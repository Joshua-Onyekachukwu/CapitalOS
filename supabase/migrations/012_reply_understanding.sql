-- Migration 012: Reply understanding layer (applied live 2026-09-30)
-- 1) Enrollment lifecycle values the engine needs: executeSend writes
--    status='completed' (not in the original enum -> runtime insert errors)
--    and stop-on-reply needs 'paused'.
ALTER TYPE step_status ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE step_status ADD VALUE IF NOT EXISTS 'completed';

ALTER TABLE public.campaign_sequence_enrollments
  ADD COLUMN IF NOT EXISTS paused_reason text,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- 2) Stored understanding of an inbound investor reply.
CREATE TABLE IF NOT EXISTS public.reply_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id uuid REFERENCES public.investors(id) ON DELETE SET NULL,
  thread_id uuid REFERENCES public.email_threads(id) ON DELETE SET NULL,
  message_id text UNIQUE,
  interest_level text NOT NULL CHECK (interest_level IN
    ('meeting_ready','interested','curious','soft_no','hard_no','out_of_office','neutral')),
  confidence numeric CHECK (confidence >= 0 AND confidence <= 1),
  rationale text,
  suggested_reply text,
  suggested_reply_subject text,
  engine text NOT NULL DEFAULT 'rules' CHECK (engine IN ('rules','ai')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reply_insights_thread ON public.reply_insights(thread_id);
CREATE INDEX IF NOT EXISTS idx_reply_insights_user ON public.reply_insights(user_id, created_at DESC);

ALTER TABLE public.reply_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY reply_insights_owner_select ON public.reply_insights
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY reply_insights_service_all ON public.reply_insights
  FOR ALL TO service_role USING (true) WITH CHECK (true);
