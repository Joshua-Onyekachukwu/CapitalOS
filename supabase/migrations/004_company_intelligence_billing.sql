-- =============================================
-- Capital-OS: Company Intelligence & Billing
-- Migration 004 (Idempotent — safe to re-run)
-- =============================================

-- =============================================
-- COMPANY PROFILES
-- =============================================

CREATE TABLE IF NOT EXISTS public.company_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name    TEXT,
  website_url     TEXT,
  industry        TEXT,
  location        TEXT,
  company_stage   TEXT,
  business_model  TEXT,
  one_liner       TEXT,
  description     TEXT,
  differentiator  TEXT,
  target_customer TEXT,
  currently_raising BOOLEAN DEFAULT false,
  funding_amount  NUMERIC,
  round_type      TEXT,
  target_investor_geographies TEXT[],
  has_pitch_deck  BOOLEAN DEFAULT false,
  mrr             NUMERIC,
  arr             NUMERIC,
  customer_count  INTEGER,
  growth_rate     TEXT,
  milestones      TEXT[],
  employee_count  INTEGER,
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,
  readiness_score INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_user ON public.company_profiles(user_id);

-- =============================================
-- COMPANY TEAM MEMBERS
-- =============================================

CREATE TABLE IF NOT EXISTS public.company_team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  title       TEXT,
  linkedin_url TEXT,
  bio         TEXT,
  is_founder  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_members_company ON public.company_team_members(company_id);

-- =============================================
-- COMPANY DOCUMENTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.company_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL,
  file_name       TEXT NOT NULL,
  file_url        TEXT,
  file_size       INTEGER,
  content_extracted TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_documents_company ON public.company_documents(company_id);

-- =============================================
-- BILLING PLANS
-- =============================================

CREATE TABLE IF NOT EXISTS public.billing_plans (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  slug                  TEXT NOT NULL UNIQUE,
  monthly_price         NUMERIC NOT NULL DEFAULT 0,
  annual_price          NUMERIC,
  included_credits      INTEGER NOT NULL DEFAULT 0,
  investor_db_limit     INTEGER NOT NULL DEFAULT 100,
  deep_research_limit   INTEGER NOT NULL DEFAULT 3,
  pitch_deck_limit      INTEGER NOT NULL DEFAULT 0,
  campaign_limit        INTEGER NOT NULL DEFAULT 0,
  email_accounts_limit  INTEGER NOT NULL DEFAULT 0,
  team_seats            INTEGER NOT NULL DEFAULT 1,
  is_active             BOOLEAN DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the plans
INSERT INTO public.billing_plans (name, slug, monthly_price, included_credits, investor_db_limit, deep_research_limit, pitch_deck_limit, campaign_limit, email_accounts_limit, team_seats)
VALUES
  ('Free', 'free', 0, 50, 100, 3, 1, 1, 0, 1),
  ('Workspace', 'workspace', 49, 500, 5000, 30, 3, 5, 1, 1),
  ('Workspace Pro', 'workspace_pro', 199, 2000, 50000, 999, 999, 999, 3, 5)
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- USER SUBSCRIPTIONS
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id                   UUID NOT NULL REFERENCES public.billing_plans(id),
  status                    TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','past_due','cancelled','trialing')),
  current_period_start      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  credits_remaining         INTEGER NOT NULL DEFAULT 0,
  credits_used_this_period  INTEGER NOT NULL DEFAULT 0,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.user_subscriptions(user_id);

-- =============================================
-- CREDIT LEDGER
-- =============================================

CREATE TABLE IF NOT EXISTS public.credit_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL,
  operation       TEXT NOT NULL,
  operation_detail JSONB DEFAULT '{}',
  model_used      TEXT,
  tokens_used     INTEGER,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON public.credit_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created ON public.credit_ledger(created_at DESC);

-- =============================================
-- CREDIT OPERATIONS COST TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS public.credit_costs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation   TEXT NOT NULL UNIQUE,
  credit_cost INTEGER NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.credit_costs (operation, credit_cost, description)
VALUES
  ('investor_research', 5, 'AI research summary for a single investor'),
  ('email_draft', 3, 'Personalized email draft generation'),
  ('fit_analysis', 4, 'AI investor-startup fit analysis'),
  ('pitch_deck_generate', 25, 'Full pitch deck generation'),
  ('pitch_deck_revision', 10, 'Pitch deck revision'),
  ('deep_enrichment', 8, 'Deep investor data enrichment'),
  ('company_intelligence', 6, 'Company website/document intelligence extraction'),
  ('email_sequence', 5, 'AI email sequence generation (3-step)')
ON CONFLICT (operation) DO NOTHING;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_costs ENABLE ROW LEVEL SECURITY;

-- Company profiles — user owns their own
DO $$ BEGIN
  CREATE POLICY "Users can view own company profile"
    ON public.company_profiles FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own company profile"
    ON public.company_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own company profile"
    ON public.company_profiles FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Team members — via company ownership
DO $$ BEGIN
  CREATE POLICY "Users can view own team members"
    ON public.company_team_members FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.company_profiles cp
      WHERE cp.id = company_team_members.company_id AND cp.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage own team members"
    ON public.company_team_members FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.company_profiles cp
      WHERE cp.id = company_team_members.company_id AND cp.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Company documents — via company ownership
DO $$ BEGIN
  CREATE POLICY "Users can view own company documents"
    ON public.company_documents FOR SELECT
    USING (EXISTS (
      SELECT 1 FROM public.company_profiles cp
      WHERE cp.id = company_documents.company_id AND cp.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage own company documents"
    ON public.company_documents FOR ALL
    USING (EXISTS (
      SELECT 1 FROM public.company_profiles cp
      WHERE cp.id = company_documents.company_id AND cp.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Billing plans — readable by all authenticated users
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view billing plans"
    ON public.billing_plans FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User subscriptions — user owns their own
DO $$ BEGIN
  CREATE POLICY "Users can view own subscription"
    ON public.user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages subscriptions"
    ON public.user_subscriptions FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Credit ledger — user owns their own
DO $$ BEGIN
  CREATE POLICY "Users can view own credit history"
    ON public.credit_ledger FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages credit ledger"
    ON public.credit_ledger FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Credit costs — readable by all authenticated users
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view credit costs"
    ON public.credit_costs FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-update updated_at on company_profiles
DROP TRIGGER IF EXISTS on_company_profile_updated ON public.company_profiles;

CREATE OR REPLACE FUNCTION public.handle_company_profile_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_company_profile_updated
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_company_profile_updated();

-- Auto-update updated_at on user_subscriptions
DROP TRIGGER IF EXISTS on_subscription_updated ON public.user_subscriptions;

CREATE OR REPLACE FUNCTION public.handle_subscription_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_subscription_updated
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_updated();

-- =============================================
-- AUTO-CREATE FREE SUBSCRIPTION ON SIGNUP
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  free_plan_id UUID;
BEGIN
  -- Get the free plan ID
  SELECT id INTO free_plan_id FROM public.billing_plans WHERE slug = 'free' LIMIT 1;

  IF free_plan_id IS NOT NULL THEN
    INSERT INTO public.user_subscriptions (user_id, plan_id, credits_remaining)
    VALUES (NEW.user_id, free_plan_id, 50);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger: auto-create subscription when company profile is created
DROP TRIGGER IF EXISTS on_company_profile_created ON public.company_profiles;

CREATE OR REPLACE FUNCTION public.handle_company_profile_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  free_plan_id UUID;
  existing_sub UUID;
BEGIN
  -- Check if user already has a subscription
  SELECT id INTO existing_sub FROM public.user_subscriptions WHERE user_id = NEW.user_id LIMIT 1;

  IF existing_sub IS NULL THEN
    SELECT id INTO free_plan_id FROM public.billing_plans WHERE slug = 'free' LIMIT 1;

    IF free_plan_id IS NOT NULL THEN
      INSERT INTO public.user_subscriptions (user_id, plan_id, credits_remaining)
      VALUES (NEW.user_id, free_plan_id, 50);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_company_profile_created
  AFTER INSERT ON public.company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_company_profile_created();

-- =============================================
-- HELPER: Check if user has credits
-- =============================================

CREATE OR REPLACE FUNCTION public.has_credits(p_user_id UUID, p_operation TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_credits INTEGER;
  v_cost INTEGER;
BEGIN
  -- Get user's remaining credits
  SELECT credits_remaining INTO v_credits
  FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  IF v_credits IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get operation cost
  SELECT credit_cost INTO v_cost
  FROM public.credit_costs
  WHERE operation = p_operation;

  IF v_cost IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_credits >= v_cost;
END;
$$;

-- =============================================
-- HELPER: Consume credits
-- =============================================

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id UUID,
  p_operation TEXT,
  p_model_used TEXT DEFAULT NULL,
  p_tokens_used INTEGER DEFAULT NULL,
  p_detail JSONB DEFAULT '{}'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sub_id UUID;
  v_credits INTEGER;
  v_cost INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get subscription
  SELECT id, credits_remaining INTO v_sub_id, v_credits
  FROM public.user_subscriptions
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get operation cost
  SELECT credit_cost INTO v_cost
  FROM public.credit_costs
  WHERE operation = p_operation;

  IF v_cost IS NULL OR v_credits < v_cost THEN
    RETURN FALSE;
  END IF;

  v_new_balance := v_credits - v_cost;

  -- Update subscription
  UPDATE public.user_subscriptions
  SET credits_remaining = v_new_balance,
      credits_used_this_period = credits_used_this_period + v_cost
  WHERE id = v_sub_id;

  -- Log to ledger
  INSERT INTO public.credit_ledger (user_id, amount, balance_after, operation, operation_detail, model_used, tokens_used)
  VALUES (p_user_id, -v_cost, v_new_balance, p_operation, p_detail, p_model_used, p_tokens_used);

  RETURN TRUE;
END;
$$;

-- =============================================
-- VIEWS
-- =============================================

CREATE OR REPLACE VIEW public.v_user_billing AS
SELECT
  u.user_id,
  u.plan_id,
  p.name AS plan_name,
  p.slug AS plan_slug,
  p.monthly_price,
  u.status AS subscription_status,
  u.credits_remaining,
  u.credits_used_this_period,
  p.included_credits,
  p.investor_db_limit,
  p.deep_research_limit,
  p.pitch_deck_limit,
  p.campaign_limit,
  p.email_accounts_limit,
  p.team_seats,
  u.current_period_start,
  u.current_period_end
FROM public.user_subscriptions u
JOIN public.billing_plans p ON u.plan_id = p.id;

-- =============================================
-- DONE
-- =============================================

SELECT 'Migration 004 complete — Company Intelligence & Billing schema ready.' AS result;
