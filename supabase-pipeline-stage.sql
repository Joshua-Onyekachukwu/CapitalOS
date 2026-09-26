-- ============================================================
-- Capital OS — Pipeline Stage Migration
-- Run this in Supabase SQL Editor to enable full pipeline management.
-- Safe to run multiple times (idempotent).
-- ============================================================

-- 1. Add pipeline_stage column to investors table
ALTER TABLE public.investors 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT DEFAULT 'discovered';

-- 2. Migrate existing outreach_readiness values to pipeline_stage
UPDATE public.investors SET pipeline_stage = CASE
  WHEN outreach_readiness = 'not_ready'          THEN 'discovered'
  WHEN outreach_readiness = 'needs_verification' THEN 'qualified'
  WHEN outreach_readiness = 'ready'              THEN 'outreach'
  WHEN outreach_readiness = 'contacted'          THEN 'contacted'
  WHEN outreach_readiness = 'interested'         THEN 'meeting'
  WHEN outreach_readiness = 'do_not_contact'     THEN 'passed'
  WHEN outreach_readiness = 'low_priority'       THEN 'discovered'
  ELSE 'discovered'
END
WHERE pipeline_stage IS NULL OR pipeline_stage = 'discovered';

-- 3. Add index for fast stage filtering
CREATE INDEX IF NOT EXISTS idx_investors_pipeline_stage 
  ON public.investors(pipeline_stage);

-- 4. Create pipeline_events table for audit trail
CREATE TABLE IF NOT EXISTS public.pipeline_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id  UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL,
  from_stage   TEXT,
  to_stage     TEXT NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_events_investor 
  ON public.pipeline_events(investor_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_events_user 
  ON public.pipeline_events(user_id);

-- 5. RLS for pipeline_events (users can only see their own events)
ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own pipeline events" ON public.pipeline_events;
CREATE POLICY "Users can manage own pipeline events"
  ON public.pipeline_events
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Done
SELECT 'Pipeline migration complete ✅' AS status;
