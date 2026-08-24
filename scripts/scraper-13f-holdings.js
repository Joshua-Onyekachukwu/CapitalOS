#!/usr/bin/env node
/**
 * Capital OS — 13F-HR XML Holdings Parser
 * =========================================
 * Parses actual 13F-HR XML filings from SEC EDGAR to extract:
 * - Individual stock holdings (company name, CUSIP, shares, value)
 * - Portfolio composition and concentration
 * - Investment amounts and position sizes
 * - Filing dates and amendment history
 * 
 * 13F-HR is filed quarterly by institutional investors with >$100M AUM.
 * Each filing lists EVERY stock position — giving us real portfolio data.
 * 
 * Usage:
 *   node scripts/scraper-13f-holdings.js              # Full scrape
 *   node scripts/scraper-13f-holdings.js --limit 50   # First 50 filers
 *   node scripts/scraper-13f-holdings.js --cik 12345  # Specific CIK
 *   node scripts/scraper-13f-holdings.js --stats       # Show stats
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKUP_DIR = path.join(__dirname, "../backups/13f-holdings");

const SEC_HEADERS = { "User-Agent": "CapitalOS/1.0 (research@capitalos.io)" };
const DELAY_MS = 200; // SEC rate limit: 10 req/sec

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function today() { return new Date().toISOString().split("T")[0]; }

// ══════════════════════════════════════════════════════════════
// Step 1: Find recent 13F-HR filings from EDGAR
// ══════════════════════════════════════════════════════════════

async function findRecent13F_Filings(days = 365) {
  console.log("📋 Searching EDGAR for recent 13F-HR filings...");
  
  const endDate = today();
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];
  
  // Use EDGAR full-text search API
  const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%2213F-HR%22&forms=13F-HR&dateRange=custom&startdt=${startDate}&enddt=${endDate}`;
  
  let allFilings = [];
  let start = 0;
  const pageSize = 100;
  
  while (true) {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%2213F-HR%22&forms=13F-HR&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${start}&size=${pageSize}`;
    
    try {
      const res = await fetch(url, { headers: SEC_HEADERS });
      if (!res.ok) {
        console.log(`   ⚠️ EFTS returned ${res.status}, trying alternative...`);
        break;
      }
      
      const data = await res.json();
      const hits = data.hits?.hits || [];
      if (hits.length === 0) break;
      
      for (const hit of hits) {
        const src = hit._source;
        allFilings.push({
          cik: src.entity_id || src.file_num,
          name: src.display_names?.[0] || src.entity_name || "Unknown",
          date: src.file_date,
          url: src.file_url,
          form: src.form_type,
        });
      }
      
      console.log(`   Fetched ${allFilings.length} filings...`);
      start += pageSize;
      
      // Cap at 1000 filings to avoid excessive API calls
      if (allFilings.length >= 1000) break;
      const total = data.hits?.total?.value || 0;
      if (start >= total) break;
      
      await sleep(DELAY_MS);
    } catch (e) {
      console.log(`   ⚠️ Error: ${e.message}`);
      break;
    }
  }
  
  // Deduplicate by CIK (keep most recent filing per filer)
  const filersMap = new Map();
  for (const f of allFilings) {
    if (f.cik && !filersMap.has(f.cik)) {
      filersMap.set(f.cik, f);
    }
  }
  
  const uniqueFilers = [...filersMap.values()];
  console.log(`   Found ${uniqueFilers.length} unique filers from ${allFilings.length} filings`);
  
  return uniqueFilers;
}

// ══════════════════════════════════════════════════════════════
// Step 2: Get the filing index page to find the XML
// ══════════════════════════════════════════════════════════════

async function getFilingIndexPage(cik) {
  // Clean CIK (remove leading zeros, ensure string)
  const cleanCik = String(cik).replace(/^0+/, "");
  
  // Try to get the most recent 13F-HR filing index
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cleanCik}&type=13F-HR&dateb=&owner=include&count=1&search_text=&action=getcompany`;
  
  try {
    const res = await fetch(url, { headers: SEC_HEADERS });
    if (!res.ok) return null;
    
    const html = await res.text();
    
    // Find the filing link
    const linkMatch = html.match(/href="(\/Archives\/edgar\/data\/[^"]+\/[^"]+\.htm)"/);
    if (!linkMatch) return null;
    
    return `https://www.sec.gov${linkMatch[1]}`;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════
// Step 3: Parse the 13F-HR XML for holdings
// ══════════════════════════════════════════════════════════════

async function parse13F_Filing(cik, filingUrl) {
  try {
    // Get the filing index page
    const indexRes = await fetch(filingUrl, { headers: SEC_HEADERS });
    if (!indexRes.ok) return null;
    
    const html = await indexRes.text();
    
    // Find the primary XML document URL
    const xmlPatterns = [
      /href="(\/Archives\/edgar\/data\/[^"]*primary_doc\.xml)"/,
      /href="(\/Archives\/edgar\/data\/[^"]*\.xml)"/,
    ];
    
    let xmlUrl = null;
    for (const pattern of xmlPatterns) {
      const match = html.match(pattern);
      if (match) {
        xmlUrl = `https://www.sec.gov${match[1]}`;
        break;
      }
    }
    
    if (!xmlUrl) return null;
    
    await sleep(DELAY_MS);
    
    const xmlRes = await fetch(xmlUrl, { headers: SEC_HEADERS });
    if (!xmlRes.ok) return null;
    
    const xml = await xmlRes.text();
    return extractHoldingsFromXml(xml, cik);
  } catch {
    return null;
  }
}

function extractHoldingsFromXml(xml, cik) {
  const holdings = [];
  
  // Pattern 1: Standard 13F format
  const entryRegex = /<infotable>([\s\S]*?)<\/infotable>/g;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const holding = parseInfoTableEntry(entry);
    if (holding) holdings.push(holding);
  }
  
  // Pattern 2: Newer XML namespace format
  const newEntryRegex = /<ns1:infoTable>([\s\S]*?)<\/ns1:infoTable>/g;
  while ((match = newEntryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const holding = parseInfoTableEntry(entry);
    if (holding) holdings.push(holding);
  }
  
  // Pattern 3: Another variant
  const altEntryRegex = /<InfoTable>([\s\S]*?)<\/InfoTable>/g;
  while ((match = altEntryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const holding = parseInfoTableEntry(entry);
    if (holding) holdings.push(holding);
  }
  
  // Extract filing date from header
  const dateMatch = xml.match(/<periodofreport>([^<]+)<\/periodofreport>/i) ||
                    xml.match(/<dateReported>([^<]+)<\/dateReported>/i) ||
                    xml.match(/<filed>([^<]+)<\/filed>/i);
  const filingDate = dateMatch ? dateMatch[1].trim() : null;
  
  return {
    cik,
    filingDate,
    holdings,
    totalHoldings: holdings.length,
    totalValue: holdings.reduce((sum, h) => sum + (h.valueInThousands || 0), 0),
    uniqueCompanies: [...new Set(holdings.map(h => h.companyName))].length,
  };
}

function parseInfoTableEntry(entry) {
  const companyName = extractTag(entry, "nameofissuer") || 
                      extractTag(entry, "ns1:nameOfIssuer");
  if (!companyName) return null;
  
  const cusip = extractTag(entry, "cusip") || extractTag(entry, "ns1:cusip");
  const value = parseInt(extractTag(entry, "value") || extractTag(entry, "ns1:value") || "0");
  const shares = parseInt(extractTag(entry, "sshprnamt") || extractTag(entry, "ns1:sshPrnamt") || "0");
  const shareType = extractTag(entry, "sshprnamttype") || extractTag(entry, "ns1:sshPrnamtType") || "SH";
  const investmentDiscretion = extractTag(entry, "investmentdiscretion") || 
                               extractTag(entry, "ns1:investmentDiscretion");
  const votingAuthority = extractTag(entry, "votingauthority") || 
                          extractTag(entry, "ns1:votingAuthority");
  const soleVoting = parseInt(extractTag(entry, "sole") || "0");
  const sharedVoting = parseInt(extractTag(entry, "shared") || "0");
  const noVoting = parseInt(extractTag(entry, "none") || "0");
  
  return {
    companyName: companyName.trim(),
    cusip: cusip?.trim(),
    valueInThousands: value,
    valueInDollars: value * 1000,
    shares: shares,
    shareType: shareType, // SH = shares, PRN = principal
    investmentDiscretion: investmentDiscretion?.trim(),
    soleVoting,
    sharedVoting,
    noVoting,
  };
}

function extractTag(xml, tag) {
  // Try both <tag> and <tag attr="...">
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

// ══════════════════════════════════════════════════════════════
// Step 4: Enrich investors with holdings data
// ══════════════════════════════════════════════════════════════

function enrichInvestorWithHoldings(investor, filingData) {
  if (!filingData || !filingData.holdings.length) return investor;
  
  const topHoldings = filingData.holdings
    .sort((a, b) => b.valueInDollars - a.valueInDollars)
    .slice(0, 50);
  
  // Calculate portfolio metrics
  const totalValue = filingData.totalValue * 1000; // Convert from thousands
  const topHoldingPct = topHoldings[0] ? 
    (topHoldings[0].valueInDollars / totalValue * 100) : 0;
  
  // Determine investment focus from holdings
  const topCompanies = topHoldings.map(h => h.companyName);
  
  // Estimate check size from position sizes
  const avgPosition = totalValue / filingData.totalHoldings;
  const maxPosition = topHoldings[0]?.valueInDollars || 0;
  
  return {
    ...investor,
    number_of_investments: filingData.totalHoldings,
    number_of_portfolio_companies: filingData.uniqueCompanies,
    portfolio_companies: topCompanies,
    recent_investments: topHoldings.slice(0, 10).map(h => h.companyName),
    total_capital_invested: totalValue,
    typical_check_size: avgPosition,
    max_check_size: maxPosition,
    last_investment_date: filingData.filingDate,
    currently_active: true,
    currently_deploying_capital: true,
    data_quality_score: Math.min(investor.data_quality_score + 20, 100),
    investment_activity_score: Math.min(
      (investor.investment_activity_score || 0) + (filingData.totalHoldings > 10 ? 10 : 5),
      15
    ),
    funding_capacity_score: Math.min(
      (investor.funding_capacity_score || 0) + (totalValue > 100000000 ? 15 : totalValue > 10000000 ? 10 : 5),
      20
    ),
    source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${String(investor.source_id)}&type=13F-HR`,
    updated_at: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════
// Step 5: Insert into Supabase
// ══════════════════════════════════════════════════════════════

async function updateInvestor(investor) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/investors?source_id=eq.${investor.source_id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        number_of_investments: investor.number_of_investments,
        number_of_portfolio_companies: investor.number_of_portfolio_companies,
        portfolio_companies: investor.portfolio_companies,
        recent_investments: investor.recent_investments,
        total_capital_invested: investor.total_capital_invested,
        typical_check_size: investor.typical_check_size,
        max_check_size: investor.max_check_size,
        last_investment_date: investor.last_investment_date,
        currently_active: investor.currently_active,
        currently_deploying_capital: investor.currently_deploying_capital,
        data_quality_score: investor.data_quality_score,
        investment_activity_score: investor.investment_activity_score,
        funding_capacity_score: investor.funding_capacity_score,
        source_url: investor.source_url,
        updated_at: investor.updated_at,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// Step 6: Backup
// ══════════════════════════════════════════════════════════════

function saveBackup(data, filename) {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  
  const jsonPath = path.join(BACKUP_DIR, `${filename}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  console.log(`   💾 Backup: ${jsonPath} (${(fs.statSync(jsonPath).size / 1024).toFixed(0)}KB)`);
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 100;
  const cikIdx = args.indexOf("--cik");
  const specificCik = cikIdx >= 0 ? args[cikIdx + 1] : null;
  const daysIdx = args.indexOf("--days");
  const days = daysIdx >= 0 ? parseInt(args[daysIdx + 1]) : 365;
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — 13F-HR XML Holdings Parser");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  // Find filings
  let filers;
  if (specificCik) {
    filers = [{ cik: String(specificCik), name: `CIK ${specificCik}`, date: today(), url: "" }];
  } else {
    filers = await findRecent13F_Filings(days);
  }
  
  console.log(`\n📊 Processing ${Math.min(filers.length, limit)} filers...\n`);
  
  let processed = 0;
  let withHoldings = 0;
  let updated = 0;
  const allHoldings = [];
  
  for (const filer of filers.slice(0, limit)) {
    const cikStr = String(filer.cik || '');
    const filingUrl = filer.url || await getFilingIndexPage(cikStr);
    
    if (!filingUrl) {
      process.stdout.write(`\r   ${processed + 1}/${limit} — ${filer.name.slice(0, 30)} (no URL)`);
      processed++;
      continue;
    }
    
    await sleep(DELAY_MS);
    const filingData = await parse13F_Filing(cikStr, filingUrl);
    processed++;
    
    if (filingData && filingData.holdings.length > 0) {
      withHoldings++;
      
      // Enrich and update Supabase
      const enriched = enrichInvestorWithHoldings(
        { source_id: cikStr, data_quality_score: 40, investment_activity_score: 40, funding_capacity_score: 40 },
        filingData
      );
      
      const success = await updateInvestor(enriched);
      if (success) updated++;
      
      allHoldings.push({
        cik: filer.cik,
        name: filer.name,
        date: filingData.filingDate,
        totalHoldings: filingData.totalHoldings,
        totalValue: filingData.totalValue,
        uniqueCompanies: filingData.uniqueCompanies,
        topHoldings: filingData.holdings.slice(0, 5).map(h => ({
          company: h.companyName,
          value: h.valueInDollars,
          shares: h.shares,
        })),
      });
      
      process.stdout.write(`\r   ${processed}/${limit} — ${filer.name.slice(0, 30)} — ${filingData.totalHoldings} holdings, $${(filingData.totalValue).toLocaleString()}K`);
    } else {
      process.stdout.write(`\r   ${processed}/${limit} — ${filer.name.slice(0, 30)} (no holdings found)`);
    }
  }
  
  console.log(`\n\n━━━ RESULTS ━━━\n`);
  console.log(`   Processed: ${processed} filers`);
  console.log(`   With holdings: ${withHoldings}`);
  console.log(`   Updated in Supabase: ${updated}`);
  
  if (allHoldings.length > 0) {
    saveBackup(allHoldings, `13f-holdings-${today()}`);
    
    // Show top 5 by value
    const top5 = allHoldings.sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);
    console.log(`\n🏆 Top 5 by Portfolio Value:`);
    for (const f of top5) {
      console.log(`   ${f.name}: ${f.totalHoldings} holdings, $${(f.totalValue).toLocaleString()}K`);
      for (const h of f.topHoldings.slice(0, 3)) {
        console.log(`     └─ ${h.company}: $${(h.value).toLocaleString()}K`);
      }
    }
  }
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
}

main().catch(err => {
  console.error("\n💥 Fatal:", err.message);
  process.exit(1);
});
