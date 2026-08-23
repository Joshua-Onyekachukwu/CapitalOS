-- =============================================
-- Capital-OS: Billing State, Email Threads & Background Jobs
-- Migration 005 (Idempotent — safe to re-run)
-- =============================================

-- =============================================
-- EMAIL THREADS (defensive: handle partial creation)
-- =============================================

-- Create table if not exists
CREATE TABLE IF NOT EXISTS public.email_threads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id     UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  campaign_id     UUID,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  message_count   INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if table already existed without them
DO $$ BEGIN ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS campaign_id UUID; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT ''; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS last_message_preview TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.email_threads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_email_threads_user ON public.email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_investor ON public.email_threads(investor_id);

-- =============================================
-- BACKGROUND JOBS
-- =============================================

CREATE TABLE IF NOT EXISTS public.background_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
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

DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS job_type TEXT NOT NULL DEFAULT 'unknown'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 5; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS input JSONB DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS output JSONB DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS error_message TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.background_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_background_jobs_user ON public.background_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON public.background_jobs(status);

-- =============================================
-- SUBSCRIPTION STATE MACHINE
-- =============================================

DO $$ BEGIN ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS previous_plan_id UUID REFERENCES public.billing_plans(id); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS plan_changed_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS grace_period_end TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS cancel_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS downgrade_at TIMESTAMPTZ; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.user_subscriptions ADD COLUMN IF NOT EXISTS pending_plan_id UUID REFERENCES public.billing_plans(id); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Expand status constraint
DO $$ BEGIN
  ALTER TABLE public.user_subscriptions
    DROP CONSTRAINT IF EXISTS user_subscriptions_status_check;
  ALTER TABLE public.user_subscriptions
    ADD CONSTRAINT user_subscriptions_status_check
    CHECK (status IN ('active','past_due','cancelled','trialing','grace_period','pending_change','downgrading'));
EXCEPTION WHEN others THEN NULL; END $$;

-- =============================================
-- BILLING EVENTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.billing_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  event_data      JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL DEFAULT gen_random_uuid(); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'unknown'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS event_data JSONB DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.billing_events ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_billing_events_user ON public.billing_events(user_id);

-- =============================================
-- RLS POLICIES (defensive: drop + recreate)
-- =============================================

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Email threads RLS
DROP POLICY IF EXISTS "Users can view own email threads" ON public.email_threads;
DROP POLICY IF EXISTS "Users can manage own email threads" ON public.email_threads;

CREATE POLICY "Users can view own email threads"
  ON public.email_threads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own email threads"
  ON public.email_threads FOR ALL
  USING (auth.uid() = user_id);

-- Background jobs RLS
DROP POLICY IF EXISTS "Users can view own background jobs" ON public.background_jobs;
DROP POLICY IF EXISTS "Service role manages background jobs" ON public.background_jobs;

CREATE POLICY "Users can view own background jobs"
  ON public.background_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages background jobs"
  ON public.background_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Billing events RLS
DROP POLICY IF EXISTS "Users can view own billing events" ON public.billing_events;
DROP POLICY IF EXISTS "Service role manages billing events" ON public.billing_events;

CREATE POLICY "Users can view own billing events"
  ON public.billing_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages billing events"
  ON public.billing_events FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- TRIGGERS
-- =============================================

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
