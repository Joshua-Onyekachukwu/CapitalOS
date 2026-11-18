-- 041_job_queue.sql
-- The jobs API and runner query public.job_queue, but the table was never
-- created by any migration (the live background_jobs table has a different
-- column set). Without this, every /api/jobs request failed at the first query.
-- Additive only: no existing table is touched.

CREATE TABLE IF NOT EXISTS public.job_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'running', 'completed', 'failed', 'dead')),
  priority      INTEGER NOT NULL DEFAULT 0,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  progress      JSONB NOT NULL DEFAULT '{}'::jsonb,
  result        JSONB,
  error         TEXT,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  max_retries   INTEGER NOT NULL DEFAULT 3,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_queue_status_priority_idx
  ON public.job_queue (status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS job_queue_created_by_idx
  ON public.job_queue (created_by, created_at DESC);
