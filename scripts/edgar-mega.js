#!/usr/bin/env node
/**
 * Capital OS — Mega EDGAR Scraper (100K+ Investors)
 * ===================================================
 * Scrapes ALL SEC EDGAR filing types across 15+ years, deduplicates,
 * cleans/qualifies data, then routes to Supabase (hot) + Convex (archive).
 *
 * Strategy: SEC EFTS caps at 10K results per query. We split by year × form
 * type to bypass this and collect 100K+ unique investors.
 *
 * Usage:
 *   node scripts/edgar-mega.js                         # Full scrape all sources
 *   node scripts/edgar-mega.js --13f                   # 13F-HR only
 *   node scripts/edgar-mega.js --form-d                # Form D only
 *   node scripts/edgar-mega.js --ncen                  # N-CEN only
 *   node scripts/edgar-mega.js --adv                   # Form ADV only
 *   node scripts/edgar-mega.js --years 5               # Last 5 years only
 *   node scripts/edgar-mega.js --stats                 # Show database stats
 *   node scripts/edgar-mega.js --clean                 # Clean + dedup existing data
 *   node scripts/edgar-mega.js --route                 # Route data to Supabase/Convex
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.local") });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// ─── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BACKUP_DIR = path.join(__dirname, "..", "backups", "edgar-mega");
const BATCH_SIZE = 100; // Supabase REST API batch limit
const EFTS_BASE = "https://efts.sec.gov/LATEST/search-index";
const FULL_TEXT_BASE = "https://efts.sec.gov/LATEST/search-index";
const UA = "CapitalOS/1.0 (investor-research@capitalos.io; contact@capitalos.io)";
const RATE_LIMIT_MS = 200; // SEC asks for 10 req/sec max

// Supabase capacity: 500MB free tier. ~60% = 300MB safe limit
// Each investor row ~2KB → ~150K rows = ~300MB
const SUPABASE_HOT_LIMIT = 120000; // Hot data cap for Supabase
const SUPABASE_FULL_LIMIT = 150000; // Absolute max before overflow

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  return fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
}

function stateToCountry(s) {
  const us = "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ");
  if (us.includes(s)) return "United States";
  const intl = {
    X0: "United Kingdom", C9: "Belgium", E9: "Cayman Islands",
    D0: "Luxembourg", V8: "Switzerland", T2: "Germany",
    J3: "Japan", C3: "France", H3: "Israel", U6: "Singapore",
    T1: "United Kingdom", X1: "Canada", Z4: "Australia",
    A2: "China", A1: "Hong Kong", J1: "South Korea",
  };
  return intl[s] || (s && s.length === 2 ? "United States" : null);
}

function classify(name) {
  const l = (name || "").toLowerCase();
  if (/pension|retirement|benefit/.test(l)) return "fund_of_funds";
  if (/bank|trust|savings/.test(l)) return "strategic_investor";
  if (/insurance|life|annuity/.test(l)) return "strategic_investor";
  if (/endowment|foundation|university/.test(l)) return "university_fund";
  if (/government|federal|state/.test(l)) return "government_fund";
  if (/venture|vc /.test(l)) return "venture_capital";
  if (/private equity|pe |buyout/.test(l)) return "private_equity";
  if (/family office|family/.test(l)) return "family_office";
  if (/accelerator|incubator/.test(l)) return "accelerator";
  if (/angel/.test(l)) return "angel_investor";
  if (/seed/.test(l)) return "venture_capital";
  if (/fund|capital|partners|advisors?|management|invest|asset/.test(l)) return "fund_of_funds";
  return "fund_of_funds";
}

function classifyStage(name) {
  const l = (name || "").toLowerCase();
  if (/seed|pre-seed|preseed/.test(l)) return ["pre_seed", "seed"];
  if (/early|start|seed/.test(l)) return ["seed", "series_a"];
  if (/growth|expansion|late/.test(l)) return ["series_b", "growth"];
  if (/venture|vc/.test(l)) return ["seed", "series_a", "series_b"];
  if (/private equity|buyout/.test(l)) return ["growth", "buyout"];
  if (/accelerator|incubator/.test(l)) return ["pre_seed", "seed"];
  return ["seed", "series_a"];
}

function cleanName(name) {
  return (name || "")
    .replace(/\s*\(CIK\s*\d+\)/g, "")
    .replace(/\s*\(See\s+.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidName(name) {
  if (!name || name.length < 3) return false;
  if (/^\d+$/.test(name)) return false;
  if (/filing|amendment|exhibit|schedule|form|report/i.test(name)) return false;
  if (name.split(" ").length > 10) return false;
  return true;
}

function estimateCheckSize(type) {
  switch (type) {
    case "angel_investor": return { min: 10000, max: 250000 };
    case "venture_capital": return { min: 250000, max: 10000000 };
    case "private_equity": return { min: 5000000, max: 100000000 };
    case "family_office": return { min: 500000, max: 25000000 };
    case "accelerator": return { min: 25000, max: 150000 };
    case "fund_of_funds": return { min: 1000000, max: 50000000 };
    case "strategic_investor": return { min: 500000, max: 20000000 };
    default: return { min: 250000, max: 5000000 };
  }
}

// ─── Data Quality Scoring ────────────────────────────────────────────────────
function scoreDataQuality(inv) {
  let score = 30; // Base score for having a name
  if (inv.full_name && inv.full_name.length > 5) score += 10;
  if (inv.investor_type && inv.investor_type !== "fund_of_funds") score += 5;
  if (inv.country) score += 5;
  if (inv.city) score += 5;
  if (inv.source_id) score += 5; // Has CIK
  if (inv.job_title && inv.job_title !== "Institutional Investor") score += 10;
  if (inv.investment_sectors?.length > 0) score += 5;
  if (inv.investment_stages?.length > 0) score += 5;
  if (inv.investment_geographies?.length > 0) score += 5;
  if (inv.fund_size) score += 5;
  if (inv.aum) score += 5;
  if (inv.email) score += 5;
  return Math.min(score, 100);
}

// ─── Supabase Insert ─────────────────────────────────────────────────────────
async function insertToSupabase(investors) {
  if (!investors.length) return { inserted: 0, failed: 0 };

  // Map to Supabase column names
  const rows = investors.map((inv) => {
    const name = cleanName(inv.full_name || "");
    const parts = name.split(/\s+/);
    const check = estimateCheckSize(inv.investor_type || "fund_of_funds");

    return {
      id: uuid(),
      full_name: name,
      first_name: parts[0] || null,
      last_name: parts.slice(1).join(" ") || null,
      job_title: inv.job_title || null,
      investor_type: inv.investor_type || "fund_of_funds",
      company_name: inv.company_name || null,
      company_website: inv.website_url || null,
      linkedin_url: null,
      country: inv.country || "United States",
      city: inv.city || null,
      location: inv.location || null,
      email: null,
      phone: null,
      min_check_size: check.min,
      max_check_size: check.max,
      fund_size: inv.fund_size || null,
      aum: inv.aum || null,
      currency: "USD",
      investment_stages: inv.investment_stages || [],
      investment_sectors: inv.investment_sectors || [],
      investment_geographies: inv.investment_geographies || [],
      data_quality_score: scoreDataQuality(inv),
      outreach_readiness: "needs_verification",
      is_verified: false,
      source: inv.source || "edgar_mega",
      source_id: inv.source_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  // Insert in batches of BATCH_SIZE
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("investors").insert(batch);

    if (error) {
      // Try one-by-one for this batch
      for (const row of batch) {
        const { error: e2 } = await supabase.from("investors").insert(row);
        if (e2) {
          failed++;
          if (failed <= 3) console.error(`   ❌ Insert error: ${e2.message?.slice(0, 100)}`);
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    process.stdout.write(
      `\r  💾 ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length} (${inserted} ok, ${failed} failed)`
    );
  }

  return { inserted, failed };
}

// ─── Backup ──────────────────────────────────────────────────────────────────
function saveBackup(data, name) {
  ensureBackupDir();
  const ts = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(BACKUP_DIR, `${name}-${ts}.json`);
  const csvPath = path.join(BACKUP_DIR, `${name}-${ts}.csv`);
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
  if (data.length > 0) {
    const h = Object.keys(data[0]);
    const csv = [
      h.join(","),
      ...data.map((r) =>
        h.map((k) => `"${String(r[k] || "").replace(/"/g, '""')}"`).join(",")
      ),
    ];
    fs.writeFileSync(csvPath, csv.join("\n"));
  }
  console.log(`   💾 Backup: ${data.length} records → ${name}-*.json/csv`);
}

// ─── SCRAPER 1: 13F-HR (Institutional Investors) ────────────────────────────
async function scrape13FHR(years) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 1: 13F-HR — Institutional Investors");
  console.log("═══════════════════════════════════════════════\n");

  const currentYear = new Date().getFullYear();
  const byCik = new Map();
  let totalHits = 0;

  for (let year = currentYear; year > currentYear - years; year--) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    let offset = 0;
    let yearHits = 0;

    while (true) {
      const url = `${EFTS_BASE}?q=13F-HR&forms=13F-HR&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=100`;
      process.stdout.write(
        `\r  📋 ${year}: offset ${offset} (${byCik.size} unique filers so far)`
      );

      try {
        const res = await eftsFetch(url);
        if (!res.ok) break;
        const data = await res.json();
        const hits = data.hits?.hits || [];
        if (hits.length === 0) break;

        for (const hit of hits) {
          const s = hit._source || {};
          const cik = (s.ciks || [])[0];
          const name = cleanName((s.display_names || [""])[0]);
          const state = (s.biz_states || [])[0] || null;
          if (!cik || !name || !isValidName(name)) continue;

          const existing = byCik.get(cik);
          if (!existing || s.file_date > existing.fileDate) {
            byCik.set(cik, {
              cik: String(cik),
              name,
              state,
              fileDate: s.file_date,
              form: s.form,
              sic: (s.sics || [])[0] || null,
              year,
            });
          }
        }

        yearHits += hits.length;
        totalHits += hits.length;
        offset += 100;
        if (hits.length < 100) break;
      } catch (e) {
        console.error(`\n   ⚠️ Error at offset ${offset}: ${e.message}`);
        break;
      }
    }

    process.stdout.write(
      `\r  📋 ${year}: ${yearHits} filings → ${byCik.size} total unique filers\n`
    );
  }

  const unique = [...byCik.values()];
  console.log(`\n  📊 ${totalHits} filings → ${unique.length} unique institutional investors\n`);

  const investors = unique.map((f) => ({
    full_name: f.name,
    job_title: "Institutional Investor",
    bio: `SEC 13F-HR filer. CIK: ${f.cik}. Last filing: ${f.form} (${f.fileDate}).`,
    location: f.state || null,
    country: stateToCountry(f.state) || "United States",
    city: null,
    investor_type: classify(f.name),
    investment_stages: classifyStage(f.name),
    investment_sectors: [],
    investment_geographies: [stateToCountry(f.state) || "United States"],
    source: "edgar_13f_hr",
    source_id: f.cik,
    website_url: null,
  }));

  saveBackup(investors, "13f-hr-investors");
  return investors;
}

// ─── SCRAPER 2: Form D (Private Placements) ─────────────────────────────────
async function scrapeFormD(years) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 2: Form D — Private Placements");
  console.log("═══════════════════════════════════════════════\n");

  const currentYear = new Date().getFullYear();
  const seen = new Map();
  let totalHits = 0;

  for (let year = currentYear; year > currentYear - years; year--) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    let offset = 0;
    let yearHits = 0;

    while (true) {
      const url = `${EFTS_BASE}?q=D&forms=D&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=100`;
      process.stdout.write(
        `\r  📋 ${year}: offset ${offset} (${seen.size} unique entities so far)`
      );

      try {
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
            const name = cleanName(names[i]);
            if (!name || !isValidName(name)) continue;
            const key = name.toLowerCase();
            if (!seen.has(key) || s.file_date > seen.get(key).fileDate) {
              const loc = locs[i] || null;
              seen.set(key, {
                name,
                cik: ciks[i] ? String(ciks[i]) : null,
                loc,
                fileDate: s.file_date,
                adsh: s.adsh,
                city: loc?.split(",")[0]?.trim() || null,
                year,
              });
            }
          }
        }

        yearHits += hits.length;
        totalHits += hits.length;
        offset += 100;
        if (hits.length < 100) break;
      } catch (e) {
        console.error(`\n   ⚠️ Error: ${e.message}`);
        break;
      }
    }

    process.stdout.write(
      `\r  📋 ${year}: ${yearHits} filings → ${seen.size} total unique entities\n`
    );
  }

  const unique = [...seen.values()];
  console.log(`\n  📊 ${totalHits} filings → ${unique.length} unique fund entities\n`);

  const investors = unique.map((f) => ({
    full_name: f.name,
    job_title: "Investment Fund",
    bio: `SEC Form D filing (${f.fileDate}). ${f.adsh || ""}`,
    location: f.loc || null,
    country: "United States",
    city: f.city,
    investor_type: /fund|capital|ventures|partners|ventures/.test(f.name.toLowerCase())
      ? "venture_capital"
      : "private_equity",
    investment_stages: classifyStage(f.name),
    investment_sectors: [],
    investment_geographies: ["United States"],
    source: "edgar_form_d",
    source_id: f.adsh || f.cik || uuid(),
    website_url: null,
  }));

  saveBackup(investors, "form-d-investors");
  return investors;
}

// ─── SCRAPER 3: N-CEN (Registered Fund Census) ──────────────────────────────
async function scrapeNCEN(years) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 3: N-CEN — Registered Fund Census");
  console.log("═══════════════════════════════════════════════\n");

  const currentYear = new Date().getFullYear();
  const byCik = new Map();
  let totalHits = 0;

  for (let year = currentYear; year > currentYear - years; year--) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    let offset = 0;
    let yearHits = 0;

    while (true) {
      const url = `${EFTS_BASE}?q=N-CEN&forms=N-CEN&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=100`;
      process.stdout.write(
        `\r  📋 ${year}: offset ${offset} (${byCik.size} unique funds so far)`
      );

      try {
        const res = await eftsFetch(url);
        if (!res.ok) break;
        const data = await res.json();
        const hits = data.hits?.hits || [];
        if (hits.length === 0) break;

        for (const hit of hits) {
          const s = hit._source || {};
          const cik = (s.ciks || [])[0];
          const name = cleanName((s.display_names || [""])[0]);
          const state = (s.biz_states || [])[0] || null;
          if (!cik || !name || !isValidName(name)) continue;

          if (!byCik.has(cik) || s.file_date > byCik.get(cik).fileDate) {
            byCik.set(cik, { cik: String(cik), name, state, fileDate: s.file_date, year });
          }
        }

        yearHits += hits.length;
        totalHits += hits.length;
        offset += 100;
        if (hits.length < 100) break;
      } catch (e) {
        console.error(`\n   ⚠️ Error: ${e.message}`);
        break;
      }
    }

    process.stdout.write(
      `\r  📋 ${year}: ${yearHits} filings → ${byCik.size} total unique funds\n`
    );
  }

  const unique = [...byCik.values()];
  console.log(`\n  📊 ${totalHits} filings → ${unique.length} unique registered funds\n`);

  const investors = unique.map((f) => ({
    full_name: f.name,
    job_title: "Registered Investment Fund",
    bio: `SEC-registered fund (N-CEN). CIK: ${f.cik}. Last filing: ${f.fileDate}.`,
    location: f.state || null,
    country: stateToCountry(f.state) || "United States",
    city: null,
    investor_type: "fund_of_funds",
    investment_stages: ["series_a", "series_b", "growth"],
    investment_sectors: [],
    investment_geographies: [stateToCountry(f.state) || "United States"],
    source: "edgar_ncen",
    source_id: f.cik,
    website_url: null,
  }));

  saveBackup(investors, "ncen-funds");
  return investors;
}

// ─── SCRAPER 4: 13F-HR/A (Amendments with detailed holdings) ────────────────
async function scrape13fAmendments(years) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 4: 13F-HR/A — Amendment Filings");
  console.log("═══════════════════════════════════════════════\n");

  const currentYear = new Date().getFullYear();
  const byCik = new Map();
  let totalHits = 0;

  for (let year = currentYear; year > currentYear - years; year--) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    let offset = 0;

    while (true) {
      const url = `${EFTS_BASE}?q=13F-HR/A&forms=13F-HR/A&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=100`;
      process.stdout.write(
        `\r  📋 ${year}: offset ${offset} (${byCik.size} unique filers so far)`
      );

      try {
        const res = await eftsFetch(url);
        if (!res.ok) break;
        const data = await res.json();
        const hits = data.hits?.hits || [];
        if (hits.length === 0) break;

        for (const hit of hits) {
          const s = hit._source || {};
          const cik = (s.ciks || [])[0];
          const name = cleanName((s.display_names || [""])[0]);
          const state = (s.biz_states || [])[0] || null;
          if (!cik || !name || !isValidName(name)) continue;

          if (!byCik.has(cik) || s.file_date > byCik.get(cik).fileDate) {
            byCik.set(cik, { cik: String(cik), name, state, fileDate: s.file_date, year });
          }
        }

        totalHits += hits.length;
        offset += 100;
        if (hits.length < 100) break;
      } catch (e) {
        break;
      }
    }
  }

  const unique = [...byCik.values()];
  console.log(`\n  📊 ${totalHits} filings → ${unique.length} unique amendment filers\n`);

  const investors = unique.map((f) => ({
    full_name: f.name,
    job_title: "Institutional Investor (Amendment)",
    bio: `SEC 13F-HR/A filer. CIK: ${f.cik}. Last amendment: ${f.fileDate}.`,
    location: f.state || null,
    country: stateToCountry(f.state) || "United States",
    city: null,
    investor_type: classify(f.name),
    investment_stages: classifyStage(f.name),
    investment_sectors: [],
    investment_geographies: [stateToCountry(f.state) || "United States"],
    source: "edgar_13f_hr_a",
    source_id: f.cik,
    website_url: null,
  }));

  saveBackup(investors, "13f-hr-a-investors");
  return investors;
}

// ─── SCRAPER 5: Form ADV (Registered Investment Advisors) ───────────────────
async function scrapeADV(years) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 5: Form ADV — Investment Advisors");
  console.log("═══════════════════════════════════════════════\n");

  const currentYear = new Date().getFullYear();
  const byCik = new Map();
  let totalHits = 0;

  for (let year = currentYear; year > currentYear - years; year--) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    let offset = 0;

    while (true) {
      const url = `${EFTS_BASE}?q=ADV&forms=ADV&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=100`;
      process.stdout.write(
        `\r  📋 ${year}: offset ${offset} (${byCik.size} unique advisors so far)`
      );

      try {
        const res = await eftsFetch(url);
        if (!res.ok) break;
        const data = await res.json();
        const hits = data.hits?.hits || [];
        if (hits.length === 0) break;

        for (const hit of hits) {
          const s = hit._source || {};
          const cik = (s.ciks || [])[0];
          const name = cleanName((s.display_names || [""])[0]);
          const state = (s.biz_states || [])[0] || null;
          if (!cik || !name || !isValidName(name)) continue;

          if (!byCik.has(cik) || s.file_date > byCik.get(cik).fileDate) {
            byCik.set(cik, { cik: String(cik), name, state, fileDate: s.file_date, year });
          }
        }

        totalHits += hits.length;
        offset += 100;
        if (hits.length < 100) break;
      } catch (e) {
        break;
      }
    }
  }

  const unique = [...byCik.values()];
  console.log(`\n  📊 ${totalHits} filings → ${unique.length} unique investment advisors\n`);

  const investors = unique.map((f) => ({
    full_name: f.name,
    job_title: "Registered Investment Advisor",
    bio: `SEC Form ADV registrant. CIK: ${f.cik}.`,
    location: f.state || null,
    country: stateToCountry(f.state) || "United States",
    city: null,
    investor_type: classify(f.name),
    investment_stages: classifyStage(f.name),
    investment_sectors: [],
    investment_geographies: [stateToCountry(f.state) || "United States"],
    source: "edgar_adv",
    source_id: f.cik,
    website_url: null,
  }));

  saveBackup(investors, "adv-advisors");
  return investors;
}

// ─── SCRAPER 6: N-CSR (Fund Financial Reports) ──────────────────────────────
async function scrapeNCSR(years) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Source 6: N-CSR — Fund Financial Reports");
  console.log("═══════════════════════════════════════════════\n");

  const currentYear = new Date().getFullYear();
  const byCik = new Map();
  let totalHits = 0;

  for (let year = currentYear; year > currentYear - years; year--) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    let offset = 0;

    while (true) {
      const url = `${EFTS_BASE}?q=N-CSR&forms=N-CSR&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${offset}&size=100`;
      process.stdout.write(
        `\r  📋 ${year}: offset ${offset} (${byCik.size} unique funds so far)`
      );

      try {
        const res = await eftsFetch(url);
        if (!res.ok) break;
        const data = await res.json();
        const hits = data.hits?.hits || [];
        if (hits.length === 0) break;

        for (const hit of hits) {
          const s = hit._source || {};
          const cik = (s.ciks || [])[0];
          const name = cleanName((s.display_names || [""])[0]);
          const state = (s.biz_states || [])[0] || null;
          if (!cik || !name || !isValidName(name)) continue;

          if (!byCik.has(cik) || s.file_date > byCik.get(cik).fileDate) {
            byCik.set(cik, { cik: String(cik), name, state, fileDate: s.file_date, year });
          }
        }

        totalHits += hits.length;
        offset += 100;
        if (hits.length < 100) break;
      } catch (e) {
        break;
      }
    }
  }

  const unique = [...byCik.values()];
  console.log(`\n  📊 ${totalHits} filings → ${unique.length} unique funds\n`);

  const investors = unique.map((f) => ({
    full_name: f.name,
    job_title: "Investment Fund (N-CSR)",
    bio: `SEC N-CSR filer. CIK: ${f.cik}.`,
    location: f.state || null,
    country: stateToCountry(f.state) || "United States",
    city: null,
    investor_type: "fund_of_funds",
    investment_stages: ["series_a", "series_b", "growth"],
    investment_sectors: [],
    investment_geographies: [stateToCountry(f.state) || "United States"],
    source: "edgar_ncsr",
    source_id: f.cik,
    website_url: null,
  }));

  saveBackup(investors, "ncsr-funds");
  return investors;
}

// ─── Deduplicate ─────────────────────────────────────────────────────────────
function deduplicate(allInvestors) {
  const byKey = new Map();
  let dupes = 0;

  for (const inv of allInvestors) {
    // Key = normalized name + country (fuzzy dedup)
    const name = (inv.full_name || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
    const key = `${name}|||${(inv.country || "").toLowerCase()}`;

    if (byKey.has(key)) {
      dupes++;
      const existing = byKey.get(key);
      // Keep the one with higher data quality score
      const newScore = scoreDataQuality(inv);
      const oldScore = scoreDataQuality(existing);
      if (newScore > oldScore) {
        byKey.set(key, inv);
      }
    } else {
      byKey.set(key, inv);
    }
  }

  const unique = [...byKey.values()];
  console.log(`\n  🔄 Deduplication: ${allInvestors.length} → ${unique.length} unique (${dupes} duplicates removed)\n`);
  return unique;
}

// ─── Route to Supabase / Convex ──────────────────────────────────────────────
async function routeData(investors) {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Smart Routing: Supabase (Hot) vs Convex (Archive)");
  console.log("═══════════════════════════════════════════════\n");

  // Check current Supabase count
  const { count: currentCount } = await supabase
    .from("investors")
    .select("*", { count: "exact", head: true });

  const availableSlots = SUPABASE_HOT_LIMIT - (currentCount || 0);
  console.log(`  📊 Current Supabase: ${currentCount || 0} investors`);
  console.log(`  📊 Hot limit: ${SUPABASE_HOT_LIMIT}`);
  console.log(`  📊 Available slots: ${availableSlots}`);
  console.log(`  📊 New investors to add: ${investors.length}\n`);

  if (investors.length <= 0) {
    console.log("  ✅ No new investors to add\n");
    return;
  }

  // Priority routing by investor type
  const PRIORITY_TYPES = [
    "venture_capital",
    "angel_investor",
    "private_equity",
    "family_office",
    "accelerator",
    "strategic_investor",
    "fund_of_funds",
    "university_fund",
    "government_fund",
  ];

  // Sort by priority and data quality
  const sorted = [...investors].sort((a, b) => {
    const aPriority = PRIORITY_TYPES.indexOf(a.investor_type);
    const bPriority = PRIORITY_TYPES.indexOf(b.investor_type);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return scoreDataQuality(b) - scoreDataQuality(a);
  });

  const supabaseBatch = sorted.slice(0, Math.max(0, availableSlots));
  const convexBatch = sorted.slice(supabaseBatch.length);

  console.log(`  📦 Routing to Supabase (hot): ${supabaseBatch.length}`);
  console.log(`  📦 Routing to Convex (archive): ${convexBatch.length}\n`);

  // Insert to Supabase
  if (supabaseBatch.length > 0) {
    console.log("  📤 Inserting to Supabase...");
    const result = await insertToSupabase(supabaseBatch);
    console.log(`\n  ✅ Supabase: ${result.inserted} inserted, ${result.failed} failed\n`);
  }

  // Save Convex batch to file for later import
  if (convexBatch.length > 0) {
    ensureBackupDir();
    const ts = new Date().toISOString().slice(0, 10);
    const convexPath = path.join(BACKUP_DIR, `convex-archive-${ts}.json`);
    fs.writeFileSync(convexPath, JSON.stringify(convexBatch, null, 2));
    console.log(`  💾 Convex archive saved: ${convexPath} (${convexBatch.length} investors)\n`);
  }

  return {
    supabase: supabaseBatch.length,
    convex: convexBatch.length,
    total: investors.length,
  };
}

// ─── Stats ──────────────────────────────────────────────────────────────────
async function showStats() {
  console.log("\n═══════════════════════════════════════════════");
  console.log("  Database Statistics");
  console.log("═══════════════════════════════════════════════\n");

  const { count: total } = await supabase
    .from("investors")
    .select("*", { count: "exact", head: true });

  console.log(`  📊 Total investors in Supabase: ${total || 0}`);
  console.log(`  📊 Hot limit: ${SUPABASE_HOT_LIMIT}`);
  console.log(`  📊 Capacity: ${(((total || 0) / SUPABASE_HOT_LIMIT) * 100).toFixed(1)}%\n`);

  // Source breakdown (sample 2000)
  const { data: samples } = await supabase.from("investors").select("source").limit(2000);
  const sources = {};
  (samples || []).forEach((r) => {
    sources[r.source] = (sources[r.source] || 0) + 1;
  });
  console.log("  By Source (sample):");
  Object.entries(sources)
    .sort((a, b) => b[1] - a[1])
    .forEach(([src, count]) => {
      console.log(`    ${src}: ${count}`);
    });

  // Type breakdown (sample 2000)
  const { data: typeSamples } = await supabase.from("investors").select("investor_type").limit(2000);
  const types = {};
  (typeSamples || []).forEach((r) => {
    types[r.investor_type] = (types[r.investor_type] || 0) + 1;
  });
  console.log("\n  By Type (sample):");
  Object.entries(types)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`    ${type}: ${count}`);
    });

  // Backup files
  if (fs.existsSync(BACKUP_DIR)) {
    const files = fs.readdirSync(BACKUP_DIR);
    console.log(`\n  💾 Backup files: ${files.length}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const startTime = Date.now();

  if (args.includes("--stats")) {
    await showStats();
    return;
  }

  const yearsIdx = args.indexOf("--years");
  const years = yearsIdx >= 0 ? parseInt(args[yearsIdx + 1]) : 10;

  const do13f = args.includes("--13f") || args.length === 0;
  const doFormD = args.includes("--form-d") || args.length === 0;
  const doNCEN = args.includes("--ncen") || args.length === 0;
  const do13fA = args.includes("--13f-a") || args.length === 0;
  const doADV = args.includes("--adv") || args.length === 0;
  const doNCSR = args.includes("--ncsr") || args.length === 0;

  const sources = [];
  if (do13f) sources.push("13F-HR");
  if (doFormD) sources.push("Form D");
  if (doNCEN) sources.push("N-CEN");
  if (do13fA) sources.push("13F-HR/A");
  if (doADV) sources.push("Form ADV");
  if (doNCSR) sources.push("N-CSR");

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Capital OS — Mega EDGAR Investor Scraper");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Sources: ${sources.join(", ")}`);
  console.log(`  Years: ${years} (back to ${new Date().getFullYear() - years})`);
  console.log(`  Target: 100,000+ unique investors`);
  console.log(`  Routing: Supabase (hot) → Convex (archive)\n`);

  let allInvestors = [];

  try {
    if (do13f) allInvestors.push(...(await scrape13FHR(years)));
    if (doFormD) allInvestors.push(...(await scrapeFormD(years)));
    if (doNCEN) allInvestors.push(...(await scrapeNCEN(years)));
    if (do13fA) allInvestors.push(...(await scrape13fAmendments(years)));
    if (doADV) allInvestors.push(...(await scrapeADV(years)));
    if (doNCSR) allInvestors.push(...(await scrapeNCSR(years)));
  } catch (err) {
    console.error(`\n💥 Scraper error: ${err.message}`);
  }

  console.log(`\n  📊 Total raw investors collected: ${allInvestors.length}`);

  // Deduplicate
  const unique = deduplicate(allInvestors);

  // Save full backup
  saveBackup(unique, "mega-all-investors");

  // Route to Supabase / Convex
  const routing = await routeData(unique);

  await showStats();

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log("═══════════════════════════════════════════════");
  console.log(`✅ DONE — ${routing?.total || 0} investors in ${elapsed} minutes`);
  console.log(`   Supabase: ${routing?.supabase || 0}`);
  console.log(`   Convex archive: ${routing?.convex || 0}`);
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("💥", err.message);
  process.exit(1);
});
