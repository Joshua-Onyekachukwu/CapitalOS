#!/usr/bin/env node
/**
 * Capital OS — OpenCorporates Director Scraper
 * ==============================================
 * Scrapes OpenCorporates (free, unlimited API) for company director data.
 * 
 * OpenCorporates provides:
 * - Company directors and officers
 * - Company details (jurisdiction, status, type)
 * - Officer appointments and resignments
 * - Company size indicators
 * - Industry classifications
 * 
 * Free tier: 500 API calls/month (enough for enrichment)
 * Unlimited: scrape the website directly (HTML parsing)
 * 
 * Usage:
 *   node scripts/scraper-opencorporates.js                    # Enrich existing investors
 *   node scripts/scraper-opencorporates.js --company "Apple"  # Search specific company
 *   node scripts/scraper-opencorporates.js --country US       # US companies only
 *   node scripts/scraper-opencorporates.js --stats            # Show stats
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKUP_DIR = path.join(__dirname, "../backups/opencorporates");

const OC_HEADERS = {
  "User-Agent": "CapitalOS/1.0 (research@capitalos.io)",
  "Accept": "application/json",
};
const DELAY_MS = 1000; // OpenCorporates rate limit: 1 req/sec for free tier

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function today() { return new Date().toISOString().split("T")[0]; }

// ══════════════════════════════════════════════════════════════
// Step 1: Search OpenCorporates for companies
// ══════════════════════════════════════════════════════════════

async function searchCompanies(query, jurisdiction = null) {
  // Use HTML search (free, unlimited) instead of API (requires token)
  let url = `https://opencorporates.com/companies?q=${encodeURIComponent(query)}`;
  
  if (jurisdiction) {
    url += `&jurisdiction_code=${jurisdiction}`;
  }
  
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
    if (!res.ok) {
      console.log(`   ⚠️ OC search error: ${res.status}`);
      return [];
    }
    
    const html = await res.text();
    return parseSearchResults(html);
  } catch (e) {
    console.log(`   ⚠️ OC search error: ${e.message}`);
    return [];
  }
}

function parseSearchResults(html) {
  const companies = [];
  // Parse company links from search results using string matching
  const linkPattern = '/companies/';
  let pos = 0;
  
  while (true) {
    const idx = html.indexOf(linkPattern, pos);
    if (idx === -1) break;
    
    // Extract jurisdiction and company number
    const start = idx + linkPattern.length;
    const endQuote = html.indexOf('"', start);
    if (endQuote === -1) break;
    
    const path = html.substring(start, endQuote);
    const parts = path.split('/');
    if (parts.length >= 2) {
      // Find the company name (text after the link)
      const nameStart = html.indexOf('>', endQuote) + 1;
      const nameEnd = html.indexOf('<', nameStart);
      const name = nameEnd > nameStart ? html.substring(nameStart, nameEnd).trim() : '';
      
      companies.push({
        company: {
          jurisdiction_code: parts[0].toUpperCase(),
          company_number: parts[1],
          name: name,
        }
      });
    }
    
    pos = endQuote + 1;
    if (companies.length >= 10) break;
  }
  
  return companies;
}

// ══════════════════════════════════════════════════════════════
// Step 2: Get company details and officers
// ══════════════════════════════════════════════════════════════

async function getCompanyDetails(companyNumber, jurisdiction) {
  const url = `https://opencorporates.com/companies/${jurisdiction}/${companyNumber}`;
  
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
    if (!res.ok) return null;
    
    const html = await res.text();
    return parseCompanyPage(html);
  } catch {
    return null;
  }
}

async function getCompanyOfficers(companyNumber, jurisdiction) {
  const url = `https://opencorporates.com/companies/${jurisdiction}/${companyNumber}/officers`;
  
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" } });
    if (!res.ok) return [];
    
    const html = await res.text();
    return parseOfficersPage(html);
  } catch {
    return [];
  }
}

function parseCompanyPage(html) {
  // Extract company details from HTML
  const nameMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
  const statusMatch = html.match(/Status:<\/dt>[^<]*<dd[^>]*>([^<]+)<\/dd>/i);
  const typeMatch = html.match(/Type:<\/dt>[^<]*<dd[^>]*>([^<]+)<\/dd>/i);
  const incorpMatch = html.match(/Incorporation:<\/dt>[^<]*<dd[^>]*>([^<]+)<\/dd>/i);
  
  return {
    current_company: {
      name: nameMatch?.[1]?.trim(),
      status: statusMatch?.[1]?.trim(),
      company_type: typeMatch?.[1]?.trim(),
      incorporation_date: incorpMatch?.[1]?.trim(),
    }
  };
}

function parseOfficersPage(html) {
  const officers = [];
  
  // Look for officer name patterns in the HTML
  const namePattern = 'officer-name';
  let pos = 0;
  
  while (true) {
    const idx = html.indexOf(namePattern, pos);
    if (idx === -1) break;
    
    // Find the name text after the class
    const tagEnd = html.indexOf('>', idx);
    if (tagEnd === -1) break;
    
    const nameStart = tagEnd + 1;
    const nameEnd = html.indexOf('<', nameStart);
    const name = nameEnd > nameStart ? html.substring(nameStart, nameEnd).trim() : '';
    
    // Find position after this name
    const posPattern = 'officer-position';
    const posIdx = html.indexOf(posPattern, nameEnd);
    let position = '';
    if (posIdx > 0 && posIdx < nameEnd + 500) {
      const posTagEnd = html.indexOf('>', posIdx);
      if (posTagEnd > 0) {
        const posTextStart = posTagEnd + 1;
        const posTextEnd = html.indexOf('<', posTextStart);
        if (posTextEnd > posTextStart) {
          position = html.substring(posTextStart, posTextEnd).trim();
        }
      }
    }
    
    if (name && !name.includes('<')) {
      officers.push({ name, position: position || 'Unknown', company_name: '' });
    }
    
    pos = nameEnd + 1;
    if (officers.length >= 20) break;
  }
  
  return officers;
}

// ══════════════════════════════════════════════════════════════
// Step 3: Enrich investor with company data
// ══════════════════════════════════════════════════════════════

function enrichInvestorFromOC(investor, companyData, officers) {
  if (!companyData) return investor;
  
  // Extract useful data
  const公司Size = companyData.current_company?.company_type || null;
  const status = companyData.current_company?.status || null;
  const incorporationDate = companyData.current_company?.incorporation_date || null;
  const numberOfOfficers = officers.length;
  
  // Find the investor in the officers list (if they're a director)
  const investorName = investor.full_name?.toLowerCase() || "";
  const matchingOfficer = officers.find(o => {
    const name = (o.name || "").toLowerCase();
    return name === investorName || 
           investorName.includes(name) || 
           name.includes(investorName);
  });
  
  if (matchingOfficer) {
    return {
      ...investor,
      job_title: matchingOfficer.position || investor.job_title,
      company_name: matchingOfficer.company_name || investor.company_name,
      founded_year: incorporationDate ? parseInt(incorporationDate) : investor.founded_year,
      number_of_employees: numberOfOfficers,
      data_quality_score: Math.min((investor.data_quality_score || 0) + 15, 100),
      contactability_score: Math.min((investor.contactability_score || 0) + 5, 15),
      updated_at: new Date().toISOString(),
    };
  }
  
  // Just enrich with company info
  return {
    ...investor,
    founded_year: incorporationDate ? parseInt(incorporationDate) : investor.founded_year,
    number_of_employees: numberOfOfficers,
    data_quality_score: Math.min((investor.data_quality_score || 0) + 10, 100),
    updated_at: new Date().toISOString(),
  };
}

// ══════════════════════════════════════════════════════════════
// Step 4: Fetch investors from Supabase to enrich
// ══════════════════════════════════════════════════════════════

async function fetchInvestorsToEnrich(limit = 100) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/investors?select=id,full_name,company_name,data_quality_score&data_quality_score=lt.60&order=data_quality_score.asc&limit=${limit}`,
    { headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` } }
  );
  
  if (!res.ok) return [];
  return await res.json();
}

// ══════════════════════════════════════════════════════════════
// Step 5: Update Supabase
// ══════════════════════════════════════════════════════════════

async function updateInvestor(investor) {
  if (!SUPABASE_URL || !SUPABASE_KEY || !investor.id) return false;
  
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/investors?id=eq.${investor.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        job_title: investor.job_title,
        company_name: investor.company_name,
        founded_year: investor.founded_year,
        number_of_employees: investor.number_of_employees,
        data_quality_score: investor.data_quality_score,
        contactability_score: investor.contactability_score,
        updated_at: investor.updated_at,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
// Backup
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
  const companyIdx = args.indexOf("--company");
  const searchCompany = companyIdx >= 0 ? args[companyIdx + 1] : null;
  const countryIdx = args.indexOf("--country");
  const country = countryIdx >= 0 ? args[countryIdx + 1] : null;
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 100;
  const showStats = args.includes("--stats");
  
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Capital OS — OpenCorporates Director Scraper");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  if (showStats) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/investors?select=id`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "count=exact" }
    });
    console.log(`📊 Total investors: ${res.headers.get("content-range")}`);
    return;
  }
  
  // If searching for a specific company
  if (searchCompany) {
    console.log(`🔍 Searching OpenCorporates for: ${searchCompany}\n`);
    
    const results = await searchCompanies(searchCompany, country);
    
    if (results.length === 0) {
      console.log("   No results found");
      return;
    }
    
    console.log(`   Found ${results.length} companies:\n`);
    
    for (const result of results.slice(0, 5)) {
      const company = result.company;
      console.log(`   📌 ${company.name}`);
      console.log(`      Jurisdiction: ${company.jurisdiction_code}`);
      console.log(`      Number: ${company.company_number}`);
      console.log(`      Status: ${company.status}`);
      console.log(`      Type: ${company.company_type}`);
      console.log(`      Incorporated: ${company.incorporation_date}`);
      
      // Get officers
      await sleep(DELAY_MS);
      const officers = await getCompanyOfficers(company.company_number, company.jurisdiction_code);
      
      if (officers.length > 0) {
        console.log(`      Officers (${officers.length}):`);
        for (const officer of officers.slice(0, 5)) {
          console.log(`        └─ ${officer.name} (${officer.position || 'Unknown'})`);
        }
      }
      
      console.log();
    }
    
    return;
  }
  
  // Enrich existing investors
  console.log("📥 Fetching investors to enrich...\n");
  
  const investors = await fetchInvestorsToEnrich(limit);
  console.log(`   Found ${investors.length} investors to enrich\n`);
  
  let enriched = 0;
  let updated = 0;
  const enrichments = [];
  
  for (const investor of investors) {
    if (!investor.company_name) {
      process.stdout.write(`\r   ${enriched + 1}/${investors.length} — ${investor.full_name?.slice(0, 30)} (no company name)`);
      enriched++;
      continue;
    }
    
    // Search OpenCorporates for the company
    await sleep(DELAY_MS);
    const results = await searchCompanies(investor.company_name, country);
    
    if (results.length > 0) {
      const bestMatch = results[0].company;
      
      // Get detailed company info
      await sleep(DELAY_MS);
      const companyData = await getCompanyDetails(bestMatch.company_number, bestMatch.jurisdiction_code);
      
      // Get officers
      await sleep(DELAY_MS);
      const officers = await getCompanyOfficers(bestMatch.company_number, bestMatch.jurisdiction_code);
      
      // Enrich investor
      const enrichedInvestor = enrichInvestorFromOC(investor, companyData, officers);
      
      // Update Supabase
      const success = await updateInvestor(enrichedInvestor);
      if (success) updated++;
      
      enrichments.push({
        investorId: investor.id,
        investorName: investor.full_name,
        companyName: investor.company_name,
        ocCompany: bestMatch.name,
        officers: officers.length,
        enriched: true,
      });
      
      process.stdout.write(`\r   ${enriched + 1}/${investors.length} — ${investor.full_name?.slice(0, 30)} → ${bestMatch.name} (${officers.length} officers)`);
    } else {
      process.stdout.write(`\r   ${enriched + 1}/${investors.length} — ${investor.full_name?.slice(0, 30)} (no OC match)`);
    }
    
    enriched++;
  }
  
  console.log(`\n\n━━━ RESULTS ━━━\n`);
  console.log(`   Enriched: ${enriched} investors`);
  console.log(`   Updated in Supabase: ${updated}`);
  console.log(`   Found on OpenCorporates: ${enrichments.length}`);
  
  if (enrichments.length > 0) {
    saveBackup(enrichments, `opencorporates-enrichment-${today()}`);
  }
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
}

main().catch(err => {
  console.error("\n💥 Fatal:", err.message);
  process.exit(1);
});
