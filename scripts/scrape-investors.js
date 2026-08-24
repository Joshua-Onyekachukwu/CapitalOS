#!/usr/bin/env node
/**
 * Capital OS — Investor Scraping Engine
 * ======================================
 * Three data sources, one pipeline:
 *
 *   1. CSV Import (works on Trial plan)
 *      - Export CSVs from Apollo web dashboard
 *      - Place in test-data/ directory
 *      - Run: node scripts/scrape-investors.js --csv <file>
 *
 *   2. Apollo API (requires paid plan)
 *      - Searches for investors by keyword
 *      - Batch-scrapes 10K+ investors
 *      - Run: node scripts/scrape-investors.js --api --keywords "venture capital"
 *
 *   3. EDGAR Form D (free, always works)
 *      - Scrapes SEC Form D filings from investment funds
 *      - Run: node scripts/scrape-investors.js --edgar --days 90
 *
 * Usage:
 *   node scripts/scrape-investors.js --csv test-data/my-export.csv
 *   node scripts/scrape-investors.js --api --keywords "seed stage VC" --limit 10000
 *   node scripts/scrape-investors.js --edgar --days 180
 *   node scripts/scrape-investors.js --csv test-data/*.csv  (multiple files)
 *
 * All modes write directly to CockroachDB via the shared connection pool.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// ── Configuration ──

const CRDB_URL = process.env.DATABASE_URL;
const APOLLO_KEY = process.env.APOLLO_API_KEY;
const BATCH_SIZE = 200;
const APOLLO_RATE_LIMIT_MS = 500; // 2 req/sec (safe for trial)
const EDGAR_RATE_LIMIT_MS = 150;  // ~7 req/sec (polite to SEC)

// ── Helpers ──

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(content) {
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

function normalizeName(str) {
  return (str || "").trim().replace(/\s+/g, " ");
}

function inferInvestorType(row) {
  const title = (row.job_title || row.title || "").toLowerCase();
  const type = (row.investor_type || row.type || "").toLowerCase();
  if (type.includes("vc") || type.includes("venture") || title.includes("partner") || title.includes("gp")) return "venture_capital";
  if (type.includes("angel") || title.includes("angel")) return "angel_investor";
  if (type.includes("pe") || type.includes("private equity") || title.includes("managing director")) return "private_equity";
  if (type.includes("corp") || type.includes("corporate") || title.includes("corporate")) return "corporate_venture";
  if (type.includes("family") || title.includes("family office")) return "family_office";
  if (type.includes("accelerator") || type.includes("incubator")) return "accelerator";
  if (type.includes("impact")) return "impact_investor";
  return "angel_investor"; // safe default
}

function normalizeStage(val) {
  const s = val.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
  const map = { preseed: "pre_seed", seed: "seed", seriesa: "series_a", seriesb: "series_b", seriesc: "series_c", growth: "growth", latestage: "late_stage", preipo: "pre_ipo" };
  return map[s] || null;
}

function normalizeSector(val) {
  return val.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function parseArrayField(val, normalizer) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(normalizer).filter(Boolean);
  return String(val).split(/[;,|]/).map(normalizer).filter(Boolean);
}

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── Database ──

async function connectDb() {
  const client = new Client({
    connectionString: CRDB_URL,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  return client;
}

async function batchInsertInvestors(client, investors) {
  if (!investors.length) return 0;

  const cols = [
    "id", "full_name", "first_name", "last_name", "email", "phone",
    "linkedin_url", "job_title", "bio", "location", "country", "city",
    "investor_type", "investment_stages", "investment_sectors",
    "investment_geographies", "min_check_size", "max_check_size",
    "currency", "portfolio_count", "website_url", "source", "source_id",
    "data_quality_score", "outreach_readiness", "is_active", "is_verified",
    "created_at", "updated_at",
  ];

  const placeholders = [];
  const params = [];
  let idx = 1;

  for (const inv of investors) {
    placeholders.push(`(${cols.map(() => `$${idx++}`).join(",")})`);
    params.push(
      uuid(),
      normalizeName(inv.full_name || `${inv.first_name || ""} ${inv.last_name || ""}`),
      normalizeName(inv.first_name || ""),
      normalizeName(inv.last_name || ""),
      inv.email || null,
      inv.phone || null,
      inv.linkedin_url || null,
      inv.job_title || inv.title || null,
      inv.bio || inv.description || null,
      inv.location || null,
      inv.country || null,
      inv.city || null,
      inferInvestorType(inv),
      parseArrayField(inv.investment_stages || inv.stages, normalizeStage),
      parseArrayField(inv.investment_sectors || inv.sectors, normalizeSector),
      parseArrayField(inv.investment_geographies || inv.geographies || inv.country, (s) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "")),
      inv.min_check_size ? Number(inv.min_check_size) : null,
      inv.max_check_size ? Number(inv.max_check_size) : null,
      inv.currency || "USD",
      inv.portfolio_count ? Number(inv.portfolio_count) : null,
      inv.website_url || inv.company_url || null,
      inv.source || "apollo_csv",
      inv.source_id || inv.id || null,
      inv.data_quality_score ? Number(inv.data_quality_score) : 75,
      "needs_verification",
      true,
      false,
      new Date().toISOString(),
      new Date().toISOString()
    );
  }

  const sql = `
    INSERT INTO investors (${cols.join(",")})
    VALUES ${placeholders.join(",")}
    ON CONFLICT DO NOTHING
  `;

  const result = await client.query(sql, params);
  return result.rowCount || 0;
}

// ── CSV Import Mode ──

async function importCsvFiles(files) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  CSV Import Mode");
  console.log("═══════════════════════════════════════════════\n");

  const client = await connectDb();
  let totalInserted = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.resolve(file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ❌ File not found: ${filePath}`);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const rows = parseCsv(content);
    console.log(`\n📄 ${path.basename(filePath)}: ${rows.length} rows`);

    // Filter to investor-like rows
    const investors = rows.filter((r) => {
      const name = r.full_name || r.name || `${r.first_name || ""} ${r.last_name || ""}`;
      return name.trim().length > 1;
    });

    console.log(`  Filtered: ${investors.length} investor records`);

    // Batch insert
    for (let i = 0; i < investors.length; i += BATCH_SIZE) {
      const batch = investors.slice(i, i + BATCH_SIZE);
      const inserted = await batchInsertInvestors(client, batch);
      totalInserted += inserted;
      totalSkipped += batch.length - inserted;
      process.stdout.write(`\r  📝 ${Math.min(i + BATCH_SIZE, investors.length)}/${investors.length} (${inserted} inserted)`);
    }
    console.log("");
  }

  await client.end();
  console.log(`\n✅ CSV import complete: ${totalInserted} inserted, ${totalSkipped} skipped (duplicates)`);
  return totalInserted;
}

// ── Apollo API Mode ──

async function scrapeApolloApi(keywords, limit) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Apollo API Scraping Mode");
  console.log("═══════════════════════════════════════════════\n");

  if (!APOLLO_KEY) {
    console.error("❌ APOLLO_API_KEY not set in .env.local");
    process.exit(1);
  }

  // Test API access first
  console.log("🔑 Testing API access...");
  const testRes = await fetch("https://api.apollo.io/v1/people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY },
    body: JSON.stringify({ q_keywords: "test", per_page: 1 }),
  });
  const testData = await testRes.json();
  if (testData.error) {
    console.error(`❌ API Error: ${testData.error.slice(0, 120)}`);
    console.error("\n   Your Apollo plan doesn't include the People Search API.");
    console.error("   Options:");
    console.error("   1. Upgrade to Apollo Pro ($49/month) for full API access");
    console.error("   2. Export CSVs from Apollo web dashboard and use --csv mode");
    console.error("   3. Use --edgar mode for free SEC Form D data");
    process.exit(1);
  }

  console.log("✅ API access confirmed\n");

  const client = await connectDb();
  let totalInserted = 0;
  let page = 1;
  const perPage = 100; // Apollo max per page

  while (totalInserted < limit) {
    const remaining = limit - totalInserted;
    const batchSize = Math.min(perPage, remaining);

    process.stdout.write(`\r  🔍 Page ${page}: searching "${keywords}" (${totalInserted}/${limit} inserted)`);

    const res = await fetch("https://api.apollo.io/v1/people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": APOLLO_KEY },
      body: JSON.stringify({
        q_keywords: keywords,
        per_page: batchSize,
        page: page,
        person_titles: ["partner", "managing partner", "general partner", "principal", "director", "vp"],
        organization_industry_tag_ids: [],
      }),
    });

    const data = await res.json();
    const people = data.people || [];

    if (people.length === 0) {
      console.log("\n  ⚠️  No more results");
      break;
    }

    // Transform to our schema
    const investors = people.map((p) => ({
      full_name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email,
      phone: p.phone_numbers?.[0]?.sanitized_number || null,
      linkedin_url: p.linkedin_url,
      job_title: p.title,
      bio: p.headline || null,
      location: p.city ? `${p.city}, ${p.state || ""}, ${p.country || ""}`.trim() : null,
      country: p.country,
      city: p.city,
      investor_type: inferInvestorType({ job_title: p.title }),
      investment_stages: [],
      investment_sectors: p.organization?.industry_tag_names || [],
      investment_geographies: p.country ? [p.country] : [],
      portfolio_count: p.organization?.estimated_num_employees || null,
      website_url: p.organization?.website_url || null,
      source: "apollo_api",
      source_id: p.id,
      data_quality_score: p.email ? 85 : 60,
    }));

    const inserted = await batchInsertInvestors(client, investors);
    totalInserted += inserted;
    page++;

    // Rate limit
    await new Promise((r) => setTimeout(r, APOLLO_RATE_LIMIT_MS));
  }

  await client.end();
  console.log(`\n\n✅ Apollo scraping complete: ${totalInserted} investors inserted`);
  return totalInserted;
}

// ── EDGAR Mode ──

let edgarLastRequest = 0;
async function edgarFetch(url) {
  const wait = EDGAR_RATE_LIMIT_MS - (Date.now() - edgarLastRequest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  edgarLastRequest = Date.now();
  return fetch(url, {
    headers: {
      "User-Agent": "CapitalOS/1.0 (investor-research@capitalos.io)",
      Accept: "application/json",
    },
  });
}

async function scrapeEdgar(days) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  EDGAR Form D Scraping Mode");
  console.log("═══════════════════════════════════════════════\n");

  const client = await connectDb();
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  console.log(`📅 Date range: ${startDate} to ${endDate}`);
  console.log(`🔍 Searching for Form D filings from investment funds...\n`);

  let totalInserted = 0;
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const url = `https://efts.sec.gov/LATEST/search-index?q=%22Form+D%22&dateRange=custom&startdt=${startDate}&enddt=${endDate}&forms=D&_source=display_names,file_date,biz_locations,ciks&from=${offset}&size=${limit}`;

    process.stdout.write(`\r  📋 Fetching filings: offset ${offset} (${totalInserted} investors so far)`);

    const res = await edgarFetch(url);
    if (!res.ok) {
      console.log(`\n  ❌ EDGAR error: ${res.status}`);
      break;
    }

    const data = await res.json();
    const hits = data.hits?.hits || [];

    if (hits.length === 0) {
      hasMore = false;
      break;
    }

    // Transform Form D filings to investors
    const investors = [];
    for (const hit of hits) {
      const src = hit._source || {};
      const names = src.display_names || [];
      const locations = src.biz_locations || [];

      for (const name of names) {
        // Skip obviously non-fund names
        const lower = name.toLowerCase();
        if (lower.includes("inc.") && !lower.includes("fund") && !lower.includes("capital") && !lower.includes("ventures")) continue;
        if (lower.includes("llc") && !lower.includes("fund") && !lower.includes("capital")) continue;

        const city = locations[0] || null;
        investors.push({
          full_name: name.replace(/\s*\(CIK.*\)/, "").trim(),
          job_title: "Investment Fund",
          location: city,
          country: "United States",
          city: city?.split(",")[0]?.trim() || null,
          investor_type: lower.includes("fund") ? "venture_capital" : "private_equity",
          investment_stages: [],
          investment_sectors: [],
          investment_geographies: ["United States"],
          source: "edgar_form_d",
          source_id: src.adsh || null,
          data_quality_score: 50,
        });
      }
    }

    if (investors.length > 0) {
      const inserted = await batchInsertInvestors(client, investors);
      totalInserted += inserted;
    }

    offset += limit;
    if (hits.length < limit) hasMore = false;
  }

  await client.end();
  console.log(`\n\n✅ EDGAR scraping complete: ${totalInserted} investors inserted from Form D filings`);
  return totalInserted;
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--csv") ? "csv" : args.includes("--api") ? "api" : args.includes("--edgar") ? "edgar" : null;

  if (!mode) {
    console.log(`
Capital OS — Investor Scraping Engine
=====================================

Usage:
  node scripts/scrape-investors.js --csv <file>              Import CSV file(s)
  node scripts/scrape-investors.js --csv file1.csv file2.csv Import multiple CSVs
  node scripts/scrape-investors.js --api --keywords "VC"     Apollo API (paid plan)
  node scripts/scrape-investors.js --api --limit 10000       Scrape 10K investors
  node scripts/scrape-investors.js --edgar --days 90         EDGAR Form D (free)

Examples:
  node scripts/scrape-investors.js --csv test-data/apollo-export.csv
  node scripts/scrape-investors.js --api --keywords "seed stage VC investor" --limit 5000
  node scripts/scrape-investors.js --edgar --days 180

Data flows directly to CockroachDB. No Supabase dependency.
`);
    process.exit(0);
  }

  const startTime = Date.now();

  try {
    if (mode === "csv") {
      const files = args.filter((a) => !a.startsWith("--") && a !== mode);
      if (files.length === 0) {
        // Default to all CSVs in test-data
        const testDir = path.join(__dirname, "..", "test-data");
        if (fs.existsSync(testDir)) {
          files.push(...fs.readdirSync(testDir).filter((f) => f.endsWith(".csv")).map((f) => path.join(testDir, f)));
        }
      }
      if (files.length === 0) {
        console.error("❌ No CSV files found. Place them in test-data/ or specify a path.");
        process.exit(1);
      }
      await importCsvFiles(files);
    } else if (mode === "api") {
      const kwIdx = args.indexOf("--keywords");
      const keywords = kwIdx >= 0 ? args[kwIdx + 1] : "venture capital investor";
      const limIdx = args.indexOf("--limit");
      const limit = limIdx >= 0 ? parseInt(args[limIdx + 1]) : 10000;
      await scrapeApolloApi(keywords, limit);
    } else if (mode === "edgar") {
      const dayIdx = args.indexOf("--days");
      const days = dayIdx >= 0 ? parseInt(args[dayIdx + 1]) : 90;
      await scrapeEdgar(days);
    }
  } catch (err) {
    console.error("\n💥 Fatal error:", err.message);
    process.exit(1);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Total time: ${elapsed}s`);
}

main();
