-- ============================================================================
-- 023 — Wave 0 foundations: investor scope, people, fit feedback, lists
--
-- WHY
--   The Phase 1 plan (docs/26) asks for two things before any surface is built
--   on top of them: a distinction between the organisations in the corpus and
--   the people who work at them, and a record of which corpus rows are even
--   in scope for a startup fundraising round.
--
--   Today 100% of the 18,995 rows in `investors` are organisations. They carry
--   first_name / last_name / job_title as if they were people, and
--   `investor_firms` (the empty table those columns were meant to belong to)
--   is joined by six read paths that have been returning nothing: every firm
--   field in the product is blank because `current_firm_id` is NULL on all
--   18,918 active records.
--
-- WHY NOT POPULATE `investor_firms` HERE
--   Copying the 18,918 org rows into `investor_firms` would give the same
--   check size, stage, sector and geography two homes that can drift apart.
--   For a product whose premise is trustworthy data, a second source of truth
--   is worse than an empty one. Instead this migration adds the entity that is
--   genuinely missing — the person — keyed to the existing org rows. A person
--   at firm X is a row in `investor_people` with firm_id = X's investors.id.
--   When firm-level enrichment diverges from prospect-level data, that is the
--   point to promote `investor_firms`, with real evidence, not a bulk copy.
--
-- WHY NO `pipeline_stage_history` TABLE
--   The plan listed one. The live schema already has `pipeline_events`
--   (user_id, investor_id, entry_id, from_stage, to_stage, notes, created_at)
--   and POST /api/investors/pipeline writes a row to it on every stage move.
--   A second history table would be a duplicate, so only the missing
--   `fit_feedback` is added.
--
-- WHY NO STAGE ENUM MIGRATION
--   `user_pipeline_entries.stage` is TEXT, not an enum, so the 21-stage list in
--   the brief needs no DDL. It is a code-level change (stages.ts) in Wave 3,
--   with a value mapping for the rows that exist.
--
-- RLS
--   `investors` is a shared corpus that every authenticated founder reads, so
--   `investor_people` follows the same model: SELECT for authenticated, writes
--   only through the service role (enrichment jobs), never from a browser.
--   `fit_feedback` and the list tables are per-founder and owner-only.
--
-- Idempotent: safe to re-run.
-- ============================================================================

SET statement_timeout = 0;


-- ============================================================================
-- 1. INVESTOR SCOPE
--
--    'unknown' is the honest default and is what every row gets: the corpus
--    has never been classified. Recording a row as 'startup_investor' is a
--    data decision (Wave 1) that must be made per record with evidence, not a
--    default applied here. The CHECK keeps a typo from becoming a silent
--    fourth category.
-- ============================================================================

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'unknown';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'investors_scope_check'
  ) THEN
    ALTER TABLE public.investors
      ADD CONSTRAINT investors_scope_check
      CHECK (scope IN ('startup_investor', 'institution', 'unknown'));
  END IF;
END $$;

COMMENT ON COLUMN public.investors.scope IS
  'Whether this record is a prospect for a startup round. unknown = not yet classified; every row starts here because the corpus has never been classified.';

-- Scoring and discovery filter on this, so it belongs in the index that
-- already carries the is_active predicate.
CREATE INDEX IF NOT EXISTS idx_investors_scope_active
  ON public.investors(scope)
  WHERE is_active;


-- ============================================================================
-- 2. INVESTOR PEOPLE
--
--    A human at an organisation. Empty on purpose: the corpus contains zero
--    people, and inventing partners for 18,995 firms is exactly the
--    fabrication the product must not do. Rows arrive from sourced enrichment
--    (Wave 1) with source + source_url + last_verified_at attached.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investor_people (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  first_name        TEXT,
  last_name         TEXT,
  title             TEXT,
  email             TEXT,
  linkedin_url      TEXT,
  bio               TEXT,
  location          TEXT,
  is_primary        BOOLEAN NOT NULL DEFAULT FALSE,
  source            TEXT,
  source_url        TEXT,
  last_verified_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_people_firm
  ON public.investor_people(firm_id);

-- One person per address per firm. Partial so multiple people without an
-- email on file are all allowed (NULLs are not a duplicate).
CREATE UNIQUE INDEX IF NOT EXISTS uq_investor_people_firm_email
  ON public.investor_people(firm_id, lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE public.investor_people ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investor_people_read" ON public.investor_people;
CREATE POLICY "investor_people_read" ON public.investor_people
  FOR SELECT TO authenticated
  USING (true);

COMMENT ON TABLE public.investor_people IS
  'Humans at an investor organisation. firm_id points at investors.id because today every investors row is itself an organisation; see migration 023 header for why investor_firms was not populated instead.';


-- ============================================================================
-- 3. FIT FEEDBACK
--
--    Matching is only improvable if a founder can say a match was wrong.
--    One verdict per founder per investor; reasons are stored so the "why"
--    survives the session.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fit_feedback (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investor_id  UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  verdict      TEXT NOT NULL,
  reasons      TEXT[] NOT NULL DEFAULT '{}',
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fit_feedback_verdict_check'
  ) THEN
    ALTER TABLE public.fit_feedback
      ADD CONSTRAINT fit_feedback_verdict_check
      CHECK (verdict IN ('strong', 'possible', 'poor'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fit_feedback_user_investor
  ON public.fit_feedback(user_id, investor_id);

ALTER TABLE public.fit_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fit_feedback_owner_all" ON public.fit_feedback;
CREATE POLICY "fit_feedback_owner_all" ON public.fit_feedback
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ============================================================================
-- 4. INVESTOR LISTS
--
--    Curated sets that are not the pipeline. `saved_investors` remains the
--    live write path until Wave 3 switches the UI over in one move; creating
--    these tables empty now avoids two writers fighting over the same rows
--    while both surfaces exist.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.investor_lists (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_investor_lists_user_name
  ON public.investor_lists(user_id, lower(name));

ALTER TABLE public.investor_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investor_lists_owner_all" ON public.investor_lists;
CREATE POLICY "investor_lists_owner_all" ON public.investor_lists
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.investor_list_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id      UUID NOT NULL REFERENCES public.investor_lists(id) ON DELETE CASCADE,
  investor_id  UUID NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  note         TEXT,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_investor_list_items
  ON public.investor_list_items(list_id, investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_list_items_investor
  ON public.investor_list_items(investor_id);

ALTER TABLE public.investor_list_items ENABLE ROW LEVEL SECURITY;

-- Membership is readable and writable only through a list the caller owns.
-- The EXISTS check is what stops a founder attaching investors to someone
-- else's list by guessing its id.
DROP POLICY IF EXISTS "investor_list_items_owner_all" ON public.investor_list_items;
CREATE POLICY "investor_list_items_owner_all" ON public.investor_list_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.investor_lists l
      WHERE l.id = investor_list_items.list_id AND l.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.investor_lists l
      WHERE l.id = investor_list_items.list_id AND l.user_id = auth.uid()
    )
  );


-- ============================================================================
-- 5. APPLY-TIME REPORT
--    Prints what this migration actually did, so the state is auditable
--    rather than assumed.
-- ============================================================================

DO $$
DECLARE
  v_total      INTEGER;
  v_unknown    INTEGER;
  v_people     INTEGER;
  v_lists      INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total   FROM public.investors;
  SELECT COUNT(*) INTO v_unknown FROM public.investors WHERE scope = 'unknown';
  SELECT COUNT(*) INTO v_people  FROM public.investor_people;
  SELECT COUNT(*) INTO v_lists   FROM public.investor_lists;

  RAISE NOTICE 'investors.scope: % of % records are unknown (unclassified, awaiting Wave 1)', v_unknown, v_total;
  RAISE NOTICE 'investor_people: % rows (0 expected until sourced enrichment)', v_people;
  RAISE NOTICE 'investor_lists: % rows (0 expected until Wave 3 moves saved_investors across)', v_lists;
END $$;