#!/usr/bin/env node
/**
 * Bulk EDGAR Form D enrichment from SEC quarterly data sets.
 *
 * One download per quarter instead of one request per filing, which avoids the
 * SEC fair-access rate limit entirely. The archive is parsed locally and joined
 * to candidates by accession number.
 *
 *   node investor-intelligence/scripts/enrich/enrich-edgar-bulk.cjs --quarter 2026q2
 *   node investor-intelligence/scripts/enrich/enrich-edgar-bulk.cjs --file path/to/2026q2_d.zip
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { setTimeout: sleep } = require("timers/promises");
const { parsePrimaryDoc, classifySignals, loadCandidates, loadDone } = require("./enrich-edgar.cjs");

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
const QUARTER = flag("quarter", "2026q2");
const FILE = flag("file", null);
const URL = `https://www.sec.gov/files/structureddata/data/form-d-data-sets/${QUARTER}_d.zip`;

async function download(url, dest, attempt = 0) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after")) || 120;
    console.log(`SEC rate limit; waiting ${wait}s`);
    await sleep(wait * 1000);
    return download(url, dest, attempt + 1);
  }
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`downloaded ${(buf.length / 1e6).toFixed(1)} MB -> ${dest}`);
}

function walk(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (/^primary_doc\.xml$/i.test(entry.name)) acc.push(p);
  }
}

(async () => {
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  let zipPath = FILE;
  if (!zipPath) {
    zipPath = path.join(RAW_DIR, `${QUARTER}_d.zip`);
    if (!fs.existsSync(zipPath) || fs.statSync(zipPath).size < 1000) {
      await download(URL, zipPath);
    }
  }
  const extractDir = path.join(RAW_DIR, QUARTER);
  if (!fs.existsSync(extractDir) || fs.readdirSync(extractDir).length === 0) {
    fs.mkdirSync(extractDir, { recursive: true });
    console.log(`extracting ${zipPath}`);
    execFileSync("unzip", ["-q", "-o", zipPath, "-d", extractDir], { stdio: "inherit" });
  }

  const candidates = loadCandidates();
  const byAccession = new Map(candidates.map((c) => [c.source_id, c]));
  const done = loadDone();
  const files = [];
  walk(extractDir, files);
  console.log(`xml documents: ${files.length}; candidates matched by accession; already enriched: ${done.size}`);

  const outFile = path.join(OUT_DIR, `records-bulk-${QUARTER}.jsonl`);
  const out = fs.createWriteStream(outFile, { flags: "a" });
  const stats = {
    quarter: QUARTER,
    documents: files.length,
    matched: 0,
    skipped_done: 0,
    parsed: 0,
    failed: 0,
    with_fund_type: 0,
    with_min_investment: 0,
    with_team: 0,
    venture_funds: 0,
    out_file: outFile,
  };

  for (const file of files) {
    const accession = path.basename(path.dirname(file));
    const c = byAccession.get(accession);
    if (!c) continue;
    stats.matched += 1;
    if (done.has(c.source_id)) {
      stats.skipped_done += 1;
      continue;
    }
    let xml;
    try {
      xml = fs.readFileSync(file, "utf8");
    } catch {
      stats.failed += 1;
      continue;
    }
    let edgar;
    try {
      edgar = parsePrimaryDoc(xml);
    } catch {
      stats.failed += 1;
      continue;
    }
    if (!edgar.entity_name && !edgar.fund_type) {
      stats.failed += 1;
      continue;
    }
    stats.parsed += 1;
    const signals = classifySignals(edgar);
    if (edgar.fund_type) stats.with_fund_type += 1;
    if (edgar.min_investment_usd != null) stats.with_min_investment += 1;
    if (edgar.related_persons.length) stats.with_team += 1;
    if (signals.is_venture_fund) stats.venture_funds += 1;

    out.write(
      JSON.stringify({
        candidate_id: c.source_id,
        full_name: c.full_name,
        normalized_name: c.normalized_name,
        cik: String(c.cik).padStart(10, "0"),
        filing_url: `https://www.sec.gov/Archives/edgar/data/${Number(c.cik)}/${accession.replace(/-/g, "")}/primary_doc.xml`,
        document: "bulk-primary_doc.xml",
        fetched_at: new Date().toISOString(),
        edgar,
        signals,
        evidence: {
          source: "sec_edgar_form_d_bulk",
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
