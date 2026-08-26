-- =============================================
-- Capital OS — Critical Missing Tables
-- Run this in Supabase SQL Editor
-- Only creates tables that don't exist yet
-- =============================================

-- 1. Saved Investors
CREATE TABLE IF NOT EXISTS saved_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, investor_id)
);

-- 2. Email Accounts (OAuth connections)
CREATE TABLE IF NOT EXISTS email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  email_address TEXT NOT NULL,
  display_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Email Messages
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  investor_id UUID REFERENCES investors(id),
  thread_id UUID,
  direction TEXT NOT NULL DEFAULT 'outbound',
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  from_address TEXT,
  to_address TEXT,
  cc_addresses JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  message_id TEXT,
  tracking_id TEXT,
  tracking_enabled BOOLEAN DEFAULT false,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Company Profiles (onboarding data)
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  industry TEXT,
  company_stage TEXT,
  one_liner TEXT,
  description TEXT,
  differentiator TEXT,
  target_customer TEXT,
  location TEXT,
  currently_raising BOOLEAN DEFAULT false,
  funding_amount NUMERIC,
  round_type TEXT,
  mrr NUMERIC,
  arr NUMERIC,
  customer_count INTEGER,
  growth_rate TEXT,
  has_pitch_deck BOOLEAN DEFAULT false,
  readiness_score INTEGER DEFAULT 0,
  milestones JSONB DEFAULT '[]'::jsonb,
  team_members JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 5. Saved Filters
CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filter_key TEXT NOT NULL,
  filters JSONB,
  sort_by TEXT,
  page_name TEXT DEFAULT 'investors',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, filter_key, page_name)
);

-- 6. Credit Ledger
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  amount INTEGER NOT NULL,
  balance_after INTEGER,
  operation TEXT,
  operation_detail JSONB DEFAULT '{}'::jsonb,
  model_used TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. User Subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID,
  status TEXT DEFAULT 'active',
  credits_remaining INTEGER DEFAULT 100,
  credits_used_this_period INTEGER DEFAULT 0,
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 8. Duplicate Candidates
CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_a_id UUID REFERENCES investors(id),
  investor_b_id UUID REFERENCES investors(id),
  confidence NUMERIC,
  match_signals JSONB,
  status TEXT DEFAULT 'pending',
  merge_into_id UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Data Acquisition Jobs
CREATE TABLE IF NOT EXISTS data_acquisition_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID,
  job_type TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  requested_count INTEGER,
  found_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  validated_count INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  error_message TEXT,
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Admin Audit Log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_investors_email ON investors(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investors_fit_score ON investors(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_outreach ON investors(outreach_readiness);
CREATE INDEX IF NOT EXISTS idx_investors_type ON investors(investor_type);
CREATE INDEX IF NOT EXISTS idx_investors_country ON investors(country);
CREATE INDEX IF NOT EXISTS idx_investors_source ON investors(source);
CREATE INDEX IF NOT EXISTS idx_company_profiles_user ON company_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_investors_user ON saved_investors(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_user ON email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_investor ON email_messages(investor_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(user_id, page_name);

-- =============================================
-- RLS Policies
-- =============================================
ALTER TABLE saved_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own saved_investors" ON saved_investors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own saved_investors" ON saved_investors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own saved_investors" ON saved_investors FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users read own company_profiles" ON company_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own company_profiles" ON company_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own company_profiles" ON company_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users read own email_messages" ON email_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own email_messages" ON email_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own email_accounts" ON email_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own email_accounts" ON email_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own saved_filters" ON saved_filters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own saved_filters" ON saved_filters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own saved_filters" ON saved_filters FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users read own subscriptions" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own credit_ledger" ON credit_ledger FOR SELECT USING (auth.uid() = user_id);
