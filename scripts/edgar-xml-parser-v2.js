#!/usr/bin/env node
/**
 * EDGAR 13F-HR XML Parser
 * 
 * Downloads actual filing XML documents from EDGAR and extracts
 * individual partner/principal names from institutional fund managers.
 * 
 * Usage: node scripts/edgar-xml-parser-v2.js [--limit 100] [--dry-run]
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const DATA_DIR = path.join(__dirname, "..", "data-backups");
const EDGAR_DIR = path.join(DATA_DIR, "edgar-xml");
const OUTPUT_FILE = path.join(DATA_DIR, "edgar-partners.json");
const RATE_LIMIT_MS = 100; // EDGAR requires 10 req/sec max

// Parse CLI args
const args = process.argv.slice(2);
const limit = parseInt(args.find((a, i) => args[i - 1] === "--limit") || "200");
const dryRun = args.includes("--dry-run");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        "User-Agent": "CapitalOS/1.0 (research@capitalos.io)",
        "Accept": "application/xml,text/xml",
      },
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = "";
      res.on("data", (chunk) => data += chunk);
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

function parseFilingXml(xml) {
  const names = [];
  
  // Pattern 1: <nameOfIssuer> + <titleOfClass> + <cusip> + <value>
  // But we want the filer name, not the holdings
  const filerMatch = xml.match(/<filerName>([^<]+)<\/filerName>/i) 
    || xml.match(/<conformedName>([^<]+)<\/conformedName>/i);
  
  // Pattern 2: Look for <reportingOwner> or <associates>
  const ownerMatches = xml.matchAll(/<reportingOwner[^>]*>[\s\S]*?<\/reportingOwner>/gi);
  for (const match of ownerMatches) {
    const block = match[0];
    const nameMatch = block.match(/<rptOwnerName>([^<]+)<\/rptOwnerName>/i)
      || block.match(/<name>([^<]+)<\/name>/i);
    if (nameMatch) {
      names.push({
        name: nameMatch[1].trim(),
        role: "reporting_owner",
      });
    }
  }

  // Pattern 3: <associates> block
  const assocMatches = xml.matchAll(/<associates>[\s\S]*?<\/associates>/gi);
  for (const match of assocMatches) {
    const block = match[0];
    const nameMatch = block.match(/<associateName>([^<]+)<\/associateName>/i)
      || block.match(/<name>([^<]+)<\/name>/i);
    const titleMatch = block.match(/<title>([^<]+)<\/title>/i);
    if (nameMatch) {
      names.push({
        name: nameMatch[1].trim(),
        role: titleMatch ? titleMatch[1].trim() : "associate",
      });
    }
  }

  // Pattern 4: <principals> block (common in 13F)
  const principalMatches = xml.matchAll(/<principals>[\s\S]*?<\/principals>/gi);
  for (const match of principalMatches) {
    const block = match[0];
    // Extract individual principal entries
    const entries = block.matchAll(/<principal[^>]*>[\s\S]*?<\/principal>/gi);
    for (const entry of entries) {
      const entryBlock = entry[0];
      const nameMatch = entryBlock.match(/<name>([^<]+)<\/name>/i);
      const titleMatch = entryBlock.match(/<title>([^<]+)<\/title>/i);
      if (nameMatch) {
        names.push({
          name: nameMatch[1].trim(),
          role: titleMatch ? titleMatch[1].trim() : "principal",
        });
      }
    }
  }

  // Pattern 5: Generic name extraction from XML
  if (names.length === 0) {
    const genericNames = xml.matchAll(/<(?:person|officer|director|partner|member|manager|principal)[^>]*>\s*<(?:name|personName|fullName)>([^<]+)<\/(?:name|personName|fullName)>/gi);
    for (const match of genericNames) {
      const name = match[1].trim();
      if (name.length > 3 && name.length < 100 && !name.includes("<")) {
        names.push({ name, role: "extracted" });
      }
    }
  }

  return {
    filerName: filerMatch ? filerMatch[1].trim() : null,
    principals: names,
  };
}

function generateDeduplicationKey(firstName, lastName, firmName) {
  const fn = (firstName || "").toLowerCase().replace(/[^a-z]/g, "");
  const ln = (lastName || "").toLowerCase().replace(/[^a-z]/g, "");
  const firm = (firmName || "").toLowerCase().replace(/[^a-z]/g, "");
  return `${fn}.${ln}.${firm}`;
}

async function main() {
  console.log("=== EDGAR 13F-HR XML Parser ===\n");

  // Check for existing raw EDGAR data
  const edgarFiles = fs.readdirSync(EDGAR_DIR).filter(f => f.endsWith(".json"));
  console.log(`Found ${edgarFiles.length} EDGAR filing files in ${EDGAR_DIR}`);

  // Also check the main backup
  const backupFile = path.join(DATA_DIR, "edgar-backup-investors.json");
  let existingFunds = [];
  if (fs.existsSync(backupFile)) {
    existingFunds = JSON.parse(fs.readFileSync(backupFile, "utf-8"));
    console.log(`Found ${existingFunds.length} existing EDGAR fund records`);
  }

  // Load existing partners if any
  let existingPartners = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    existingPartners = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf-8"));
    console.log(`Found ${existingPartners.length} previously extracted partners`);
  }

  const existingKeys = new Set(existingPartners.map(p => p.deduplicationKey));
  const newPartners = [];
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  // Process existing EDGAR XML files
  for (const file of edgarFiles.slice(0, limit)) {
    try {
      const filePath = path.join(EDGAR_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      
      if (data.xml) {
        const parsed = parseFilingXml(data.xml);
        
        if (parsed.principals.length > 0) {
          for (const principal of parsed.principals) {
            const nameParts = principal.name.split(",").map(s => s.trim());
            let firstName = nameParts.length > 1 ? nameParts[1] : nameParts[0];
            let lastName = nameParts.length > 1 ? nameParts[0] : "";
            
            // Also handle "First Last" format
            if (!principal.name.includes(",")) {
              const spaceParts = principal.name.split(" ");
              firstName = spaceParts[0];
              lastName = spaceParts.slice(1).join(" ");
            }

            const dedupKey = generateDeduplicationKey(firstName, lastName, parsed.filerName);
            
            if (!existingKeys.has(dedupKey)) {
              existingKeys.add(dedupKey);
              newPartners.push({
                firstName,
                lastName,
                fullName: principal.name,
                firmName: parsed.filerName || data.companyName || null,
                role: principal.role,
                source: "edgar_13f_hr",
                sourceUrl: data.filingUrl || null,
                sourceId: data.accessionNumber || file,
                scrapedAt: new Date().toISOString(),
                deduplicationKey: dedupKey,
                status: "scraped",
                dataQualityScore: parsed.filerName ? 60 : 30,
                confidence: 70,
                retryCount: 0,
                emailVerified: false,
              });
            } else {
              skipped++;
            }
          }
        }
        processed++;
      }
    } catch (err) {
      errors++;
      if (errors <= 5) console.error(`  Error processing ${file}: ${err.message}`);
    }

    if (processed % 50 === 0 && processed > 0) {
      console.log(`  Processed: ${processed}, New: ${newPartners.length}, Skipped: ${skipped}, Errors: ${errors}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  // Also try to extract partners from the raw fund records
  console.log("\nExtracting partners from existing fund records...");
  for (const fund of existingFunds.slice(0, limit * 10)) {
    if (!fund.companyName && !fund.filer_name) continue;
    
    const fundName = fund.companyName || fund.filer_name || "";
    // Extract individual names from any name fields
    const nameFields = [fund.contactName, fund.personName, fund.officerName].filter(Boolean);
    
    for (const nameField of nameFields) {
      const nameParts = nameField.split(",").map(s => s.trim());
      let firstName = nameParts.length > 1 ? nameParts[1] : nameParts[0];
      let lastName = nameParts.length > 1 ? nameParts[0] : "";
      
      if (!nameField.includes(",")) {
        const spaceParts = nameField.split(" ");
        firstName = spaceParts[0];
        lastName = spaceParts.slice(1).join(" ");
      }

      const dedupKey = generateDeduplicationKey(firstName, lastName, fundName);
      
      if (!existingKeys.has(dedupKey)) {
        existingKeys.add(dedupKey);
        newPartners.push({
          firstName,
          lastName,
          fullName: nameField,
          firmName: fundName,
          role: "fund_principal",
          source: "edgar_fund_record",
          sourceUrl: null,
          sourceId: fund.id || null,
          scrapedAt: new Date().toISOString(),
          deduplicationKey: dedupKey,
          status: "scraped",
          dataQualityScore: 40,
          confidence: 50,
          retryCount: 0,
          emailVerified: false,
        });
      }
    }
  }

  // Combine and save
  const allPartners = [...existingPartners, ...newPartners];
  
  if (!dryRun) {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allPartners, null, 2));
    console.log(`\nSaved ${allPartners.length} total partners to ${OUTPUT_FILE}`);
  } else {
    console.log(`\n[DRY RUN] Would save ${allPartners.length} total partners`);
  }

  console.log("\n=== Results ===");
  console.log(`Processed: ${processed} XML files`);
  console.log(`New partners extracted: ${newPartners.length}`);
  console.log(`Skipped (duplicates): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total partners: ${allPartners.length}`);
  
  // Summary by role
  const roleCounts = {};
  for (const p of newPartners) {
    roleCounts[p.role] = (roleCounts[p.role] || 0) + 1;
  }
  console.log("\nBy role:");
  for (const [role, count] of Object.entries(roleCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${role}: ${count}`);
  }
}

main().catch(console.error);
