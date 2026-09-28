/**
 * Local data lake — the staging layer.
 *
 * Directory contract (repo-root /data/pipeline):
 *   raw/<provider>/<date>/part-*.jsonl        exactly what was collected
 *   processed/<provider>/<date>/part-*.jsonl  cleaned SourceRecords
 *   normalized/investors/<batch>/part-*.jsonl canonical InvestorRecords
 *   qualified/investors/<batch>/part-*.jsonl  passed qualification
 *   rejected/investors/<batch>/part-*.jsonl   failed qualification (+ reason)
 *   duplicates/investors/<batch>/part-*.jsonl dup verdicts for review
 *   failed/jobs/<runid>.json                  crashed job state for retry
 *   exports/                                   bulk exports / snapshots
 *   runs/<runid>/metrics.json                  stage metrics for the run
 *
 * The disk is the system of record for raw data (cheap, reproducible,
 * reprocessable). Supabase only ever sees qualified, scored records.
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "data", "pipeline");

export type LakeArea =
  | "raw"
  | "processed"
  | "normalized"
  | "qualified"
  | "rejected"
  | "duplicates"
  | "failed"
  | "exports"
  | "runs";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function lakePath(
  area: LakeArea,
  provider: string,
  batch: string,
  part = "part-000.jsonl"
): string {
  const dir =
    area === "raw" || area === "processed"
      ? path.join(ROOT, area, provider, today())
      : path.join(ROOT, area, provider === "investors" ? provider : provider, batch);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, part);
}

export interface AppendOptions {
  /** max bytes per part file before rotating (default 32MB) */
  maxPartBytes?: number;
}

export function appendJsonl(
  area: LakeArea,
  provider: string,
  batch: string,
  rows: unknown[],
  opts: AppendOptions = {}
): string {
  const max = opts.maxPartBytes ?? 32 * 1024 * 1024;
  let partIdx = 0;
  let file = lakePath(area, provider, batch, `part-${String(partIdx).padStart(3, "0")}.jsonl`);
  while (fs.existsSync(file) && fs.statSync(file).size >= max) {
    partIdx++;
    file = lakePath(area, provider, batch, `part-${String(partIdx).padStart(3, "0")}.jsonl`);
  }
  if (rows.length === 0) return file;
  const payload = rows.map((r) => JSON.stringify(r)).join("\n") + "\n";
  fs.appendFileSync(file, payload);
  return file;
}

export function readJsonl(file: string): unknown[] {
  if (!fs.existsSync(file)) return [];
  const out: unknown[] = [];
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s));
    } catch {
      // corrupt line: quarantine rather than crash the run
      const bad = file + ".corrupt";
      fs.appendFileSync(bad, s + "\n");
    }
  }
  return out;
}

export function listParts(area: LakeArea, provider: string, batch?: string): string[] {
  let dir: string;
  if (area === "raw" || area === "processed") {
    const base = path.join(ROOT, area, provider);
    if (!fs.existsSync(base)) return [];
    const dates = fs.readdirSync(base).sort();
    dir = dates.length ? path.join(base, dates[dates.length - 1]) : base;
  } else {
    dir = path.join(ROOT, area, provider);
    if (batch) dir = path.join(dir, batch);
  }
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".jsonl"))
    .map((f) => path.join(dir, f))
    .sort();
}

export function writeMetrics(runId: string, metrics: unknown[]): void {
  const dir = path.join(ROOT, "runs", runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "metrics.json"), JSON.stringify(metrics, null, 2));
}

export function readMetrics(runId: string): unknown[] | null {
  const file = path.join(ROOT, "runs", runId, "metrics.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

export function writeFailedJob(runId: string, stage: string, error: unknown, cursor?: unknown): void {
  const dir = path.join(ROOT, "failed", "jobs");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, `${runId}.json`),
    JSON.stringify({ runId, stage, error: String(error), cursor, at: new Date().toISOString() }, null, 2)
  );
}

/** Checkpoint file for resumable runs (batch cursors). */
export function checkpoint(runId: string, state: unknown): void {
  const dir = path.join(ROOT, "runs", runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "checkpoint.json"), JSON.stringify(state, null, 2));
}

export function readCheckpoint<T>(runId: string): T | null {
  const file = path.join(ROOT, "runs", runId, "checkpoint.json");
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as T) : null;
}
