#!/usr/bin/env node
/**
 * Capital OS — Enhanced EDGAR Scraper
 * =====================================
 * Parses 13F-HR XML filings to extract:
 * - Portfolio companies (individual stock holdings)
 * - Investment amounts and positions
 * - Filing dates and amendments
 * - Fund names and CIKs
 * 
 * Also scrapes Form D for private placement data.
 * 
 * Usage:
 *   node scripts/edgar-enhanced.js              # Full scrape
 *   node scripts/edgar-enhanced.js --13f        # 13F-HR only
 *   node scripts/edgar-enhanced.js --form-d     # Form D only
 *   node scripts/edgar-enhanced.js --days 365   # Last year only
 *   node scripts/edgar-enhanced.js --stats      # Show stats
 *   node scripts/edgar-enhanced.js --enrich     # Enrich existing records
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKUP_DIR = path.join(__dirname, "../backups/edgar");

// EDGAR API endpoints
const EFTS_SEARCH = "https://efts.sec.gov/LATEST/search-index";
const EDGAR_FULL_TEXT = "https://efts.sec.gov/LATEST/search-index?q=%2213F-HR%22&dateRange=custom";
const EDGAR_FILINGS = "https://www.sec.gov/cgi-bin/browse-edgar";
const EDGAR_ARCHIVES = "https://www.sec.gov/Archives/edgar/data";
const SEC_HEADERS = { "User-Agent": "CapitalOS/1.0 (research@capitalos.io)" };

// Rate limit: SEC asks for 10 requests/second max
const DELAY_MS = 150;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function today() { return new Date().toISOString().split("T")[0]; }

// ══════════════════════════════════════════════════════════════
// 13F-HR: Parse XML holdings to get portfolio companies
// ══════════════════════════════════════════════════════════════

async function fetch13F_filings(days = 3650) {
  console.log("📋 Fetching 13F-HR filings from EDGAR EFTS...");
  
  const endDate = today();
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  
  // Search for 13F-HR filings
  const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%2213F-HR%22&dateRange=custom&startdt=${startDate}&enddt=${endDate}&forms=13F-HR`;
  
  let allFilings = [];
  let start = 0;
  const pageSize = 100;
  
  while (true) {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%2213F-HR%22&forms=13F-HR&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${start}&size=${pageSize}`;
    
    try {
      const res = await fetch(url, { headers: SEC_HEADERS });
      if (!res.ok) {
        // Fallback: use the older API
        console.log("   Trying alternative EDGAR API...");
        break;
      }
      const data = await res.json();
      const hits = data.hits?.hits || [];
      if (hits.length === 0) break;
      
      for (const hit of hits) {
        const src = hit._source;
        allFilings.push({
          cik: src.entity_id || src.file_num,
          name: src.display_names?.[0] || src.entity_name,
          date: src.file_date,
          url: src.file_url,
          form: src.form_type,
        });
      }
      
      start += pageSize;
      if (start >= (data.hits?.total?.value || 0)) break;
      await sleep(DELAY_MS);
    } catch (e) {
      console.log(`   ⚠️ EFTS error: ${e.message}`);
      break;
    }
  }
  
  // If EFTS didn't work, use the full-text search
  if (allFilings.length === 0) {
    console.log("   Using EDGAR full-text search...");
    allFilings = await fetch13F_viaSearch(startDate, endDate);
  }
  
  console.log(`   Found ${allFilings.length} 13F-HR filings`);
  return allFilings;
}

async function fetch13F_viaSearch(startDate, endDate) {
  const filings = [];
  
  // Use the EDGAR company search for 13F-HR
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=13F-HR&dateb=&owner=include&count=100&search_text=&action=getcompany`;
  
  try {
    const res = await fetch(url, { headers: { ...SEC_HEADERS, Accept: "application/json" } });
    if (res.ok) {
      const text = await res.text();
      // Parse the HTML response for CIK numbers
      const cikMatches = text.match(/CIK=(\d+)/g) || [];
      console.log(`   Found ${cikMatches.length} companies from EDGAR`);
    }
  } catch (e) {
    console.log(`   ⚠️ Search error: ${e.message}`);
  }
  
  return filings;
}

async function parse13F_xml(cik, filingUrl) {
  try {
    // Get the filing index page
    const indexRes = await fetch(filingUrl, { headers: SEC_HEADERS });
    if (!indexRes.ok) return null;
    
    const html = await indexRes.text();
    
    // Find the primary XML document
    const xmlMatch = html.match(/href="(\/Archives\/edgar\/data\/[^"]+\.xml)"/);
    if (!xmlMatch) return null;
    
    const xmlUrl = `https://www.sec.gov${xmlMatch[1]}`;
    await sleep(DELAY_MS);
    
    const xmlRes = await fetch(xmlUrl, { headers: SEC_HEADERS });
    if (!xmlRes.ok) return null;
    
    const xml = await xmlRes.text();
    return parseHoldingsFromXml(xml);
  } catch (e) {
    return null;
  }
}

function parseHoldingsFromXml(xml) {
  const holdings = [];
  
  // Parse <infotable> entries
  const entryRegex = /<infotable>([\s\S]*?)<\/infotable>/g;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    
    const nameOfIssuer = extractTag(entry, "nameofissuer");
    const cusip = extractTag(entry, "cusip");
    const value = extractTag(entry, "value");
    const sshPrnamt = extractTag(entry, "sshprnamt");
    const sshPrnamtType = extractTag(entry, "sshprnamttype");
    const investmentDiscretion = extractTag(entry, "investmentdiscretion");
    const votingAuthority = extractTag(entry, "votingauthority");
    
    if (nameOfIssuer) {
      holdings.push({
        company_name: nameOfIssuer,
        cusip,
        value_thousands: parseInt(value) || 0,
        shares: parseInt(sshPrnamt) || 0,
        share_type: sshPrnamtType, // SH = shares, PRN = principal
        investment_discretion: investmentDiscretion,
      });
    }
  }
  
  // Also try the newer XML format
  const newEntryRegex = /<ns1:infoTable>([\s\S]*?)<\/ns1:infoTable>/g;
  while ((match = newEntryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const nameOfIssuer = extractTag(entry, "ns1:nameOfIssuer") || extractTag(entry, "nameofissuer");
    const cusip = extractTag(entry, "ns1:cusip") || extractTag(entry, "cusip");
    const value = extractTag(entry, "ns1:value") || extractTag(entry, "value");
    const sshPrnamt = extractTag(entry, "ns1:sshPrnamt") || extractTag(entry, "sshprnamt");
    
    if (nameOfIssuer) {
      holdings.push({
        company_name: nameOfIssuer,
        cusip,
        value_thousands: parseInt(value) || 0,
        shares: parseInt(sshPrnamt) || 0,
      });
    }
  }
  
  return holdings;
}

function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

// ══════════════════════════════════════════════════════════════
// Form D: Private placement filings
// ══════════════════════════════════════════════════════════════

async function fetchFormD_filings(days = 3650) {
  console.log("📋 Fetching Form D filings from EDGAR...");
  
  const endDate = today();
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  
  const filings = [];
  let start = 0;
  const pageSize = 100;
  
  while (true) {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22FORM-D%22&forms=D&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${start}&size=${pageSize}`;
    
    try {
      const res = await fetch(url, { headers: SEC_HEADERS });
      if (!res.ok) break;
      
      const data = await res.json();
      const hits = data.hits?.hits || [];
      if (hits.length === 0) break;
      
      for (const hit of hits) {
        const src = hit._source;
        filings.push({
          cik: src.entity_id,
          name: src.display_names?.[0] || src.entity_name,
          date: src.file_date,
          url: src.file_url,
        });
      }
      
      start += pageSize;
      if (start >= (data.hits?.total?.value || 0)) break;
      await sleep(DELAY_MS);
    } catch (e) {
      console.log(`   ⚠️ Form D error: ${e.message}`);
      break;
    }
  }
  
  console.log(`   Found ${filings.length} Form D filings`);
  return filings;
}

// ══════════════════════════════════════════════════════════════
// Insert into Supabase
// ══════════════════════════════════════════════════════════════

async function insertInvestors(records) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing Supabase credentials");
    return { inserted: 0, failed: records.length };
  }
  
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
      
      if (res.ok) {
        inserted += batch.length;
      } else {
        const err = await res.text();
        failed += batch.length;
        if (failed <= BATCH * 2) {
          console.log(`   ❌ Batch error: ${err.slice(0, 150)}`);
        }
      }
    } catch (e) {
      failed += batch.length;
    }
    
    process.stdout.write(`\r   📤 ${Math.min(i + BATCH, records.length)}/${records.length} (${inserted} ok, ${failed} failed)`);
  }
  
  console.log();
  return { inserted, failed };
}

// ══════════════════════════════════════════════════════════════
// Backup to disk
// ══════════════════════════════════════════════════════════════

function saveBackup(data, filename) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const jsonPath = path.join(BACKUP_DIR, `${filename}.json`);
  const csvPath = path.join(BACKUP_DIR, `${filename}.csv`);
  
  // Save JSON
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  
  // Save CSV
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
  
  console.log(`   💾 Saved: ${jsonPath} (${(fs.statSync(jsonPath).size / 1024).toFixed(0)}KB)`);
  console.log(`   💾 Saved: ${csvPath} (${(fs.statSync(csvPath).size / 1024).toFixed(0)}KB)`);
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const do13f = args.includes("--13f") || args.length === 0 || args.includes("--full");
  const doFormD = args.includes("--form-d") || args.length === 0 || args.includes("--full");
  const showStats = args.includes("--stats");
  const daysIdx = args.indexOf("--days");
  const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1]) : 3650; // Default 10 years
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — Enhanced EDGAR Scraper");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  if (showStats) {
    // Show what we have
    const res = await fetch(`${SUPABASE_URL}/rest/v1/investors?select=id`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "count=exact" }
    });
    console.log(`📊 Total investors in Supabase: ${res.headers.get("content-range")}`);
    return;
  }
  
  const allInvestors = [];
  
  // ── 13F-HR ──
  if (do13f) {
    console.log("━━━ 13F-HR INSTITUTIONAL INVESTORS ━━━\n");
    const filings = await fetch13F_filings(days);
    
    // Get unique filers
    const filers = new Map();
    for (const f of filings) {
      if (f.cik && !filers.has(f.cik)) {
        filers.set(f.cik, f);
      }
    }
    
    console.log(`   Unique filers: ${filers.size}`);
    console.log(`   Parsing top 200 for portfolio data...\n`);
    
    let parsed = 0;
    let withHoldings = 0;
    
    for (const [cik, filing] of [...filers.entries()].slice(0, 200)) {
      const holdings = await parse13F_xml(cik, filing.url);
      parsed++;
      
      const investor = {
        full_name: filing.name || `Fund ${cik}`,
        first_name: null,
        last_name: null,
        job_title: "Institutional Investor",
        investor_type: "institutional_investor",
        company_name: filing.name,
        company_website: null,
        linkedin_url: null,
        personal_website: null,
        country: "United States",
        city: null,
        location: null,
        email: null,
        phone: null,
        min_check_size: null,
        max_check_size: null,
        fund_size: null,
        aum: null,
        investment_stages: ["series_a", "series_b", "growth"],
        investment_sectors: [],
        investment_geographies: ["united_states"],
        investment_thesis: null,
        number_of_investments: holdings ? holdings.length : 0,
        number_of_exits: 0,
        last_investment_date: filing.date,
        fit_score: 0,
        data_quality_score: holdings ? 70 : 40,
        outreach_readiness: "needs_verification",
        is_verified: false,
        source: "edgar_13f_hr",
        source_id: cik,
        source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F-HR`,
        source_name: "SEC EDGAR",
        date_scraped: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        // Enhanced fields from 13F-HR
        number_of_portfolio_companies: holdings ? holdings.length : 0,
        portfolio_companies: holdings ? holdings.slice(0, 50).map(h => h.company_name) : [],
        total_capital_invested: holdings ? holdings.reduce((sum, h) => sum + (h.value_thousands || 0), 0) * 1000 : null,
        typical_check_size: null,
        lead_investor: true,
        currently_active: true,
        currently_deploying_capital: true,
        investment_activity_score: holdings && holdings.length > 10 ? 80 : holdings && holdings.length > 0 ? 60 : 30,
        contactability_score: 20, // No email from SEC
        funding_capacity_score: holdings && holdings.length > 20 ? 85 : holdings && holdings.length > 5 ? 60 : 30,
        overall_lead_score: 0,
        founded_year: null,
        fund_type: "hedge_fund",
        investment_frequency: "active",
      };
      
      // Calculate overall lead score
      investor.overall_lead_score = Math.round(
        (investor.investment_activity_score * 0.3) +
        (investor.funding_capacity_score * 0.3) +
        (investor.contactability_score * 0.2) +
        (investor.data_quality_score * 0.2)
      );
      
      // Determine investor rating
      if (investor.overall_lead_score >= 80) investor.investor_rating = "A";
      else if (investor.overall_lead_score >= 60) investor.investor_rating = "B";
      else if (investor.overall_lead_score >= 40) investor.investor_rating = "C";
      else investor.investor_rating = "D";
      
      allInvestors.push(investor);
      if (holdings && holdings.length > 0) withHoldings++;
      
      process.stdout.write(`\r   Parsed ${parsed}/200 (${withHoldings} with portfolio data)`);
      await sleep(DELAY_MS);
    }
    
    console.log(`\n\n   ✅ 13F-HR: ${allInvestors.length} investors (${withHoldings} with portfolio data)`);
    
    // Backup
    saveBackup(allInvestors, `13f-hr-enhanced-${today()}`);
  }
  
  // ── Form D ──
  if (doFormD) {
    console.log("\n━━━ FORM D PRIVATE PLACEMENT INVESTORS ━━━\n");
    const filings = await fetchFormD_filings(days);
    
    const formDInvestors = [];
    const seen = new Set();
    
    for (const filing of filings.slice(0, 500)) {
      if (seen.has(filing.cik)) continue;
      seen.add(filing.cik);
      
      const investor = {
        full_name: filing.name || `Fund ${filing.cik}`,
        first_name: null,
        last_name: null,
        job_title: "Private Fund Manager",
        investor_type: "private_equity",
        company_name: filing.name,
        company_website: null,
        linkedin_url: null,
        personal_website: null,
        country: "United States",
        city: null,
        location: null,
        email: null,
        phone: null,
        min_check_size: null,
        max_check_size: null,
        fund_size: null,
        aum: null,
        investment_stages: ["seed", "series_a"],
        investment_sectors: [],
        investment_geographies: ["united_states"],
        investment_thesis: null,
        number_of_investments: 0,
        number_of_exits: 0,
        last_investment_date: filing.date,
        fit_score: 0,
        data_quality_score: 45,
        outreach_readiness: "needs_verification",
        is_verified: false,
        source: "edgar_form_d",
        source_id: filing.cik,
        source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${filing.cik}&type=D`,
        source_name: "SEC EDGAR",
        date_scraped: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        
        currently_active: true,
        currently_deploying_capital: true,
        contactability_score: 15,
        funding_capacity_score: 50,
        investment_activity_score: 55,
        overall_lead_score: 0,
        fund_type: "private_fund",
      };
      
      investor.overall_lead_score = Math.round(
        (investor.investment_activity_score * 0.3) +
        (investor.funding_capacity_score * 0.3) +
        (investor.contactability_score * 0.2) +
        (investor.data_quality_score * 0.2)
      );
      
      formDInvestors.push(investor);
      process.stdout.write(`\r   Processed ${formDInvestors.length}/${Math.min(filings.length, 500)}`);
    }
    
    allInvestors.push(...formDInvestors);
    
    console.log(`\n\n   ✅ Form D: ${formDInvestors.length} investors`);
    
    // Backup
    saveBackup(formDInvestors, `form-d-enhanced-${today()}`);
  }
  
  // ── Insert into Supabase ──
  if (allInvestors.length > 0) {
    console.log(`\n━━━ INSERTING INTO SUPABASE ━━━\n`);
    console.log(`   Total investors to insert: ${allInvestors.length}`);
    
    const result = await insertInvestors(allInvestors);
    
    console.log(`\n\n✅ COMPLETE!`);
    console.log(`   Inserted: ${result.inserted}`);
    console.log(`   Failed: ${result.failed}`);
    console.log(`   Total in batch: ${allInvestors.length}`);
  }
  
  // ── Stats ──
  console.log(`\n━━━ FINAL STATS ━━━\n`);
  const statsRes = await fetch(`${SUPABASE_URL}/rest/v1/investors?select=id`, {
    headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "count=exact" }
  });
  console.log(`   Total in Supabase: ${statsRes.headers.get("content-range")}`);
  console.log(`   Backups saved to: ${BACKUP_DIR}`);
}

main().catch(err => {
  console.error("\n💥 Fatal:", err.message);
  process.exit(1);
});
