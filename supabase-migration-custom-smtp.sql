-- Capital OS — Custom SMTP/IMAP Support
-- Allows users to connect their own domain email (Gmail, Outlook, custom SMTP)

-- Add custom SMTP fields to email_accounts
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_host TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_user TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_pass_encrypted TEXT; -- encrypted at rest
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN DEFAULT true;

ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS imap_host TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS imap_user TEXT;
ALTER TABLE email_accounts ADD COLUMN IF NOT EXISTS imap_pass_encrypted TEXT; -- encrypted at rest
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

-- Index for rate limiting
CREATE INDEX IF NOT EXISTS idx_email_accounts_daily_sends 
  ON email_accounts(user_id, last_send_reset_at) 
  WHERE is_active = true;
