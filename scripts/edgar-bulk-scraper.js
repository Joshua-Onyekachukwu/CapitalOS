#!/usr/bin/env node
/**
 * Capital OS — Comprehensive EDGAR Investor Scraper
 * ==================================================
 * Scrapes multiple SEC EDGAR filing types to build a massive
 * investor database from REAL public data.
 *
 * Sources:
 *   1. 13F-HR  — Institutional investors (hedge funds, mutual funds, RIAs)
 *   2. Form D   — Private placement fund filings (VC, PE, angels)
 *   3. N-CEN    — Registered fund census data
 *   4. CIK enrichment — Detailed info from data.sec.gov per filer
 *
 * Every run saves physical CSV + JSON backups to backups/edgar/
 * so you NEVER lose data again.
 *
 * Usage:
 *   node scripts/edgar-bulk-scraper.js                    # All sources, 10 years
 *   node scripts/edgar-bulk-scraper.js --13f              # 13F-HR only
 *   node scripts/edgar-bulk-scraper.js --form-d           # Form D only
 *   node scripts/edgar-bulk-scraper.js --ncen             # N-CEN only
 *   node scripts/edgar-bulk-scraper.js --days 365         # Last year only
 *   node scripts/edgar-bulk-scraper.js --enrich           # Enrich existing data
 *   node scripts/edgar-bulk-scraper.js --stats            # Show database stats
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

// ── Configuration ──
const CRDB_URL = process.env.DATABASE_URL;
const BACKUP_DIR = path.join(__dirname, "..", "backups", "edgar");
const BATCH_SIZE = 500;
const RATE_LIMIT_MS = 120; // SEC asks for 10 req/sec max
const EFTS_BASE = "https://efts.sec.gov/LATEST/search-index";
const DATA_SEC = "https://data.sec.gov";
const UA = "CapitalOS/1.0 (investor-research@capitalos.io)";

// ── Helpers ──
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

let lastRequest = 0;
async function rateLimitedFetch(url) {
  const wait = RATE_LIMIT_MS - (Date.now() - lastRequest);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequest = Date.now();
  return fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
}

function classifyInvestor(name, state, sic) {
  const lower = (name || "").toLowerCase();
  const isBank = /bank|trust|savings|credit union/.test(lower);
  const isInsurance = /insurance|life|annuity|mutual/.test(lower);
  const isPension = /pension|retirement|benefit/.test(lower);
  const isEndowment = /endowment|foundation|university/.test(lower);
  const isFund = /fund|capital|partners|ventures|advisors?|management|invest/.test(lower);

  if (isPension) return "pension_fund";
  if (isEndowment) return "endowment";
  if (isInsurance) return "insurance_company";
  if (isBank) return "bank";
  if (isFund) return "institutional_investor";
  return "institutional_investor";
}

function stateToCountry(state) {
  const usStates = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC","AR"];
  if (usStates.includes(state)) return "United States";
  if (state === "X0") return "United Kingdom"; // SEC code for UK
  if (state === "C9") return "Belgium"; // SEC code for Belgium
  if (state === "E9") return "Cayman Islands"; // SEC code for Cayman
  if (state === "D0") return "Luxembourg"; // SEC code for Luxembourg
  if (state === "V8") return "Switzerland";
  if (state && state.length === 2) return "United States";
  return null;
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

async function batchInsert(client, investors) {
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
  const rows = [];
  const params = [];
  let idx = 1;

  for (const inv of investors) {
    rows.push(`(${cols.map(() => `$${idx++}`).join(",")})`);
    const name = (inv.full_name || "").trim();
    const parts = name.split(/\s+/);
    const first = parts[0] || "";
    const last = parts.slice(1).join(" ") || "";
    params.push(
      uuid(), name, first, last, inv.email || null, inv.phone || null,
      inv.linkedin_url || null, inv.job_title || null, inv.bio || null,
      inv.location || null, inv.country || null, inv.city || null,
      inv.investor_type || "institutional_investor",
      JSON.stringify(inv.investment_stages || []),
      JSON.stringify(inv.investment_sectors || []),
      JSON.stringify(inv.investment_geographies || []),
      inv.min_check_size || null, inv.max_check_size || null,
      inv.currency || "USD", inv.portfolio_count || null,
      inv.website_url || null, inv.source || "edgar_bulk",
      inv.source_id || null, inv.data_quality_score || 60,
      "needs_verification", true, false,
      new Date().toISOString(), new Date().toISOString()
    );
  }

  const sql = `INSERT INTO investors (${cols.join(",")}) VALUES ${rows.join(",")} ON CONFLICT DO NOTHING`;
  const result = await client.query(sql, params);
  return result.rowCount || 0;
}

function saveBackup(data, name) {
  ensureBackupDir();
  const ts = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(BACKUP_DIR, `${name}-${ts}.json`);
  const csvPath = path.join(BACKUP_DIR, `${name}-${ts}.csv`);

  // Save JSON
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  console.log(`   💾 JSON saved: ${jsonPath} (${data.length} records)`);

  // Save CSV
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    const csvLines = [headers.join(",")];
    for (const row of data) {
      csvLines.push(headers.map((h) => `"${String(row[h] || "").replace(/"/g, '""')}"`).join(","));
    }
    fs.writeFileSync(csvPath, csvLines.join("\n"));
    console.log(`   💾 CSV saved:  ${csvPath}`);
  }

  return { jsonPath, csvPath };
}

// ── Source 1: 13F-HR (Institutional Investors) ──
async function scrape13FHR(client, days) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 1: 13F-HR — Institutional Investors");
  console.log("═══════════════════════════════════════════════\n");

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  console.log(`📅 Date range: ${startDate} to ${endDate}`);

  // Step 1: Get all 13F-HR filing indices
  let offset = 0;
  const size = 100;
  let allFilings = [];
  let hasMore = true;

  while (hasMore) {
    const url = `${EFTS_BASE}?q=13F-HR&forms=13F-HR&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=${size}`;
    process.stdout.write(`\r  📋 Fetching 13F-HR index: offset ${offset} (${allFilings.length} filings)`);

    const res = await rateLimitedFetch(url);
    if (!res.ok) { console.log(`\n  ❌ HTTP ${res.status}`); break; }

    const data = await res.json();
    const hits = data.hits?.hits || [];
    if (hits.length === 0) break;

    for (const hit of hits) {
      const src = hit._source || {};
      allFilings.push({
        cik: (src.ciks || [])[0],
        name: (src.display_names || [""])[0].replace(/\s*\(CIK.*\)/, "").trim(),
        form: src.form,
        fileDate: src.file_date,
        periodEnding: src.period_ending,
        state: (src.biz_states || [])[0] || null,
        adsh: src.adsh,
      });
    }

    offset += size;
    if (offset >= 10000 || hits.length < size) hasMore = false;
  }

  console.log(`\n\n  📊 Found ${allFilings.length} 13F-HR filings`);

  // Step 2: Deduplicate by CIK (keep most recent filing per entity)
  const byCik = {};
  for (const f of allFilings) {
    if (!f.cik || !f.name) continue;
    if (!byCik[f.cik] || f.fileDate > byCik[f.cik].fileDate) {
      byCik[f.cik] = f;
    }
  }
  const uniqueFilings = Object.values(byCik);
  console.log(`  📊 Unique filers: ${uniqueFilings.length}`);

  // Step 3: Enrich with CIK details (batch from data.sec.gov)
  console.log(`\n  🔍 Enriching filer details from data.sec.gov...\n`);

  const enrichedData = [];
  let enriched = 0;
  let failed = 0;

  for (const filing of uniqueFilings) {
    if (!filing.cik) continue;
    process.stdout.write(`\r  🔍 Enriching: ${enriched}/${uniqueFilings.length} (${failed} failed)`);

    try {
      const cikPadded = filing.cik.padStart(10, "0");
      const res = await rateLimitedFetch(`${DATA_SEC}/submissions/CIK${cikPadded}.json`);
      if (!res.ok) { failed++; continue; }

      const data = await res.json();
      const state = filing.state || data.addresses?.business?.state || null;
      const country = stateToCountry(state);
      const city = data.addresses?.business?.city || null;
      const zip = data.addresses?.business?.zip || null;
      const phone = data.phones?.business || data.phones?.voice || null;
      const website = data.websites?.[0] || null;

      // Determine investor type from SIC code
      const sic = (data.sics || [])[0] || null;
      const sicDesc = (data.sicDescriptions || {})[sic] || "";
      let investorType = "institutional_investor";
      if (/bank|trust/.test(sicDesc)) investorType = "bank";
      else if (/insurance|life/.test(sicDesc)) investorType = "insurance_company";
      else if (/security brokers|investment/.test(sicDesc)) investorType = "broker_dealer";

      enrichedData.push({
        full_name: data.name || filing.name,
        job_title: investorType === "institutional_investor" ? "Institutional Investor" : sicDesc || "Investment Firm",
        bio: `SEC-registered entity. SIC: ${sic || "N/A"}. Last filing: ${filing.form} on ${filing.fileDate}.`,
        location: [city, state, country].filter(Boolean).join(", "),
        country: country || "United States",
        city: city || null,
        investor_type: investorType,
        investment_stages: [],
        investment_sectors: [],
        investment_geographies: country ? [country] : ["United States"],
        source: "edgar_13f_hr",
        source_id: filing.cik,
        data_quality_score: 75,
        website_url: website,
        phone: phone,
      });

      enriched++;
    } catch (e) {
      failed++;
    }
  }

  console.log(`\n\n  ✅ Enriched ${enriched} filers (${failed} failed)`);

  // Step 4: Save backup
  saveBackup(enrichedData, "13f-hr-investors");

  // Step 5: Insert into CockroachDB
  console.log(`\n  💾 Inserting into CockroachDB...`);
  let totalInserted = 0;
  for (let i = 0; i < enrichedData.length; i += BATCH_SIZE) {
    const batch = enrichedData.slice(i, i + BATCH_SIZE);
    const inserted = await batchInsert(client, batch);
    totalInserted += inserted;
    process.stdout.write(`\r  💾 ${Math.min(i + BATCH_SIZE, enrichedData.length)}/${enrichedData.length} (${totalInserted} inserted)`);
  }

  console.log(`\n\n  ✅ 13F-HR complete: ${totalInserted} investors inserted`);
  return { count: totalInserted, data: enrichedData };
}

// ── Source 2: Form D (Private Placements) ──
async function scrapeFormD(client, days) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 2: Form D — Private Placements");
  console.log("═══════════════════════════════════════════════\n");

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  console.log(`📅 Date range: ${startDate} to ${endDate}`);

  let offset = 0;
  const size = 100;
  let allData = [];
  let hasMore = true;

  while (hasMore) {
    const url = `${EFTS_BASE}?q=D&forms=D&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=${size}`;
    process.stdout.write(`\r  📋 Fetching Form D index: offset ${offset} (${allData.length} filings)`);

    const res = await rateLimitedFetch(url);
    if (!res.ok) { console.log(`\n  ❌ HTTP ${res.status}`); break; }

    const data = await res.json();
    const hits = data.hits?.hits || [];
    if (hits.length === 0) break;

    for (const hit of hits) {
      const src = hit._source || {};
      const names = src.display_names || [];
      const locations = src.biz_locations || [];
      const ciks = src.ciks || [];

      for (let i = 0; i < names.length; i++) {
        const name = names[i].replace(/\s*\(CIK.*\)/, "").trim();
        if (!name || name.length < 3) continue;
        allData.push({
          full_name: name,
          cik: ciks[i] || null,
          fileDate: src.file_date,
          location: locations[i] || null,
          adsh: src.adsh,
        });
      }
    }

    offset += size;
    if (offset >= 10000 || hits.length < size) hasMore = false;
  }

  console.log(`\n\n  📊 Found ${allData.length} Form D entities`);

  // Deduplicate by name
  const uniqueMap = {};
  for (const d of allData) {
    const key = d.full_name.toLowerCase();
    if (!uniqueMap[key] || d.fileDate > uniqueMap[key].fileDate) {
      uniqueMap[key] = d;
    }
  }
  const uniqueData = Object.values(uniqueMap);
  console.log(`  📊 Unique entities: ${uniqueData.length}`);

  // Transform to investors
  const investors = uniqueData.map((d) => ({
    full_name: d.full_name,
    job_title: "Investment Fund",
    bio: `SEC Form D filing. Last filed: ${d.fileDate}.`,
    location: d.location || null,
    country: "United States",
    city: d.location?.split(",")[0]?.trim() || null,
    investor_type: /fund|capital|ventures|partners/.test(d.full_name.toLowerCase()) ? "venture_capital" : "private_equity",
    investment_stages: [],
    investment_sectors: [],
    investment_geographies: ["United States"],
    source: "edgar_form_d",
    source_id: d.adsh || d.cik,
    data_quality_score: 65,
  }));

  // Save backup
  saveBackup(investors, "form-d-investors");

  // Insert
  console.log(`\n  💾 Inserting into CockroachDB...`);
  let totalInserted = 0;
  for (let i = 0; i < investors.length; i += BATCH_SIZE) {
    const batch = investors.slice(i, i + BATCH_SIZE);
    const inserted = await batchInsert(client, batch);
    totalInserted += inserted;
    process.stdout.write(`\r  💾 ${Math.min(i + BATCH_SIZE, investors.length)}/${investors.length} (${totalInserted} inserted)`);
  }

  console.log(`\n\n  ✅ Form D complete: ${totalInserted} investors inserted`);
  return { count: totalInserted, data: investors };
}

// ── Source 3: N-CEN (Registered Fund Census) ──
async function scrapeNCEN(client, days) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 3: N-CEN — Registered Fund Census");
  console.log("═══════════════════════════════════════════════\n");

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  console.log(`📅 Date range: ${startDate} to ${endDate}`);

  let offset = 0;
  const size = 100;
  let allData = [];
  let hasMore = true;

  while (hasMore) {
    const url = `${EFTS_BASE}?q=N-CEN&forms=N-CEN&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=${size}`;
    process.stdout.write(`\r  📋 Fetching N-CEN index: offset ${offset} (${allData.length} filings)`);

    const res = await rateLimitedFetch(url);
    if (!res.ok) { console.log(`\n  ❌ HTTP ${res.status}`); break; }

    const data = await res.json();
    const hits = data.hits?.hits || [];
    if (hits.length === 0) break;

    for (const hit of hits) {
      const src = hit._source || {};
      const names = src.display_names || [];
      const ciks = src.ciks || [];

      for (let i = 0; i < names.length; i++) {
        const name = names[i].replace(/\s*\(CIK.*\)/, "").trim();
        if (!name || name.length < 3) continue;
        allData.push({
          full_name: name,
          cik: ciks[i] || null,
          fileDate: src.file_date,
          state: (src.biz_states || [])[0] || null,
        });
      }
    }

    offset += size;
    if (offset >= 10000 || hits.length < size) hasMore = false;
  }

  console.log(`\n\n  📊 Found ${allData.length} N-CEN filings`);

  // Deduplicate by CIK
  const uniqueMap = {};
  for (const d of allData) {
    if (!d.cik) continue;
    if (!uniqueMap[d.cik] || d.fileDate > uniqueMap[d.cik].fileDate) {
      uniqueMap[d.cik] = d;
    }
  }
  const uniqueData = Object.values(uniqueMap);
  console.log(`  📊 Unique registered funds: ${uniqueData.length}`);

  // Transform
  const investors = uniqueData.map((d) => ({
    full_name: d.full_name,
    job_title: "Registered Investment Fund",
    bio: `SEC-registered fund. N-CEN filing: ${d.fileDate}.`,
    location: d.state || null,
    country: stateToCountry(d.state) || "United States",
    investor_type: "institutional_investor",
    investment_stages: [],
    investment_sectors: [],
    investment_geographies: [stateToCountry(d.state) || "United States"],
    source: "edgar_ncen",
    source_id: d.cik,
    data_quality_score: 70,
  }));

  // Save backup
  saveBackup(investors, "ncen-funds");

  // Insert
  console.log(`\n  💾 Inserting into CockroachDB...`);
  let totalInserted = 0;
  for (let i = 0; i < investors.length; i += BATCH_SIZE) {
    const batch = investors.slice(i, i + BATCH_SIZE);
    const inserted = await batchInsert(client, batch);
    totalInserted += inserted;
    process.stdout.write(`\r  💾 ${Math.min(i + BATCH_SIZE, investors.length)}/${investors.length} (${totalInserted} inserted)`);
  }

  console.log(`\n\n  ✅ N-CEN complete: ${totalInserted} investors inserted`);
  return { count: totalInserted, data: investors };
}

// ── Stats Mode ──
async function showStats(client) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Database Statistics");
  console.log("═══════════════════════════════════════════════\n");

  const total = await client.query("SELECT COUNT(*)::int as count FROM investors");
  console.log(`📊 Total investors: ${total.rows[0].count}`);

  const bySource = await client.query(`
    SELECT source, COUNT(*)::int as count,
           COUNT(*) FILTER (WHERE email IS NOT NULL AND email != '')::int as with_email,
           COUNT(*) FILTER (WHERE linkedin_url IS NOT NULL AND linkedin_url != '')::int as with_linkedin,
           ROUND(AVG(data_quality_score), 1)::float as avg_quality
    FROM investors GROUP BY source ORDER BY count DESC
  `);
  console.log("\nBy Source:");
  console.table(bySource.rows);

  const byType = await client.query(`
    SELECT investor_type, COUNT(*)::int as count
    FROM investors GROUP BY investor_type ORDER BY count DESC
  `);
  console.log("By Type:");
  console.table(byType.rows);

  const byReadiness = await client.query(`
    SELECT outreach_readiness, COUNT(*)::int as count
    FROM investors GROUP BY outreach_readiness ORDER BY count DESC
  `);
  console.log("By Outreach Readiness:");
  console.table(byReadiness.rows);

  const byCountry = await client.query(`
    SELECT COALESCE(country, '(null)') as country, COUNT(*)::int as count
    FROM investors GROUP BY country ORDER BY count DESC LIMIT 15
  `);
  console.log("Top 15 Countries:");
  console.table(byCountry.rows);

  // Check backups
  if (fs.existsSync(BACKUP_DIR)) {
    const backups = fs.readdirSync(BACKUP_DIR);
    console.log(`\n💾 Backup files in backups/edgar/: ${backups.length}`);
    for (const f of backups.slice(-10)) {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      console.log(`   ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
    }
  }
}

// ── Main ──
async function main() {
  const args = process.argv.slice(2);
  const startTime = Date.now();

  const do13f = args.includes("--13f") || args.length === 0 || (!args.includes("--form-d") && !args.includes("--ncen") && !args.includes("--stats") && !args.includes("--enrich"));
  const doFormD = args.includes("--form-d") || args.length === 0 || (!args.includes("--13f") && !args.includes("--ncen") && !args.includes("--stats") && !args.includes("--enrich"));
  const doNCEN = args.includes("--ncen") || args.length === 0 || (!args.includes("--13f") && !args.includes("--form-d") && !args.includes("--stats") && !args.includes("--enrich"));
  const doStats = args.includes("--stats");
  const dayIdx = args.indexOf("--days");
  const days = dayIdx >= 0 ? parseInt(args[dayIdx + 1]) : 3650; // Default 10 years

  const client = await connectDb();

  if (doStats) {
    await showStats(client);
    await client.end();
    return;
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Capital OS — Bulk EDGAR Investor Scraper");
  console.log("═══════════════════════════════════════════════");
  console.log(`\n  Sources: ${[do13f && "13F-HR", doFormD && "Form D", doNCEN && "N-CEN"].filter(Boolean).join(", ")}`);
  console.log(`  Date range: ${days} days`);
  console.log(`  Backup dir: ${BACKUP_DIR}\n`);

  let totalCount = 0;
  const allData = {};

  try {
    if (do13f) {
      const result = await scrape13FHR(client, days);
      totalCount += result.count;
      allData["13f-hr"] = result.data;
    }

    if (doFormD) {
      const result = await scrapeFormD(client, days);
      totalCount += result.count;
      allData["form-d"] = result.data;
    }

    if (doNCEN) {
      const result = await scrapeNCEN(client, days);
      totalCount += result.count;
      allData["ncen"] = result.data;
    }

    // Save combined backup
    ensureBackupDir();
    const ts = new Date().toISOString().slice(0, 10);
    const combinedPath = path.join(BACKUP_DIR, `combined-${ts}.json`);
    fs.writeFileSync(combinedPath, JSON.stringify(allData, null, 2));
    console.log(`\n💾 Combined backup saved: ${combinedPath}`);

  } catch (err) {
    console.error(`\n💥 Fatal error: ${err.message}`);
  }

  await client.end();

  // Show final stats
  await showStats(await connectDb().then(async (c) => { await c.end(); return c; }).catch(() => null));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️  Total time: ${elapsed}s`);
  console.log(`📊 Total investors inserted: ${totalCount}`);
}

main().catch((err) => {
  console.error("💥 Fatal:", err.message);
  process.exit(1);
});
