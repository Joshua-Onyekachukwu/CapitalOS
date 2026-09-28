/**
 * Controlled batch runner for the investor-intelligence pipeline.
 *
 * Usage:
 *   OPENROUTER_ENABLED=1 npx tsx scripts/pipeline/run-batch.ts --limit 100
 *   npx tsx scripts/pipeline/run-batch.ts --limit 100 --ingest --max-rows 100
 *
 * Stages:
 *   acquire   → raw/       (SEC IAPD adviser extract, via data/iapd/*.json
 *                           fetched on GitHub Actions US runners; see
 *                           .github/workflows/iapd-acquire.yml)
 *   process   → processed/ (typed SourceRecords, deterministic cleaning)
 *   qualify   → normalized/ + qualified/ + rejected/ + duplicates/ (AI gates)
 *   dedup     → duplicates/ verdicts; exact-dups collapse to one record
 *   ingest    → Supabase raw_records + investors (guarded, idempotent)
 *
 * Every stage writes JSONL to the lake and appends to metrics.json for
 * the run, so costs and throughput are measured per stage per batch.
 */

import { emptyMetrics, type InvestorRecord, type SourceRecord, type StageMetrics } from "./types";
import { appendJsonl, checkpoint, lakePath, listParts, readJsonl, writeMetrics, writeFailedJob, readCheckpoint } from "./lake";
import { canonicalizeName } from "./normalize";
import { tier1Classify, tier2Qualify, type Tier1Verdict, type Tier2Qualification } from "./openrouter";
import { qualify } from "./qualify";
import { DedupIndex } from "./dedup";
import { ingestQualified } from "./ingest";

// ── CLI ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
const arg = (name: string, def?: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const flag = (name: string): boolean => args.includes(`--${name}`);

const LIMIT = parseInt(arg("limit", "100") || "100", 10);
const BATCH = arg("batch", `batch-${new Date().toISOString().slice(0, 19).replace(/[:T-]/g, "")}`) as string;
const AI_ENABLED = process.env.OPENROUTER_API_KEY && flag("ai") ? true : false;
const DO_AI = AI_ENABLED;
const DO_INGEST = flag("ingest");
const MAX_ROWS = parseInt(arg("max-rows", "500") || "500", 10);
const PROVIDER = "iapd";

// ── Stage 1: acquire (reads pre-fetched files; see workflow) ─

function acquireRaw(): SourceRecord[] {
  const files = listParts("raw", PROVIDER).filter((f) => !f.includes("processed"));
  const srcDir = "data/iapd";
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");
  const sources: SourceRecord[] = [];

  if (fs.existsSync(srcDir)) {
    for (const f of fs.readdirSync(srcDir).filter((f) => f.endsWith(".json"))) {
      const parsed = JSON.parse(fs.readFileSync(path.join(srcDir, f), "utf8")) as any;
      const rows: any[] = Array.isArray(parsed) ? parsed : parsed?.data?.rows || [];
      for (const r of rows) {
        sources.push({
          key: `iapd:${r.firm_id || r.sec_number || r.firm_name}`,
          provider: PROVIDER,
          kind: r.kind || "iapd_adviser",
          payload: r,
          source_url: `https://adviserinfo.sec.gov/firm/summary/${r.firm_id ?? ""}`,
          collected_at: parsed.collected_at || new Date().toISOString(),
        });
      }
    }
  }

  if (sources.length === 0) {
    console.error(`No IAPD source files found under ${srcDir}.`);
    console.error("Run: gh workflow run iapd-acquire.yml -f limit=100   (US runners fetch SEC data)");
    console.error("then: gh run download --name iapd-raw -D data/iapd");
    process.exit(2);
  }
  return sources;
}

// ── Stage 2: process (deterministic cleaning → SourceRecords) ─

function processRecords(raw: SourceRecord[]): { records: SourceRecord[]; metrics: StageMetrics } {
  const t0 = Date.now();
  const m = emptyMetrics("process");
  m.input = raw.length;
  const out: SourceRecord[] = [];
  const seen = new Set<string>();

  for (const r of raw) {
    const name = (r.payload.firm_name || r.payload.name || "") as string;
    if (typeof name !== "string" || name.trim().length < 3) {
      m.rejected++;
      continue;
    }
    if (seen.has(r.key)) {
      m.duplicates++;
      continue;
    }
    seen.add(r.key);
    // normalize key payload fields deterministically
    r.payload.firm_name = name.trim();
    if (typeof r.payload.firm_id === "string") r.payload.firm_id = r.payload.firm_id.replace(/\D/g, "");
    out.push(r);
  }
  m.output = out.length;
  m.duration_ms = Date.now() - t0;
  return { records: out, metrics: m };
}

// ── Stage 3+4: qualify + dedup (AI gates when enabled) ───────

interface QualifiedRow {
  record: InvestorRecord;
  outcome: string;
  reason?: string;
  dup_verdict?: string;
  dup_matched_on?: string;
}

async function qualifyAll(
  records: SourceRecord[],
  index: DedupIndex
): Promise<{
  qualified: QualifiedRow[];
  rejected: QualifiedRow[];
  duplicates: QualifiedRow[];
  failed: QualifiedRow[];
  metrics: StageMetrics;
}> {
  const t0 = Date.now();
  const m = emptyMetrics("qualify");
  m.input = records.length;

  const qualified: QualifiedRow[] = [];
  const rejected: QualifiedRow[] = [];
  const duplicates: QualifiedRow[] = [];
  const failed: QualifiedRow[] = [];

  for (const src of records) {
    try {
      const name = (src.payload.firm_name as string) || "unknown";
      const blurb = Object.entries(src.payload)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => `${k}: ${v}`)
        .join(". ");

      // Lightweight pre-check on canonical name (cheap path, before AI spend)
      const probeName = canonicalizeName(name);
      const preDupNameKey = `${probeName}|`;
      // exact name+region dup probe against the index
      const existingNames = index.hasNameRegion(probeName, null);
      if (existingNames) {
        m.duplicates++;
        duplicates.push({
          record: { id: "", canonical_name: probeName } as any,
          outcome: "duplicate",
          dup_verdict: "exact_duplicate",
          dup_matched_on: "name+region",
        });
        continue;
      }

      let tier1: Tier1Verdict | null = null;
      let tier2: Tier2Qualification | null = null;
      if (DO_AI) {
        const t1 = await tier1Classify(name, blurb);
        if (t1) {
          tier1 = t1.data;
          m.ai_calls++;
          m.ai_prompt_tokens += t1.usage.prompt_tokens;
          m.ai_completion_tokens += t1.usage.completion_tokens;
          m.ai_cost_usd += t1.usage.cost_usd;
        }
        if (tier1?.is_investor_entity && blurb.length > 400) {
          const t2 = await tier2Qualify(name, blurb);
          if (t2) {
            tier2 = t2.data;
            m.ai_calls++;
            m.ai_prompt_tokens += t2.usage.prompt_tokens;
            m.ai_completion_tokens += t2.usage.completion_tokens;
            m.ai_cost_usd += t2.usage.cost_usd;
          }
        }
      }

      const res = qualify({ source: src, tier1, tier2 });
      if (res.outcome === "failed") {
        m.failed++;
        failed.push({ record: undefined as any, outcome: "failed", reason: res.reason });
        continue;
      }
      if (res.outcome === "rejected" || !res.record) {
        m.rejected++;
        rejected.push({ record: undefined as any, outcome: "rejected", reason: res.reason });
        continue;
      }

      // Full dedup with the complete record
      const dup = index.check(res.record);
      if (dup && dup.verdict !== "distinct") {
        m.duplicates++;
        duplicates.push({
          record: res.record,
          outcome: "duplicate",
          dup_verdict: dup.verdict,
          dup_matched_on: dup.matched_on,
        });
        continue;
      }

      index.add(res.record);
      m.output++;
      qualified.push({ record: res.record, outcome: "qualified" });
    } catch (err) {
      m.failed++;
      failed.push({ record: undefined as any, outcome: "failed", reason: String(err) });
    }
  }

  m.duration_ms = Date.now() - t0;
  return { qualified, rejected, duplicates, failed, metrics: m };
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  const runId = `iapd-${BATCH}`;
  const metrics: StageMetrics[] = [];
  console.log(`▶ pipeline run ${runId}  limit=${LIMIT} ai=${DO_AI} ingest=${DO_INGEST}`);

  const raw = acquireRaw().slice(0, LIMIT);
  console.log(`  raw rows: ${raw.length}`);

  const processed = processRecords(raw);
  metrics.push(processed.metrics);
  console.log(`  processed: ${processed.metrics.output} (rejected ${processed.metrics.rejected}, dups ${processed.metrics.duplicates})`);
  appendJsonl("processed", PROVIDER, BATCH, processed.records);

  // Seed dedup index from already-ingested iapd investors (idempotency)
  const index = new DedupIndex();
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".env.local" });
    const sp = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);
    const { data } = await sp
      .from("investors")
      .select("id, full_name, website_url, email, country")
      .eq("source_provider", "iapd")
      .limit(5000);
    index.seed(
      (data || []).map((r: any) => ({
        id: r.id,
        canonical_name: r.full_name,
        website: r.website_url ? r.website_url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : null,
        email: r.email,
        region: null,
        country: r.country,
      }))
    );
    console.log(`  dedup index seeded with ${(data || []).length} existing iapd records`);
  } catch (e) {
    console.log("  (dedup seed skipped: no Supabase access)");
  }

  const t = qualifyAll(processed.records, index);
  const q = await t;
  metrics.push(q.metrics);
  console.log(
    `  qualified: ${q.qualified.length} | rejected: ${q.rejected.length} | dups: ${q.duplicates.length} | failed: ${q.failed.length}`
  );
  console.log(
    `  AI: ${q.metrics.ai_calls} calls, ${q.metrics.ai_prompt_tokens}+${q.metrics.ai_completion_tokens} tok, $${q.metrics.ai_cost_usd.toFixed(4)}`
  );

  appendJsonl("normalized", "investors", BATCH, q.qualified.map((r) => r.record));
  appendJsonl("qualified", "investors", BATCH, q.qualified.map((r) => r.record));
  if (q.rejected.length) appendJsonl("rejected", "investors", BATCH, q.rejected);
  if (q.duplicates.length) appendJsonl("duplicates", "investors", BATCH, q.duplicates);
  if (q.failed.length) appendJsonl("failed", "investors", BATCH, q.failed);

  writeMetrics(runId, metrics);

  if (DO_INGEST) {
    const ing = await ingestQualified(
      q.qualified.map((r) => r.record),
      BATCH,
      { maxRows: MAX_ROWS }
    );
    console.log(`  ingest: staged=${ing.staged} inserted=${ing.inserted} skipped=${ing.skipped} capped=${ing.capped}`);
    if (ing.errors.length) console.log(`  ingest errors: ${ing.errors.slice(0, 3).join("; ")}`);
    checkpoint(runId, { batch: BATCH, ingested: ing.inserted, at: new Date().toISOString() });
  }

  writeMetrics(runId, metrics); // final
  console.log(`✓ run complete → data/pipeline/runs/${runId}/metrics.json`);
}

main().catch((err) => {
  writeFailedJob(`iapd-${BATCH}`, "main", err);
  console.error(err);
  process.exit(1);
});
