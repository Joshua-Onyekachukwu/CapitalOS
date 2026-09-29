/**
 * Data-quality report for the investor intelligence pipeline.
 *
 * Combines:
 *   1. Lake-level analysis of the latest run's qualified/ JSONL
 *      (score distribution, tier mix, evidence coverage, rejection/dedup
 *      breakdown, per-attribute confidence).
 *   2. DB-level distributions over ingested rows (verification status,
 *      type mix, contactability, source mix).
 *
 * Usage:
 *   npx tsx scripts/pipeline/quality-report.ts [--run iapd-batch-...] [--out data/pipeline/quality-report.md]
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import fs from "fs";
import path from "path";
import type { InvestorRecord } from "./types";

const args = process.argv.slice(2);
const arg = (name: string, def = ""): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : def;
};

const LAKE = path.join("data", "pipeline");
const provider = arg("provider", "investors");

/** Read every part-*.jsonl for one (area, provider, batch). */
function readBatch(area: string, batch: string): unknown[] {
  const dir = path.join(LAKE, area, provider, batch);
  if (!fs.existsSync(dir)) return [];
  const out: unknown[] = [];
  for (const f of fs.readdirSync(dir).filter((f) => /^part-\d+\.jsonl$/.test(f)).sort()) {
    for (const line of fs.readFileSync(path.join(dir, f), "utf8").split("\n")) {
      const s = line.trim();
      if (!s) continue;
      try {
        out.push(JSON.parse(s));
      } catch {
        // skip corrupt lines (lake quarantines them separately)
      }
    }
  }
  return out;
}

// newest batch by directory name (timestamp-ordered)
const qualifiedDir = path.join(LAKE, "qualified", provider);
const batches = fs.existsSync(qualifiedDir) ? fs.readdirSync(qualifiedDir).sort() : [];
const runId = arg("run") || batches[batches.length - 1] || "";
if (!runId) {
  console.error("no pipeline run found — run the pipeline first");
  process.exit(1);
}  const outPath = arg("out") || path.join("data", "pipeline", `quality-report-${runId}.md`);

const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : "0.0");
const bar = (share: number, width = 24) => {
  const filled = Math.round(share * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
};

async function dbStats() {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

    const count = async (fn: () => PromiseLike<{ count: number | null }>) => (await fn()).count ?? 0;

    const total = await count(() => sp.from("investors").select("id", { count: "exact", head: true }));
    const iapd = await count(() => sp.from("investors").select("id", { count: "exact", head: true }).eq("source_provider", "iapd"));
    const verified = await count(() => sp.from("investors").select("id", { count: "exact", head: true }).eq("verification_status", "verified"));
    const withEmail = await count(() => sp.from("investors").select("id", { count: "exact", head: true }).not("email", "is", null).neq("email", ""));
    const withWebsite = await count(() => sp.from("investors").select("id", { count: "exact", head: true }).not("website_url", "is", null));
    const active = await count(() => sp.from("investors").select("id", { count: "exact", head: true }).eq("is_active", true));

    // type distribution (db values) — paginated (PostgREST caps at 1000/request)
    const typeCounts: Record<string, number> = {};
    let tFrom = 0;
    for (;;) {
      const { data: typeRows, error: tErr } = await sp
        .from("investors")
        .select("investor_type")
        .eq("source_provider", "iapd")
        .order("created_at", { ascending: true })
        .range(tFrom, tFrom + 999);
      if (tErr) break;
      if (!typeRows || typeRows.length === 0) break;
      for (const r of typeRows) {
        const t = (r as { investor_type: string }).investor_type || "null";
        typeCounts[t] = (typeCounts[t] || 0) + 1;
      }
      tFrom += 1000;
      if (typeRows.length < 1000) break;
    }

    return { ok: true as const, total, iapd, verified, withEmail, withWebsite, active, typeCounts };
  } catch (e) {
    return { ok: false as const, error: String(e) };
  }
}

async function main() {
  const qualified = readBatch("qualified", runId) as InvestorRecord[];
  const rejected = readBatch("rejected", runId) as Array<{ reason?: string }>;
  const duplicates = readBatch("duplicates", runId) as Array<{ dup_verdict?: string; dup_matched_on?: string }>;

  // ── Score distribution ──
  const scores = qualified.map((r) => r.quality_score).sort((a, b) => a - b);
  const q = (p: number) => (scores.length ? scores[Math.min(scores.length - 1, Math.floor(p * scores.length))] : 0);
  const buckets = [0, 0, 0, 0, 0]; // <25, 25-44, 45-59, 60-74, 75+
  for (const s of scores) {
    if (s < 25) buckets[0]++;
    else if (s < 45) buckets[1]++;
    else if (s < 60) buckets[2]++;
    else if (s < 75) buckets[3]++;
    else buckets[4]++;
  }

  // ── Tier + coverage ──
  const tierCounts: Record<string, number> = { verified: 0, supported: 0, inferred: 0, unknown: 0 };
  const attrCoverage: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const stageCount = qualified.filter((r) => r.stages.length > 0).length;
  const sectorCount = qualified.filter((r) => r.sectors.length > 0).length;
  const withWebsite = qualified.filter((r) => r.website).length;
  const withEmail = qualified.filter((r) => r.email).length;
  const kindCounts: Record<string, number> = {};

  for (const r of qualified) {
    tierCounts[r.claim_tier] = (tierCounts[r.claim_tier] || 0) + 1;
    const t = r.investor_type || "null";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    if (r.source_kind) kindCounts[r.source_kind] = (kindCounts[r.source_kind] || 0) + 1;
    for (const k of Object.keys(r.evidence)) {
      attrCoverage[k] = (attrCoverage[k] || 0) + 1;
    }
  }

  const rejectReasons: Record<string, number> = {};
  for (const r of rejected) {
    const key = (r.reason || "unknown").split(":")[0];
    rejectReasons[key] = (rejectReasons[key] || 0) + 1;
  }
  const dupVerdicts: Record<string, number> = {};
  for (const d of duplicates) {
    const key = `${d.dup_verdict || "?"} (${d.dup_matched_on || "?"})`;
    dupVerdicts[key] = (dupVerdicts[key] || 0) + 1;
  }

  const db = await dbStats();

  const L: string[] = [];
  L.push(`# Investor Pipeline — Data Quality Report`);
  L.push(``);
  L.push(`Run: \`${runId}\` · generated ${new Date().toISOString()}`);
  L.push(``);
  L.push(`## Funnel`);
  L.push(``);
  L.push(`| Stage | Count | Share of raw |`);
  L.push(`|---|---|---|`);
  const rawTotal = qualified.length + rejected.length + duplicates.length;
  L.push(`| raw rows in run | ${rawTotal} | 100% |`);
  L.push(`| qualified | ${qualified.length} | ${pct(qualified.length, rawTotal)}% |`);
  L.push(`| duplicates (verdicts emitted, not merged) | ${duplicates.length} | ${pct(duplicates.length, rawTotal)}% |`);
  L.push(`| rejected | ${rejected.length} | ${pct(rejected.length, rawTotal)}% |`);
  L.push(``);
  L.push(`## Quality score distribution (qualified set)`);
  L.push(``);
  L.push(`- p10 **${q(0.10)}** · p25 **${q(0.25)}** · median **${q(0.50)}** · p75 **${q(0.75)}** · p90 **${q(0.90)}**`);
  L.push(``);
  L.push(`| Band | Count | Share | |`);
  L.push(`|---|---|---|---|`);
  const bandLabels = [`<25 (unusable)`, `25-44 (weak)`, `45-59 (usable)`, `60-74 (good)`, `75+ (strong)`];
  buckets.forEach((n, i) => {
    L.push(`| ${bandLabels[i]} | ${n} | ${pct(n, scores.length)}% | ${bar(n / Math.max(1, scores.length))} |`);
  });
  L.push(``);
  L.push(`## Claim tiers (weakest-of per record)`);
  L.push(``);
  for (const t of ["verified", "supported", "inferred", "unknown"]) {
    L.push(`- **${t}**: ${tierCounts[t] || 0} (${pct(tierCounts[t] || 0, qualified.length)}%)`);
  }
  L.push(``);
  L.push(`## Evidence coverage per attribute family`);
  L.push(``);
  L.push(`| Attribute | Coverage | Share |`);
  L.push(`|---|---|---|`);
  for (const [k, n] of Object.entries(attrCoverage).sort((a, b) => b[1] - a[1])) {
    L.push(`| ${k} | ${n} | ${pct(n, qualified.length)}% |`);
  }
  L.push(``);
  L.push(`- has stages: ${stageCount} (${pct(stageCount, qualified.length)}%) · has sectors: ${sectorCount} (${pct(sectorCount, qualified.length)}%)`);
  L.push(`- has website: ${withWebsite} (${pct(withWebsite, qualified.length)}%) · has email: ${withEmail} (${pct(withEmail, qualified.length)}%)`);
  L.push(``);
  L.push(`## Investor-type mix (pipeline vocabulary)`);
  L.push(``);
  for (const [t, n] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    L.push(`- **${t}**: ${n} (${pct(n, qualified.length)}%) ${bar(n / Math.max(1, qualified.length), 16)}`);
  }
  if (Object.keys(kindCounts).length > 1 || Object.keys(kindCounts)[0] !== "iapd_adviser") {
    L.push(``);
    L.push(`Sub-source mix: ${Object.entries(kindCounts).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  if (Object.keys(rejectReasons).length) {
    L.push(``);
    L.push(`## Rejection reasons`);
    L.push(``);
    for (const [k, n] of Object.entries(rejectReasons).sort((a, b) => b[1] - a[1])) {
      L.push(`- ${k}: ${n}`);
    }
  }
  if (Object.keys(dupVerdicts).length) {
    L.push(``);
    L.push(`## Duplicate verdicts (rows NOT ingested; review artifacts kept)`);
    L.push(``);
    for (const [k, n] of Object.entries(dupVerdicts).sort((a, b) => b[1] - a[1])) {
      L.push(`- ${k}: ${n}`);
    }
  }
  L.push(``);
  L.push(`## Database state after ingest`);
  L.push(``);
  if (db.ok) {
    L.push(`| Metric | Value |`);
    L.push(`|---|---|`);
    L.push(`| investors total | ${db.total} |`);
    L.push(`| IAPD-sourced rows | ${db.iapd} |`);
    L.push(`| EDGAR/SEC-verified rows | ${db.verified} |`);
    L.push(`| with email | ${db.withEmail} (${pct(db.withEmail, db.total)}%) |`);
    L.push(`| with website | ${db.withWebsite} (${pct(db.withWebsite, db.total)}%) |`);
    L.push(`| active | ${db.active} |`);
    L.push(``);
    L.push(`IAPD type mix (DB vocabulary):`);
    L.push(``);
    for (const [t, n] of Object.entries(db.typeCounts).sort((a, b) => b[1] - a[1])) {
      L.push(`- ${t}: ${n}`);
    }
  } else {
    L.push(`(DB stats unavailable: ${db.error})`);
  }
  L.push(``);
  L.push(`## Known limitations`);
  L.push(``);
  L.push(`- IAPD monthly extracts carry registration facts (identity, geo, AUM, employees),`);
  L.push(`  not investment theses — stages/sectors are text-signal extractions and most`);
  L.push(`  records will legitimately score in the middle bands, not 75+.`);
  L.push(`- Duplicates were collapsed conservatively (name+state granularity); verdicts are`);
  L.push(`  review artifacts, nothing was auto-merged.`);
  L.push(`- 'angel' as a type prior for exempt reporting advisers is weak evidence by design`);
  L.push(`  (see qualify.ts) — treat iapd_ecr types as directional until enriched.`);

  fs.writeFileSync(outPath, L.join("\n"));
  console.log(L.join("\n"));
  console.log(`\n✓ report written → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
