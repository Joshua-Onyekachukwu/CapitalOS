-- 2026-09-27: Schema drift fix — applies columns/tables the application code
-- references but that were never applied to the live database (email branding,
-- custom SMTP accounts, email tracking, warmup/health counters, founding
-- member webhook idempotency). All statements are additive and idempotent.

-- ── Email branding on company_profiles (supabase-email-branding.sql) ──
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_brand_name TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_tagline TEXT DEFAULT 'AI-Powered Fundraising';
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_accent_color TEXT DEFAULT '#84cc16';
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_logo_url TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_website TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_footer_text TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_cta_text TEXT DEFAULT 'Let''s Connect';
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_cta_url TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_signature TEXT;

-- ── Email accounts: custom SMTP/IMAP + warmup/health counters ──
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_host TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_user TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_pass_encrypted TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT true;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS imap_host TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS imap_user TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS imap_pass_encrypted TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS imap_secure BOOLEAN DEFAULT true;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS custom_domain TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS spf_valid BOOLEAN DEFAULT false;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS dkim_valid BOOLEAN DEFAULT false;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS dmarc_valid BOOLEAN DEFAULT false;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS last_test_sent_at TIMESTAMPTZ;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS test_recipient TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS daily_send_limit INTEGER DEFAULT 50;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS sends_today INTEGER DEFAULT 0;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS last_send_reset_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS warmup_status TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS warmup_day INTEGER;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS warmup_started_at TIMESTAMPTZ;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS recommended_daily_limit INTEGER;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS daily_log JSONB;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS sending_paused BOOLEAN DEFAULT false;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS pause_reason TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS health_score INTEGER;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS health_status TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS health_last_checked_at TIMESTAMPTZ;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS total_sent_all_time INTEGER DEFAULT 0;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS total_bounced_all_time INTEGER DEFAULT 0;

-- ── Email warmup table extras ──
ALTER TABLE email_warmup ADD COLUMN IF NOT EXISTS daily_log JSONB;
ALTER TABLE email_warmup ADD COLUMN IF NOT EXISTS sending_paused BOOLEAN DEFAULT false;
ALTER TABLE email_warmup ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- ── Email health events / suppression list extras ──
ALTER TABLE email_health_events ADD COLUMN IF NOT EXISTS email_address TEXT;
ALTER TABLE email_health_events ADD COLUMN IF NOT EXISTS bounce_type TEXT;
ALTER TABLE email_suppression_list ADD COLUMN IF NOT EXISTS notes TEXT;

-- ── Email tracking (supabase-email-tracking.sql) ──
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS tracking_id TEXT;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS first_open_ip TEXT;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS first_click_ip TEXT;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS reply_detected_at TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS bounced_at TIMESTAMPTZ;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS bounce_type TEXT;
ALTER TABLE email_messages ADD COLUMN IF NOT EXISTS deliverability_status TEXT DEFAULT 'unknown';
ALTER TABLE email_tracking_events ADD COLUMN IF NOT EXISTS tracking_id TEXT;
ALTER TABLE email_tracking_events ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE email_tracking_events ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0;
ALTER TABLE email_tracking_events ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;
ALTER TABLE email_tracking_events ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE email_tracking_events ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;
ALTER TABLE email_tracking_events ADD COLUMN IF NOT EXISTS reply_detected_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_messages_tracking_id ON email_messages(tracking_id);

-- ── Founding member webhook idempotency columns ──
ALTER TABLE founding_members ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;
ALTER TABLE founding_members ADD COLUMN IF NOT EXISTS payment_method TEXT;

SELECT 'schema drift fix applied' AS result;
