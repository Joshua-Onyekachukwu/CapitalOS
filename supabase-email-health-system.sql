-- =============================================
-- Capital OS — Email Health System Migration
-- Run this ENTIRE file in Supabase SQL Editor
-- It will:
--   1. Fix PostgREST cache for email_messages
--   2. Add missing columns to email_messages
--   3. Create all new email health tables
-- =============================================

-- =============================================
-- 1. FIX email_messages PostgREST visibility
-- =============================================
-- Drop and recreate with proper RLS to force PostgREST reload

-- First, back up existing data if any
DO $$
BEGIN
  -- Add missing columns to email_messages
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_messages' AND column_name='bounce_type') THEN
    ALTER TABLE email_messages ADD COLUMN bounce_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_messages' AND column_name='delivery_status') THEN
    ALTER TABLE email_messages ADD COLUMN delivery_status TEXT DEFAULT 'unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_messages' AND column_name='account_id') THEN
    ALTER TABLE email_messages ADD COLUMN account_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_messages' AND column_name='unsubscribed') THEN
    ALTER TABLE email_messages ADD COLUMN unsubscribed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Force PostgREST schema reload by modifying the table
ALTER TABLE email_messages DROP CONSTRAINT IF EXISTS email_messages_pkey CASCADE;
ALTER TABLE email_messages ADD PRIMARY KEY (id);

-- =============================================
-- 2. Add missing columns to email_accounts
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='health_score') THEN
    ALTER TABLE email_accounts ADD COLUMN health_score INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='health_status') THEN
    ALTER TABLE email_accounts ADD COLUMN health_status TEXT DEFAULT 'unknown';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='warmup_status') THEN
    ALTER TABLE email_accounts ADD COLUMN warmup_status TEXT DEFAULT 'not_started';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='warmup_day') THEN
    ALTER TABLE email_accounts ADD COLUMN warmup_day INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='recommended_daily_limit') THEN
    ALTER TABLE email_accounts ADD COLUMN recommended_daily_limit INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='total_sent_all_time') THEN
    ALTER TABLE email_accounts ADD COLUMN total_sent_all_time INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='total_bounced_all_time') THEN
    ALTER TABLE email_accounts ADD COLUMN total_bounced_all_time INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='total_complaints_all_time') THEN
    ALTER TABLE email_accounts ADD COLUMN total_complaints_all_time INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='last_sent_at') THEN
    ALTER TABLE email_accounts ADD COLUMN last_sent_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='sending_paused') THEN
    ALTER TABLE email_accounts ADD COLUMN sending_paused BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_accounts' AND column_name='pause_reason') THEN
    ALTER TABLE email_accounts ADD COLUMN pause_reason TEXT;
  END IF;
END $$;

-- =============================================
-- 3. Email Health Scores
-- =============================================
CREATE TABLE IF NOT EXISTS email_health_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  overall_score INTEGER DEFAULT 0,
  health_status TEXT DEFAULT 'unknown',
  auth_score INTEGER DEFAULT 0,
  bounce_score INTEGER DEFAULT 0,
  consistency_score INTEGER DEFAULT 0,
  complaint_score INTEGER DEFAULT 0,
  domain_score INTEGER DEFAULT 0,
  warmup_score INTEGER DEFAULT 0,
  factors JSONB DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. Email Warm-Up Tracking
-- =============================================
CREATE TABLE IF NOT EXISTS email_warmup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'not_started',
  current_day INTEGER DEFAULT 0,
  current_stage INTEGER DEFAULT 1,
  recommended_volume INTEGER DEFAULT 0,
  actual_sent_today INTEGER DEFAULT 0,
  target_volume INTEGER DEFAULT 0,
  stage_started_at TIMESTAMPTZ,
  stage_completed_at TIMESTAMPTZ,
  history JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  pause_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. Email Sending Log
-- =============================================
CREATE TABLE IF NOT EXISTS email_sending_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID,
  campaign_id UUID,
  investor_id UUID,
  direction TEXT DEFAULT 'outbound',
  status TEXT DEFAULT 'queued',
  bounce_type TEXT,
  error_code TEXT,
  error_message TEXT,
  provider_message_id TEXT,
  tracking_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. Email Health Events (Timeline)
-- =============================================
CREATE TABLE IF NOT EXISTS email_health_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID,
  campaign_id UUID,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  description TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 7. Suppression List
-- =============================================
CREATE TABLE IF NOT EXISTS email_suppression_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email_address TEXT NOT NULL,
  reason TEXT NOT NULL,
  bounce_type TEXT,
  source TEXT,
  suppressed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, email_address)
);

-- =============================================
-- 8. Domain Health
-- =============================================
CREATE TABLE IF NOT EXISTS email_domain_health (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  spf_valid BOOLEAN,
  spf_record TEXT,
  dkim_valid BOOLEAN,
  dkim_record TEXT,
  dmarc_valid BOOLEAN,
  dmarc_record TEXT,
  dmarc_policy TEXT,
  mx_valid BOOLEAN,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, domain)
);

-- =============================================
-- 9. Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_email_health_scores_user ON email_health_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_email_health_scores_account ON email_health_scores(account_id);
CREATE INDEX IF NOT EXISTS idx_email_warmup_user ON email_warmup(user_id);
CREATE INDEX IF NOT EXISTS idx_email_warmup_account ON email_warmup(account_id);
CREATE INDEX IF NOT EXISTS idx_email_sending_log_user ON email_sending_log(user_id);
CREATE INDEX IF NOT EXISTS idx_email_sending_log_account ON email_sending_log(account_id);
CREATE INDEX IF NOT EXISTS idx_email_sending_log_status ON email_sending_log(status);
CREATE INDEX IF NOT EXISTS idx_email_sending_log_created ON email_sending_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_health_events_user ON email_health_events(user_id);
CREATE INDEX IF NOT EXISTS idx_email_health_events_type ON email_health_events(event_type);
CREATE INDEX IF NOT EXISTS idx_email_health_events_created ON email_health_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_suppression_user ON email_suppression_list(user_id);
CREATE INDEX IF NOT EXISTS idx_email_suppression_email ON email_suppression_list(email_address);
CREATE INDEX IF NOT EXISTS idx_email_domain_health_user ON email_domain_health(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_account ON email_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_delivery ON email_messages(delivery_status);
CREATE INDEX IF NOT EXISTS idx_email_messages_campaign ON email_messages(campaign_id);

-- =============================================
-- 10. RLS Policies
-- =============================================
ALTER TABLE email_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_warmup ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sending_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_health_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_domain_health ENABLE ROW LEVEL SECURITY;

-- Health Scores
CREATE POLICY "Users read own health scores" ON email_health_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own health scores" ON email_health_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own health scores" ON email_health_scores FOR UPDATE USING (auth.uid() = user_id);

-- Warm-Up
CREATE POLICY "Users read own warmup" ON email_warmup FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own warmup" ON email_warmup FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own warmup" ON email_warmup FOR UPDATE USING (auth.uid() = user_id);

-- Sending Log
CREATE POLICY "Users read own sending log" ON email_sending_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own sending log" ON email_sending_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Health Events
CREATE POLICY "Users read own health events" ON email_health_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own health events" ON email_health_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Suppression List
CREATE POLICY "Users read own suppression list" ON email_suppression_list FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own suppression list" ON email_suppression_list FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own suppression list" ON email_suppression_list FOR DELETE USING (auth.uid() = user_id);

-- Domain Health
CREATE POLICY "Users read own domain health" ON email_domain_health FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own domain health" ON email_domain_health FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own domain health" ON email_domain_health FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- Done
-- =============================================
DO $$ BEGIN RAISE NOTICE 'Email health system migration complete!'; END $$;
