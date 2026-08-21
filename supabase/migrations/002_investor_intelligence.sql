-- =============================================
-- Capital-OS: Investor Intelligence Schema
-- =============================================
-- Run in Supabase SQL Editor or via CLI

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE investor_type AS ENUM (
  'angel_investor',
  'angel_syndicate',
  'venture_capital',
  'corporate_venture',
  'family_office',
  'private_equity',
  'accelerator',
  'incubator',
  'government_fund',
  'university_fund',
  'venture_studio',
  'micro_vc',
  'impact_investor',
  'strategic_investor',
  'debt_investor',
  'fund_of_funds'
);

CREATE TYPE investment_stage AS ENUM (
  'pre_seed',
  'seed',
  'series_a',
  'series_b',
  'series_c',
  'growth',
  'late_stage',
  'pre_ipo'
);

CREATE TYPE firm_type AS ENUM (
  'venture_capital',
  'corporate_venture',
  'family_office',
  'accelerator',
  'incubator',
  'angel_syndicate',
  'micro_vc',
  'growth_equity',
  'private_equity',
  'fund_of_funds',
  'sovereign_wealth',
  'other'
);

CREATE TYPE provider_status AS ENUM (
  'active',
  'inactive',
  'error',
  'rate_limited'
);

CREATE TYPE acquisition_status AS ENUM (
  'pending',
  'running',
  'completed',
  'partially_completed',
  'failed',
  'cancelled'
);

CREATE TYPE data_quality_level AS ENUM (
  'unverified',
  'low',
  'medium',
  'high',
  'verified'
);

CREATE TYPE outreach_readiness AS ENUM (
  'not_ready',
  'needs_verification',
  'ready',
  'contacted',
  'do_not_contact'
);

CREATE TYPE source_type AS ENUM (
  'provider',
  'web_research',
  'firm_website',
  'manual_entry',
  'ai_inferred',
  'public_records'
);

-- =============================================
-- INVESTOR FIRMS
-- =============================================

CREATE TABLE IF NOT EXISTS public.investor_firms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  domain          TEXT,
  website         TEXT,
  linkedin_url    TEXT,
  description     TEXT,
  firm_type       firm_type NOT NULL DEFAULT 'venture_capital',
  headquarters    TEXT,
  country         TEXT,
  region          TEXT,
  investment_stages investment_stage[] DEFAULT '{}',
  investment_sectors TEXT[] DEFAULT '{}',
  investment_geographies TEXT[] DEFAULT '{}',
  min_check_size  NUMERIC,
  max_check_size  NUMERIC,
  currency        TEXT DEFAULT 'USD',
  fund_size       NUMERIC,
  active_fund     TEXT,
  founded_year    INTEGER,
  portfolio_count INTEGER DEFAULT 0,
  team_size       INTEGER,
  is_active       BOOLEAN DEFAULT true,
  source          TEXT,
  source_id       TEXT,
  source_provider TEXT,
  data_quality_score INTEGER DEFAULT 0 CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
  last_enriched_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investor_firms_name ON public.investor_firms(name);
CREATE INDEX idx_investor_firms_domain ON public.investor_firms(domain);
CREATE INDEX idx_investor_firms_firm_type ON public.investor_firms(firm_type);
CREATE INDEX idx_investor_firms_country ON public.investor_firms(country);
CREATE INDEX idx_investor_firms_stages ON public.investor_firms USING GIN(investment_stages);
CREATE INDEX idx_investor_firms_sectors ON public.investor_firms USING GIN(investment_sectors);

-- =============================================
-- INVESTORS
-- =============================================

CREATE TABLE IF NOT EXISTS public.investors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       TEXT NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  email           TEXT,
  phone           TEXT,
  linkedin_url    TEXT,
  twitter_url     TEXT,
  job_title       TEXT,
  bio             TEXT,
  location        TEXT,
  country         TEXT,
  city            TEXT,
  investor_type   investor_type NOT NULL DEFAULT 'angel_investor',
  current_firm_id UUID REFERENCES public.investor_firms(id) ON DELETE SET NULL,
  investment_stages investment_stage[] DEFAULT '{}',
  investment_sectors TEXT[] DEFAULT '{}',
  investment_geographies TEXT[] DEFAULT '{}',
  min_check_size  NUMERIC,
  max_check_size  NUMERIC,
  currency        TEXT DEFAULT 'USD',
  investment_thesis TEXT,
  portfolio_count INTEGER DEFAULT 0,
  website_url     TEXT,
  avatar_url      TEXT,
  is_active       BOOLEAN DEFAULT true,
  is_verified     BOOLEAN DEFAULT false,
  do_not_contact  BOOLEAN DEFAULT false,
  outreach_readiness outreach_readiness DEFAULT 'not_ready',
  data_quality_score INTEGER DEFAULT 0 CHECK (data_quality_score >= 0 AND data_quality_score <= 100),
  fit_score       INTEGER DEFAULT 0 CHECK (fit_score >= 0 AND fit_score <= 100),
  last_investment_date DATE,
  recent_investment_count INTEGER DEFAULT 0,
  last_enriched_at TIMESTAMPTZ,
  source          TEXT,
  source_id       TEXT,
  source_provider TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investors_email ON public.investors(email);
CREATE INDEX idx_investors_linkedin ON public.investors(linkedin_url);
CREATE INDEX idx_investors_firm ON public.investors(current_firm_id);
CREATE INDEX idx_investors_type ON public.investors(investor_type);
CREATE INDEX idx_investors_country ON public.investors(country);
CREATE INDEX idx_investors_stages ON public.investors USING GIN(investment_stages);
CREATE INDEX idx_investors_sectors ON public.investors USING GIN(investment_sectors);
CREATE INDEX idx_investors_geographies ON public.investors USING GIN(investment_geographies);
CREATE INDEX idx_investors_source ON public.investors(source, source_id);
CREATE INDEX idx_investors_active ON public.investors(is_active) WHERE is_active = true;

-- =============================================
-- INVESTOR EMPLOYMENT HISTORY
-- =============================================

CREATE TABLE IF NOT EXISTS public.investor_employment_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  firm_id     UUID REFERENCES public.investor_firms(id) ON DELETE SET NULL,
  firm_name   TEXT,
  title       TEXT,
  start_date  DATE,
  end_date    DATE,
  is_current  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_employment_investor ON public.investor_employment_history(investor_id);

-- =============================================
-- INVESTOR DATA SOURCES (Provenance)
-- =============================================

CREATE TABLE IF NOT EXISTS public.investor_data_sources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id     UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  field_name      TEXT NOT NULL,
  source_type     source_type NOT NULL,
  source_url      TEXT,
  source_provider TEXT,
  source_value    TEXT,
  confidence      NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  collected_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_sources_investor ON public.investor_data_sources(investor_id);
CREATE INDEX idx_data_sources_field ON public.investor_data_sources(field_name);

-- =============================================
-- DATA PROVIDERS
-- =============================================

CREATE TABLE IF NOT EXISTS public.data_providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  provider_type   TEXT NOT NULL DEFAULT 'investor_data',
  status          provider_status NOT NULL DEFAULT 'inactive',
  config          JSONB DEFAULT '{}',
  api_key_hint    TEXT,
  last_health_check TIMESTAMPTZ,
  health_status   TEXT DEFAULT 'unknown',
  total_credits   INTEGER DEFAULT 0,
  credits_used    INTEGER DEFAULT 0,
  monthly_limit   INTEGER DEFAULT 0,
  cost_per_credit NUMERIC DEFAULT 0,
  annual_cost     NUMERIC DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- DATA ACQUISITION JOBS
-- =============================================

CREATE TABLE IF NOT EXISTS public.data_acquisition_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id     UUID NOT NULL REFERENCES public.data_providers(id) ON DELETE CASCADE,
  job_type        TEXT NOT NULL DEFAULT 'investor_search',
  filters         JSONB DEFAULT '{}',
  requested_count INTEGER DEFAULT 0,
  found_count     INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  validated_count INTEGER DEFAULT 0,
  deduplicated_count INTEGER DEFAULT 0,
  success_count   INTEGER DEFAULT 0,
  failed_count    INTEGER DEFAULT 0,
  credits_used    INTEGER DEFAULT 0,
  status          acquisition_status NOT NULL DEFAULT 'pending',
  error_message   TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acquisition_provider ON public.data_acquisition_jobs(provider_id);
CREATE INDEX idx_acquisition_status ON public.data_acquisition_jobs(status);
CREATE INDEX idx_acquisition_created ON public.data_acquisition_jobs(created_at DESC);

-- =============================================
-- INVESTOR PROFILES (Enrichment Data)
-- =============================================

CREATE TABLE IF NOT EXISTS public.investor_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id           UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  investment_preferences JSONB DEFAULT '{}',
  partner_interests     JSONB DEFAULT '{}',
  portfolio_highlights   JSONB DEFAULT '{}',
  recent_activity       JSONB DEFAULT '{}',
  public_statements     JSONB DEFAULT '{}',
  ai_summary            TEXT,
  ai_reasoning          TEXT,
  recommended_angle     TEXT,
  potential_objections  TEXT[],
  enrichment_data       JSONB DEFAULT '{}',
  last_ai_analyzed_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_investor_profiles_investor ON public.investor_profiles(investor_id);

-- =============================================
-- INVESTOR SECTORS (Controlled Taxonomy)
-- =============================================

CREATE TABLE IF NOT EXISTS public.investor_sectors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  parent_id   UUID REFERENCES public.investor_sectors(id),
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed core sectors
INSERT INTO public.investor_sectors (name, slug) VALUES
  ('Artificial Intelligence', 'ai'),
  ('AI Infrastructure', 'ai-infrastructure'),
  ('Machine Learning', 'ml'),
  ('Developer Tools', 'devtools'),
  ('FinTech', 'fintech'),
  ('HealthTech', 'healthtech'),
  ('ClimateTech', 'climatetech'),
  ('CleanTech', 'cleantech'),
  ('EdTech', 'edtech'),
  ('Cybersecurity', 'cybersecurity'),
  ('SaaS', 'saas'),
  ('Enterprise Software', 'enterprise'),
  ('Consumer', 'consumer'),
  ('Marketplace', 'marketplace'),
  ('DeepTech', 'deeptech'),
  ('Robotics', 'robotics'),
  ('SpaceTech', 'spacetech'),
  ('PropTech', 'proptech'),
  ('AgriTech', 'agritech'),
  ('Logistics', 'logistics'),
  ('Mobility', 'mobility'),
  ('Energy', 'energy'),
  ('Media', 'media'),
  ('Web3', 'web3')
ON CONFLICT (name) DO NOTHING;

-- =============================================
-- INVESTOR SEARCH HISTORY
-- =============================================

CREATE TABLE IF NOT EXISTS public.investor_search_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  search_query  TEXT NOT NULL,
  filters       JSONB DEFAULT '{}',
  results_count INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_search_history_user ON public.investor_search_history(user_id);

-- =============================================
-- ADMIN AUDIT LOG
-- =============================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  entity_type   TEXT,
  entity_id     UUID,
  details       JSONB DEFAULT '{}',
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON public.admin_audit_log(user_id);
CREATE INDEX idx_audit_log_action ON public.admin_audit_log(action);
CREATE INDEX idx_audit_log_created ON public.admin_audit_log(created_at DESC);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.investor_firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_employment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_acquisition_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read investors and firms (founder-facing search)
CREATE POLICY "Authenticated users can view investors"
  ON public.investors FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view firms"
  ON public.investor_firms FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view sectors"
  ON public.investor_sectors FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view investor profiles"
  ON public.investor_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view employment history"
  ON public.investor_employment_history FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view data sources"
  ON public.investor_data_sources FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can manage their own search history
CREATE POLICY "Users can manage own search history"
  ON public.investor_search_history FOR ALL
  USING (auth.uid() = user_id);

-- Admin-only: data providers, acquisition jobs, audit log
-- (These would use a custom admin check in practice)
CREATE POLICY "Service role manages data providers"
  ON public.data_providers FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages acquisition jobs"
  ON public.data_acquisition_jobs FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages audit log"
  ON public.admin_audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_investor_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_investor_updated
  BEFORE UPDATE ON public.investors
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_investor_updated();

CREATE OR REPLACE FUNCTION public.handle_firm_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_firm_updated
  BEFORE UPDATE ON public.investor_firms
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_firm_updated();

CREATE OR REPLACE FUNCTION public.handle_provider_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_provider_updated
  BEFORE UPDATE ON public.data_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_provider_updated();

-- =============================================
-- VIEWS
-- =============================================

-- Active investors with firm info
CREATE OR REPLACE VIEW public.v_investors_with_firms AS
SELECT
  i.*,
  f.name AS firm_name,
  f.firm_type AS firm_firm_type,
  f.website AS firm_website,
  f.fund_size AS firm_fund_size
FROM public.investors i
LEFT JOIN public.investor_firms f ON i.current_firm_id = f.id
WHERE i.is_active = true;

-- Provider usage summary
CREATE OR REPLACE VIEW public.v_provider_usage AS
SELECT
  dp.id,
  dp.name,
  dp.display_name,
  dp.status,
  dp.total_credits,
  dp.credits_used,
  dp.total_credits - dp.credits_used AS credits_remaining,
  CASE
    WHEN dp.total_credits > 0
    THEN ROUND((dp.credits_used::NUMERIC / dp.total_credits) * 100, 1)
    ELSE 0
  END AS usage_percentage,
  dp.monthly_limit,
  dp.cost_per_credit,
  dp.annual_cost,
  dp.last_health_check,
  dp.health_status
FROM public.data_providers dp;
