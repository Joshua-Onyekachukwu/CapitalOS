#!/usr/bin/env node
/**
 * EDGAR 13F-HR XML Parser v2
 * 
 * Downloads and parses SEC 13F-HR filing XML documents to extract
 * individual partner/principal names from institutional fund managers.
 * 
 * The SEC EDGAR Full-Text Search API provides filing links.
 * 13F-HR filings contain a cover page with fund manager names and
 * sometimes individual partner/principal information.
 * 
 * Usage:
 *   node scripts/edgar-xml-parser-v2.js [--limit 100] [--offset 0] [--resume]
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const https = require("https");
const fs = require("fs");
const path = require("path");

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CHECKPOINT_FILE = path.join(__dirname, "../data-backups/edgar-parser-checkpoint.json");
const RESULTS_FILE = path.join(__dirname, "../data-backups/edgar-parsed-contacts.json");

const LIMIT = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--limit") || "50");
const OFFSET = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--offset") || "0");
const RESUME = process.argv.includes("--resume");

const EDGAR_USER_AGENT = "CapitalOS/1.0 (hello@capitalos.io)";

function fetchURL(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeout);
    https.get(url, {
      headers: {
        "User-Agent": EDGAR_USER_AGENT,
        "Accept": "application/xml,text/xml,*/*",
      },
    }, (res) => {
      clearTimeout(timer);
      if ([301, 302, 303, 307].includes(res.statusCode) && res.headers.location) {
        fetchURL(res.headers.location, timeout).then(resolve).catch(reject);
        return;
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    }).on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

function extractFromXML(xml) {
  const contacts = [];

  // Pattern 1: <coverPage> section with filer information
  const coverPattern = /<coverPage>([\s\S]*?)<\/coverPage>/gi;
  let match;
  while ((match = coverPattern.exec(xml)) !== null) {
    const cover = match[1];
    
    // Extract filer name
    const filerPattern = /<filerName>([\s\S]*?)<\/filerName>/gi;
    let filerMatch;
    while ((filerMatch = filerPattern.exec(cover)) !== null) {
      contacts.push({
        name: filerMatch[1].trim(),
        role: "Filer",
        source: "13f-cover",
      });
    }

    // Extract signatory name (the person who signed the filing)
    const signatoryPattern = /<signatoryName>([\s\S]*?)<\/signatoryName>/gi;
    let sigMatch;
    while ((sigMatch = signatoryPattern.exec(cover)) !== null) {
      contacts.push({
        name: sigMatch[1].trim(),
        role: "Signatory",
        source: "13f-signatory",
      });
    }

    // Extract authorized person
    const authPattern = /<authorizedPerson[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<\/authorizedPerson>/gi;
    let authMatch;
    while ((authMatch = authPattern.exec(cover)) !== null) {
      contacts.push({
        name: authMatch[1].trim(),
        role: authMatch[2].trim(),
        source: "13f-authorized",
      });
    }
  }

  // Pattern 2: <reportingOwner> or <primaryDoc> information
  const ownerPattern = /<reportingOwner[^>]*>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/reportingOwner>/gi;
  while ((match = ownerPattern.exec(xml)) !== null) {
    contacts.push({
      name: match[1].trim(),
      role: "Reporting Owner",
      source: "13f-owner",
    });
  }

  // Pattern 3: Individual names in <name> tags near <title> with partner/CEO/MD keywords
  const nameTitlePattern = /<name>([^<]+)<\/name>[\s\S]{0,200}?<title>([^<]*(?:Partner|Principal|Managing|Director|CEO|CTO|CIO|Chief|Head)[^<]*)<\/title>/gi;
  while ((match = nameTitlePattern.exec(xml)) !== null) {
    contacts.push({
      name: match[1].trim(),
      role: match[2].trim(),
      source: "13f-name-title",
    });
  }

  // Pattern 4: Reverse — title before name
  const titleNamePattern = /<title>([^<]*(?:Partner|Principal|Managing|Director|CEO|CTO|CIO|Chief|Head)[^<]*)<\/title>[\s\S]{0,200}?<name>([^<]+)<\/name>/gi;
  while ((match = titleNamePattern.exec(xml)) !== null) {
    contacts.push({
      name: match[2].trim(),
      role: match[1].trim(),
      source: "13f-title-name",
    });
  }

  // Pattern 5: Person names in structured data blocks
  const personPattern = /<(?:person|individual|officer|director)[^>]*>[\s\S]*?<firstName>([^<]+)<\/firstName>[\s\S]*?<lastName>([^<]+)<\/lastName>/gi;
  while ((match = personPattern.exec(xml)) !== null) {
    contacts.push({
      name: `${match[1].trim()} ${match[2].trim()}`,
      firstName: match[1].trim(),
      lastName: match[2].trim(),
      role: "Person",
      source: "13f-person",
    });
  }

  return contacts;
}

function parseName(fullName) {
  // Handle "First Last" or "First M Last" or "FIRST LAST"
  const parts = fullName.split(/\s+/);
  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  }
  return { firstName: fullName, lastName: "" };
}

function inferEmail(firstName, lastName, domain) {
  const fn = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const ln = lastName.toLowerCase().replace(/[^a-z]/g, "");
  if (!fn || !ln) return null;
  return `${fn}.${ln}@${domain}`;
}

function getDomainFromUrl(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return null; }
}

async function main() {
  const checkpoint = RESUME
    ? (() => { try { return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8")); } catch { return { lastOffset: 0, processed: 0, found: 0, errors: 0 }; } })()
    : { lastOffset: OFFSET, processed: 0, found: 0, errors: 0 };

  console.log("=".repeat(60));
  console.log("EDGAR 13F-HR XML Parser v2");
  console.log("=".repeat(60));
  console.log(`Offset: ${checkpoint.lastOffset}, Limit: ${LIMIT}\n`);

  // Get investors from 13F filings that don't have individual names yet
  const { data: investors } = await sp
    .from("investors")
    .select("id, full_name, company_name, company_website, source, source_url")
    .eq("source", "edgar-13f")
    .is("first_name", null)
    .not("company_name", "is", null)
    .range(checkpoint.lastOffset, checkpoint.lastOffset + LIMIT - 1);

  if (!investors?.length) {
    console.log("No more investors to process.");
    return;
  }

  console.log(`Processing ${investors.length} EDGAR 13F-HR filings...\n`);

  let allContacts = [];
  let processed = checkpoint.processed;
  let found = checkpoint.found;
  let errors = checkpoint.errors;

  for (let i = 0; i < investors.length; i++) {
    const inv = investors[i];
    process.stdout.write(`[${i + 1}/${investors.length}] ${inv.company_name?.substring(0, 40)}... `);

    try {
      // Try to fetch the actual SEC filing XML
      if (inv.source_url?.includes("sec.gov")) {
        const xml = await fetchURL(inv.source_url, 10000);
        if (xml && xml.includes("<")) {
          const contacts = extractFromXML(xml);
          
          if (contacts.length > 0) {
            // Get domain from company website
            const domain = getDomainFromUrl(inv.company_website);
            
            for (const contact of contacts) {
              const name = parseName(contact.name);
              const email = domain ? inferEmail(name.firstName, name.lastName, domain) : null;
              
              allContacts.push({
                fullName: contact.name,
                firstName: name.firstName,
                lastName: name.lastName,
                jobTitle: contact.role,
                companyName: inv.company_name,
                email,
                emailSource: email ? "inferred" : null,
                website: inv.company_website,
                source: "edgar-xml-parse",
                sourceId: inv.id,
                sourceUrl: inv.source_url,
              });
            }
            
            found += contacts.length;
            console.log(`✓ Found ${contacts.length} contacts`);
          } else {
            console.log("— No individual names in filing");
          }
        } else {
          console.log("— Could not fetch XML");
        }
      } else {
        // No direct SEC URL — just the firm name
        console.log("— No SEC URL");
      }
    } catch (e) {
      errors++;
      console.log(`✗ ${e.message}`);
    }

    processed++;

    // Save checkpoint every 10
    if ((i + 1) % 10 === 0) {
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({
        lastOffset: checkpoint.lastOffset + i + 1,
        processed,
        found,
        errors,
      }, null, 2));
    }

    // Rate limit — SEC requires 10 req/sec max
    await new Promise(r => setTimeout(r, 200));
  }

  // Save results
  const existing = fs.existsSync(RESULTS_FILE)
    ? JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"))
    : [];
  
  fs.writeFileSync(RESULTS_FILE, JSON.stringify([...existing, ...allContacts], null, 2));

  console.log("\n\n" + "=".repeat(60));
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`Processed: ${processed}`);
  console.log(`Contacts found: ${allContacts.length}`);
  console.log(`Total contacts: ${found}`);
  console.log(`Errors: ${errors}`);
  console.log(`Results: ${RESULTS_FILE}`);
}

main().catch(console.error);
