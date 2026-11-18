#!/usr/bin/env node
/**
 * Measure manager-level distinctness of the imported Form D vehicles.
 *
 * The import loaded fund VEHICLES ("X Fund III - Series 9"), not managers.
 * Quoting the vehicle count as "investors" overstates the corpus. This script
 * clusters vehicle names to a manager key and reports the distinct count.
 * Read-only: it never writes to the database.
 *
 *   node scripts/analyze-fund-managers.cjs [--top 25]
 */

require("dotenv").config({ path: ".env.local", quiet: true });
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const TOP = (() => {
  const i = process.argv.indexOf("--top");
  return i >= 0 ? Number(process.argv[i + 1]) || 25 : 25;
})();

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const LEGAL = /\b(llc|l\.l\.c|lp|l\.p|llp|ltd|limited|inc|incorporated|corp|corporation|co|company|plc|gmbh|ag|bv|nv|sarl|sas|sa|pte|pty)\b/g;
const SERIES = /\b(series\s+[a-z0-9]+|a\s+series\s+of\s+.+)$/i;

const GENERIC = new Set(
  "fund funds capital partners partner management mgmt advisors advisers ventures venture holdings holding investment investments series a of the and co company llc lp ltd inc group sponsor".split(" ")
);

function managerKey(name) {
  const raw = String(name || "");

  // "X Fund I, a series of First Peak Ventures, LP" names the manager after
  // "a series of" — use that, not the vehicle prefix.
  const seriesOf = raw.match(/a\s+series\s+of\s+(.+)$/i);
  let s = String(seriesOf ? seriesOf[1] : raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Drop " - Series 9" tails.
  s = s.replace(SERIES, " ");
  // Drop trailing fund numbering: fund iii, fund 3, fund iv, fund one.
  s = s.replace(/\b(fund|funds)\s+(?:[ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, " fund ");
  // Legal suffixes.
  s = s.replace(LEGAL, " ");
  // Vehicle words at the end ("... capital", "... partners", "... ventures").
  s = s.replace(/\b(feeder|parallel|spv|holdings?|vehicle)\b/gi, " ");
  s = s.replace(/\s+/g, " ").trim();

  // If only generic words remain, the name carries no manager identity;
  // fall back to the full normalized name so unrelated filers never merge.
  const tokens = s.split(" ").filter(Boolean);
  if (s.length < 3 || tokens.every((t) => GENERIC.has(t))) {
    s = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(LEGAL, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return s;
}

(async () => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sp
      .from("investors")
      .select("id,full_name,source_id,current_firm_id")
      .eq("source", "sec_formd_bulk")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const groups = new Map();
  for (const r of rows) {
    const key = managerKey(r.full_name);
    if (!groups.has(key)) groups.set(key, { key, vehicles: [] });
    groups.get(key).vehicles.push(r.full_name);
  }

  const clusters = [...groups.values()].sort((a, b) => b.vehicles.length - a.vehicles.length);
  const multi = clusters.filter((c) => c.vehicles.length > 1);
  const max = clusters[0];

  const report = {
    generated_at: new Date().toISOString(),
    imported_vehicles: rows.length,
    distinct_manager_keys: clusters.length,
    collapse_ratio: Number((rows.length / Math.max(1, clusters.length)).toFixed(2)),
    managers_with_multiple_vehicles: multi.length,
    vehicles_absorbed: multi.reduce((n, c) => n + c.vehicles.length - 1, 0),
    largest_cluster: max
      ? { key: max.key, vehicles: max.vehicles.length, examples: max.vehicles.slice(0, 8) }
      : null,
    top_clusters: clusters.slice(0, TOP).map((c) => ({
      manager: c.key,
      vehicles: c.vehicles.length,
      examples: c.vehicles.slice(0, 4),
    })),
  };

  fs.mkdirSync(".tmp", { recursive: true });
  fs.writeFileSync(".tmp/fund-managers.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, top_clusters: report.top_clusters.slice(0, 10) }, null, 2));
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
