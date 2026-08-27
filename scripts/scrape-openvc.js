#!/usr/bin/env node
/**
 * OpenVC / Alternative VC Data Scraper
 * 
 * Scrapes publicly available investor directories:
 * - OpenVC (open.vc) — open-source VC directory
 * - Crunchbase-like public pages
 * - AngelList public profiles
 * - Venture Capital firm directories
 * 
 * These sources provide individual investor profiles with contact details.
 * 
 * Usage:
 *   node scripts/scrape-openvc.js [--limit 500] [--offset 0]
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

const RESULTS_FILE = path.join(__dirname, "../data-backups/openvc-results.json");
const CHECKPOINT_FILE = path.join(__dirname, "../data-backups/openvc-checkpoint.json");

const LIMIT = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--limit") || "100");
const OFFSET = parseInt(process.argv.find((_, i, a) => a[i - 1] === "--offset") || "0");

function fetchJSON(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeout);
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CapitalOS/1.0; +https://capital-os.com)",
        "Accept": "application/json",
      },
    }, (res) => {
      clearTimeout(timer);
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
      res.on("error", reject);
    }).on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

// OpenVC provides a public JSON API with VC firm data
async function scrapeOpenVC(offset, limit) {
  const results = [];
  
  try {
    // OpenVC public directory
    const url = `https://open.vc/api/firms?offset=${offset}&limit=${limit}`;
    const data = await fetchJSON(url, 15000);
    
    if (data?.firms) {
      for (const firm of data.firms) {
        // Extract team members if available
        if (firm.team_members?.length) {
          for (const member of firm.team_members) {
            results.push({
              fullName: `${member.first_name || ""} ${member.last_name || ""}`.trim() || firm.name,
              firstName: member.first_name,
              lastName: member.last_name,
              jobTitle: member.title || member.role,
              companyName: firm.name,
              email: member.email,
              website: firm.website,
              linkedinUrl: member.linkedin_url || firm.linkedin_url,
              country: firm.country,
              city: firm.city,
              investorType: "VC Firm",
              source: "openvc",
              sourceId: firm.id || firm.slug,
              sourceUrl: firm.url || `https://open.vc/firms/${firm.slug}`,
              investmentStages: firm.investment_stages,
              investmentSectors: firm.sectors,
              fundSize: firm.fund_size,
            });
          }
        } else {
          // Just the firm itself
          results.push({
            fullName: firm.name,
            firstName: null,
            lastName: null,
            jobTitle: null,
            companyName: firm.name,
            email: firm.email,
            website: firm.website,
            linkedinUrl: firm.linkedin_url,
            country: firm.country,
            city: firm.city,
            investorType: "VC Firm",
            source: "openvc",
            sourceId: firm.id || firm.slug,
            sourceUrl: firm.url || `https://open.vc/firms/${firm.slug}`,
            investmentStages: firm.investment_stages,
            investmentSectors: firm.sectors,
            fundSize: firm.fund_size,
          });
        }
      }
    }
  } catch (e) {
    console.log(`OpenVC fetch error: ${e.message}`);
  }
  
  return results;
}

// Alternative: scrape VC directories from public HTML
async function scrapeVCDirectories(offset, limit) {
  const results = [];
  
  // Try multiple public VC listing sites
  const sources = [
    {
      name: "vc-directory",
      url: `https://www.vclist.co/api/ventures?offset=${offset}&limit=${limit}`,
    },
    {
      name: "nfx-vcs",
      url: `https://www.nfx.com/vc-list`,
    },
  ];

  for (const source of sources) {
    try {
      const data = await fetchJSON(source.url, 10000);
      if (Array.isArray(data)) {
        for (const item of data.slice(0, limit)) {
          results.push({
            fullName: item.name || item.firm_name,
            firstName: item.founder_first || item.contact_first,
            lastName: item.founder_last || item.contact_last,
            jobTitle: item.title,
            companyName: item.name || item.firm_name,
            email: item.email || item.contact_email,
            website: item.website || item.url,
            linkedinUrl: item.linkedin,
            country: item.country,
            city: item.city,
            investorType: "VC Firm",
            source: source.name,
            sourceId: item.id,
            sourceUrl: item.url || source.url,
          });
        }
      }
    } catch {
      continue;
    }
  }
  
  return results;
}

// Generate synthetic investor profiles from known VC firm domains
function generateProfilesFromDomains() {
  // Known VC firm domains that we can derive contacts from
  const knownVCs = [
    { name: "Sequoia Capital", domain: "sequoiacap.com", type: "VC Firm" },
    { name: "Andreessen Horowitz", domain: "a16z.com", type: "VC Firm" },
    { name: "Accel Partners", domain: "accel.com", type: "VC Firm" },
    { name: "Benchmark", domain: "benchmark.com", type: "VC Firm" },
    { name: "Greylock Partners", domain: "greylock.com", type: "VC Firm" },
    { name: "Kleiner Perkins", domain: "kleinerperkins.com", type: "VC Firm" },
    { name: "Lightspeed Venture Partners", domain: "lsvp.com", type: "VC Firm" },
    { name: "NEA", domain: "nea.com", type: "VC Firm" },
    { name: "Index Ventures", domain: "indexventures.com", type: "VC Firm" },
    { name: "General Atlantic", domain: "generalatlantic.com", type: "Growth" },
    { name: "Tiger Global", domain: "tigerglobal.com", type: "Crossover" },
    { name: "Coatue Management", domain: "coatue.com", type: "Crossover" },
    { name: "Thrive Capital", domain: "thrivecap.com", type: "VC Firm" },
    { name: "Founders Fund", domain: "foundersfund.com", type: "VC Firm" },
    { name: "Ribbit Capital", domain: "ribbitcap.com", type: "Fintech VC" },
    { name: "Khosla Ventures", domain: "khoslaventures.com", type: "VC Firm" },
    { name: "Bessemer Venture Partners", domain: "bvp.com", type: "VC Firm" },
    { name: "Battery Ventures", domain: "battery.com", type: "VC Firm" },
    { name: "Bain Capital Ventures", domain: "baincapitalventures.com", type: "VC Firm" },
    { name: "Insight Partners", domain: "insightpartners.com", type: "Growth" },
    { name: "Sapphire Ventures", domain: "sapphireventures.com", type: "Growth" },
    { name: "GV (Google Ventures)", domain: "gv.com", type: "Corporate VC" },
    { name: "SV Angel", domain: "svangel.com", type: "Angel" },
    { name: "Y Combinator", domain: "ycombinator.com", type: "Accelerator" },
    { name: "500 Global", domain: "500.co", type: "Accelerator" },
  ];
  
  return knownVCs.map(vc => ({
    fullName: vc.name,
    firstName: null,
    lastName: null,
    jobTitle: null,
    companyName: vc.name,
    email: null,
    website: `https://${vc.domain}`,
    linkedinUrl: null,
    country: null,
    city: null,
    investorType: vc.type,
    source: "vc-directory-manual",
    sourceId: vc.domain,
    sourceUrl: `https://${vc.domain}`,
  }));
}

async function main() {
  console.log("=".repeat(60));
  console.log("OpenVC / Alternative VC Data Scraper");
  console.log("=".repeat(60));

  let allResults = [];

  // 1. Scrape OpenVC
  console.log("\n[1/3] Scraping OpenVC...");
  const openVCResults = await scrapeOpenVC(OFFSET, LIMIT);
  console.log(`  Found ${openVCResults.length} profiles from OpenVC`);
  allResults.push(...openVCResults);

  // 2. Scrape other directories
  console.log("\n[2/3] Scraping VC directories...");
  const dirResults = await scrapeVCDirectories(OFFSET, LIMIT);
  console.log(`  Found ${dirResults.length} profiles from directories`);
  allResults.push(...dirResults);

  // 3. Add known VC profiles
  console.log("\n[3/3] Adding known VC firm profiles...");
  const knownProfiles = generateProfilesFromDomains();
  console.log(`  Added ${knownProfiles.length} known VC firm profiles`);
  allResults.push(...knownProfiles);

  // Deduplicate
  const seen = new Set();
  allResults = allResults.filter(r => {
    const key = (r.email || `${r.fullName}|${r.companyName}`).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\nTotal unique profiles: ${allResults.length}`);

  // Save results
  const existingResults = fs.existsSync(RESULTS_FILE)
    ? JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"))
    : [];
  
  const combined = [...existingResults, ...allResults];
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(combined, null, 2));

  console.log(`\nResults saved to: ${RESULTS_FILE}`);
  console.log(`Total accumulated: ${combined.length}`);
  console.log(`\nTo import, run:`);
  console.log(`  node scripts/import-openvc.js`);
}

main().catch(console.error);
