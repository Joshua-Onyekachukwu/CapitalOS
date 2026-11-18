-- 024 — Pipeline stages: 11 → 21
--
-- The brief (Phase 2, §10) fixes the stage set at 21. The original 11 were
-- close enough to run on, but they conflated distinct states: "Meeting" covered
-- both a scheduled and a completed first meeting, "Closed" covered committed
-- and closed-won, and there was one terminal "Passed" for both a pass and a
-- loss. Those ambiguities are why a pipeline cannot report conversion.
--
-- Order matters here: the CHECK constraint still lists the 11 old ids, so it is
-- dropped before the remap and re-created afterwards with the 21 new ones.
-- Without that, every UPDATE below would be rejected.
--
-- Id mapping. Legacy ids are remapped rather than kept as aliases: an alias
-- would leave rows the board cannot render (the board iterates the canonical
-- list), and `stage` is written by the API route from that same list.
--
--   qualified            → shortlisted        (same meaning, clearer name)
--   outreach             → outreach_drafted   (it was "Outreach Ready")
--   meeting              → meeting_scheduled
--   closed               → closed_won
--   passed               → not_a_fit
--   discovered, researching, contacted, follow_up, due_diligence, term_sheet
--                        → unchanged
--
-- Idempotent: the CASE arms only touch legacy values, so a second run is a
-- no-op, and the constraint is created only if absent.

ALTER TABLE public.user_pipeline_entries
  DROP CONSTRAINT IF EXISTS user_pipeline_entries_stage_check;

UPDATE public.user_pipeline_entries
SET stage = CASE stage
  WHEN 'qualified' THEN 'shortlisted'
  WHEN 'outreach'  THEN 'outreach_drafted'
  WHEN 'meeting'   THEN 'meeting_scheduled'
  WHEN 'closed'    THEN 'closed_won'
  WHEN 'passed'    THEN 'not_a_fit'
  ELSE stage
END
WHERE stage IN ('qualified', 'outreach', 'meeting', 'closed', 'passed');

-- The audit trail must speak the same vocabulary as the entries it describes,
-- otherwise stage-duration reporting silently drops every historical move.
UPDATE public.pipeline_events
SET from_stage = CASE from_stage
  WHEN 'qualified' THEN 'shortlisted'
  WHEN 'outreach'  THEN 'outreach_drafted'
  WHEN 'meeting'   THEN 'meeting_scheduled'
  WHEN 'closed'    THEN 'closed_won'
  WHEN 'passed'    THEN 'not_a_fit'
  ELSE from_stage
END
WHERE from_stage IN ('qualified', 'outreach', 'meeting', 'closed', 'passed');

UPDATE public.pipeline_events
SET to_stage = CASE to_stage
  WHEN 'qualified' THEN 'shortlisted'
  WHEN 'outreach'  THEN 'outreach_drafted'
  WHEN 'meeting'   THEN 'meeting_scheduled'
  WHEN 'closed'    THEN 'closed_won'
  WHEN 'passed'    THEN 'not_a_fit'
  ELSE to_stage
END
WHERE to_stage IN ('qualified', 'outreach', 'meeting', 'closed', 'passed');

ALTER TABLE public.user_pipeline_entries
  ADD CONSTRAINT user_pipeline_entries_stage_check CHECK (stage = ANY (ARRAY[
    'discovered',
    'researching',
    'shortlisted',
    'introduction_requested',
    'introduction_received',
    'outreach_drafted',
    'contacted',
    'responded',
    'meeting_scheduled',
    'first_meeting_completed',
    'follow_up',
    'due_diligence',
    'partner_meeting',
    'verbal_commitment',
    'term_sheet',
    'negotiation',
    'committed',
    'closed_won',
    'closed_lost',
    'not_a_fit',
    'on_hold'
  ]::text[]));

-- Stage is the board's grouping key and the route filters on it per user.
CREATE INDEX IF NOT EXISTS idx_user_pipeline_entries_user_stage
  ON public.user_pipeline_entries (user_id, stage);

COMMENT ON COLUMN public.user_pipeline_entries.stage IS
  'One of the 21 stages in src/lib/services/pipeline/stages.ts. TEXT (not an enum) so the set can evolve without a type migration; the CHECK constraint is the guard.';
