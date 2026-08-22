-- =============================================
-- Capital-OS: Billing State, Email Threads & Background Jobs
-- Migration 005 (Idempotent — safe to re-run)
-- =============================================

-- =============================================
-- EMAIL THREADS
-- =============================================

CREATE TABLE IF NOT EXISTS public.email_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id     UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  campaign_id     UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived','closed')),
  message_count   INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_threads_user ON public.email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_investor ON public.email_threads(investor_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_campaign ON public.email_threads(campaign_id);

-- =============================================
-- BACKGROUND JOBS
-- =============================================

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed','cancelled')),
  priority        INTEGER NOT NULL DEFAULT 5,
  input           JSONB DEFAULT '{}',
  output          JSONB DEFAULT '{}',
  error_message   TEXT,
  progress        INTEGER DEFAULT 0,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_user ON public.background_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON public.background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_type ON public.background_jobs(job_type);

-- =============================================
-- SUBSCRIPTION STATE MACHINE
-- =============================================

-- Add grace period and state machine columns to user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS previous_plan_id UUID REFERENCES public.billing_plans(id),
  ADD COLUMN IF NOT EXISTS plan_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS downgrade_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_plan_id UUID REFERENCES public.billing_plans(id);

-- Expand status to include more states
DO $$ BEGIN
  ALTER TABLE public.user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
EXCEPTION WHEN others THEN NULL; END $$;

ALTER TABLE public.user_subscriptions
  ADD CONSTRAINT user_subscriptions_status_check
  CHECK (status IN ('active','past_due','cancelled','trialing','grace_period','pending_change','downgrading'));

-- =============================================
-- BILLING EVENTS (audit trail)
-- =============================================

CREATE TABLE IF NOT EXISTS public.billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  event_data      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_user ON public.billing_events(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_created ON public.billing_events(created_at DESC);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Email threads — user owns their own
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

-- Background jobs — user owns their own
DO $$ BEGIN
  CREATE POLICY "Users can view own background jobs"
    ON public.background_jobs FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages background jobs"
    ON public.background_jobs FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Billing events — user owns their own
DO $$ BEGIN
  CREATE POLICY "Users can view own billing events"
    ON public.billing_events FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages billing events"
    ON public.billing_events FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at on email_threads
DROP TRIGGER IF EXISTS on_email_thread_updated ON public.email_threads;

CREATE OR REPLACE FUNCTION public.handle_email_thread_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_email_thread_updated
  BEFORE UPDATE ON public.email_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_thread_updated();

-- Auto-update updated_at on background_jobs
DROP TRIGGER IF EXISTS on_background_job_updated ON public.background_jobs;

CREATE OR REPLACE FUNCTION public.handle_background_job_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_background_job_updated
  BEFORE UPDATE ON public.background_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_background_job_updated();

-- =============================================
-- DONE
-- =============================================

SELECT 'Migration 005 complete — Email Threads, Background Jobs, Subscription State Machine ready.' AS result;
