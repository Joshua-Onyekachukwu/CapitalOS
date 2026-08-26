#!/usr/bin/env node
/**
 * FishTank VC Investor Scraper v2
 * ================================
 * FishTank is fully client-rendered — no data in SSR HTML.
 * Strategy: Extract investor names from sitemap slugs, create profiles
 * that can be enriched later via AI or manual research.
 *
 * The sitemap has 18,245 URLs like:
 *   /resources/investor-profiles/sosv        → "SOSV"
 *   /resources/investor-profiles/sequoia     → "Sequoia Capital"
 *   /resources/investor-profiles/a16z        → "a16z"
 *
 * Usage:
 *   node scripts/scrape-fishtank-v2.js --dry-run        # Test with 10
 *   node scripts/scrape-fishtank-v2.js --limit 1000     # Scrape 1000
 *   node scripts/scrape-fishtank-v2.js                  # Scrape all 18K+
 *   node scripts/scrape-fishtank-v2.js --stats          # Show stats
 *   node scripts/scrape-fishtank-v2.js --upload         # Upload to Supabase
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const fs = require("fs");
const path = require("path");
const https = require("https");
const { createClient } = require("@supabase/supabase-js");

// ─── Config ──────────────────────────────────────────────────────────────────
const BACKUP_DIR = path.resolve(__dirname, "../data-backups/fishtank");
const RESULTS_FILE = path.join(BACKUP_DIR, "fishtank-investors-v2.json");
const SITEMAP_URL = "https://www.fishtank.vc/sitemaps/investor-profiles.xml";
const BASE_URL = "https://www.fishtank.vc";
const CONCURRENCY = 10;
const RATE_LIMIT_MS = 100;
const USER_AGENT = "CapitalOS-Scraper/2.0 (investor-research@capitalos.io)";

// Known firm name mappings (slug → full name)
const FIRM_NAMES = {
  sosv: "SOSV",
  sequoia: "Sequoia Capital",
  a16z: "Andreessen Horowitz (a16z)",
  "andreessen-horowitz": "Andreessen Horowitz (a16z)",
  "kleiner-perkins": "Kleiner Perkins",
  "benchmark-capital": "Benchmark",
  "greylock-partners": "Greylock Partners",
  "accel-partners": "Accel",
  "battery-ventures": "Battery Ventures",
  "general-catalyst": "General Catalyst",
  "founders-fund": "Founders Fund",
  "lightspeed-venture-partners": "Lightspeed Venture Partners",
  "benchmark": "Benchmark",
  "index-ventures": "Index Ventures",
  "atomico": "Atomico",
  "balderton-capital": "Balderton Capital",
  "birdhouse": "Birdhouse",
  "y-combinator": "Y Combinator",
  "techstars": "Techstars",
  "500-global": "500 Global",
  "500-startups": "500 Global",
  "plug-and-play": "Plug and Play",
  "seedcamp": "Seedcamp",
  "rocket-internet": "Rocket Internet",
  "northzone": "Northzone",
  "atlantic-labs": "Atlantic Labs",
  "point-nine": "Point Nine",
  "project-a": "Project A",
  "lakestar": "Lakestar",
  "HV-capital": "HV Capital",
  "project-a-ventures": "Project A Ventures",
  "earlybird": "Earlybird",
  "eventures": "e.ventures",
  "HV": "HV Capital",
  "family-fund": "Family Fund",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let lastReq = 0;
async function fetchUrl(url, timeoutMs = 15000) {
  const wait = RATE_LIMIT_MS - (Date.now() - lastReq);
  if (wait > 0) await sleep(wait);
  lastReq = Date.now();

  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: timeoutMs,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json, text/xml, */*" },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirect = res.headers.location.startsWith("http")
          ? res.headers.location
          : `${BASE_URL}${res.headers.location}`;
        return fetchUrl(redirect, timeoutMs).then(resolve, reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

// ─── Sitemap ─────────────────────────────────────────────────────────────────
async function getSitemapUrls() {
  console.log("📋 Fetching FishTank sitemap...\n");
  const xml = await fetchUrl(SITEMAP_URL);
  const urls = [];
  const regex = /<loc>(https?:\/\/www\.fishtank\.vc\/resources\/investor-profiles\/[^<]+)<\/loc>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1]);
  }
  console.log(`   Found ${urls.length.toLocaleString()} investor profile URLs\n`);
  return urls;
}

// ─── Profile Extraction ──────────────────────────────────────────────────────
function slugToName(slug) {
  // Check known mappings first
  if (FIRM_NAMES[slug]) return FIRM_NAMES[slug];

  // Convert slug to title case name
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bVC\b/i, "VC")
    .replace(/\bPE\b/i, "PE")
    .replace(/\bLP\b/i, "LP")
    .replace(/\bGP\b/i, "GP")
    .replace(/\bGP\b/i, "GP")
    .replace(/\bAI\b/i, "AI")
    .replace(/\bML\b/i, "ML")
    .replace(/\bSAAS\b/i, "SaaS")
    .replace(/\bB2B\b/i, "B2B")
    .replace(/\bB2C\b/i, "B2C")
    .replace(/\bCX\b/i, "CX")
    .replace(/\bIO\b/i, ".io")
    .replace(/\bCO\b/i, ".co");
}

function extractProfileFromUrl(url) {
  const slugMatch = url.match(/investor-profiles\/([^/?#]+)/);
  if (!slugMatch) return null;

  const slug = slugMatch[1];
  const name = slugToName(slug);

  return {
    source: "fishtank.vc",
    source_url: url,
    full_name: name,
    first_name: "",
    last_name: "",
    company_name: name,
    investor_type: "unknown",
    location: "",
    city: "",
    country: "",
    website: "",
    linkedin_url: "",
    company_linkedin_url: "",
    investment_stages: [],
    investment_sectors: [],
    investment_geographies: [],
    description: "",
    fund_size: null,
    aum: null,
    number_of_investments: null,
    number_of_portfolio_companies: null,
    founded_year: null,
    team_size: null,
    data_quality_score: 10, // Low — needs enrichment
    scraped_at: new Date().toISOString(),
  };
}

// ─── Enrichment: Fetch meta tags for additional data ─────────────────────────
async function enrichProfile(profile) {
  try {
    const html = await fetchUrl(profile.source_url);

    // Extract og:description for description
    const ogDesc = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
    if (ogDesc) {
      profile.description = ogDesc[1].trim();
      // Try to extract investor type from description
      const desc = ogDesc[1].toLowerCase();
      if (desc.includes("venture capital") || desc.includes("vc fund")) profile.investor_type = "venture_capital";
      else if (desc.includes("angel")) profile.investor_type = "angel_investor";
      else if (desc.includes("private equity")) profile.investor_type = "private_equity";
      else if (desc.includes("accelerator")) profile.investor_type = "accelerator";
      else if (desc.includes("family office")) profile.investor_type = "family_office";
      else if (desc.includes("corporate")) profile.investor_type = "corporate_venture";
      else if (desc.includes("seed")) profile.investor_type = "seed_fund";
      else if (desc.includes("micro")) profile.investor_type = "micro_vc";
    }

    // Extract LinkedIn from HTML
    const linkedinMatch = html.match(/href="(https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"]+)"/i);
    if (linkedinMatch) {
      profile.linkedin_url = linkedinMatch[1];
      if (linkedinMatch[1].includes("/company/")) {
        profile.company_linkedin_url = linkedinMatch[1];
      }
    }

    // Extract website from HTML
    const websiteMatch = html.match(/href="(https?:\/\/(?!www\.fishtank\.vc)[^"]+\.(com|io|vc|fund|co|org)[^"]*)"/i);
    if (websiteMatch) {
      profile.website = websiteMatch[1];
    }

    // Try to extract location from text content
    const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const cities = [
      "San Francisco", "New York", "London", "Berlin", "Singapore", "Toronto",
      "Tel Aviv", "Austin", "Boston", "Chicago", "Los Angeles", "Seattle",
      "Mumbai", "Nairobi", "Lagos", "Paris", "Amsterdam", "Tokyo", "Sydney",
      "Dubai", "Hong Kong", "Seoul", "Bangalore", "Shanghai", "São Paulo",
      "Zurich", "Munich", "Stockholm", "Copenhagen", "Helsinki", "Oslo",
    ];
    for (const c of cities) {
      if (textContent.includes(c)) {
        profile.location = c;
        profile.city = c;
        break;
      }
    }

    // Update data quality score
    let score = 10;
    if (profile.full_name) score += 20;
    if (profile.investor_type !== "unknown") score += 15;
    if (profile.linkedin_url) score += 15;
    if (profile.website) score += 10;
    if (profile.location) score += 10;
    if (profile.description) score += 10;
    profile.data_quality_score = Math.min(score, 100);

  } catch (e) {
    // Keep basic profile from slug
  }
  return profile;
}

// ─── Batch Processing ────────────────────────────────────────────────────────
async function processBatch(urls) {
  const results = [];
  let errors = 0;

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const promises = batch.map(async (url) => {
      try {
        const profile = extractProfileFromUrl(url);
        if (!profile) return null;
        return await enrichProfile(profile);
      } catch (e) {
        errors++;
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) results.push(r);
    }

    process.stdout.write(
      `\r   Processed ${results.length.toLocaleString()} / ${urls.length.toLocaleString()} profiles (${errors} errors)...`
    );

    if (i + CONCURRENCY < urls.length) {
      await sleep(50);
    }
  }

  console.log();
  return { results, errors };
}

// ─── Stats ───────────────────────────────────────────────────────────────────
function showStats() {
  console.log("═══════════════════════════════════════════════");
  console.log("  FishTank VC Backup Statistics");
  console.log("═══════════════════════════════════════════════\n");

  if (!fs.existsSync(RESULTS_FILE)) {
    console.log("  No backup found.\n");
    return;
  }

  const data = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  console.log(`  Total profiles: ${data.length.toLocaleString()}`);
  console.log(`  With name: ${data.filter((d) => d.full_name).length.toLocaleString()}`);
  console.log(`  With type: ${data.filter((d) => d.investor_type && d.investor_type !== "unknown").length.toLocaleString()}`);
  console.log(`  With location: ${data.filter((d) => d.location).length.toLocaleString()}`);
  console.log(`  With LinkedIn: ${data.filter((d) => d.linkedin_url).length.toLocaleString()}`);
  console.log(`  With website: ${data.filter((d) => d.website).length.toLocaleString()}`);
  console.log(`  With description: ${data.filter((d) => d.description).length.toLocaleString()}`);

  const fileSize = fs.statSync(RESULTS_FILE).size;
  console.log(`\n  File size: ${(fileSize / 1024 / 1024).toFixed(1)} MB`);
  console.log("═══════════════════════════════════════════════\n");
}

// ─── Upload to Supabase ──────────────────────────────────────────────────────
async function uploadToSupabase() {
  if (!fs.existsSync(RESULTS_FILE)) {
    console.log("❌ No backup found. Run scraper first.\n");
    return;
  }

  const data = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
  console.log(`\n📤 Uploading ${data.length.toLocaleString()} FishTank profiles to Supabase...\n`);

  const sp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Check current count
  const { count: currentCount } = await sp
    .from("investors")
    .select("id", { count: "exact", head: true });

  console.log(`   Current investors in Supabase: ${currentCount?.toLocaleString() || 0}`);
  console.log(`   Hot limit: 120,000`);
  console.log(`   Available capacity: ${(120000 - (currentCount || 0)).toLocaleString()}\n`);

  const available = 120000 - (currentCount || 0);
  const toUpload = data.slice(0, Math.max(0, available));

  if (toUpload.length === 0) {
    console.log("   ⚠️  Supabase at capacity. Skipping upload.\n");
    return;
  }

  // Batch insert (100 at a time)
  let uploaded = 0;
  const BATCH = 100;

  for (let i = 0; i < toUpload.length; i += BATCH) {
    const batch = toUpload.slice(i, i + BATCH).map((p) => ({
      full_name: p.full_name,
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      company_name: p.company_name || null,
      investor_type: p.investor_type === "unknown" ? null : p.investor_type,
      location: p.location || null,
      city: p.city || null,
      country: p.country || null,
      website: p.website || null,
      linkedin_url: p.linkedin_url || null,
      company_linkedin_url: p.company_linkedin_url || null,
      description: p.description || null,
      investment_stages: p.investment_stages?.length ? p.investment_stages : null,
      investment_sectors: p.investment_sectors?.length ? p.investment_sectors : null,
      investment_geographies: p.investment_geographies?.length ? p.investment_geographies : null,
      fund_size: p.fund_size,
      aum: p.aum,
      number_of_investments: p.number_of_investments,
      number_of_portfolio_companies: p.number_of_portfolio_companies,
      source: "fishtank.vc",
      source_id: p.source_url,
      data_quality_score: p.data_quality_score || 10,
    }));

    const { error } = await sp.from("investors").insert(batch);
    if (error) {
      console.error(`   ❌ Batch ${Math.floor(i / BATCH) + 1} error:`, error.message);
    } else {
      uploaded += batch.length;
    }

    process.stdout.write(`\r   Uploaded ${uploaded.toLocaleString()} / ${toUpload.length.toLocaleString()}...`);
  }

  console.log(`\n\n   ✅ Uploaded ${uploaded.toLocaleString()} FishTank profiles to Supabase`);
  console.log(`   💾 ${data.length - toUpload.length.toLocaleString()} remaining in local backup\n`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--stats")) {
    showStats();
    return;
  }

  if (args.includes("--upload")) {
    await uploadToSupabase();
    return;
  }

  const dryRun = args.includes("--dry-run");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;

  ensureDir(BACKUP_DIR);

  console.log("═══════════════════════════════════════════════");
  console.log("  FishTank VC Investor Scraper v2");
  console.log("═══════════════════════════════════════════════\n");

  if (dryRun) console.log("🧪 DRY RUN — testing with 10 profiles\n");

  // Get sitemap URLs
  let urls = await getSitemapUrls();

  // Apply limits
  if (dryRun) urls = urls.slice(0, 10);
  else if (limit < Infinity) urls = urls.slice(0, limit);

  console.log(`📊 Processing ${urls.length.toLocaleString()} profiles (concurrency: ${CONCURRENCY})...\n`);

  const startTime = Date.now();
  const { results, errors } = await processBatch(urls);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Save
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const resultsPath = dryRun
    ? path.join(BACKUP_DIR, `fishtank-test-${timestamp}.json`)
    : RESULTS_FILE;

  // Merge with existing if not dry run
  let allResults = results;
  if (!dryRun && fs.existsSync(RESULTS_FILE)) {
    const existing = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
    const urlMap = new Map();
    for (const inv of existing) urlMap.set(inv.source_url, inv);
    for (const inv of results) urlMap.set(inv.source_url, inv);
    allResults = Array.from(urlMap.values());
  }

  fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));

  // Report
  console.log(`\n   Completed in ${elapsed}s`);
  console.log(`   💾 Saved ${allResults.length.toLocaleString()} profiles to ${resultsPath}\n`);

  const withType = allResults.filter((r) => r.investor_type && r.investor_type !== "unknown").length;
  const withLinkedin = allResults.filter((r) => r.linkedin_url).length;
  const withWebsite = allResults.filter((r) => r.website).length;
  const withLocation = allResults.filter((r) => r.location).length;
  const withDesc = allResults.filter((r) => r.description).length;

  console.log("═══════════════════════════════════════════════");
  console.log("  Scrape Results");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Total profiles: ${allResults.length.toLocaleString()}`);
  console.log(`  New this run: ${results.length.toLocaleString()}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  With investor type: ${withType.toLocaleString()}`);
  console.log(`  With LinkedIn: ${withLinkedin.toLocaleString()}`);
  console.log(`  With website: ${withWebsite.toLocaleString()}`);
  console.log(`  With location: ${withLocation.toLocaleString()}`);
  console.log(`  With description: ${withDesc.toLocaleString()}`);
  console.log("═══════════════════════════════════════════════\n");

  console.log("💡 Next steps:");
  console.log("   1. Run AI enrichment to add more data: node scripts/enrich-ai.js");
  console.log("   2. Upload to Supabase: node scripts/scrape-fishtank-v2.js --upload");
  console.log("   3. Or keep in Convex for bulk storage\n");
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
