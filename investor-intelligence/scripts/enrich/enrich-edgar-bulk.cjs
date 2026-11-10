#!/usr/bin/env node
/**
 * Bulk EDGAR Form D enrichment from SEC quarterly data sets.
 *
 * The quarterly archive is a set of TSV tables (issuers, offering, related
 * persons), so one download enriches every candidate from that quarter with no
 * per-filing requests and no fair-access rate-limit exposure.
 *
 *   node investor-intelligence/scripts/enrich/enrich-edgar-bulk.cjs --quarter 2026q3
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { setTimeout: sleep } = require("timers/promises");
const { classifySignals, loadCandidates, loadDone } = require("./enrich-edgar.cjs");

const ROOT = path.resolve(__dirname, "../../..");
const DATA = path.join(ROOT, "investor-intelligence/data");
const RAW_DIR = path.join(DATA, "raw", "sec-formd-bulk");
const OUT_DIR = path.join(DATA, "enriched", "edgar");
const REPORT_DIR = path.join(DATA, "reports");
const UA = process.env.SEC_USER_AGENT || "CapitalOS Research contact@capital-os.com";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
};
const QUARTER = flag("quarter", "2026q3");
const FILE = flag("file", null);
const BASES = [
  "https://www.sec.gov/files/datastandardsinnovation/data/form-d-data-sets",
  "https://www.sec.gov/files/structureddata/data/form-d-data-sets",
];

async function download(url, dest, attempt = 0) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after")) || 120;
    console.log(`SEC rate limit; waiting ${wait}s`);
    await sleep(wait * 1000);
    return download(url, dest, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`downloaded ${(buf.length / 1e6).toFixed(1)} MB -> ${dest}`);
}

const money = (v) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

function readTsv(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];
  const header = lines[0].split("\t");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const row = {};
    for (let c = 0; c < header.length; c++) row[header[c]] = cols[c] ?? "";
    rows.push(row);
  }
  return rows;
}

function findTable(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findTable(p, name);
      if (found) return found;
    } else if (entry.name.toLowerCase() === name.toLowerCase()) {
      return p;
    }
  }
  return null;
}

(async () => {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  let zipPath = FILE;
  if (!zipPath) {
    zipPath = path.join(RAW_DIR, `${QUARTER}_d.zip`);
    if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000) {
      let lastErr = null;
      for (const base of BASES) {
        try {
          await download(`${base}/${QUARTER}_d.zip`, zipPath);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          console.log(`  ${e.message}`);
        }
      }
      if (lastErr) throw lastErr;
    }
  }

  const extractDir = path.join(RAW_DIR, QUARTER);
  if (!fs.existsSync(extractDir) || fs.readdirSync(extractDir).length === 0) {
    fs.mkdirSync(extractDir, { recursive: true });
    console.log(`extracting ${zipPath}`);
    execFileSync("unzip", ["-q", "-o", zipPath, "-d", extractDir], { stdio: "inherit" });
  }

  const issuersFile = findTable(extractDir, "ISSUERS.tsv");
  const offeringFile = findTable(extractDir, "OFFERING.tsv");
  const personsFile = findTable(extractDir, "RELATEDPERSONS.tsv");
  if (!issuersFile || !offeringFile) throw new Error("bulk tables not found in archive");

  console.log("reading TSV tables");
  const issuers = new Map();
  for (const r of readTsv(issuersFile)) {
    const acc = r.ACCESSIONNUMBER;
    if (!acc) continue;
    if (!issuers.has(acc) || r.IS_PRIMARYISSUER_FLAG === "1") issuers.set(acc, r);
  }
  const offerings = new Map();
  for (const r of readTsv(offeringFile)) if (r.ACCESSIONNUMBER) offerings.set(r.ACCESSIONNUMBER, r);
  const persons = new Map();
  for (const r of readTsv(personsFile)) {
    if (!r.ACCESSIONNUMBER) continue;
    if (!persons.has(r.ACCESSIONNUMBER)) persons.set(r.ACCESSIONNUMBER, []);
    const name = [r.FIRSTNAME, r.MIDDLENAME, r.LASTNAME].filter(Boolean).join(" ").trim();
    if (!name) continue;
    persons.get(r.ACCESSIONNUMBER).push({
      name,
      relationships: [r.RELATIONSHIP_1, r.RELATIONSHIP_2, r.RELATIONSHIP_3].filter(Boolean),
      city: r.CITY || null,
      state: r.STATEORCOUNTRY || null,
    });
  }
  console.log(`tables: ${issuers.size} issuers, ${offerings.size} offerings, ${persons.size} with persons`);

  const candidates = loadCandidates();
  const done = loadDone();
  const outFile = path.join(OUT_DIR, `records-bulk-${QUARTER}.jsonl`);
  const out = fs.createWriteStream(outFile, { flags: "a" });

  const stats = {
    quarter: QUARTER,
    candidates: candidates.length,
    skipped_done: 0,
    matched: 0,
    parsed: 0,
    with_fund_type: 0,
    with_min_investment: 0,
    with_team: 0,
    with_offering_amount: 0,
    venture_funds: 0,
    out_file: outFile,
  };

  for (const c of candidates) {
    if (done.has(c.source_id)) {
      stats.skipped_done += 1;
      continue;
    }
    const issuer = issuers.get(c.source_id);
    const offer = offerings.get(c.source_id);
    if (!issuer && !offer) continue;
    stats.matched += 1;

    const personRows = persons.get(c.source_id) || [];
    const edgar = {
      entity_name: issuer?.ENTITYNAME || null,
      city: issuer?.CITY || null,
      state: issuer?.STATEORCOUNTRY || null,
      zip: issuer?.ZIPCODE || null,
      phone: issuer?.ISSUERPHONENUMBER || null,
      jurisdiction: issuer?.JURISDICTIONOFINC || null,
      year_incorporated: issuer?.YEAROFINC_VALUE_ENTERED || null,
      industry_group: offer?.INDUSTRYGROUPTYPE || null,
      fund_type: offer?.INVESTMENTFUNDTYPE || null,
      is_40_act: offer?.IS40ACT || null,
      revenue_range: offer?.REVENUERANGE || null,
      min_investment_usd: money(offer?.MINIMUMINVESTMENTACCEPTED),
      total_offering_usd: money(offer?.TOTALOFFERINGAMOUNT),
      total_sold_usd: money(offer?.TOTALAMOUNTSOLD),
      total_remaining_usd: money(offer?.TOTALREMAINING),
      total_investors: null,
      first_sale_date: offer?.SALE_DATE || null,
      first_sale_yet_to_occur: offer?.YETTOOCCUR || null,
      related_persons: personRows,
    };
    if (!edgar.entity_name && !edgar.fund_type) continue;

    stats.parsed += 1;
    const signals = classifySignals(edgar);
    if (edgar.fund_type) stats.with_fund_type += 1;
    if (edgar.min_investment_usd != null) stats.with_min_investment += 1;
    if (personRows.length) stats.with_team += 1;
    if ((edgar.total_offering_usd || 0) > 0) stats.with_offering_amount += 1;
    if (signals.is_venture_fund) stats.venture_funds += 1;

    out.write(
      JSON.stringify({
        candidate_id: c.source_id,
        full_name: c.full_name,
        normalized_name: c.normalized_name,
        cik: String(c.cik).padStart(10, "0"),
        filing_url: `https://www.sec.gov/Archives/edgar/data/${Number(c.cik)}/${c.source_id.replace(/-/g, "")}/primary_doc.xml`,
        document: "bulk-tsv",
        fetched_at: new Date().toISOString(),
        edgar,
        signals,
        evidence: {
          source: "sec_edgar_form_d_bulk_tsv",
          level: "verified",
          note: `SEC quarterly Form D data set ${QUARTER}`,
        },
      }) + "\n"
    );
  }

  await new Promise((r) => out.end(r));
  stats.finished_at = new Date().toISOString();
  fs.writeFileSync(path.join(REPORT_DIR, `enrich-edgar-bulk-${QUARTER}.json`), JSON.stringify(stats, null, 2) + "\n");
  console.log(JSON.stringify(stats, null, 2));
})().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
