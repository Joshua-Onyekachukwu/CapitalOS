-- =============================================
-- 025 — Round targets and stage entry timestamps
-- =============================================
-- Two things the pipeline needs to answer "where does my round stand":
--
-- 1. `company_profiles.target_valuation` — the round parameters a founder
--    commits to. `funding_amount`, `round_type` and the cheque range already
--    exist; valuation did not.
-- 2. `user_pipeline_entries.stage_entered_at` — when the entry last changed
--    stage, so "days in stage" is a fact rather than a guess derived from
--    `updated_at` (which any note edit also moves).
--
-- `user_pipeline_entries` already carries expected_amount, probability and
-- lost_reason from the live schema (created outside the migration set). They
-- are asserted here so a fresh rebuild from migrations alone is complete.

alter table public.company_profiles
  add column if not exists target_valuation numeric;

alter table public.user_pipeline_entries
  add column if not exists expected_amount numeric,
  add column if not exists probability     integer,
  add column if not exists lost_reason     text,
  add column if not exists stage_entered_at timestamptz;

-- Backfill: the best available evidence of when the current stage began.
update public.user_pipeline_entries
   set stage_entered_at = coalesce(stage_entered_at, updated_at, created_at)
 where stage_entered_at is null;

alter table public.user_pipeline_entries
  alter column stage_entered_at set default now();

-- A probability outside 0–100 is not a percentage, so it must not reach a
-- weighted total. NOT VALID keeps the migration safe on existing rows while
-- still enforcing the rule for every new write.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'user_pipeline_entries_probability_range'
  ) then
    alter table public.user_pipeline_entries
      add constraint user_pipeline_entries_probability_range
      check (probability is null or (probability >= 0 and probability <= 100))
      not valid;
  end if;
end $$;

-- Committed money is summed per founder, so the predicate that finds those
-- stages needs an index once a founder tracks hundreds of investors.
create index if not exists idx_user_pipeline_entries_user_stage
  on public.user_pipeline_entries (user_id, stage);

comment on column public.company_profiles.target_valuation is
  'Pre-money target valuation for the current round, in the founder''s currency.';
comment on column public.user_pipeline_entries.stage_entered_at is
  'Timestamp the entry entered its current stage; drives days-in-stage.';
