-- ============================================
-- 040 — Investor candidates (acquisition staging)
-- ============================================
-- The acquisition operation must never write directly into `investors`: a raw
-- SEC filing name is a lead, not a verified investor. This table holds every
-- discovered entity with its provenance, classification and qualification
-- state. Promotion into `investors` stays a separate, reviewed step.
--
-- Service-role only: RLS is enabled with no policies, matching the import
-- staging table. The product does not read candidates.

CREATE TABLE IF NOT EXISTS public.investor_candidates (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name           TEXT NOT NULL,
  -- Lowercased, punctuation-stripped, legal-suffix-stripped name used for
  -- deduplication. The original is preserved in full_name.
  normalized_name     TEXT NOT NULL,
  entity_kind         TEXT NOT NULL DEFAULT 'unknown'
                        CHECK (entity_kind IN ('fund_vehicle', 'firm', 'person', 'unknown')),
  investor_type       TEXT,
  country             TEXT,
  region              TEXT,
  city                TEXT,
  website             TEXT,
  linkedin_url        TEXT,
  source_provider     TEXT NOT NULL,
  source_id           TEXT NOT NULL,
  source_url          TEXT,
  source_published_at DATE,
  -- Why this record was classified the way it was (e.g. "Form D item 3C.7").
  classification_reason TEXT,
  confidence          NUMERIC(5, 2),
  qualification_score INTEGER,
  qualification_tier  TEXT,
  status              TEXT NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'duplicate', 'qualified', 'rejected')),
  duplicate_of        UUID REFERENCES public.investors(id) ON DELETE SET NULL,
  raw                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_provider, source_id)
);

CREATE INDEX IF NOT EXISTS idx_investor_candidates_norm
  ON public.investor_candidates (normalized_name);
CREATE INDEX IF NOT EXISTS idx_investor_candidates_status
  ON public.investor_candidates (status, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_investor_candidates_country
  ON public.investor_candidates (country);

ALTER TABLE public.investor_candidates ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: only the service role (acquisition scripts) reads or
-- writes candidates. Founders see promoted investors, not raw leads.

COMMENT ON TABLE public.investor_candidates IS
  'Acquisition staging. One row per discovered entity with provenance; never read by the product.';
