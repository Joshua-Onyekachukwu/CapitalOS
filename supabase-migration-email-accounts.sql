-- Capital OS — Create email_accounts table with custom SMTP/IMAP support
-- Run this FIRST before the custom SMTP migration

-- Create the email_accounts table
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider info
  provider TEXT NOT NULL, -- 'google', 'microsoft', 'custom_smtp'
  email_address TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN DEFAULT true,
  
  -- OAuth tokens (for Google/Microsoft)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  
  -- Custom SMTP fields
  smtp_host TEXT,
  smtp_port INTEGER DEFAULT 587,
  smtp_user TEXT,
  smtp_pass_encrypted TEXT,
  smtp_secure BOOLEAN DEFAULT true,
  
  -- Custom IMAP fields
  imap_host TEXT,
  imap_port INTEGER DEFAULT 993,
  imap_user TEXT,
  imap_pass_encrypted TEXT,
  imap_secure BOOLEAN DEFAULT true,
  
  -- Domain verification
  custom_domain TEXT,
  spf_valid BOOLEAN DEFAULT false,
  dkim_valid BOOLEAN DEFAULT false,
  dmarc_valid BOOLEAN DEFAULT false,
  
  -- Send tracking
  last_test_sent_at TIMESTAMPTZ,
  test_recipient TEXT,
  daily_send_limit INTEGER DEFAULT 50,
  sends_today INTEGER DEFAULT 0,
  last_send_reset_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Sync tracking
  last_synced_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own email accounts
CREATE POLICY "Users can view own email accounts" ON email_accounts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own email accounts
CREATE POLICY "Users can insert own email accounts" ON email_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own email accounts
CREATE POLICY "Users can update own email accounts" ON email_accounts
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own email accounts
CREATE POLICY "Users can delete own email accounts" ON email_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Index for rate limiting
CREATE INDEX IF NOT EXISTS idx_email_accounts_user_active 
  ON email_accounts(user_id, is_active) 
  WHERE is_active = true;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_email_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_email_accounts_updated_at
  BEFORE UPDATE ON email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_email_accounts_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'email_accounts table created successfully with custom SMTP/IMAP fields';
END;
$$;
