#!/usr/bin/env node
/**
 * IAPD spreadsheet → pipeline raw JSON converter.
 *
 * Usage: node scripts/iapd-convert.cjs <extracted-dir> <out-file> <row-limit> <kind>
 *
 * The SEC monthly reports unzip to a spreadsheet whose columns reference
 * Form ADV items ("1A 1. Firm Name", "5B(2)", "MainAddrCity"...). Column
 * names drift between months, so we map fuzzily by header substring and
 * keep a truncated raw row for evidence. The pipeline treats the output
 * as raw lake input — no assumptions about correctness are made here.
 */

const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const [dir, outFile, limitArg, kind] = process.argv.slice(2);
const LIMIT = parseInt(limitArg || "120", 10);

// Find the first spreadsheet in the extracted dir
const files = fs.readdirSync(dir).filter((f) => /\.(xlsx|xls|csv)$/i.test(f));
if (files.length === 0) {
  console.error(`no spreadsheet in ${dir}:`, fs.readdirSync(dir));
  process.exit(3);
}
const file = path.join(dir, files[0]);
console.log(`parsing ${file} (${(fs.statSync(file).size / 1e6).toFixed(2)} MB)`);

const wb = XLSX.readFile(file, { dense: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

// ── Fuzzy header mapping ─────────────────────────────────────
// Form ADV item references we care about, by candidate substrings.
const FIELD_MAP = {
  firm_name: ["firm name", "1a 1", "legal name"],
  sec_number: ["801- ", "sec number", "file number"],
  crd_number: ["crd", "1a 2"],
  location_city: ["mainaddr", "city"],
  location_state: ["state", "jurisdiction"],
  location_country: ["country"],
  website: ["website", "web site", "1a 12"],
  aum_regulated: ["5c", "regulatory assets under management", "discretionary aum"],
  aum_total: ["5f", "total amount of regulatory assets", "assets under management"],
  employees: ["5b", "number of employees"],
  offices: ["5d", "office"],
  client_types: ["7a 1", "individuals", "business development"],
  form_adv_date: ["filing date", "updated date", "1a 1 date"],
};

function pick(row, candidates) {
  const keys = Object.keys(row);
  for (const cand of candidates) {
    const hit = keys.find((k) => k.toLowerCase().includes(cand));
    if (hit && row[hit] !== null && row[hit] !== undefined && String(row[hit]).trim() !== "") {
      return String(row[hit]).trim();
    }
  }
  return null;
}

const records = [];
for (const row of rows) {
  if (records.length >= LIMIT) break;
  const name = pick(row, FIELD_MAP.firm_name);
  if (!name) continue;

  const rec = {
    kind: kind === "exempt" ? "iapd_ecr" : "iapd_adviser",
    firm_id: pick(row, FIELD_MAP.crd_number),
    sec_number: pick(row, FIELD_MAP.sec_number),
    firm_name: name,
    location_city: pick(row, FIELD_MAP.location_city),
    location_state: pick(row, FIELD_MAP.location_state),
    location_country: pick(row, FIELD_MAP.location_country),
    website: pick(row, FIELD_MAP.website),
    aum_regulated_usd: pick(row, FIELD_MAP.aum_regulated),
    aum_total_usd: pick(row, FIELD_MAP.aum_total),
    employees: pick(row, FIELD_MAP.employees),
    offices: pick(row, FIELD_MAP.offices),
    client_types: pick(row, FIELD_MAP.client_types),
    filing_date: pick(row, FIELD_MAP.form_adv_date),
  };

  // Keep a compact raw snapshot (first ~30 columns) for evidence/reprocessing
  rec.raw = Object.entries(row)
    .slice(0, 30)
    .reduce((acc, [k, v]) => {
      const s = String(v ?? "");
      if (s && s.length < 80) acc[k.slice(0, 40)] = s;
      return acc;
    }, {});

  records.push(rec);
}

const payload = {
  collected_at: new Date().toISOString(),
  source: "SEC IAPD monthly compilation",
  kind,
  count: records.length,
  data: { rows: records },
};
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
console.log(`emitted ${records.length} ${kind} rows → ${outFile}`);
