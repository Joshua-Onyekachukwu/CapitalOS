-- =============================================
-- Capital OS — Follow-Up Email Sequences
-- =============================================
-- Multi-step drip campaigns for investor outreach.
-- Run in Supabase SQL Editor after migration 006.

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE sequence_status AS ENUM (
  'draft',
  'active',
  'paused',
  'completed',
  'cancelled'
);

CREATE TYPE sequence_step_type AS ENUM (
  'initial',
  'follow_up',
  'breakup',
  'custom'
);

CREATE TYPE step_status AS ENUM (
  'pending',
  'scheduled',
  'sent',
  'delivered',
  'opened',
  'replied',
  'bounced',
  'skipped',
  'cancelled'
);

-- =============================================
-- CAMPAIGN SEQUENCES
-- =============================================

CREATE TABLE IF NOT EXISTS public.campaign_sequences (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id     UUID NOT NULL REFERENCES public.data_acquisition_jobs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  status          sequence_status NOT NULL DEFAULT 'draft',
  total_steps     INTEGER NOT NULL DEFAULT 0,
  total_enrolled  INTEGER NOT NULL DEFAULT 0,
  total_completed INTEGER NOT NULL DEFAULT 0,
  total_replies   INTEGER NOT NULL DEFAULT 0,
  send_window_start TIME,              -- Earliest time of day to send (e.g., '09:00')
  send_window_end   TIME,              -- Latest time of day to send (e.g., '17:00')
  send_days       INTEGER[] DEFAULT '{1,2,3,4,5}',  -- Days of week (1=Mon, 7=Sun)
  stop_on_reply   BOOLEAN NOT NULL DEFAULT true,    -- Stop sequence if investor replies
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_sequences_campaign ON public.campaign_sequences(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_user ON public.campaign_sequences(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sequences_status ON public.campaign_sequences(status);

-- =============================================
-- CAMPAIGN SEQUENCE STEPS
-- =============================================

CREATE TABLE IF NOT EXISTS public.campaign_sequence_steps (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id     UUID NOT NULL REFERENCES public.campaign_sequences(id) ON DELETE CASCADE,
  step_number     INTEGER NOT NULL,
  step_type       sequence_step_type NOT NULL DEFAULT 'follow_up',
  subject_template TEXT NOT NULL,         -- Subject with {{variables}}
  body_template    TEXT NOT NULL,         -- Body with {{variables}}
  delay_days      INTEGER NOT NULL DEFAULT 3,  -- Days after previous step
  delay_hours     INTEGER NOT NULL DEFAULT 0,  -- Additional hours
  tone            TEXT DEFAULT 'professional', -- AI tone for generation
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, step_number)
);

CREATE INDEX IF NOT EXISTS idx_sequence_steps_sequence ON public.campaign_sequence_steps(sequence_id);

-- =============================================
-- CAMPAIGN SEQUENCE ENROLLMENTS
-- =============================================
-- Tracks which investors are enrolled in which sequence
-- and their current step + status.

CREATE TABLE IF NOT EXISTS public.campaign_sequence_enrollments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id     UUID NOT NULL REFERENCES public.campaign_sequences(id) ON DELETE CASCADE,
  investor_id     UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  campaign_id     UUID NOT NULL REFERENCES public.data_acquisition_jobs(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step    INTEGER NOT NULL DEFAULT 0,  -- 0 = not started, 1 = first step sent
  status          step_status NOT NULL DEFAULT 'pending',
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_send_at    TIMESTAMPTZ,                  -- When the next step should be sent
  last_sent_at    TIMESTAMPTZ,                  -- When the last step was sent
  completed_at    TIMESTAMPTZ,                  -- When the sequence completed
  stopped_reason  TEXT,                         -- Why the sequence stopped (replied, bounced, etc.)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON public.campaign_sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_investor ON public.campaign_sequence_enrollments(investor_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_next_send ON public.campaign_sequence_enrollments(next_send_at)
  WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON public.campaign_sequence_enrollments(user_id);

-- =============================================
-- CAMPAIGN SEQUENCE EMAILS (sent emails per step)
-- =============================================

CREATE TABLE IF NOT EXISTS public.campaign_sequence_emails (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id   UUID NOT NULL REFERENCES public.campaign_sequence_enrollments(id) ON DELETE CASCADE,
  step_id         UUID NOT NULL REFERENCES public.campaign_sequence_steps(id) ON DELETE CASCADE,
  investor_id     UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL,
  body_text       TEXT,
  from_address    TEXT,
  to_address      TEXT,
  message_id      TEXT,                    -- Provider message ID
  status          step_status NOT NULL DEFAULT 'sent',
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at    TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  bounced_at      TIMESTAMPTZ,
  error_message   TEXT,
  ai_generated    BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seq_emails_enrollment ON public.campaign_sequence_emails(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_seq_emails_investor ON public.campaign_sequence_emails(investor_id);
CREATE INDEX IF NOT EXISTS idx_seq_emails_status ON public.campaign_sequence_emails(status);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.campaign_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_sequence_emails ENABLE ROW LEVEL SECURITY;

-- Sequences: users can manage their own
CREATE POLICY "Users manage own sequences"
  ON public.campaign_sequences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Steps: users can manage steps of their own sequences
CREATE POLICY "Users manage own sequence steps"
  ON public.campaign_sequence_steps FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_sequences
      WHERE id = campaign_sequence_steps.sequence_id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_sequences
      WHERE id = campaign_sequence_steps.sequence_id
      AND user_id = auth.uid()
    )
  );

-- Enrollments: users can manage their own
CREATE POLICY "Users manage own enrollments"
  ON public.campaign_sequence_enrollments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Emails: users can view their own
CREATE POLICY "Users manage own sequence emails"
  ON public.campaign_sequence_emails FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access on sequences"
  ON public.campaign_sequences FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on sequence steps"
  ON public.campaign_sequence_steps FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on enrollments"
  ON public.campaign_sequence_enrollments FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access on sequence emails"
  ON public.campaign_sequence_emails FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- UPDATED_AT TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION update_campaign_sequence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_sequence_updated
  BEFORE UPDATE ON public.campaign_sequences
  FOR EACH ROW EXECUTE FUNCTION update_campaign_sequence_updated_at();

CREATE TRIGGER on_sequence_step_updated
  BEFORE UPDATE ON public.campaign_sequence_steps
  FOR EACH ROW EXECUTE FUNCTION update_campaign_sequence_updated_at();

CREATE TRIGGER on_enrollment_updated
  BEFORE UPDATE ON public.campaign_sequence_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_campaign_sequence_updated_at();

-- =============================================
-- HELPER: Calculate next send time
-- =============================================

CREATE OR REPLACE FUNCTION calculate_next_send_at(
  p_delay_days INTEGER,
  p_delay_hours INTEGER,
  p_send_window_start TIME,
  p_send_window_end TIME,
  p_send_days INTEGER[]
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  next_time TIMESTAMPTZ;
  base_time TIMESTAMPTZ;
  check_day INTEGER;
  found BOOLEAN := false;
BEGIN
  -- Start from now + delay
  base_time := now() + (p_delay_days || ' days')::INTERVAL + (p_delay_hours || ' hours')::INTERVAL;

  -- If no send window constraints, return base_time
  IF p_send_window_start IS NULL OR p_send_window_end IS NULL OR p_send_days IS NULL OR array_length(p_send_days, 1) IS NULL THEN
    RETURN base_time;
  END IF;

  -- Find the next valid send time within the window
  next_time := base_time;

  -- Check up to 14 days ahead
  FOR i IN 0..14 LOOP
    check_day := EXTRACT(DOW FROM (next_time + (i || ' days')::INTERVAL))::INTEGER;
    -- Convert PostgreSQL DOW (0=Sun) to our format (1=Mon, 7=Sun)
    IF check_day = 0 THEN check_day := 7; END IF;

    IF check_day = ANY(p_send_days) THEN
      next_time := (next_time + (i || ' days')::INTERVAL)::TIMESTAMPTZ;
      -- Set to send window start time
      next_time := DATE_TRUNC('day', next_time) + p_send_window_start;
      found := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT found THEN
    next_time := base_time;
  END IF;

  RETURN next_time;
END;
$$ LANGUAGE plpgsql;
