#!/usr/bin/env node
/**
 * Populate investor_managers and investors.manager_id for the imported Form D
 * vehicles, conservatively.
 *
 * Rules (deliberate, from docs/audit/MANAGER-COLLAPSE-2026-11-18.md):
 *   - a cluster larger than MAX_CLUSTER looks like an SPV platform, not one
 *     manager, and is left unresolved (manager_id NULL)
 *   - known umbrella/administrator names are left unresolved
 *   - every vehicle row stays; nothing is deactivated
 *
 *   node scripts/build-manager-map.cjs            # dry run, print top clusters
 *   node scripts/build-manager-map.cjs --apply    # write managers + manager_id
 */

require("dotenv").config({ path: ".env.local", quiet: true });
const { createClient } = require("@supabase/supabase-js");

const APPLY = process.argv.includes("--apply");
const MAX_CLUSTER = 25;
const TOP = 20;

const sp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const LEGAL =
  /\b(llc|l\.l\.c|lp|l\.p|llp|ltd|limited|inc|incorporated|corp|corporation|co|company|plc|gmbh|ag|bv|nv|sarl|sas|sa|pte|pty)\b/g;
const SERIES = /\b(series\s+[a-z0-9]+|a\s+series\s+of\s+.+)$/i;
const GENERIC = new Set(
  "fund funds capital partners partner management mgmt advisors advisers ventures venture holdings holding investment investments series a of the and co company llc lp ltd inc group sponsor".split(
    " "
  )
);

// Umbrella SPV platforms and filing administrators: many unrelated managers
// file through them. Measured in the audit.
const UMBRELLA = [
  /^cgf\d*$/,
  /^roll up vehicles?$/,
  /^platform funds?$/,
  /^mv funds?$/,
  /^n a fund gp$/,
  /^sydecar$/,
  /^a master$/,
  /^exitfund venture$/,
  /^v360( holdings)?$/,
  /^decile start fund$/,
  /^slrte i$/,
  /^jmwtx investments$/,
  /^litquidity ventures fund$/,
];

function managerKey(name) {
  const raw = String(name || "");
  const seriesOf = raw.match(/a\s+series\s+of\s+(.+)$/i);
  let s = String(seriesOf ? seriesOf[1] : raw)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  s = s.replace(SERIES, " ");
  s = s.replace(
    /\b(fund|funds)\s+(?:[ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/gi,
    " fund "
  );
  s = s.replace(LEGAL, " ");
  s = s.replace(/\b(feeder|parallel|spv|holdings?|vehicle)\b/gi, " ");
  s = s.replace(/\s+/g, " ").trim();

  const tokens = s.split(" ").filter(Boolean);
  if (s.length < 3 || tokens.every((t) => GENERIC.has(t))) {
    return raw.toLowerCase().replace(/\s+/g, " ").trim();
  }
  return s;
}

function displayName(vehicles) {
  // Shortest non-legal-form name reads best as the manager label.
  return [...vehicles].sort((a, b) => a.length - b.length)[0];
}

(async () => {
  // Supabase caps a single response at 1,000 rows; page through the corpus.
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sp
      .from("investors")
      .select("id, full_name, manager_id")
      .eq("source", "sec_formd_bulk")
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }

  const groups = new Map();
  for (const row of rows) {
    const key = managerKey(row.full_name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const clusters = [...groups.entries()]
    .map(([key, vehicles]) => ({ key, vehicles }))
    .sort((a, b) => b.vehicles.length - a.vehicles.length);

  const unresolvedReasons = new Map();
  const approved = [];
  for (const cluster of clusters) {
    const name = displayName(cluster.vehicles.map((v) => v.full_name));
    // Only merge when the filing itself says "a series of X". Identical names
    // with different "Series N" tails are separate SPVs, not one manager.
    const explicitSeries = cluster.vehicles.every((v) =>
      /a\s+series\s+of\s+/i.test(v.full_name || "")
    );
    if (!explicitSeries) {
      unresolvedReasons.set(cluster.key, "not an explicit series-of filing");
      continue;
    }
    if (cluster.vehicles.length > MAX_CLUSTER) {
      unresolvedReasons.set(cluster.key, `cluster of ${cluster.vehicles.length} > ${MAX_CLUSTER}`);
      continue;
    }
    if (UMBRELLA.some((re) => re.test(cluster.key))) {
      unresolvedReasons.set(cluster.key, "umbrella/administrator");
      continue;
    }
    approved.push({ ...cluster, name });
  }

  const assigned = approved.reduce((n, c) => n + c.vehicles.length, 0);
  const unresolved = rows.length - assigned;

  const report = {
    mode: APPLY ? "apply" : "dry-run",
    vehicles: rows.length,
    managers: approved.length,
    assigned_vehicles: assigned,
    unresolved_vehicles: unresolved,
    unresolved_clusters: unresolvedReasons.size,
    max_cluster_size: MAX_CLUSTER,
    top_reviewed: approved.slice(0, TOP).map((c) => ({
      name: c.name,
      vehicles: c.vehicles.length,
      samples: c.vehicles.slice(0, 2).map((v) => v.full_name),
    })),
    unresolved_top: [...unresolvedReasons.entries()]
      .sort((a, b) => (groups.get(b[0]).length || 0) - (groups.get(a[0]).length || 0))
      .slice(0, 10)
      .map(([key, reason]) => ({ key, vehicles: groups.get(key).length, reason })),
  };

  if (!APPLY) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  for (const cluster of approved) {
    const { data: manager, error: mErr } = await sp
      .from("investor_managers")
      .upsert(
        {
          name: cluster.name,
          normalized_key: cluster.key,
          key_source: "normalized_name",
          confidence: cluster.vehicles.length > 1 ? "medium" : "low",
          review_status: "auto",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "normalized_key" }
      )
      .select("id")
      .single();
    if (mErr) throw new Error(`${cluster.key}: ${mErr.message}`);

    const ids = cluster.vehicles.map((v) => v.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { error: uErr } = await sp
        .from("investors")
        .update({ manager_id: manager.id })
        .in("id", ids.slice(i, i + 200));
      if (uErr) throw new Error(`${cluster.key} update: ${uErr.message}`);
    }
  }

  // Reviewed top clusters: the hand-checked set becomes the trusted core.
  const reviewedKeys = approved.slice(0, TOP).map((c) => c.key);
  await sp
    .from("investor_managers")
    .update({ review_status: "reviewed" })
    .in("normalized_key", reviewedKeys);

  console.log(JSON.stringify({ ...report, applied: true }, null, 2));
})().catch((err) => {
  console.error("build-manager-map failed:", err.message);
  process.exit(1);
});
