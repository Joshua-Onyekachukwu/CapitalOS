-- =============================================
-- EMAIL HEALTH SYSTEM — COMPLETE SQL MIGRATION
-- Capital OS
-- =============================================
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates all tables, indexes, RLS policies, and extends existing tables.

-- =============================================
-- 1. EXTEND email_accounts TABLE
-- =============================================

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 0;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS health_status TEXT DEFAULT 'unknown';
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS health_last_checked_at TIMESTAMPTZ;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS warmup_status TEXT DEFAULT 'not_started';
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS warmup_day INTEGER DEFAULT 0;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS warmup_started_at TIMESTAMPTZ;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS warmup_paused_at TIMESTAMPTZ;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS recommended_daily_limit INTEGER DEFAULT 50;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS total_sent_all_time INTEGER DEFAULT 0;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS total_bounced_all_time INTEGER DEFAULT 0;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS total_complaints_all_time INTEGER DEFAULT 0;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS bounce_rate_7d NUMERIC(5,2) DEFAULT 0;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS bounce_rate_30d NUMERIC(5,2) DEFAULT 0;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS reply_rate_7d NUMERIC(5,2) DEFAULT 0;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS spf_status TEXT DEFAULT 'unknown';
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS dkim_status TEXT DEFAULT 'unknown';
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS dmarc_status TEXT DEFAULT 'unknown';
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS domain_verified BOOLEAN DEFAULT false;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS sending_paused BOOLEAN DEFAULT false;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS pause_reason TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS sending_window_start INTEGER DEFAULT 9;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS sending_window_end INTEGER DEFAULT 17;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- =============================================
-- 2. EXTEND email_messages TABLE (if it exists in Supabase)
-- Note: email_messages may be in CockroachDB, not Supabase.
-- This block safely skips if the table doesn't exist.
-- =============================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_messages') THEN
    ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS bounce_type TEXT;
    ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'unknown';
    ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS account_id UUID;
    ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS campaign_id UUID;
    ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- =============================================
-- 3. email_health_events TABLE
-- Every important email event is logged here
-- =============================================

CREATE TABLE IF NOT EXISTS email_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID,
  event_type TEXT NOT NULL,
  -- Types: sent, delivered, bounced, hard_bounced, soft_bounced, complaint,
  --        opened, clicked, replied, unsubscribed, suppressed, warmup_milestone,
  --        health_score_change, sending_paused, sending_resumed, dns_check,
  --        token_refreshed, token_refresh_failed, daily_limit_reached
  severity TEXT DEFAULT 'info',
  -- Levels: info, warning, critical
  details JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_events_user ON email_health_events(user_id);
CREATE INDEX IF NOT EXISTS idx_health_events_account ON email_health_events(account_id);
CREATE INDEX IF NOT EXISTS idx_health_events_type ON email_health_events(event_type);
CREATE INDEX IF NOT EXISTS idx_health_events_created ON email_health_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_events_severity ON email_health_events(severity);

ALTER TABLE email_health_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own health events" ON email_health_events;
CREATE POLICY "Users can view own health events" ON email_health_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert health events" ON email_health_events;
CREATE POLICY "Service role can insert health events" ON email_health_events
  FOR INSERT WITH CHECK (true);

-- =============================================
-- 4. email_sending_log TABLE
-- Records every individual email send attempt
-- =============================================

CREATE TABLE IF NOT EXISTS email_sending_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID,
  campaign_id UUID,
  investor_id UUID,
  email_message_id UUID,
  -- The email_messages record created for this send
  provider TEXT NOT NULL,
  -- google, microsoft, smtp
  to_address TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  -- queued, sending, sent, delivered, failed, bounced, suppressed
  error TEXT,
  tracking_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  bounce_type TEXT,
  -- hard, soft
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sending_log_user ON email_sending_log(user_id);
CREATE INDEX IF NOT EXISTS idx_sending_log_account ON email_sending_log(account_id);
CREATE INDEX IF NOT EXISTS idx_sending_log_status ON email_sending_log(status);
CREATE INDEX IF NOT EXISTS idx_sending_log_sent ON email_sending_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_sending_log_created ON email_sending_log(created_at DESC);

ALTER TABLE email_sending_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sending log" ON email_sending_log;
CREATE POLICY "Users can view own sending log" ON email_sending_log
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert sending log" ON email_sending_log;
CREATE POLICY "Service role can insert sending log" ON email_sending_log
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update sending log" ON email_sending_log;
CREATE POLICY "Service role can update sending log" ON email_sending_log
  FOR UPDATE USING (true);

-- =============================================
-- 5. email_suppression_list TABLE
-- Prevents sending to bounced/unsubscribed contacts
-- =============================================

CREATE TABLE IF NOT EXISTS email_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_address TEXT NOT NULL,
  reason TEXT NOT NULL,
  -- bounced, hard_bounced, unsubscribed, complained, manual
  bounce_type TEXT,
  -- hard, soft (for bounce reasons)
  source TEXT DEFAULT 'system',
  -- system, manual, campaign
  campaign_id UUID,
  suppressed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  -- null = permanent, set date for temporary
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppression_unique ON email_suppression_list(user_id, email_address);
CREATE INDEX IF NOT EXISTS idx_suppression_email ON email_suppression_list(email_address);
CREATE INDEX IF NOT EXISTS idx_suppression_user ON email_suppression_list(user_id);

ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own suppression list" ON email_suppression_list;
CREATE POLICY "Users can view own suppression list" ON email_suppression_list
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own suppression list" ON email_suppression_list;
CREATE POLICY "Users can manage own suppression list" ON email_suppression_list
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert suppression" ON email_suppression_list;
CREATE POLICY "Service role can insert suppression" ON email_suppression_list
  FOR INSERT WITH CHECK (true);

-- =============================================
-- 6. email_health_scores TABLE
-- Historical health score snapshots
-- =============================================

CREATE TABLE IF NOT EXISTS email_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  health_score INTEGER NOT NULL,
  health_status TEXT NOT NULL,
  -- excellent, healthy, needs_attention, at_risk, critical
  authentication_score INTEGER DEFAULT 0,
  bounce_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  consistency_score INTEGER DEFAULT 0,
  warmup_score INTEGER DEFAULT 0,
  domain_score INTEGER DEFAULT 0,
  factors JSONB DEFAULT '{}',
  recommendations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_scores_account ON email_health_scores(account_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_user ON email_health_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_health_scores_created ON email_health_scores(created_at DESC);

ALTER TABLE email_health_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own health scores" ON email_health_scores;
CREATE POLICY "Users can view own health scores" ON email_health_scores
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert health scores" ON email_health_scores;
CREATE POLICY "Service role can insert health scores" ON email_health_scores
  FOR INSERT WITH CHECK (true);

-- =============================================
-- 7. email_warmup TABLE
-- Warm-up stage tracking
-- =============================================

CREATE TABLE IF NOT EXISTS email_warmup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  -- active, paused, completed, failed
  current_stage INTEGER DEFAULT 1,
  -- 1-10 warmup stages
  daily_target INTEGER DEFAULT 5,
  daily_sent INTEGER DEFAULT 0,
  day_number INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  health_at_start INTEGER DEFAULT 0,
  health_current INTEGER DEFAULT 0,
  auto_escalate BOOLEAN DEFAULT true,
  schedule JSONB DEFAULT '{}',
  -- {mon: 5, tue: 8, wed: 12, ...}
  daily_log JSONB DEFAULT '[]',
  -- [{day: 1, sent: 5, target: 5, health: 45}, ...]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_warmup_account ON email_warmup(account_id);
CREATE INDEX IF NOT EXISTS idx_warmup_user ON email_warmup(user_id);
CREATE INDEX IF NOT EXISTS idx_warmup_status ON email_warmup(status);

ALTER TABLE email_warmup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own warmup" ON email_warmup;
CREATE POLICY "Users can view own warmup" ON email_warmup
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own warmup" ON email_warmup;
CREATE POLICY "Users can manage own warmup" ON email_warmup
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert warmup" ON email_warmup;
CREATE POLICY "Service role can insert warmup" ON email_warmup
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update warmup" ON email_warmup;
CREATE POLICY "Service role can update warmup" ON email_warmup
  FOR UPDATE USING (true);

-- =============================================
-- 8. email_domain_health TABLE
-- DNS verification results
-- =============================================

CREATE TABLE IF NOT EXISTS email_domain_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  spf_valid BOOLEAN DEFAULT false,
  spf_record TEXT,
  dkim_valid BOOLEAN DEFAULT false,
  dkim_record TEXT,
  dmarc_valid BOOLEAN DEFAULT false,
  dmarc_record TEXT,
  mx_valid BOOLEAN DEFAULT false,
  mx_records JSONB DEFAULT '[]',
  overall_status TEXT DEFAULT 'unchecked',
  -- good, needs_attention, failing, unchecked
  last_checked_at TIMESTAMPTZ,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_domain_health_unique ON email_domain_health(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_domain_health_domain ON email_domain_health(domain);

ALTER TABLE email_domain_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own domain health" ON email_domain_health;
CREATE POLICY "Users can view own domain health" ON email_domain_health
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own domain health" ON email_domain_health;
CREATE POLICY "Users can manage own domain health" ON email_domain_health
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 9. VIEWS for quick access
-- =============================================

-- Account health overview view
CREATE OR REPLACE VIEW v_account_health AS
SELECT
  ea.id AS account_id,
  ea.user_id,
  ea.email_address,
  ea.provider,
  ea.health_score,
  ea.health_status,
  ea.warmup_status,
  ea.warmup_day,
  ea.recommended_daily_limit,
  ea.sends_today,
  ea.daily_send_limit,
  ea.total_sent_all_time,
  ea.total_bounced_all_time,
  ea.bounce_rate_7d,
  ea.bounce_rate_30d,
  ea.reply_rate_7d,
  ea.sending_paused,
  ea.pause_reason,
  ea.spf_status,
  ea.dkim_status,
  ea.dmarc_status,
  ea.health_last_checked_at,
  (
    SELECT COUNT(*) FROM email_sending_log sl
    WHERE sl.account_id = ea.id AND sl.status = 'sent'
    AND sl.sent_at >= NOW() - INTERVAL '24 hours'
  ) AS sent_last_24h,
  (
    SELECT COUNT(*) FROM email_sending_log sl
    WHERE sl.account_id = ea.id AND sl.status = 'bounced'
    AND sl.bounced_at >= NOW() - INTERVAL '7 days'
  ) AS bounces_last_7d
FROM email_accounts ea;

-- Daily sending summary view
CREATE OR REPLACE VIEW v_daily_sending AS
SELECT
  sl.account_id,
  DATE(sl.sent_at) AS send_date,
  COUNT(*) AS total_sent,
  COUNT(*) FILTER (WHERE sl.status = 'sent') AS successful,
  COUNT(*) FILTER (WHERE sl.status = 'bounced') AS bounced,
  COUNT(*) FILTER (WHERE sl.status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE sl.bounce_type = 'hard') AS hard_bounced,
  COUNT(*) FILTER (WHERE sl.bounce_type = 'soft') AS soft_bounced
FROM email_sending_log sl
WHERE sl.sent_at IS NOT NULL
GROUP BY sl.account_id, DATE(sl.sent_at)
ORDER BY send_date DESC;
