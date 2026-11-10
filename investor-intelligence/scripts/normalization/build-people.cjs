#!/usr/bin/env node
/**
 * Build a local people layer from Form D related persons.
 *
 * Each fund filing names its officers, directors, promoters and general
 * partners. This extracts the individuals, drops corporate entities that also
 * appear as "related persons", and links each person to the funds they filed
 * for. Local only; no database writes.
 *
 *   node investor-intelligence/scripts/normalization/build-people.cjs
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "../../..");
const DATA = path.join(ROOT, "investor-intelligence/data");
const EDGAR_DIR = path.join(DATA, "enriched", "edgar");
const OUT_DIR = path.join(DATA, "people");
const REPORT_DIR = path.join(DATA, "reports");
const RUN_ID = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

const ORG = /\b(llc|l\.l\.c|lp|l\.p|llp|ltd|limited|inc|incorporated|corp|corporation|plc|gmbh|ag|bv|nv|sarl|sas|sa|pte|pty|gp|fund|funds|capital|management|mgmt|advisors?|advisers?|administration|admin|trust|partners|group|company|co)\b/i;

const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function readJsonl(dir) {
  const rows = [];
  if (!fs.existsSync(dir)) return rows;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".jsonl")) continue;
    for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        rows.push(JSON.parse(line));
      } catch {
        /* partial line */
      }
    }
  }
  return rows;
}

const seenFunds = new Set();
const funds = readJsonl(EDGAR_DIR).filter((f) => {
  if (!f.candidate_id || seenFunds.has(f.candidate_id)) return false;
  seenFunds.add(f.candidate_id);
  return true;
});
const byPerson = new Map();
let personRows = 0;
let orgRows = 0;

for (const f of funds) {
  const persons = f.edgar?.related_persons || [];
  for (const p of persons) {
    if (!p.name) continue;
    personRows += 1;
    if (ORG.test(p.name)) {
      orgRows += 1;
      continue;
    }
    const words = p.name.trim().split(/\s+/);
    if (words.length < 2) continue; // single token is usually a fund entity
    const key = `${normalize(p.name)}|${normalize(p.state || "")}`;
    if (!byPerson.has(key)) {
      byPerson.set(key, {
        person_id: crypto.createHash("sha1").update(key).digest("hex").slice(0, 16),
        full_name: p.name.trim(),
        normalized_name: normalize(p.name),
        city: p.city || f.edgar?.city || null,
        state: p.state || f.edgar?.state || null,
        roles: new Set(),
        funds: [],
        source_urls: new Set(),
      });
    }
    const rec = byPerson.get(key);
    for (const r of p.relationships || []) rec.roles.add(r);
    if (rec.funds.length < 25) {
      rec.funds.push({ candidate_id: f.candidate_id, fund_name: f.full_name, fund_type: f.edgar?.fund_type || null });
    }
    if (f.filing_url) rec.source_urls.add(f.filing_url);
  }
}

const people = [...byPerson.values()].map((p) => ({
  ...p,
  roles: [...p.roles],
  source_urls: [...p.source_urls].slice(0, 5),
  fund_count: p.funds.length,
}));

people.sort((a, b) => b.fund_count - a.fund_count);
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(REPORT_DIR, { recursive: true });
const outFile = path.join(OUT_DIR, `people-${RUN_ID}.jsonl`);
fs.writeFileSync(outFile, people.map((p) => JSON.stringify(p)).join("\n") + (people.length ? "\n" : ""));

const roleCounts = {};
for (const p of people) for (const r of p.roles) roleCounts[r] = (roleCounts[r] || 0) + 1;
const summary = {
  run_id: RUN_ID,
  generated_at: new Date().toISOString(),
  funds_scanned: funds.length,
  person_rows: personRows,
  org_rows_dropped: orgRows,
  unique_people: people.length,
  multi_fund_people: people.filter((p) => p.fund_count > 1).length,
  roles: Object.fromEntries(Object.entries(roleCounts).sort((a, b) => b[1] - a[1])),
  top_roles: Object.entries(roleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10),
  out_file: outFile,
  note: "Derived from SEC Form D related persons. Individuals only; corporate related persons dropped. Local only.",
};
fs.writeFileSync(path.join(REPORT_DIR, `people-${RUN_ID}.json`), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
