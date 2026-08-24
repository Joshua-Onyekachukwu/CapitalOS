#!/usr/bin/env node
/**
 * Capital OS — ADV Filing Scraper
 * =================================
 * Scrapes Form ADV filings from SEC EDGAR for Registered Investment Advisors (RIAs).
 * 
 * Form ADV contains:
 * - Firm name, CRD number, SEC file number
 * - AUM (assets under management)
 * - Number of clients and accounts
 * - Investment strategies and types
 * - Geographic focus
 * - Fee structures
 * - Disciplinary history
 * 
 * ADV Part 1: Basic firm info, AUM, clients
 * ADV Part 2A: Brochure (investment strategy, fees, conflicts)
 * 
 * Usage:
 *   node scripts/scraper-adv.js              # Full scrape
 *   node scripts/scraper-adv.js --limit 50   # First 50 firms
 *   node scripts/scraper-adv.js --stats      # Show stats
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKUP_DIR = path.join(__dirname, "../backups/adv");

const SEC_HEADERS = { "User-Agent": "CapitalOS/1.0 (research@capitalos.io)" };
const DELAY_MS = 200;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function today() { return new Date().toISOString().split("T")[0]; }

// ══════════════════════════════════════════════════════════════
// Step 1: Find ADV filings from EDGAR
// ══════════════════════════════════════════════════════════════

async function findADV_filings(days = 365) {
  console.log("📋 Searching EDGAR for ADV filings...");
  
  const endDate = today();
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  
  const allFilings = [];
  let start = 0;
  const pageSize = 100;
  
  while (true) {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22FORM-ADV%22&forms=ADV-W,ADV&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${start}&size=${pageSize}`;
    
    try {
      const res = await fetch(url, { headers: SEC_HEADERS });
      if (!res.ok) break;
      
      const data = await res.json();
      const hits = data.hits?.hits || [];
      if (hits.length === 0) break;
      
      for (const hit of hits) {
        const src = hit._source;
        allFilings.push({
          cik: src.entity_id,
          name: src.display_names?.[0] || src.entity_name || "Unknown",
          date: src.file_date,
          url: src.file_url,
          form: src.form_type,
        });
      }
      
      console.log(`   Fetched ${allFilings.length} filings...`);
      start += pageSize;
      
      if (start >= (data.hits?.total?.value || 0)) break;
      await sleep(DELAY_MS);
    } catch (e) {
      console.log(`   ⚠️ Error: ${e.message}`);
      break;
    }
  }
  
  // Also search for ADV/CRD directly
  if (allFilings.length === 0) {
    console.log("   Trying alternative ADV search...");
    const altUrl = `https://efts.sec.gov/LATEST/search-index?q=%22ADV%22&forms=ADV&dateRange=custom&startdt=${startDate}&enddt=${endDate}`;
    try {
      const res = await fetch(altUrl, { headers: SEC_HEADERS });
      if (res.ok) {
        const data = await res.json();
        const hits = data.hits?.hits || [];
        for (const hit of hits) {
          const src = hit._source;
          allFilings.push({
            cik: src.entity_id,
            name: src.display_names?.[0] || src.entity_name || "Unknown",
            date: src.file_date,
            url: src.file_url,
          });
        }
      }
    } catch {}
  }
  
  // Deduplicate by CIK
  const filersMap = new Map();
  for (const f of allFilings) {
    if (f.cik && !filersMap.has(f.cik)) {
      filersMap.set(f.cik, f);
    }
  }
  
  const uniqueFilers = [...filersMap.values()];
  console.log(`   Found ${uniqueFilers.length} unique RIA firms`);
  
  return uniqueFilers;
}

// ══════════════════════════════════════════════════════════════
// Step 2: Parse ADV XML/HTML for firm details
// ══════════════════════════════════════════════════════════════

async function parseADV_Filing(cik, filingUrl) {
  try {
    const indexRes = await fetch(filingUrl, { headers: SEC_HEADERS });
    if (!indexRes.ok) return null;
    
    const html = await indexRes.text();
    
    // Find XML or HTML document
    const docPatterns = [
      /href="(\/Archives\/edgar\/data\/[^"]*\.xml)"/,
      /href="(\/Archives\/edgar\/data\/[^"]*\.htm[l]?")/,
    ];
    
    let docUrl = null;
    for (const pattern of docPatterns) {
      const match = html.match(pattern);
      if (match) {
        docUrl = `https://www.sec.gov${match[1]}`;
        break;
      }
    }
    
    if (!docUrl) return null;
    
    await sleep(DELAY_MS);
    
    const docRes = await fetch(docUrl, { headers: SEC_HEADERS });
    if (!docRes.ok) return null;
    
    const content = await docRes.text();
    return extractADV_Data(content, cik);
  } catch {
    return null;
  }
}

function extractADV_Data(content, cik) {
  const data = {
    cik,
    firmName: null,
    crdNumber: null,
    secFileNumber: null,
    aum: null,
    totalClients: null,
    totalAccounts: null,
    numberOfEmployees: null,
    headquarters: null,
    state: null,
    country: "United States",
    investmentStrategies: [],
    typesOfClients: [],
    feeStructure: null,
    hasDisciplinaryHistory: false,
    yearFounded: null,
  };
  
  // Extract firm name
  data.firmName = extractTag(content, "firmName") ||
                  extractTag(content, "BusinessName") ||
                  extractTag(content, "EntityName");
  
  // Extract CRD number
  data.crdNumber = extractTag(content, "CRDNumber") ||
                   extractTag(content, "crdNumber") ||
                   extractTag(content, "FirmCRDNumber");
  
  // Extract AUM (in various formats)
  const aumStr = extractTag(content, "totalAssets") ||
                 extractTag(content, "AUM") ||
                 extractTag(content, "assetsUnderManagement");
  if (aumStr) {
    data.aum = parseDollarAmount(aumStr);
  }
  
  // Extract client count
  const clientStr = extractTag(content, "totalClients") ||
                    extractTag(content, "numberOfClients");
  if (clientStr) data.totalClients = parseInt(clientStr.replace(/[^0-9]/g, ""));
  
  // Extract account count
  const accountStr = extractTag(content, "totalAccounts") ||
                     extractTag(content, "numberOfAccounts");
  if (accountStr) data.totalAccounts = parseInt(accountStr.replace(/[^0-9]/g, ""));
  
  // Extract employees
  const empStr = extractTag(content, "numberOfEmployees") ||
                 extractTag(content, "employees");
  if (empStr) data.numberOfEmployees = parseInt(empStr.replace(/[^0-9]/g, ""));
  
  // Extract location
  data.headquarters = extractTag(content, "city") || extractTag(content, "City");
  data.state = extractTag(content, "state") || extractTag(content, "State") ||
               extractTag(content, "StateCode");
  
  // Extract investment strategies
  const strategyMatches = content.match(/<[^>]*strategy[^>]*>([^<]+)<\/[^>]*>/gi) || [];
  data.investmentStrategies = strategyMatches.map(m => {
    const match = m.match(/>([^<]+)</);
    return match ? match[1].trim() : null;
  }).filter(Boolean).slice(0, 5);
  
  // Extract types of clients
  const clientTypeMatches = content.match(/<[^>]*clientType[^>]*>([^<]+)<\/[^>]*>/gi) || [];
  data.typesOfClients = clientTypeMatches.map(m => {
    const match = m.match(/>([^<]+)</);
    return match ? match[1].trim() : null;
  }).filter(Boolean).slice(0, 5);
  
  // Check for disciplinary history
  data.hasDisciplinaryHistory = content.includes("disciplinary") && 
    (content.includes("yes") || content.includes("Yes") || content.includes("YES"));
  
  // Extract year founded
  const yearStr = extractTag(content, "yearFounded") || extractTag(content, "yearEstablished");
  if (yearStr) data.yearFounded = parseInt(yearStr);
  
  return data;
}

function parseDollarAmount(str) {
  const cleaned = str.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;
  
  // Handle billions/millions
  if (str.toLowerCase().includes("billion")) return num * 1000000000;
  if (str.toLowerCase().includes("million")) return num * 1000000;
  
  return num;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

// ══════════════════════════════════════════════════════════════
// Step 3: Create Supabase investor record
// ══════════════════════════════════════════════════════════════

function advToInvestor(advData) {
  const investor = {
    full_name: advData.firmName || `RIA ${advData.cik}`,
    first_name: null,
    last_name: null,
    job_title: "Registered Investment Advisor",
    investor_type: "institutional_investor",
    investor_subtype: "ria",
    company_name: advData.firmName,
    company_website: null,
    linkedin_url: null,
    personal_website: null,
    country: advData.country || "United States",
    city: advData.headquarters,
    location: advData.state ? `${advData.headquarters}, ${advData.state}` : advData.headquarters,
    email: null,
    phone: null,
    
    // AUM and capacity
    fund_size: advData.aum,
    aum: advData.aum,
    typical_check_size: advData.aum ? advData.aum * 0.01 : null, // Assume 1% position size
    
    // Focus
    investment_stages: ["series_a", "series_b", "growth"],
    investment_sectors: advData.investmentStrategies,
    investment_geographies: ["united_states"],
    
    // History
    number_of_investments: advData.totalAccounts || 0,
    number_of_exits: 0,
    
    // Status
    fit_score: 0,
    data_quality_score: 50,
    outreach_readiness: "needs_verification",
    is_verified: false,
    
    // Source
    source: "sec_adv",
    source_id: advData.cik,
    source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${advData.cik}`,
    source_name: "SEC EDGAR ADV",
    date_scraped: new Date().toISOString(),
    
    // Enhanced fields
    currently_active: true,
    currently_deploying_capital: true,
    number_of_employees: advData.numberOfEmployees,
    founded_year: advData.yearFounded,
    headquarters: advData.headquarters,
    fund_type: "ria",
    number_of_portfolio_companies: advData.totalAccounts || 0,
    
    // Scoring
    investment_activity_score: advData.totalAccounts ? 70 : 40,
    funding_capacity_score: advData.aum ? (advData.aum > 1000000000 ? 90 : advData.aum > 100000000 ? 75 : 50) : 30,
    contactability_score: 20,
    overall_lead_score: 0,
    
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  // Calculate overall lead score
  investor.overall_lead_score = Math.round(
    (investor.investment_activity_score * 0.3) +
    (investor.funding_capacity_score * 0.3) +
    (investor.contactability_score * 0.2) +
    (investor.data_quality_score * 0.2)
  );
  
  // Rating
  if (investor.overall_lead_score >= 80) investor.investor_rating = "A";
  else if (investor.overall_lead_score >= 60) investor.investor_rating = "B";
  else if (investor.overall_lead_score >= 40) investor.investor_rating = "C";
  else investor.investor_rating = "D";
  
  return investor;
}

// ══════════════════════════════════════════════════════════════
// Step 4: Insert into Supabase
// ══════════════════════════════════════════════════════════════

async function insertInvestors(records) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { inserted: 0, failed: records.length };
  
  let inserted = 0;
  let failed = 0;
  const BATCH = 50;
  
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/investors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify(batch),
      });
      
      if (res.ok) inserted += batch.length;
      else failed += batch.length;
    } catch {
      failed += batch.length;
    }
    
    process.stdout.write(`\r   📤 ${Math.min(i + BATCH, records.length)}/${records.length} (${inserted} ok, ${failed} failed)`);
  }
  
  console.log();
  return { inserted, failed };
}

// ══════════════════════════════════════════════════════════════
// Backup
// ══════════════════════════════════════════════════════════════

function saveBackup(data, filename) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  
  const jsonPath = path.join(BACKUP_DIR, `${filename}.json`);
  const csvPath = path.join(BACKUP_DIR, `${filename}.csv`);
  
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    const csvLines = [headers.join(",")];
    for (const row of data) {
      csvLines.push(headers.map(h => {
        const val = row[h];
        if (Array.isArray(val)) return `"${val.join("; ")}"`;
        if (val === null || val === undefined) return "";
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(","));
    }
    fs.writeFileSync(csvPath, csvLines.join("\n"));
  }
  
  console.log(`   💾 JSON: ${jsonPath} (${(fs.statSync(jsonPath).size / 1024).toFixed(0)}KB)`);
  console.log(`   💾 CSV: ${csvPath}`);
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 200;
  const daysIdx = args.indexOf("--days");
  const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1]) : 365;
  const showStats = args.includes("--stats");
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — ADV Filing Scraper (Registered Investment Advisors)");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  if (showStats) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/investors?source=eq.sec_adv&select=id`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "count=exact" }
    });
    console.log(`📊 ADV investors in Supabase: ${res.headers.get("content-range")}`);
    return;
  }
  
  // Find ADV filings
  const filers = await findADV_filings(days);
  console.log(`\n📊 Processing ${Math.min(filers.length, limit)} RIA firms...\n`);
  
  const allInvestors = [];
  let processed = 0;
  
  for (const filer of filers.slice(0, limit)) {
    const filingUrl = filer.url || `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filer.cik}&type=ADV&dateb=&owner=include&count=1`;
    
    await sleep(DELAY_MS);
    const advData = await parseADV_Filing(filer.cik, filingUrl);
    processed++;
    
    if (advData && advData.firmName) {
      const investor = advToInvestor(advData);
      allInvestors.push(investor);
      
      process.stdout.write(`\r   ${processed}/${limit} — ${advData.firmName.slice(0, 35)} (AUM: $${advData.aum ? (advData.aum / 1000000).toFixed(0) + 'M' : '?'})`);
    } else {
      // Use filing name as fallback
      const investor = advToInvestor({
        cik: filer.cik,
        firmName: filer.name,
      });
      allInvestors.push(investor);
      
      process.stdout.write(`\r   ${processed}/${limit} — ${filer.name.slice(0, 35)} (basic)`);
    }
  }
  
  console.log(`\n\n━━━ INSERTING INTO SUPABASE ━━━\n`);
  console.log(`   Total RIA firms: ${allInvestors.length}`);
  
  const result = await insertInvestors(allInvestors);
  
  // Backup
  saveBackup(allInvestors, `adv-rias-${today()}`);
  
  console.log(`\n✅ ADV scraping complete!`);
  console.log(`   Inserted: ${result.inserted}`);
  console.log(`   Failed: ${result.failed}`);
  console.log(`   Total: ${allInvestors.length}`);
  
  // Show top by AUM
  const top5 = allInvestors
    .filter(i => i.aum)
    .sort((a, b) => (b.aum || 0) - (a.aum || 0))
    .slice(0, 5);
  
  if (top5.length > 0) {
    console.log(`\n🏆 Top 5 RIAs by AUM:`);
    for (const r of top5) {
      console.log(`   ${r.company_name}: $${(r.aum / 1000000000).toFixed(1)}B AUM`);
    }
  }
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
}

main().catch(err => {
  console.error("\n💥 Fatal:", err.message);
  process.exit(1);
});
