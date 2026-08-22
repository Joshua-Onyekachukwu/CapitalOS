-- =============================================
-- Capital-OS: Intelligence Pipeline Schema
-- Migration 003 (Idempotent — safe to re-run)
-- =============================================

-- =============================================
-- NEW ENUMS (skip if exists)
-- =============================================

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM (
    'pending', 'approved', 'rejected', 'auto_resolved'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- RAW RECORDS — Ingestion Staging
-- =============================================

CREATE TABLE IF NOT EXISTS public.raw_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_job_id   UUID REFERENCES public.data_acquisition_jobs(id) ON DELETE SET NULL,
  source_type     source_type NOT NULL,
  source_provider TEXT,
  source_url      TEXT,
  raw_data        JSONB NOT NULL,
  parsed_data     JSONB,
  normalized_data JSONB,
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','processing','matched','new','duplicate','rejected','error')),
  matched_investor_id UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  match_confidence    NUMERIC CHECK (match_confidence >= 0 AND match_confidence <= 1),
  error_message   TEXT,
  processed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_records_status ON public.raw_records(status);
CREATE INDEX IF NOT EXISTS idx_raw_records_job ON public.raw_records(import_job_id);
CREATE INDEX IF NOT EXISTS idx_raw_records_matched ON public.raw_records(matched_investor_id);
CREATE INDEX IF NOT EXISTS idx_raw_records_created ON public.raw_records(created_at DESC);

-- =============================================
-- DUPLICATE CANDIDATES — Review Queue
-- =============================================

CREATE TABLE IF NOT EXISTS public.duplicate_candidates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_a_id     UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  investor_b_id     UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  confidence        NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  match_signals     JSONB NOT NULL DEFAULT '{}',
  status            review_status NOT NULL DEFAULT 'pending',
  reviewed_by       UUID REFERENCES auth.users(id),
  reviewed_at       TIMESTAMPTZ,
  merge_into_id     UUID REFERENCES public.investors(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(investor_a_id, investor_b_id)
);

CREATE INDEX IF NOT EXISTS idx_dup_candidates_status ON public.duplicate_candidates(status);
CREATE INDEX IF NOT EXISTS idx_dup_candidates_confidence ON public.duplicate_candidates(confidence DESC);

-- =============================================
-- DATA CHANGE LOG — Version History
-- =============================================

CREATE TABLE IF NOT EXISTS public.data_change_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id   UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  field_name    TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  source_type   source_type,
  source_provider TEXT,
  confidence    NUMERIC CHECK (confidence >= 0 AND confidence <= 1),
  change_type   TEXT NOT NULL DEFAULT 'update'
    CHECK (change_type IN ('create','update','merge','delete','revert')),
  detected_by   TEXT DEFAULT 'system',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_log_investor ON public.data_change_log(investor_id);
CREATE INDEX IF NOT EXISTS idx_change_log_field ON public.data_change_log(field_name);
CREATE INDEX IF NOT EXISTS idx_change_log_created ON public.data_change_log(created_at DESC);

-- =============================================
-- FIRM ALIASES — Organization Name Resolution
-- =============================================

CREATE TABLE IF NOT EXISTS public.firm_aliases (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id       UUID NOT NULL REFERENCES public.investor_firms(id) ON DELETE CASCADE,
  alias_name    TEXT NOT NULL,
  normalized    TEXT NOT NULL,
  source        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(firm_id, normalized)
);

CREATE INDEX IF NOT EXISTS idx_firm_aliases_normalized ON public.firm_aliases(normalized);

-- =============================================
-- EMAIL ACCOUNTS — OAuth-connected email
-- =============================================

CREATE TABLE IF NOT EXISTS public.email_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL
    CHECK (provider IN ('google','microsoft','other')),
  email_address   TEXT NOT NULL,
  access_token    TEXT,
  refresh_token   TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes          TEXT[],
  is_active       BOOLEAN DEFAULT true,
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON public.email_accounts(user_id);

-- =============================================
-- EMAIL MESSAGES — Outreach History
-- =============================================

CREATE TABLE IF NOT EXISTS public.email_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id),
  investor_id     UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  campaign_id     UUID,
  direction       TEXT NOT NULL
    CHECK (direction IN ('outbound','inbound')),
  thread_id       TEXT,
  message_id      TEXT,
  subject         TEXT,
  body_html       TEXT,
  body_text       TEXT,
  from_address    TEXT,
  to_address      TEXT,
  cc_addresses    TEXT[],
  attachments     JSONB DEFAULT '[]',
  status          TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sent','delivered','opened','clicked','bounced','failed','replied')),
  sent_at         TIMESTAMPTZ,
  opened_at       TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,
  ai_generated    BOOLEAN DEFAULT false,
  ai_prompt       TEXT,
  user_notes      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_investor ON public.email_messages(investor_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_user ON public.email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON public.email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON public.email_messages(status);

-- =============================================
-- CAMPAIGN INVESTORS — Junction Table
-- =============================================

CREATE TABLE IF NOT EXISTS public.campaign_investors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES public.data_acquisition_jobs(id) ON DELETE CASCADE,
  investor_id     UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  pipeline_stage  TEXT DEFAULT 'discovered'
    CHECK (pipeline_stage IN ('discovered','qualified','outreach','interested','meeting','closed','rejected')),
  added_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(campaign_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_investors_campaign ON public.campaign_investors(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_investors_investor ON public.campaign_investors(investor_id);

-- =============================================
-- SAVED INVESTORS — User Bookmarks
-- =============================================

CREATE TABLE IF NOT EXISTS public.saved_investors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_investors_user ON public.saved_investors(user_id);

-- =============================================
-- ALTER EXISTING TABLES (IF NOT EXISTS)
-- =============================================

ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES public.investors(id);
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS merge_history JSONB DEFAULT '[]';
ALTER TABLE public.investor_firms ADD COLUMN IF NOT EXISTS normalized_name TEXT;

-- =============================================
-- RLS POLICIES (drop and recreate to be idempotent)
-- =============================================

ALTER TABLE public.raw_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.firm_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_investors ENABLE ROW LEVEL SECURITY;

-- Raw records
DO $$ BEGIN
  CREATE POLICY "Service role manages raw records"
    ON public.raw_records FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Duplicate candidates
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view duplicates"
    ON public.duplicate_candidates FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can update duplicates"
    ON public.duplicate_candidates FOR UPDATE
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages duplicate detection"
    ON public.duplicate_candidates FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Data change log
DO $$ BEGIN
  CREATE POLICY "Service role manages change log"
    ON public.data_change_log FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Firm aliases
DO $$ BEGIN
  CREATE POLICY "Authenticated users can view firm aliases"
    ON public.firm_aliases FOR SELECT
    USING (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Service role manages firm aliases"
    ON public.firm_aliases FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Email accounts (user-owned)
DO $$ BEGIN
  CREATE POLICY "Users can view own email accounts"
    ON public.email_accounts FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own email accounts"
    ON public.email_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own email accounts"
    ON public.email_accounts FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own email accounts"
    ON public.email_accounts FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Email messages (user-owned)
DO $$ BEGIN
  CREATE POLICY "Users can view own email messages"
    ON public.email_messages FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own email messages"
    ON public.email_messages FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own email messages"
    ON public.email_messages FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Campaign investors
DO $$ BEGIN
  CREATE POLICY "Service role manages campaign investors"
    ON public.campaign_investors FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Saved investors
DO $$ BEGIN
  CREATE POLICY "Users can view own saved investors"
    ON public.saved_investors FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can manage own saved investors"
    ON public.saved_investors FOR ALL
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- TRIGGERS (drop and recreate to be idempotent)
-- =============================================

-- email_accounts auto-update trigger
DROP TRIGGER IF EXISTS on_email_account_updated ON public.email_accounts;

CREATE OR REPLACE FUNCTION public.handle_email_account_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_email_account_updated
  BEFORE UPDATE ON public.email_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_email_account_updated();

-- =============================================
-- HELPER FUNCTIONS (CREATE OR REPLACE = always idempotent)
-- =============================================

CREATE OR REPLACE FUNCTION public.log_data_change(
  p_investor_id UUID,
  p_field_name TEXT,
  p_old_value TEXT,
  p_new_value TEXT,
  p_source_type source_type DEFAULT 'manual_entry',
  p_source_provider TEXT DEFAULT NULL,
  p_confidence NUMERIC DEFAULT 1.0,
  p_change_type TEXT DEFAULT 'update',
  p_detected_by TEXT DEFAULT 'system'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.data_change_log (
    investor_id, field_name, old_value, new_value,
    source_type, source_provider, confidence,
    change_type, detected_by
  ) VALUES (
    p_investor_id, p_field_name, p_old_value, p_new_value,
    p_source_type, p_source_provider, p_confidence,
    p_change_type, p_detected_by
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_firm_name(name TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(name),
        '\s+(LLC|LTD|INC|LLP|CORP|CORPORATION|CO|COMPANY|LP|PLC|AG|GmbH|S\.?A\.?|SAS|BV|NV|PTY\.?\s*LTD\.?)\s*$', '', 'i'
      ),
      '\s+', ' ', 'g'
    )
  );
END;
$$;

-- =============================================
-- VIEWS (CREATE OR REPLACE = always idempotent)
-- =============================================

CREATE OR REPLACE VIEW public.v_pending_duplicates AS
SELECT
  dc.id,
  dc.confidence,
  dc.match_signals,
  dc.status,
  dc.created_at,
  ia.full_name AS investor_a_name,
  ia.email AS investor_a_email,
  ib.full_name AS investor_b_name,
  ib.email AS investor_b_email,
  fa.name AS firm_a_name,
  fb.name AS firm_b_name
FROM public.duplicate_candidates dc
JOIN public.investors ia ON dc.investor_a_id = ia.id
JOIN public.investors ib ON dc.investor_b_id = ib.id
LEFT JOIN public.investor_firms fa ON ia.current_firm_id = fa.id
LEFT JOIN public.investor_firms fb ON ib.current_firm_id = fb.id
WHERE dc.status = 'pending'
ORDER BY dc.confidence DESC;

CREATE OR REPLACE VIEW public.v_data_health AS
SELECT
  (SELECT COUNT(*) FROM public.investors WHERE is_active = true) AS total_investors,
  (SELECT COUNT(*) FROM public.investors WHERE is_active = true AND email IS NOT NULL) AS with_email,
  (SELECT COUNT(*) FROM public.investors WHERE is_active = true AND linkedin_url IS NOT NULL) AS with_linkedin,
  (SELECT COUNT(*) FROM public.investors WHERE is_active = true AND is_verified = true) AS verified,
  (SELECT COUNT(*) FROM public.investors WHERE is_active = true AND data_quality_score >= 80) AS high_quality,
  (SELECT COUNT(*) FROM public.investors WHERE is_active = true AND fit_score >= 80) AS high_fit,
  (SELECT COUNT(*) FROM public.duplicate_candidates WHERE status = 'pending') AS pending_duplicates,
  (SELECT COUNT(*) FROM public.raw_records WHERE status = 'pending') AS pending_raw_records;

-- =============================================
-- DONE
-- =============================================

SELECT 'Migration 003 complete — Intelligence Pipeline schema ready.' AS result;
