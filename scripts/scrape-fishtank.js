#!/usr/bin/env node
/**
 * FishTank VC Investor Scraper
 * =============================
 * Scrapes investor profiles from fishtank.vc sitemap
 * Extracts: name, type, stage, sector, location, website, LinkedIn
 *
 * FishTank has 18,245+ investor profiles.
 * We scrape the sitemap for URLs, then fetch each profile page.
 *
 * Usage:
 *   node scripts/scrape-fishtank.js --dry-run        # Test with 10 profiles
 *   node scripts/scrape-fishtank.js --limit 100      # Scrape 100 profiles
 *   node scripts/scrape-fishtank.js                  # Scrape all 18K+
 *   node scripts/scrape-fishtank.js --resume          # Resume from last checkpoint
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const BACKUP_DIR = path.resolve(__dirname, "../data-backups/fishtank");
const CHECKPOINT_FILE = path.join(BACKUP_DIR, "checkpoint.json");
const RESULTS_FILE = path.join(BACKUP_DIR, "fishtank-investors.json");
const SITEMAP_URL = "https://www.fishtank.vc/sitemaps/investor-profiles.xml";
const BASE_URL = "https://www.fishtank.vc";
const CONCURRENCY = 5; // parallel requests
const DELAY_MS = 200; // delay between batches

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a URL and return the response body
 */
function fetchUrl(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;
    const req = protocol.get(url, { timeout: timeoutMs, headers: { "User-Agent": "CapitalOS-Scraper/1.0" } }, (res) => {
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
 * Extract investor profile URLs from sitemap XML
 */
async function getSitemapUrls() {
  console.log("📋 Fetching FishTank sitemap...\n");

  const xml = await fetchUrl(SITEMAP_URL);
  const urls = [];
  const regex = /<loc>(https:\/\/www\.fishtank\.vc\/resources\/investor-profiles\/[^<]+)<\/loc>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1]);
  }

  console.log(`   Found ${urls.length.toLocaleString()} investor profile URLs\n`);
  return urls;
}

/**
 * Parse a FishTank investor profile page (HTML)
 * Extracts structured data from the page content
 */
function parseProfilePage(html, url) {
  const profile = {
    source: "fishtank.vc",
    source_url: url,
    full_name: "",
    company_name: "",
    investor_type: "",
    location: "",
    website: "",
    linkedin_url: "",
    investment_stages: "",
    sectors: "",
    description: "",
    founded_year: "",
    aum: "",
    fund_size: "",
    num_investments: "",
    portfolio_highlights: "",
  };

  // Extract title/name from <title> tag
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    let title = titleMatch[1].replace(/\s*\|.*$/, "").replace(/\s*-\s*FishTank.*$/i, "").trim();
    profile.full_name = title;
  }

  // Extract og:title
  const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
  if (ogTitleMatch) {
    profile.full_name = ogTitleMatch[1].replace(/\s*\|.*$/, "").trim();
  }

  // Extract og:description
  const ogDescMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
  if (ogDescMatch) {
    profile.description = ogDescMatch[1].trim();
  }

  // Extract from structured data (JSON-LD)
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd.name) profile.full_name = profile.full_name || jsonLd.name;
      if (jsonLd.description) profile.description = profile.description || jsonLd.description;
      if (jsonLd.url) profile.website = jsonLd.url;
    } catch (e) { /* ignore parse errors */ }
  }

  // Extract data from page content using common patterns
  // Look for table data or structured sections
  const textContent = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // Investor type patterns
  const typePatterns = [
    /Venture Capital/i, /Angel Investor/i, /Private Equity/i,
    /Family Office/i, /Corporate VC/i, /Accelerator/i,
    /Micro VC/i, /Growth Equity/i, /CVC/i,
  ];
  for (const p of typePatterns) {
    if (p.test(textContent)) {
      profile.investor_type = textContent.match(p)[0];
      break;
    }
  }

  // Extract links
  const linkedinMatch = html.match(/href="(https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^"]+)"/i);
  if (linkedinMatch) profile.linkedin_url = linkedinMatch[1];

  const websiteMatch = html.match(/href="(https?:\/\/(?!www\.fishtank\.vc)[^"]+\.(com|io|vc|fund|co)[^"]*)"/i);
  if (websiteMatch) profile.website = profile.website || websiteMatch[1];

  // Extract location patterns
  const locationPatterns = [
    /(?:based in|located in|headquarters:?\s*)([^,.]+(?:,\s*[A-Z]{2})?(?:,\s*\w+)?)/i,
    /((?:San Francisco|New York|London|Berlin|Singapore|Toronto|Tel Aviv|Austin|Boston|Chicago|Los Angeles|Seattle|Mumbai|Nairobi|Lagos)[^,.]*)/i,
  ];
  for (const p of locationPatterns) {
    const m = textContent.match(p);
    if (m) { profile.location = m[1].trim(); break; }
  }

  // Investment stages
  const stagePatterns = /((?:Pre-?seed|Seed|Series [A-Z]+|Growth|Late Stage|Buyout|Bridge|Extension)(?:\s*,\s*(?:Pre-?seed|Seed|Series [A-Z]+|Growth|Late Stage|Buyout|Bridge|Extension))*)/i;
  const stageMatch = textContent.match(stagePatterns);
  if (stageMatch) profile.investment_stages = stageMatch[1];

  // Sectors/industries
  const sectorPatterns = /((?:SaaS|Fintech|Healthcare|AI|Machine Learning|E-commerce|EdTech|CleanTech|BioTech|Cybersecurity|Enterprise|B2B|B2C|Marketplace|Consumer|Deep Tech|Climate|InsurTech|PropTech|DevTools|Infrastructure)(?:\s*,\s*(?:SaaS|Fintech|Healthcare|AI|Machine Learning|E-commerce|EdTech|CleanTech|BioTech|Cybersecurity|Enterprise|B2B|B2C|Marketplace|Consumer|Deep Tech|Climate|InsurTech|PropTech|DevTools|Infrastructure))*)/i;
  const sectorMatch = textContent.match(sectorPatterns);
  if (sectorMatch) profile.sectors = sectorMatch[1];

  return profile;
}

/**
 * Scrape a batch of URLs with concurrency control
 */
async function scrapeBatch(urls, batchSize = CONCURRENCY) {
  const results = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const promises = batch.map(async (url) => {
      try {
        const html = await fetchUrl(url);
        return parseProfilePage(html, url);
      } catch (e) {
        return { source_url: url, error: e.message };
      }
    });
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);

    process.stdout.write(
      `\r   Scraped ${results.length.toLocaleString()} / ${urls.length.toLocaleString()} profiles...`
    );

    if (i + batchSize < urls.length) {
      await sleep(DELAY_MS);
    }
  }
  console.log();
  return results;
}

/**
 * Load checkpoint for resume
 */
function loadCheckpoint() {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf8"));
  }
  return { lastIndex: 0, count: 0 };
}

function saveCheckpoint(lastIndex, count) {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastIndex, count, timestamp: new Date().toISOString() }));
}

/**
 * Merge new results with existing data (deduplicate by source_url)
 */
function mergeResults(existing, newResults) {
  const urlMap = new Map();
  for (const inv of existing) {
    if (inv.source_url) urlMap.set(inv.source_url, inv);
  }
  for (const inv of newResults) {
    if (inv.source_url && !inv.error) {
      urlMap.set(inv.source_url, inv);
    }
  }
  return Array.from(urlMap.values());
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const resume = args.includes("--resume");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : Infinity;

  ensureDir(BACKUP_DIR);

  console.log("═══════════════════════════════════════════════");
  console.log("  FishTank VC Investor Scraper");
  console.log("═══════════════════════════════════════════════\n");

  if (dryRun) {
    console.log("🧪 DRY RUN — testing with 10 profiles\n");
  }

  // Get sitemap URLs
  let urls = await getSitemapUrls();

  // Apply limit
  if (dryRun) urls = urls.slice(0, 10);
  else if (limit < Infinity) urls = urls.slice(0, limit);

  // Resume from checkpoint
  let startIndex = 0;
  let existingResults = [];
  if (resume && fs.existsSync(RESULTS_FILE)) {
    existingResults = JSON.parse(fs.readFileSync(RESULTS_FILE, "utf8"));
    const checkpoint = loadCheckpoint();
    startIndex = checkpoint.lastIndex;
    console.log(`   Resuming from index ${startIndex} (${existingResults.length} existing results)\n`);
  }

  const urlsToScrape = urls.slice(startIndex);
  console.log(`📊 Scraping ${urlsToScrape.length.toLocaleString()} profiles (concurrency: ${CONCURRENCY})...\n`);

  // Scrape
  const startTime = Date.now();
  const results = await scrapeBatch(urlsToScrape);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n   Completed in ${elapsed}s\n`);

  // Merge with existing
  const allResults = mergeResults(existingResults, results);

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const resultsPath = dryRun
    ? path.join(BACKUP_DIR, `fishtank-test-${timestamp}.json`)
    : RESULTS_FILE;
  fs.writeFileSync(resultsPath, JSON.stringify(allResults, null, 2));
  console.log(`   💾 Saved ${allResults.length.toLocaleString()} profiles to ${resultsPath}`);

  // Save checkpoint
  if (!dryRun) {
    saveCheckpoint(startIndex + urlsToScrape.length, allResults.length);
  }

  // Stats
  const withEmail = allResults.filter((r) => r.email).length;
  const withLinkedIn = allResults.filter((r) => r.linkedin_url).length;
  const withType = allResults.filter((r) => r.investor_type).length;
  const errors = results.filter((r) => r.error).length;

  console.log("\n═══════════════════════════════════════════════");
  console.log("  FishTank VC Scrape Results");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Total profiles: ${allResults.length.toLocaleString()}`);
  console.log(`  New this run: ${results.filter((r) => !r.error).length.toLocaleString()}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  With email: ${withEmail}`);
  console.log(`  With LinkedIn: ${withLinkedIn}`);
  console.log(`  With investor type: ${withType}`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message);
  process.exit(1);
});
