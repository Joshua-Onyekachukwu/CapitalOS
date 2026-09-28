/**
 * Scheduled JSONL snapshot export — durable archive off-database.
 *
 * Streams the compact investors table to Supabase Storage (bucket
 * `data-archive`, path `snapshots/investors-YYYY-MM-DD.jsonl`) so the dataset
 * survives any database incident and every mutation is diffable against a
 * dated baseline. Idempotent per day: an existing object for today is
 * skipped, not overwritten.
 *
 * Outcome recorded in background_jobs (job_type 'snapshot_export').
 */

import { createClient } from "@supabase/supabase-js";

const BUCKET = "data-archive";
const FOLDER = "snapshots";

const COLUMNS = [
  "id", "full_name", "name_normalized", "investor_type",
  "investment_stages", "investment_sectors", "investment_geographies",
  "country", "city", "website_url", "linkedin_url", "email",
  "fit_score", "data_quality_score", "outreach_readiness",
  "verification_status", "last_verified_at", "content_hash",
  "source", "source_id", "source_provider", "is_active",
  "record_status", "merged_into_id", "created_at", "updated_at",
];

export interface SnapshotSummary {
  status: "completed" | "skipped_exists" | "failed" | "failed_zero_rows";
  rows: number;
  bytes: number;
  object: string;
  error?: string;
}

function sp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function recordJob(outcome: SnapshotSummary): Promise<void> {
  try {
    const now = new Date().toISOString();
    await sp().from("background_jobs").insert({
      job_type: "snapshot_export",
      status: outcome.status === "completed" ? "completed" : "failed",
      priority: 5,
      input: { scheduled: true, bucket: BUCKET },
      output: outcome as unknown as Record<string, unknown>,
      error_message: outcome.error || null,
      started_at: now,
      completed_at: now,
    });
  } catch {
    // observability is best-effort
  }
}

export async function runSnapshotExport(opts?: { userId?: string }): Promise<SnapshotSummary> {
  const db = sp();
  const date = new Date().toISOString().slice(0, 10);
  const object = `${FOLDER}/investors-${date}.jsonl`;

  try {
    // Bucket may not exist on a fresh project — create it (no-op if present).
    const { data: buckets } = await db.storage.listBuckets();
    if (buckets && !buckets.find((b) => b.name === BUCKET)) {
      const { error: createErr } = await db.storage.createBucket(BUCKET, { public: false });
      if (createErr && !/exists/i.test(createErr.message)) throw createErr;
    }

    const { data: existing } = await db.storage.from(BUCKET).list(FOLDER, { search: `investors-${date}.jsonl` });
    if (existing && existing.length > 0) {
      const outcome: SnapshotSummary = { status: "skipped_exists", rows: 0, bytes: 0, object };
      await recordJob(outcome);
      return outcome;
    }

    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let rows = 0;

    const PAGE = 1000;
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await db
        .from("investors")
        .select(COLUMNS.join(", "))
        .order("created_at")
        .range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) {
        chunks.push(encoder.encode(JSON.stringify(row) + "\n"));
        rows++;
      }
      if (rows > 200_000) throw new Error("snapshot exceeded 200k rows — aborting to bound memory");
    }

    if (rows === 0) {
      const outcome: SnapshotSummary = { status: "failed_zero_rows", rows: 0, bytes: 0, object, error: "0 rows exported — refusing to archive an empty snapshot" };
      await recordJob(outcome);
      return outcome;
    }

    const body = chunks.reduce((acc, c) => {
      const merged = new Uint8Array(acc.length + c.length);
      merged.set(acc, 0);
      merged.set(c, acc.length);
      return merged;
    }, new Uint8Array(0));

    const { error: uploadErr } = await db.storage
      .from(BUCKET)
      .upload(object, body, { contentType: "application/x-ndjson", upsert: false });
    if (uploadErr) throw uploadErr;

    const outcome: SnapshotSummary = { status: "completed", rows, bytes: body.length, object };
    await recordJob(outcome);
    if (opts?.userId) {
      const { logAdminAction } = await import("@/lib/services/admin/audit");
      logAdminAction({ userId: opts.userId, action: "snapshot_export_run", entityType: "investor", details: outcome as unknown as Record<string, unknown> });
    }
    return outcome;
  } catch (err) {
    const outcome: SnapshotSummary = {
      status: "failed", rows: 0, bytes: 0, object,
      error: String((err as Error).message || err).slice(0, 300),
    };
    await recordJob(outcome);
    return outcome;
  }
}
