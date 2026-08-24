#!/usr/bin/env node
/**
 * Capital OS — Optimized EDGAR Bulk Scraper
 * ===========================================
 * Fast scraping of 13F-HR, Form D, N-CEN from SEC EFTS index.
 * No per-filer enrichment (too slow for 10K+ entities).
 * Saves CSV + JSON backups to backups/edgar/
 *
 * Usage:
 *   node scripts/edgar-bulk-fast.js                    # All sources, 10 years
 *   node scripts/edgar-bulk-fast.js --13f              # 13F-HR only
 *   node scripts/edgar-bulk-fast.js --form-d           # Form D only
 *   node scripts/edgar-bulk-fast.js --ncen             # N-CEN only
 *   node scripts/edgar-bulk-fast.js --days 365         # Last year only
 *   node scripts/edgar-bulk-fast.js --stats            # Show stats
 *   node scripts/edgar-bulk-fast.js --clean            # Remove duplicates
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const CRDB_URL = process.env.DATABASE_URL;
const BACKUP_DIR = path.join(__dirname, "..", "backups", "edgar");
const BATCH_SIZE = 500;
const RATE_LIMIT_MS = 130;
const EFTS_BASE = "https://efts.sec.gov/LATEST/search-index";
const UA = "CapitalOS/1.0 (investor-research@capitalos.io)";

function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

let lastReq = 0;
async function eftsFetch(url) {
  const wait = RATE_LIMIT_MS - (Date.now() - lastReq);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastReq = Date.now();
  return fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
}

function stateToCountry(s) {
  const us = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");
  if (us.includes(s)) return "United States";
  const intl = { X0: "United Kingdom", C9: "Belgium", E9: "Cayman Islands", D0: "Luxembourg", V8: "Switzerland", T2: "Germany", J3: "Japan", C3: "France", H3: "Israel", U6: "Singapore" };
  return intl[s] || (s && s.length === 2 ? "United States" : null);
}

function classify(name) {
  const l = (name || "").toLowerCase();
  if (/pension|retirement|benefit/.test(l)) return "fund_of_funds";
  if (/bank|trust|savings/.test(l)) return "strategic_investor";
  if (/insurance|life|annuity/.test(l)) return "strategic_investor";
  if (/endowment|foundation|university/.test(l)) return "university_fund";
  if (/government|federal|state/.test(l)) return "government_fund";
  if (/venture|vc|seed|seed/.test(l)) return "venture_capital";
  if (/private equity|pe |buyout/.test(l)) return "private_equity";
  if (/family office|family/.test(l)) return "family_office";
  if (/accelerator|incubator/.test(l)) return "accelerator";
  if (/angel/.test(l)) return "angel_investor";
  if (/fund|capital|partners|advisors?|management|invest|asset/.test(l)) return "fund_of_funds";
  return "fund_of_funds";
}

// ── Database ──
async function connectDb() {
  const c = new Client({ connectionString: CRDB_URL, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
  await c.connect();
  return c;
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
    params.push(
      uuid(), name, parts[0] || "", parts.slice(1).join(" ") || "",
      null, null, null, inv.job_title || null, inv.bio || null,
      inv.location || null, inv.country || null, inv.city || null,
      inv.investor_type || "fund_of_funds",
      (inv.investment_stages || []).length ? `{${inv.investment_stages.join(",")}}` : null,
      (inv.investment_sectors || []).length ? `{${inv.investment_sectors.join(",")}}` : null,
      (inv.investment_geographies || []).length ? `{${inv.investment_geographies.join(",")}}` : null,
      null, null, "USD", null, inv.website_url || null,
      inv.source || "edgar_bulk", inv.source_id || null,
      inv.data_quality_score || 60, "needs_verification", true, false,
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
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  if (data.length > 0) {
    const h = Object.keys(data[0]);
    const csv = [h.join(","), ...data.map((r) => h.map((k) => `"${String(r[k] || "").replace(/"/g, '""')}"`).join(","))];
    fs.writeFileSync(csvPath, csv.join("\n"));
  }
  console.log(`   💾 Backup: ${jsonPath} & ${csvPath} (${data.length} records)`);
}

// ── 13F-HR ──
async function scrape13FHR(client, days) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 1: 13F-HR — Institutional Investors");
  console.log("═══════════════════════════════════════════════\n");

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  console.log(`📅 ${startDate} → ${endDate}`);

  let offset = 0;
  const size = 100;
  const byCik = {};
  let totalHits = 0;

  while (true) {
    const url = `${EFTS_BASE}?q=13F-HR&forms=13F-HR&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=${size}`;
    process.stdout.write(`\r  📋 Fetching: offset ${offset} (${Object.keys(byCik).length} unique filers)`);

    const res = await eftsFetch(url);
    if (!res.ok) break;
    const data = await res.json();
    const hits = data.hits?.hits || [];
    if (hits.length === 0) break;

    for (const hit of hits) {
      const s = hit._source || {};
      const cik = (s.ciks || [])[0];
      const name = (s.display_names || [""])[0].replace(/\s*\(CIK.*\)/, "").trim();
      const state = (s.biz_states || [])[0] || null;
      if (!cik || !name) continue;

      if (!byCik[cik] || s.file_date > byCik[cik].fileDate) {
        byCik[cik] = { cik, name, state, fileDate: s.file_date, form: s.form, sic: (s.sics || [])[0] || null };
      }
    }

    totalHits += hits.length;
    offset += size;
    if (hits.length < size) break;
  }

  const unique = Object.values(byCik);
  console.log(`\n\n  📊 ${totalHits} filings → ${unique.length} unique institutional investors`);

  const investors = unique.map((f) => ({
    full_name: f.name,
    job_title: "Institutional Investor",
    bio: `SEC 13F-HR filer. CIK: ${f.cik}. Last filing: ${f.form} (${f.fileDate}).`,
    location: f.state || null,
    country: stateToCountry(f.state) || "United States",
    investor_type: classify(f.name),
    investment_geographies: [stateToCountry(f.state) || "United States"],
    source: "edgar_13f_hr",
    source_id: f.cik,
    data_quality_score: 70,
  }));

  saveBackup(investors, "13f-hr-investors");

  let inserted = 0;
  for (let i = 0; i < investors.length; i += BATCH_SIZE) {
    const batch = investors.slice(i, i + BATCH_SIZE);
    const ins = await batchInsert(client, batch);
    inserted += ins;
    process.stdout.write(`\r  💾 ${Math.min(i + BATCH_SIZE, investors.length)}/${investors.length} (${inserted} inserted)`);
  }
  console.log(`\n\n  ✅ 13F-HR: ${inserted} investors inserted\n`);
  return inserted;
}

// ── Form D ──
async function scrapeFormD(client, days) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 2: Form D — Private Placements");
  console.log("═══════════════════════════════════════════════\n");

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  console.log(`📅 ${startDate} → ${endDate}`);

  let offset = 0;
  const size = 100;
  const seen = new Map();
  let totalHits = 0;

  while (true) {
    const url = `${EFTS_BASE}?q=D&forms=D&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=${size}`;
    process.stdout.write(`\r  📋 Fetching: offset ${offset} (${seen.size} unique entities)`);

    const res = await eftsFetch(url);
    if (!res.ok) break;
    const data = await res.json();
    const hits = data.hits?.hits || [];
    if (hits.length === 0) break;

    for (const hit of hits) {
      const s = hit._source || {};
      const names = s.display_names || [];
      const locs = s.biz_locations || [];
      const ciks = s.ciks || [];

      for (let i = 0; i < names.length; i++) {
        const name = names[i].replace(/\s*\(CIK.*\)/, "").trim();
        if (!name || name.length < 3) continue;
        const key = name.toLowerCase();
        if (!seen.has(key) || s.file_date > seen.get(key).fileDate) {
          seen.set(key, { name, cik: ciks[i] || null, loc: locs[i] || null, fileDate: s.file_date, adsh: s.adsh });
        }
      }
    }

    totalHits += hits.length;
    offset += size;
    if (hits.length < size) break;
  }

  const unique = [...seen.values()];
  console.log(`\n\n  📊 ${totalHits} filings → ${unique.length} unique fund entities`);

  const investors = unique.map((f) => {
    const l = (f.name || "").toLowerCase();
    return {
      full_name: f.name,
      job_title: "Investment Fund",
      bio: `SEC Form D filing (${f.fileDate}). ${f.adsh || ""}`,
      location: f.loc || null,
      country: "United States",
      city: f.loc?.split(",")[0]?.trim() || null,
      investor_type: /fund|capital|ventures|partners/.test(l) ? "venture_capital" : "private_equity",
      investment_geographies: ["United States"],
      source: "edgar_form_d",
      source_id: f.adsh || f.cik,
      data_quality_score: 55,
    };
  });

  saveBackup(investors, "form-d-investors");

  let inserted = 0;
  for (let i = 0; i < investors.length; i += BATCH_SIZE) {
    const batch = investors.slice(i, i + BATCH_SIZE);
    const ins = await batchInsert(client, batch);
    inserted += ins;
    process.stdout.write(`\r  💾 ${Math.min(i + BATCH_SIZE, investors.length)}/${investors.length} (${inserted} inserted)`);
  }
  console.log(`\n\n  ✅ Form D: ${inserted} investors inserted\n`);
  return inserted;
}

// ── N-CEN ──
async function scrapeNCEN(client, days) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 3: N-CEN — Registered Fund Census");
  console.log("═══════════════════════════════════════════════\n");

  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  console.log(`📅 ${startDate} → ${endDate}`);

  let offset = 0;
  const size = 100;
  const byCik = {};
  let totalHits = 0;

  while (true) {
    const url = `${EFTS_BASE}?q=N-CEN&forms=N-CEN&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=${size}`;
    process.stdout.write(`\r  📋 Fetching: offset ${offset} (${Object.keys(byCik).length} unique funds)`);

    const res = await eftsFetch(url);
    if (!res.ok) break;
    const data = await res.json();
    const hits = data.hits?.hits || [];
    if (hits.length === 0) break;

    for (const hit of hits) {
      const s = hit._source || {};
      const cik = (s.ciks || [])[0];
      const name = (s.display_names || [""])[0].replace(/\s*\(CIK.*\)/, "").trim();
      const state = (s.biz_states || [])[0] || null;
      if (!cik || !name) continue;
      if (!byCik[cik] || s.file_date > byCik[cik].fileDate) {
        byCik[cik] = { cik, name, state, fileDate: s.file_date };
      }
    }

    totalHits += hits.length;
    offset += size;
    if (hits.length < size) break;
  }

  const unique = Object.values(byCik);
  console.log(`\n\n  📊 ${totalHits} filings → ${unique.length} unique registered funds`);

  const investors = unique.map((f) => ({
    full_name: f.name,
    job_title: "Registered Investment Fund",
    bio: `SEC-registered fund (N-CEN). CIK: ${f.cik}. Last filing: ${f.fileDate}.`,
    location: f.state || null,
    country: stateToCountry(f.state) || "United States",
    investor_type: "fund_of_funds",
    investment_geographies: [stateToCountry(f.state) || "United States"],
    source: "edgar_ncen",
    source_id: f.cik,
    data_quality_score: 65,
  }));

  saveBackup(investors, "ncen-funds");

  let inserted = 0;
  for (let i = 0; i < investors.length; i += BATCH_SIZE) {
    const batch = investors.slice(i, i + BATCH_SIZE);
    const ins = await batchInsert(client, batch);
    inserted += ins;
    process.stdout.write(`\r  💾 ${Math.min(i + BATCH_SIZE, investors.length)}/${investors.length} (${inserted} inserted)`);
  }
  console.log(`\n\n  ✅ N-CEN: ${inserted} investors inserted\n`);
  return inserted;
}

// ── Stats ──
async function showStats() {
  const client = await connectDb();
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Database Statistics");
  console.log("═══════════════════════════════════════════════\n");

  const total = await client.query("SELECT COUNT(*)::int as count FROM investors");
  console.log(`📊 Total investors: ${total.rows[0].count}`);

  const bySource = await client.query(`SELECT source, COUNT(*)::int as count FROM investors GROUP BY source ORDER BY count DESC`);
  console.log("\nBy Source:");
  console.table(bySource.rows);

  const byType = await client.query(`SELECT investor_type, COUNT(*)::int as count FROM investors GROUP BY investor_type ORDER BY count DESC`);
  console.log("By Type:");
  console.table(byType.rows);

  const byCountry = await client.query(`SELECT COALESCE(country, '(none)') as country, COUNT(*)::int as count FROM investors GROUP BY country ORDER BY count DESC LIMIT 15`);
  console.log("Top Countries:");
  console.table(byCountry.rows);

  if (fs.existsSync(BACKUP_DIR)) {
    const files = fs.readdirSync(BACKUP_DIR);
    console.log(`\n💾 Backups: ${files.length} files in backups/edgar/`);
  }

  await client.end();
}

// ── Main ──
async function main() {
  const args = process.argv.slice(2);
  const startTime = Date.now();

  if (args.includes("--stats")) { await showStats(); return; }

  const do13f = args.includes("--13f") || (!args.includes("--form-d") && !args.includes("--ncen") && !args.includes("--stats"));
  const doFormD = args.includes("--form-d") || (!args.includes("--13f") && !args.includes("--ncen") && !args.includes("--stats"));
  const doNCEN = args.includes("--ncen") || (!args.includes("--13f") && !args.includes("--form-d") && !args.includes("--stats"));
  const dayIdx = args.indexOf("--days");
  const days = dayIdx >= 0 ? parseInt(args[dayIdx + 1]) : 3650;

  const sources = [do13f && "13F-HR", doFormD && "Form D", doNCEN && "N-CEN"].filter(Boolean);
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Capital OS — Bulk EDGAR Investor Scraper");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Sources: ${sources.join(", ")}`);
  console.log(`  Date range: ${days} days\n`);

  const client = await connectDb();
  let total = 0;

  try {
    if (do13f) total += await scrape13FHR(client, days);
    if (doFormD) total += await scrapeFormD(client, days);
    if (doNCEN) total += await scrapeNCEN(client, days);
  } catch (err) {
    console.error(`\n💥 Error: ${err.message}`);
  }

  await client.end();

  console.log("═══════════════════════════════════════════════");
  console.log(`✅ DONE — ${total} investors inserted in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log("═══════════════════════════════════════════════\n");

  await showStats();
}

main().catch((err) => { console.error("💥", err.message); process.exit(1); });
