-- =============================================
-- Capital OS — Missing Supabase Tables
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Company Profiles (onboarding data)
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

-- 2. Saved Investors
CREATE TABLE IF NOT EXISTS saved_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, investor_id)
);

-- 3. Email Accounts (OAuth connections)
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

-- 4. Email Messages
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

-- 5. Email Threads
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  investor_id UUID REFERENCES investors(id),
  subject TEXT,
  status TEXT DEFAULT 'active',
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Email Tracking Events
CREATE TABLE IF NOT EXISTS email_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES email_messages(id),
  user_id UUID REFERENCES auth.users(id),
  investor_id UUID REFERENCES investors(id),
  event_type TEXT NOT NULL,
  url TEXT,
  user_agent TEXT,
  ip_address TEXT,
  device_type TEXT,
  email_client TEXT,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Duplicate Candidates
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

-- 8. Data Acquisition Jobs (campaigns)
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

-- 9. Credit Ledger
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

-- 10. User Subscriptions
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
  pending_plan_id UUID,
  previous_plan_id UUID,
  downgrade_at TIMESTAMPTZ,
  grace_period_end TIMESTAMPTZ,
  plan_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- 11. Billing Plans
CREATE TABLE IF NOT EXISTS billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  monthly_price NUMERIC DEFAULT 0,
  annual_price NUMERIC,
  included_credits INTEGER DEFAULT 100,
  investor_db_limit INTEGER DEFAULT 100,
  deep_research_limit INTEGER DEFAULT 5,
  pitch_deck_limit INTEGER DEFAULT 2,
  campaign_limit INTEGER DEFAULT 1,
  email_accounts_limit INTEGER DEFAULT 1,
  team_seats INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Credit Costs
CREATE TABLE IF NOT EXISTS credit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation TEXT UNIQUE NOT NULL,
  credit_cost INTEGER NOT NULL,
  description TEXT
);

-- 13. Saved Filters
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

-- 14. Investor Firms
CREATE TABLE IF NOT EXISTS investor_firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT,
  firm_type TEXT,
  country TEXT,
  headquarters TEXT,
  founded_year INTEGER,
  website TEXT,
  domain TEXT,
  team_size INTEGER,
  portfolio_count INTEGER,
  fund_size NUMERIC,
  investment_stages JSONB DEFAULT '[]'::jsonb,
  investment_sectors JSONB DEFAULT '[]'::jsonb,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Investor Profiles (AI research)
CREATE TABLE IF NOT EXISTS investor_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID UNIQUE REFERENCES investors(id) ON DELETE CASCADE,
  ai_summary TEXT,
  ai_reasoning JSONB,
  recommended_angle TEXT,
  potential_objections JSONB DEFAULT '[]'::jsonb,
  last_ai_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Investor Data Sources
CREATE TABLE IF NOT EXISTS investor_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id) ON DELETE CASCADE,
  field_name TEXT,
  source_type TEXT,
  source_provider TEXT,
  source_value TEXT,
  confidence NUMERIC,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. Data Change Log
CREATE TABLE IF NOT EXISTS data_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id),
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  source_type TEXT,
  source_provider TEXT,
  confidence NUMERIC,
  change_type TEXT,
  detected_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Admin Audit Log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Campaign Sequences
CREATE TABLE IF NOT EXISTS campaign_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES data_acquisition_jobs(id),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  total_steps INTEGER DEFAULT 0,
  total_enrolled INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  total_replies INTEGER DEFAULT 0,
  send_window_start TEXT DEFAULT '09:00',
  send_window_end TEXT DEFAULT '17:00',
  send_days JSONB DEFAULT '[1,2,3,4,5]'::jsonb,
  stop_on_reply BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 20. Campaign Sequence Steps
CREATE TABLE IF NOT EXISTS campaign_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES campaign_sequences(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_type TEXT DEFAULT 'initial',
  subject_template TEXT,
  body_template TEXT,
  delay_days INTEGER DEFAULT 0,
  delay_hours INTEGER DEFAULT 0,
  tone TEXT DEFAULT 'professional',
  is_active BOOLEAN DEFAULT true
);

-- 21. Campaign Sequence Enrollments
CREATE TABLE IF NOT EXISTS campaign_sequence_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES campaign_sequences(id),
  investor_id UUID REFERENCES investors(id),
  campaign_id UUID,
  user_id UUID REFERENCES auth.users(id),
  current_step INTEGER DEFAULT 0,
  status TEXT DEFAULT 'scheduled',
  next_send_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  stopped_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sequence_id, investor_id)
);

-- 22. Campaign Sequence Emails
CREATE TABLE IF NOT EXISTS campaign_sequence_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID REFERENCES campaign_sequence_enrollments(id),
  step_id UUID REFERENCES campaign_sequence_steps(id),
  investor_id UUID REFERENCES investors(id),
  user_id UUID REFERENCES auth.users(id),
  subject TEXT,
  body_html TEXT,
  from_address TEXT,
  to_address TEXT,
  message_id TEXT,
  status TEXT DEFAULT 'sent',
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Raw Records
CREATE TABLE IF NOT EXISTS raw_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_data JSONB,
  source_type TEXT,
  source_provider TEXT,
  source_url TEXT,
  import_job_id UUID,
  status TEXT DEFAULT 'pending',
  normalized_data JSONB,
  parsed_data JSONB,
  matched_investor_id UUID,
  match_confidence NUMERIC,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. Job Queue
CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  payload JSONB DEFAULT '{}'::jsonb,
  progress JSONB,
  result JSONB,
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. Data Providers
CREATE TABLE IF NOT EXISTS data_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT,
  provider_type TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 26. Company Team Members
CREATE TABLE IF NOT EXISTS company_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  name TEXT,
  title TEXT,
  email TEXT,
  linkedin_url TEXT,
  is_founder BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 27. Company Documents
CREATE TABLE IF NOT EXISTS company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES company_profiles(id) ON DELETE CASCADE,
  document_type TEXT,
  file_name TEXT,
  file_url TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 28. Investor Employment History
CREATE TABLE IF NOT EXISTS investor_employment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id) ON DELETE CASCADE,
  firm_name TEXT,
  title TEXT,
  start_date TEXT,
  end_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 29. Profiles (user display name)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 30. Investor Qualification History
CREATE TABLE IF NOT EXISTS investor_qualification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID REFERENCES investors(id),
  user_id UUID REFERENCES auth.users(id),
  fit_score INTEGER,
  factors JSONB,
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
CREATE INDEX IF NOT EXISTS idx_email_messages_tracking ON email_messages(tracking_id);
CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_candidates_status ON duplicate_candidates(status);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON job_queue(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON job_queue(job_type);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(user_id, page_name);
CREATE INDEX IF NOT EXISTS idx_investor_profiles_investor ON investor_profiles(investor_id);
CREATE INDEX IF NOT EXISTS idx_raw_records_status ON raw_records(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON campaign_sequence_enrollments(status);

-- =============================================
-- Seed default billing plans
-- =============================================
INSERT INTO billing_plans (name, slug, monthly_price, included_credits, investor_db_limit, deep_research_limit, pitch_deck_limit, campaign_limit, email_accounts_limit, team_seats)
VALUES
  ('Free', 'free', 0, 100, 500, 2, 1, 1, 1, 1),
  ('Starter', 'starter', 49, 500, 5000, 10, 5, 3, 2, 1),
  ('Growth', 'growth', 149, 2000, 25000, 50, 20, 10, 5, 3),
  ('Scale', 'scale', 399, 10000, 100000, 200, 100, 50, 10, 10)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- Seed credit costs
-- =============================================
INSERT INTO credit_costs (operation, credit_cost, description)
VALUES
  ('ai_research', 5, 'AI investor research summary'),
  ('ai_email_draft', 3, 'AI email draft generation'),
  ('ai_fit_analysis', 2, 'AI fit score analysis'),
  ('ai_copilot', 1, 'AI copilot chat message'),
  ('pitch_deck', 20, 'Pitch deck generation'),
  ('deep_research', 10, 'Deep investor research'),
  ('email_send', 1, 'Send outreach email'),
  ('csv_import', 5, 'CSV investor import')
ON CONFLICT (operation) DO NOTHING;

-- =============================================
-- RLS Policies (basic — service role bypasses)
-- =============================================
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

-- Users can read/write their own data
CREATE POLICY "Users read own company_profiles" ON company_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own company_profiles" ON company_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own company_profiles" ON company_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users read own saved_investors" ON saved_investors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own saved_investors" ON saved_investors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own saved_investors" ON saved_investors FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users read own email_messages" ON email_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own email_messages" ON email_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own email_accounts" ON email_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own email_accounts" ON email_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own saved_filters" ON saved_filters FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users write own saved_filters" ON saved_filters FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own saved_filters" ON saved_filters FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users read own subscriptions" ON user_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own credit_ledger" ON credit_ledger FOR SELECT USING (auth.uid() = user_id);

-- Investors are public read (service role manages writes)
CREATE POLICY "Public read investors" ON investors FOR SELECT USING (true);
