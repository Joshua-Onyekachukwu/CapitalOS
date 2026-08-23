-- =============================================
-- Capital OS — Email Open/Click Tracking
-- =============================================
-- Adds tracking columns and tables for pixel-based
-- open detection and click redirect tracking.

-- =============================================
-- Add tracking columns to email_messages
-- =============================================

ALTER TABLE public.email_messages
  ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_open_ip TEXT,
  ADD COLUMN IF NOT EXISTS first_click_ip TEXT,
  ADD COLUMN IF NOT EXISTS tracking_enabled BOOLEAN DEFAULT true;

-- Index for fast tracking lookups
CREATE INDEX IF NOT EXISTS idx_email_messages_tracking_id
  ON public.email_messages(tracking_id)
  WHERE tracking_id IS NOT NULL;

-- =============================================
-- EMAIL TRACKING EVENTS (detailed log)
-- =============================================

CREATE TABLE IF NOT EXISTS public.email_tracking_events (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id        UUID NOT NULL REFERENCES public.email_messages(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  investor_id     UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  event_type      TEXT NOT NULL CHECK (event_type IN ('open', 'click')),
  url             TEXT,                    -- URL that was clicked (null for opens)
  user_agent      TEXT,
  ip_address      TEXT,
  country         TEXT,                    -- GeoIP lookup result
  device_type     TEXT,                    -- desktop, mobile, tablet
  email_client    TEXT,                    -- gmail, outlook, apple_mail, etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_events_email ON public.email_tracking_events(email_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_user ON public.email_tracking_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON public.email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created ON public.email_tracking_events(created_at);

-- =============================================
-- RLS
-- =============================================

ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tracking events"
  ON public.email_tracking_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on tracking events"
  ON public.email_tracking_events FOR ALL
  USING (auth.role() = 'service_role');
