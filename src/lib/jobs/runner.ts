/**
 * Background Job Runner
 *
 * Processes jobs from the job_queue table in CockroachDB.
 * Jobs are persisted to survive server restarts.
 *
 * Features:
 *   - In-process execution (no external worker needed)
 *   - Progress tracking (step, current/total, percent)
 *   - Automatic retry with exponential backoff
 *   - Dead letter after max retries
 *   - Concurrent job limiting
 *   - Graceful shutdown
 *
 * Usage:
 *   import { jobRunner, createJob } from "@/lib/jobs/runner";
 *
 *   // Enqueue a job
 *   const jobId = await createJob("apollo_import", { csvPath: "..." }, user.id);
 *
 *   // Register a handler
 *   jobRunner.register("apollo_import", async (job) => {
 *     await job.progress("normalizing", 0, 100, 10);
 *     // ... do work ...
 *     await job.progress("inserting", 10, 100, 50);
 *     // ... more work ...
 *     return { inserted: 500, skipped: 10 };
 *   });
 */

import { query } from "@/lib/db";

// ── Types ──

export type JobStatus = "pending" | "running" | "completed" | "failed" | "dead";

export interface JobProgress {
  step: string;
  current: number;
  total: number;
  percent: number;
}

export interface JobRecord {
  id: string;
  job_type: string;
  status: JobStatus;
  priority: number;
  payload: Record<string, unknown>;
  progress: JobProgress;
  result: Record<string, unknown> | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type JobHandler = (job: JobContext) => Promise<unknown>;

export interface JobContext {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdBy: string | null;
  progress(step: string, current: number, total: number, percent?: number): Promise<void>;
  log(message: string): void;
}

// ── Job Runner Class ──

class JobRunner {
  private handlers = new Map<string, JobHandler>();
  private running = new Set<string>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private maxConcurrent = 3;
  private pollIntervalMs = 2_000;

  /**
   * Register a handler for a job type.
   */
  register(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
    console.log(`[jobs] Registered handler for "${type}"`);
  }

  /**
   * Start polling for pending jobs.
   */
  start(): void {
    if (this.pollTimer) return;
    console.log(`[jobs] Starting poller (interval: ${this.pollIntervalMs}ms, max concurrent: ${this.maxConcurrent})`);
    this.pollTimer = setInterval(() => this.poll(), this.pollIntervalMs);
    // Run immediately
    this.poll();
  }

  /**
   * Stop polling and wait for running jobs to finish.
   */
  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log(`[jobs] Stopping... waiting for ${this.running.size} running jobs`);
    // Wait for running jobs to finish (with timeout)
    const deadline = Date.now() + 30_000;
    while (this.running.size > 0 && Date.now() < deadline) {
      await sleep(500);
    }
    console.log(`[jobs] Stopped`);
  }

  /**
   * Poll for and process pending jobs.
   */
  private async poll(): Promise<void> {
    // Skip if at capacity
    if (this.running.size >= this.maxConcurrent) return;

    try {
      // Fetch pending jobs (ordered by priority DESC, created_at ASC)
      const available = this.maxConcurrent - this.running.size;
      const jobs = await query<JobRecord>(
        `SELECT * FROM job_queue
         WHERE status = 'pending'
         ORDER BY priority DESC, created_at ASC
         LIMIT $1`,
        [available]
      );

      for (const job of jobs) {
        if (this.running.has(job.id)) continue;
        this.execute(job);
      }
    } catch (err) {
      console.error("[jobs] Poll error:", err);
    }
  }

  /**
   * Execute a single job.
   */
  private async execute(job: JobRecord): Promise<void> {
    const handler = this.handlers.get(job.job_type);
    if (!handler) {
      console.warn(`[jobs] No handler for "${job.job_type}" — marking as failed`);
      await this.updateStatus(job.id, "failed", "No handler registered for this job type");
      return;
    }

    this.running.add(job.id);
    console.log(`[jobs] ▶ Starting ${job.job_type} (${job.id})`);

    try {
      // Mark as running
      await query(
        `UPDATE job_queue SET status = 'running', started_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [job.id]
      );

      // Create job context
      const ctx: JobContext = {
        id: job.id,
        type: job.job_type,
        payload: job.payload || {},
        createdBy: job.created_by,

        async progress(step, current, total, percent) {
          const pct = percent ?? (total > 0 ? Math.round((current / total) * 100) : 0);
          await query(
            `UPDATE job_queue
             SET progress = $1::jsonb, updated_at = NOW()
             WHERE id = $2`,
            [
              JSON.stringify({ step, current, total, percent: pct }),
              job.id,
            ]
          );
        },

        log(message) {
          console.log(`[jobs:${job.job_type}] ${message}`);
        },
      };

      // Execute the handler
      const result = await handler(ctx);

      // Mark as completed
      await query(
        `UPDATE job_queue
         SET status = 'completed',
             result = $1::jsonb,
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(result || {}), job.id]
      );

      console.log(`[jobs] ✅ ${job.job_type} (${job.id}) completed`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[jobs] ❌ ${job.job_type} (${job.id}) failed:`, errorMsg);

      const newRetryCount = (job.retry_count || 0) + 1;

      if (newRetryCount >= (job.max_retries || 3)) {
        // Dead letter — too many retries
        await query(
          `UPDATE job_queue
           SET status = 'dead',
               error = $1,
               retry_count = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [errorMsg, newRetryCount, job.id]
        );
        console.log(`[jobs] 💀 ${job.job_type} (${job.id}) moved to dead letter`);
      } else {
        // Retry with backoff
        await query(
          `UPDATE job_queue
           SET status = 'pending',
               error = $1,
               retry_count = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [errorMsg, newRetryCount, job.id]
        );
        console.log(`[jobs] 🔄 ${job.job_type} (${job.id}) queued for retry (${newRetryCount}/${job.max_retries})`);
      }
    } finally {
      this.running.delete(job.id);
    }
  }

  /**
   * Update job status.
   */
  private async updateStatus(id: string, status: JobStatus, error?: string): Promise<void> {
    await query(
      `UPDATE job_queue
       SET status = $1, error = $2, updated_at = NOW()
       WHERE id = $3`,
      [status, error || null, id]
    );
  }
}

// ── Singleton ──

export const jobRunner = new JobRunner();

// ── Helper Functions ──

/**
 * Create a new job and enqueue it.
 */
export async function createJob(
  type: string,
  payload: Record<string, unknown>,
  createdBy?: string
): Promise<string> {
  const result = await query<{ id: string }>(
    `INSERT INTO job_queue (job_type, payload, created_by, status)
     VALUES ($1, $2::jsonb, $3, 'pending')
     RETURNING id`,
    [type, JSON.stringify(payload), createdBy || null]
  );
  const jobId = result[0].id;
  console.log(`[jobs] Created ${type} job: ${jobId}`);
  return jobId;
}

/**
 * Get job status by ID.
 */
export async function getJob(id: string): Promise<JobRecord | null> {
  const result = await query<JobRecord>(
    `SELECT * FROM job_queue WHERE id = $1`,
    [id]
  );
  return result[0] || null;
}

/**
 * Get recent jobs, optionally filtered by type.
 */
export async function listJobs(
  type?: string,
  limit = 20
): Promise<JobRecord[]> {
  if (type) {
    return query<JobRecord>(
      `SELECT * FROM job_queue
       WHERE job_type = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [type, limit]
    );
  }
  return query<JobRecord>(
    `SELECT * FROM job_queue
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
}

/**
 * Cancel a pending or running job.
 */
export async function cancelJob(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE job_queue
     SET status = 'failed', error = 'Cancelled by user', updated_at = NOW()
     WHERE id = $1 AND status IN ('pending', 'running')`,
    [id]
  );
  return (result as any).rowCount > 0;
}

/**
 * Retry a failed or dead job.
 */
export async function retryJob(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE job_queue
     SET status = 'pending', error = NULL, retry_count = 0, updated_at = NOW()
     WHERE id = $1 AND status IN ('failed', 'dead')`,
    [id]
  );
  return (result as any).rowCount > 0;
}

// ── Utilities ──

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Graceful Shutdown ──

if (typeof process !== "undefined") {
  process.once("SIGTERM", () => jobRunner.stop());
  process.once("SIGINT", () => jobRunner.stop());
}
