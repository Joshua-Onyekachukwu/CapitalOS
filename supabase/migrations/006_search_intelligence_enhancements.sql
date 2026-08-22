-- =============================================
-- Capital-OS: Search & Intelligence Enhancements
-- Migration 006 (Idempotent — safe to re-run)
-- =============================================

-- =============================================
-- FULL-TEXT SEARCH (tsvector)
-- =============================================

-- Add search vector column to investors
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_investors_search ON public.investors USING GIN(search_vector);

-- Populate search vector from existing data
UPDATE public.investors SET search_vector =
  setweight(to_tsvector('english', coalesce(full_name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(email, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(job_title, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(bio, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(location, '')), 'D') ||
  setweight(to_tsvector('english', coalesce(country, '')), 'D')
WHERE search_vector IS NULL;

-- Create trigger to auto-update search vector on insert/update
CREATE OR REPLACE FUNCTION public.update_investor_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.full_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.email, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.job_title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.bio, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.location, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(NEW.country, '')), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_investor_search_update ON public.investors;
CREATE TRIGGER on_investor_search_update
  BEFORE INSERT OR UPDATE ON public.investors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_investor_search_vector();

-- =============================================
-- FIT SCORE BREAKDOWN
-- =============================================

ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS fit_score_breakdown JSONB DEFAULT '{}';
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS qualification_notes TEXT;

-- =============================================
-- ROLE NORMALIZATION
-- =============================================

ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS role_normalized TEXT;

-- Populate from existing job_title
UPDATE public.investors SET role_normalized = LOWER(TRIM(
  CASE
    WHEN job_title ILIKE '%partner%' THEN 'partner'
    WHEN job_title ILIKE '%managing partner%' THEN 'managing_partner'
    WHEN job_title ILIKE '%general partner%' THEN 'general_partner'
    WHEN job_title ILIKE '%principal%' THEN 'principal'
    WHEN job_title ILIKE '%associate%' THEN 'associate'
    WHEN job_title ILIKE '%analyst%' THEN 'analyst'
    WHEN job_title ILIKE '%vp%' OR job_title ILIKE '%vice president%' THEN 'vp'
    WHEN job_title ILIKE '%director%' THEN 'director'
    WHEN job_title ILIKE '%founder%' OR job_title ILIKE '%co-founder%' THEN 'founder'
    WHEN job_title ILIKE '%advisor%' THEN 'advisor'
    ELSE NULL
  END
)) WHERE role_normalized IS NULL AND job_title IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_investors_role ON public.investors(role_normalized) WHERE role_normalized IS NOT NULL;

-- =============================================
-- EMAIL THREADS
-- =============================================

CREATE TABLE IF NOT EXISTS public.email_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id     UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  campaign_id     UUID,
  subject         TEXT,
  status          TEXT DEFAULT 'active'
    CHECK (status IN ('active','archived','closed')),
  message_count   INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_user ON public.email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_investor ON public.email_threads(investor_id);

-- Add thread_id to email_messages
ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS thread_id UUID REFERENCES public.email_threads(id);

-- RLS for email_threads
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own email threads"
    ON public.email_threads FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage own email threads"
    ON public.email_threads FOR ALL
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- BACKGROUND JOB QUEUE
-- =============================================

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}',
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','cancelled')),
  priority        INTEGER DEFAULT 0,
  attempts        INTEGER DEFAULT 0,
  max_attempts    INTEGER DEFAULT 3,
  error_message   TEXT,
  result          JSONB,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON public.background_jobs(status, priority DESC);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON public.background_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_created ON public.background_jobs(created_at DESC);

-- RLS for background_jobs
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role manages background jobs"
    ON public.background_jobs FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- DONE
-- =============================================

SELECT 'Migration 006 complete — Search & Intelligence enhancements ready.' AS result;
