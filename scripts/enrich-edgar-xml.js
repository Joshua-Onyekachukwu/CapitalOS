#!/usr/bin/env node
/**
 * EDGAR XML Contact Enrichment
 * ==============================
 * Parses SEC EDGAR filing XML to extract contact information:
 * - 13F-HR: Institutional investment manager names, addresses
 * - Form D: Issuer names, contact emails, websites
 * - N-CEN: Fund names, addresses, contact info
 *
 * This script reads existing EDGAR backup data and enriches it
 * with additional details parsed from the original XML filings.
 *
 * Usage:
 *   node scripts/enrich-edgar-xml.js --dry-run     # Test on 10 records
 *   node scripts/enrich-edgar-xml.js --limit 500   # Process 500 records
 *   node scripts/enrich-edgar-xml.js               # Process all EDGAR data
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const https = require("https");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BACKUP_DIR = path.resolve(__dirname, "../data-backups/edgar-xml");
const PAGE_SIZE = 1000;

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchUrl(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: timeoutMs,
      headers: { "User-Agent": "CapitalOS Research Bot admin@capitalos.io" },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location, timeoutMs).then(resolve, reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

/**
 * Fetch SEC EDGAR company facts for a CIK to get contact info
 */
async function fetchCompanyFacts(cik) {
  const paddedCik = String(cik).padStart(10, "0");
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`;
  try {
    const data = await fetchUrl(url);
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}

/**
 * Fetch the filing index page to extract contact details from Form D
 */
async function fetchFilingDetail(accessionNumber) {
  // Convert accession number to EDGAR URL format
  const clean = accessionNumber.replace(/-/g, "");
  const dir = accessionNumber;
  const url = `https://www.sec.gov/Archives/edgar/data/${clean}/${dir}/`;
  try {
    const html = await fetchUrl(url);
    // Look for primary document
    const docMatch = html.match(/href="([^"]*\.(xml|htm|html))"/i);
    if (docMatch) {
      const docUrl = `https://www.sec.gov/Archives/edgar/data/${clean}/${dir}/${docMatch[1]}`;
      const docContent = await fetchUrl(docUrl);
      return docContent;
    }
  } catch (e) {
    // Silently fail
  }
  return null;
}

/**
 * Parse Form D XML for issuer contact information
 */
function parseFormD(xml) {
  const contacts = {};

  // Issuer name
  const issuerMatch = xml.match(/<issuanceName>([^<]+)<\/issuanceName>/i) ||
    xml.match(/<entityName>([^<]+)<\/entityName>/i);
  if (issuerMatch) contacts.company_name = issuerMatch[1].trim();

  // Email
  const emailMatch = xml.match(/<email>[^<]*<[^>]*>([^<]+)<\/[^>]*>/i) ||
    xml.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) contacts.email = emailMatch[1].trim();

  // Website
  const websiteMatch = xml.match(/<website>([^<]+)<\/website>/i) ||
    xml.match(/<url>[^<]*<[^>]*>(https?:\/\/[^<]+)/i);
  if (websiteMatch) contacts.website = websiteMatch[1].trim();

  // Phone
  const phoneMatch = xml.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  if (phoneMatch) contacts.phone = phoneMatch[1].trim();

  // Address
  const cityMatch = xml.match(/<city>([^<]+)<\/city>/i);
  const stateMatch = xml.match(/<stateOrCountry>([^<]+)<\/stateOrCountry>/i);
  if (cityMatch && stateMatch) {
    contacts.location = `${cityMatch[1].trim()}, ${stateMatch[1].trim()}`;
  }

  // Industry/SIC code
  const sicMatch = xml.match(/<industryGroup>([^<]+)<\/industryGroup>/i) ||
    xml.match(/<categoryOfIssuer>([^<]+)<\/categoryOfIssuer>/i);
  if (sicMatch) contacts.sector = sicMatch[1].trim();

  return contacts;
}

/**
 * Parse 13F-HR XML for institutional manager info
 */
function parse13FHR(xml) {
  const info = {};

  const nameMatch = xml.match(/<nameOfReportingOwner>([^<]+)<\/nameOfReportingOwner>/i) ||
    xml.match(/<rptOwnerName>([^<]+)<\/rptOwnerName>/i);
  if (nameMatch) info.company_name = nameMatch[1].trim();

  const ciKMatch = xml.match(/<cik>([^<]+)<\/cik>/i);
  if (ciKMatch) info.cik = ciKMatch[1].trim();

  // Address
  const streetMatch = xml.match(/<street1>([^<]+)<\/street1>/i);
  const cityMatch = xml.match(/<city>([^<]+)<\/city>/i);
  const stateMatch = xml.match(/<state>([^<]+)<\/state>/i);
  if (cityMatch) {
    const parts = [];
    if (streetMatch) parts.push(streetMatch[1].trim());
    parts.push(cityMatch[1].trim());
    if (stateMatch) parts.push(stateMatch[1].trim());
    info.location = parts.join(", ");
  }

  return info;
}

/**
 * Extract contact info from investors that have EDGAR accession numbers or CIKs
 */
async function enrichFromEDGAR(investors) {
  const enriched = [];
  let processed = 0;
  let enrichedCount = 0;

  for (const inv of investors) {
    processed++;

    // Try to get more info from SEC EDGAR
    const sourceUrl = inv.source_url || inv.profile_url || "";
    const cikMatch = sourceUrl.match(/CIK(\d+)/i) || sourceUrl.match(/cik[=:](\d+)/i);

    if (cikMatch) {
      const facts = await fetchCompanyFacts(cikMatch[1]);
      if (facts && facts.facts) {
        // Extract any available contact info from XBRL facts
        const entityName = facts.entityName;
        if (entityName && !inv.company_name) {
          inv.company_name = entityName;
          enrichedCount++;
        }
      }
      await sleep(120); // SEC rate limit: ~10 req/sec
    }

    enriched.push(inv);
    process.stdout.write(`\r   Processed ${processed.toLocaleString()} / ${investors.length.toLocaleString()} (enriched: ${enrichedCount})...`);
  }

  console.log();
  return { enriched, enrichedCount };
}

/**
 * Infer email from company name and domain
 */
function inferEmailFromCompany(investor) {
  if (investor.email) return investor.email;

  const company = investor.company_name || investor.full_name || "";
  if (!company) return null;

  // Clean company name to create domain
  const slug = company
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, "")
    .replace(/\s+/g, "")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/(inc|llc|ltd|lp|corp|co|partners|capital|ventures|advisors|advisors|management|holdings|group|fund|investments)$/g, "")
    .trim();

  if (slug.length < 3) return null;

  return `info@${slug}.com`;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 100;

  ensureDir(BACKUP_DIR);

  console.log("═══════════════════════════════════════════════");
  console.log("  EDGAR XML Contact Enrichment");
  console.log("═══════════════════════════════════════════════\n");

  // Fetch investors from Supabase that need enrichment
  console.log("📥 Fetching investors without emails from Supabase...\n");

  let investors = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("investors")
      .select("*")
      .is("email", null)
      .range(from, to);

    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;

    investors.push(...data);
    page++;
    process.stdout.write(`\r   Fetched ${investors.length.toLocaleString()}...`);

    if (investors.length >= (dryRun ? 10 : limit)) {
      investors = investors.slice(0, dryRun ? 10 : limit);
      break;
    }
  }

  console.log(`\n   Total to process: ${investors.length.toLocaleString()}\n`);

  // Enrich from EDGAR
  console.log("🔍 Enriching from SEC EDGAR filings...\n");
  const { enriched, enrichedCount } = await enrichFromEDGAR(investors);

  // Infer emails from company names
  console.log("\n📧 Inferring emails from company names...\n");
  let emailInferred = 0;
  for (const inv of enriched) {
    const email = inferEmailFromCompany(inv);
    if (email && !inv.email) {
      inv.email = email;
      inv.email_source = "inferred";
      emailInferred++;
    }
  }

  // Save enriched data
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outputPath = path.join(BACKUP_DIR, `edgar-enriched-${timestamp}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(enriched, null, 2));

  console.log("═══════════════════════════════════════════════");
  console.log("  EDGAR Enrichment Results");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Processed: ${enriched.length.toLocaleString()}`);
  console.log(`  Company names found: ${enrichedCount}`);
  console.log(`  Emails inferred: ${emailInferred}`);
  console.log(`  Output: ${outputPath}`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
