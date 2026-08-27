-- =============================================
-- Capital OS — Create All Missing Tables
-- =============================================
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- This creates all tables the platform needs that don't exist yet.

-- =============================================
-- 1. saved_investors
-- =============================================
CREATE TABLE IF NOT EXISTS saved_investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  investor_id UUID NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_unique ON saved_investors(user_id, investor_id);
CREATE INDEX IF NOT EXISTS idx_saved_user ON saved_investors(user_id);

-- =============================================
-- 2. company_profiles
-- =============================================
CREATE TABLE IF NOT EXISTS company_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  company_name TEXT,
  website_url TEXT,
  industry TEXT,
  location TEXT,
  company_stage TEXT,
  business_model TEXT,
  one_liner TEXT,
  description TEXT,
  differentiator TEXT,
  target_customer TEXT,
  currently_raising BOOLEAN DEFAULT false,
  funding_amount NUMERIC,
  round_type TEXT,
  target_investor_geographies TEXT[] DEFAULT '{}',
  has_pitch_deck BOOLEAN DEFAULT false,
  mrr NUMERIC,
  arr NUMERIC,
  customer_count INTEGER,
  growth_rate TEXT,
  milestones TEXT[] DEFAULT '{}',
  employee_count INTEGER,
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  readiness_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- 3. company_team_members
-- =============================================
CREATE TABLE IF NOT EXISTS company_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title TEXT,
  linkedin_url TEXT,
  bio TEXT,
  is_founder BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_company ON company_team_members(company_id);

-- =============================================
-- 4. company_documents
-- =============================================
CREATE TABLE IF NOT EXISTS company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_docs_company ON company_documents(company_id);

-- =============================================
-- 5. campaigns
-- =============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  investor_ids UUID[] DEFAULT '{}',
  total_investors INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_generated INTEGER DEFAULT 0,
  response_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- =============================================
-- 6. email_messages
-- =============================================
CREATE TABLE IF NOT EXISTS email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  investor_id UUID,
  direction TEXT DEFAULT 'outbound',
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  to_address TEXT,
  from_address TEXT,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounce_type TEXT,
  delivery_status TEXT DEFAULT 'unknown',
  account_id UUID,
  campaign_id UUID,
  unsubscribed BOOLEAN DEFAULT false,
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_user ON email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_investor ON email_messages(investor_id);
CREATE INDEX IF NOT EXISTS idx_email_status ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_sent ON email_messages(sent_at DESC);

-- =============================================
-- 7. investor_firms
-- =============================================
CREATE TABLE IF NOT EXISTS investor_firms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  firm_type TEXT,
  website TEXT,
  country TEXT,
  city TEXT,
  fund_size NUMERIC,
  description TEXT,
  investment_focus TEXT[],
  investor_count INTEGER DEFAULT 0,
  avg_fit_score NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_firms_type ON investor_firms(firm_type);
CREATE INDEX IF NOT EXISTS idx_firms_country ON investor_firms(country);

-- =============================================
-- 8. investor_fit_profiles
-- =============================================
CREATE TABLE IF NOT EXISTS investor_fit_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL,
  user_id UUID,
  fit_score NUMERIC DEFAULT 0,
  ai_summary TEXT,
  ai_reasoning TEXT,
  recommended_angle TEXT,
  potential_objections TEXT[],
  factor_scores JSONB,
  confidence NUMERIC DEFAULT 0,
  data_quality NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fit_investor ON investor_fit_profiles(investor_id);
CREATE INDEX IF NOT EXISTS idx_fit_user ON investor_fit_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_fit_score ON investor_fit_profiles(fit_score DESC);

-- =============================================
-- 9. acquisition_jobs
-- =============================================
CREATE TABLE IF NOT EXISTS acquisition_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  source TEXT,
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  error_message TEXT,
  result JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_type ON acquisition_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON acquisition_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON acquisition_jobs(created_at DESC);

-- =============================================
-- =============================================
-- 10. saved_filters
-- =============================================
CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  page TEXT NOT NULL,
  name TEXT,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_filters_user ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_filters_page ON saved_filters(user_id, page);

-- Done
-- =============================================
