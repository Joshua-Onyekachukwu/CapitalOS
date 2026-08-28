-- =============================================
-- Capital OS — Production Fixes SQL
-- =============================================
-- Run this ENTIRE file in Supabase SQL Editor.
-- It handles: indexes, dedup, RLS fixes, and new tables.

-- ═══════════════════════════════════════════
-- 1. PERFORMANCE INDEXES
-- ═══════════════════════════════════════════

-- Investors Table (83K records — indexes are critical)
CREATE INDEX IF NOT EXISTS idx_investors_fit_score ON investors(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_investor_type ON investors(investor_type);
CREATE INDEX IF NOT EXISTS idx_investors_outreach_readiness ON investors(outreach_readiness);
CREATE INDEX IF NOT EXISTS idx_investors_email_idx ON investors(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investors_country ON investors(country);
CREATE INDEX IF NOT EXISTS idx_investors_source ON investors(source);
CREATE INDEX IF NOT EXISTS idx_investors_data_quality ON investors(data_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_created_at ON investors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_investors_email_score ON investors(fit_score DESC) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investors_name_search ON investors USING gin(to_tsvector('english', coalesce(full_name, '')));

-- Saved Investors
CREATE INDEX IF NOT EXISTS idx_saved_investors_user ON saved_investors(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_investors_user_investor ON saved_investors(user_id, investor_id);

-- Email Messages
CREATE INDEX IF NOT EXISTS idx_email_messages_user ON email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_investor ON email_messages(investor_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON email_messages(sent_at DESC);

-- Email Accounts
CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts(user_id);

-- Campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Company Profiles
CREATE INDEX IF NOT EXISTS idx_company_profiles_user ON company_profiles(user_id);

-- Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- Investor Firms
CREATE INDEX IF NOT EXISTS idx_firms_type ON investor_firms(firm_type);
CREATE INDEX IF NOT EXISTS idx_firms_country ON investor_firms(country);

-- Acquisition Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_status ON acquisition_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON acquisition_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON acquisition_jobs(created_at DESC);


-- ═══════════════════════════════════════════
-- 2. DEDUPLICATE EMAILS
-- ═══════════════════════════════════════════
-- Remove duplicate emails, keeping the most recent record

DELETE FROM investors
WHERE id NOT IN (
  SELECT DISTINCT ON (LOWER(email)) id
  FROM investors
  WHERE email IS NOT NULL AND email != ''
  ORDER BY LOWER(email), created_at DESC
);

-- Also deduplicate by full_name + investor_type (same person, different email)
-- Only if they have the same name AND type
DELETE FROM investors a
USING investors b
WHERE a.id < b.id
  AND LOWER(a.full_name) = LOWER(b.full_name)
  AND a.investor_type = b.investor_type
  AND a.email IS NULL
  AND b.email IS NOT NULL;


-- ═══════════════════════════════════════════
-- 3. RLS POLICIES (proper access control)
-- ═══════════════════════════════════════════
-- SEE: supabase-rls-fix.sql for complete RLS policies.
-- That file creates proper per-user policies so that:
--   - Authenticated users can only access their own data
--   - Service role (API routes) bypasses RLS automatically
--   - Public routes (waitlist, tracking) work for anonymous users
-- DO NOT disable RLS — it's a security risk.


-- ═══════════════════════════════════════════
-- 4. EMAIL BRANDING COLUMNS
-- ═══════════════════════════════════════════

ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_brand_name TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_tagline TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_accent_color TEXT DEFAULT '#84cc16';
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_logo_url TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_website TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_footer_text TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_cta_text TEXT DEFAULT 'Let''s Connect';
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_cta_url TEXT;
ALTER TABLE company_profiles ADD COLUMN IF NOT EXISTS email_signature TEXT;


-- ═══════════════════════════════════════════
-- 5. EMAIL HEALTH TABLES (if not exists)
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_health_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_sending_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID,
  investor_id UUID,
  subject TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_suppression_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT,
  source TEXT,
  suppressed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_warmup (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  stage TEXT DEFAULT 'cold',
  daily_limit INTEGER DEFAULT 5,
  sends_today INTEGER DEFAULT 0,
  health_score INTEGER DEFAULT 50,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_domain_health (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  spf_valid BOOLEAN DEFAULT false,
  dkim_valid BOOLEAN DEFAULT false,
  dmarc_valid BOOLEAN DEFAULT false,
  mx_valid BOOLEAN DEFAULT false,
  last_checked TIMESTAMPTZ DEFAULT NOW(),
  details JSONB DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS email_health_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  health_score INTEGER DEFAULT 50,
  bounce_rate NUMERIC(5,2) DEFAULT 0,
  open_rate NUMERIC(5,2) DEFAULT 0,
  reply_rate NUMERIC(5,2) DEFAULT 0,
  spam_rate NUMERIC(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ═══════════════════════════════════════════
-- 6. WAITLIST TABLE
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  company TEXT,
  source TEXT DEFAULT 'landing_page',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE waitlist DISABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════
-- 7. FOUNDING MEMBERS TABLE
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS founding_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  founding_member BOOLEAN DEFAULT true,
  founding_credit NUMERIC(10,2) DEFAULT 9.99,
  stripe_session_id TEXT,
  payment_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE founding_members DISABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════
-- 8. SAVED FILTERS TABLE
-- ═══════════════════════════════════════════

CREATE TABLE IF NOT EXISTS saved_filters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_filters DISABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════
