#!/usr/bin/env node
/**
 * Manager mapping for imported Form D fund vehicles — review-gated, no
 * heuristic merges.
 *
 * The script never decides on its own which cluster is a manager. It exports
 * the top name clusters for a human to classify, then applies ONLY the keys a
 * reviewer explicitly approved in scripts/manager-review-decisions.json.
 * Rejected keys are recorded in `investor_managers` with
 * `review_status = 'rejected'` and map no vehicle; keys absent from the
 * decision file stay untouched (manager_id NULL).
 *
 *   node scripts/build-manager-map.cjs --export-review [--top 60]
 *       write .tmp/manager-review-candidates.json for review
 *
 *   node scripts/build-manager-map.cjs                 # dry run, print report
 *   node scripts/build-manager-map.cjs --apply         # apply approved keys
 *
 * Rules that still apply (docs/audit/MANAGER-COLLAPSE-2026-11-18.md):
 *   - every vehicle row is kept; nothing is deleted or deactivated
 *   - a cluster whose filings are not "a series of X" is never offered as a
 *     candidate, because identical names with different "Series N" tails are
 *     separate SPVs
 *   - umbrella/SPV platforms must be rejected, not merged
 */

require("dotenv").config({ path: ".env.local", quiet: true });
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes("--apply");
const EXPORT = ARGS.includes("--export-review");
const topArg = ARGS.indexOf("--top");
const TOP = topArg >= 0 ? Number(ARGS[topArg + 1]) || 60 : 60;
const DECISIONS_FILE = path.join(__dirname, "manager-review-decisions.json");
const EXPORT_FILE = path.join(__dirname, "..", ".tmp", "manager-review-candidates.json");

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

async function loadCorpus() {
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
  return rows;
}

function clusterCorpus(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = managerKey(row.full_name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.entries()]
    .map(([key, vehicles]) => {
      const explicitSeries = vehicles.every((v) => /a\s+series\s+of\s+/i.test(v.full_name || ""));
      return { key, vehicles, explicitSeries };
    })
    .sort((a, b) => b.vehicles.length - a.vehicles.length || a.key.localeCompare(b.key));
}

function readDecisions() {
  if (!fs.existsSync(DECISIONS_FILE)) {
    throw new Error(
      `decision file missing: ${path.relative(process.cwd(), DECISIONS_FILE)}. ` +
        "Run --export-review, classify the clusters, and commit the decision list."
    );
  }
  const parsed = JSON.parse(fs.readFileSync(DECISIONS_FILE, "utf8"));
  const decisions = Array.isArray(parsed.decisions) ? parsed.decisions : [];
  const seen = new Set();
  for (const d of decisions) {
    if (!d || typeof d.key !== "string" || !d.key.trim()) {
      throw new Error("every decision needs a non-empty key");
    }
    if (seen.has(d.key)) throw new Error(`duplicate decision for key "${d.key}"`);
    seen.add(d.key);
    if (d.decision !== "approve" && d.decision !== "reject") {
      throw new Error(`decision for "${d.key}" must be "approve" or "reject"`);
    }
    if (d.decision === "approve" && !String(d.reason || "").trim()) {
      throw new Error(`approved key "${d.key}" needs a reason (the evidence)`);
    }
    if (d.decision === "reject" && !String(d.reason || "").trim()) {
      throw new Error(`rejected key "${d.key}" needs a reason`);
    }
  }
  return { meta: parsed, decisions };
}

async function upsertManager(payload) {
  const { data, error } = await sp
    .from("investor_managers")
    .upsert(payload, { onConflict: "normalized_key" })
    .select("id")
    .single();
  if (error) throw new Error(`${payload.normalized_key}: ${error.message}`);
  return data.id;
}

(async () => {
  const rows = await loadCorpus();
  const clusters = clusterCorpus(rows);
  const decisions = EXPORT ? { decisions: [] } : readDecisions();
  const decisionByKey = new Map(decisions.decisions.map((d) => [d.key, d]));

  if (EXPORT) {
    const candidates = clusters
      .filter((c) => c.explicitSeries)
      .slice(0, TOP)
      .map((c) => ({
        key: c.key,
        vehicles: c.vehicles.length,
        decision: decisionByKey.get(c.key)?.decision ?? null,
        samples: c.vehicles.slice(0, 5).map((v) => v.full_name),
      }));
    fs.mkdirSync(path.dirname(EXPORT_FILE), { recursive: true });
    fs.writeFileSync(
      EXPORT_FILE,
      JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          corpus_vehicles: rows.length,
          clusters: clusters.length,
          exported: candidates.length,
          candidates,
        },
        null,
        2
      )
    );
    console.log(
      `exported ${candidates.length} candidates to ${path.relative(process.cwd(), EXPORT_FILE)}`
    );
    console.log(JSON.stringify(candidates.slice(0, 15), null, 2));
    return;
  }

  const byKey = new Map(clusters.map((c) => [c.key, c]));
  const approved = [];
  const rejected = [];
  const stale = [];
  const notOffered = [];

  for (const d of decisions.decisions) {
    const cluster = byKey.get(d.key);
    if (!cluster) {
      stale.push({ key: d.key, decision: d.decision, reason: "no vehicle in the corpus" });
      continue;
    }
    if (d.decision === "reject") {
      rejected.push({ key: d.key, vehicles: cluster.vehicles.length, reason: d.reason });
      continue;
    }
    if (!cluster.explicitSeries) {
      // Never map a cluster the reviewer approved on a name that is not an
      // explicit series-of filing: those are separate SPVs.
      notOffered.push({ key: d.key, vehicles: cluster.vehicles.length, reason: "not an explicit series-of filing" });
      continue;
    }
    approved.push({
      key: d.key,
      name: String(d.name || displayName(cluster.vehicles.map((v) => v.full_name))).trim(),
      confidence: d.confidence || "medium",
      reason: d.reason,
      // Two clusters of the same manager (for example a program and its
      // verticals) share one manager row instead of counting twice.
      group: d.group ? String(d.group).trim() : null,
      vehicles: cluster.vehicles,
    });
  }

  const managerRows = new Map();
  for (const c of approved) {
    const groupKey = c.group || c.key;
    if (!managerRows.has(groupKey)) {
      managerRows.set(groupKey, {
        key: groupKey,
        name: c.name,
        confidence: c.confidence,
        reason: c.reason,
        vehicles: [],
        sources: [],
      });
    }
    const row = managerRows.get(groupKey);
    row.vehicles.push(...c.vehicles);
    row.sources.push(c.key);
    if (c.confidence === "high") row.confidence = "high";
  }
  const managers = [...managerRows.values()];

  const assigned = managers.reduce((n, m) => n + m.vehicles.length, 0);
  const report = {
    mode: APPLY ? "apply" : "dry-run",
    decisions_file: path.relative(process.cwd(), DECISIONS_FILE),
    corpus_vehicles: rows.length,
    corpus_managers: clusters.length,
    reviewed: decisions.decisions.length,
    approved_clusters: approved.length,
    applied_managers: managers.length,
    rejected_managers: rejected.length,
    vehicles_assigned: assigned,
    vehicles_unassigned: rows.length - assigned,
    coverage_pct: Number(((assigned / rows.length) * 100).toFixed(2)),
    approved: managers.map((m) => ({
      key: m.key,
      name: m.name,
      clusters: m.sources,
      vehicles: m.vehicles.length,
      confidence: m.confidence,
    })),
    rejected: rejected.map((r) => ({ key: r.key, vehicles: r.vehicles, reason: r.reason })),
    stale_decisions: stale,
    not_offered: notOffered,
  };

  if (!APPLY) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  for (const cluster of managers) {
    const managerId = await upsertManager({
      name: cluster.name,
      normalized_key: cluster.key,
      key_source: "manual",
      confidence: cluster.confidence,
      review_status: "reviewed",
      notes: `approved 2026-11-19: ${cluster.reason} [clusters: ${cluster.sources.join(", ")}]`,
      updated_at: new Date().toISOString(),
    });

    const ids = cluster.vehicles.map((v) => v.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await sp
        .from("investors")
        .update({ manager_id: managerId })
        .in("id", ids.slice(i, i + 200));
      if (error) throw new Error(`${cluster.key} update: ${error.message}`);
    }
  }

  // Record rejections in the same table so the decision survives in the DB and
  // a later run cannot silently adopt a platform. No vehicle points at them.
  for (const r of rejected) {
    const managerId = await upsertManager({
      name: r.key,
      normalized_key: r.key,
      key_source: "manual",
      confidence: "low",
      review_status: "rejected",
      notes: `rejected 2026-11-19: ${r.reason}`,
      updated_at: new Date().toISOString(),
    });
    const { error } = await sp
      .from("investors")
      .update({ manager_id: null })
      .eq("manager_id", managerId);
    if (error) throw new Error(`${r.key} unmap: ${error.message}`);
  }

  console.log(JSON.stringify({ ...report, applied: true }, null, 2));
})().catch((err) => {
  console.error("build-manager-map failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
