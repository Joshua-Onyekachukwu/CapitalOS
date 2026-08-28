-- =============================================
-- Email Tracking — SQL Migration
-- =============================================
-- Adds tracking support to email_messages and creates
-- the tracking events table for open/click analytics.

-- Add tracking columns to email_messages
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS tracking_id TEXT UNIQUE;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS first_open_ip TEXT;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS first_click_ip TEXT;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS reply_detected_at TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS bounce_type TEXT;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS deliverability_status TEXT DEFAULT 'unknown';

-- Create tracking events table
CREATE TABLE IF NOT EXISTS email_tracking_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID NOT NULL,
  user_id UUID NOT NULL,
  investor_id UUID,
  event_type TEXT NOT NULL,
  url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  device_type TEXT,
  email_client TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_tracking_events_email ON email_tracking_events(email_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_user ON email_tracking_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_type ON email_tracking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_tracking_events_created ON email_tracking_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_id ON email_messages(tracking_id);

-- RLS
ALTER TABLE email_tracking_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own tracking events" ON email_tracking_events;
  DROP POLICY IF EXISTS "Service can insert tracking events" ON email_tracking_events;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users can view own tracking events" ON email_tracking_events
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert tracking events" ON email_tracking_events
  FOR INSERT WITH CHECK (true);
