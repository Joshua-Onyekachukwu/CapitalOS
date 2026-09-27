-- Bulk scoring update for investors (applied 2026-09-27).
-- Used by POST /api/investors/fit-analysis (action: batch_score).
-- PostgREST upserts cannot be used here: partial rows would write NULLs into
-- NOT NULL columns (e.g. full_name), so a single SQL statement applies the
-- payloads instead. Execute is revoked from anon/authenticated — only the
-- server (service role) can call it.
create or replace function public.bulk_update_fit_scores(payload jsonb)
returns void
language sql
set search_path = public
as $fn$
  update investors i set
    fit_score = (e->>'fit_score')::int,
    fit_score_breakdown = (e->'fit_score_breakdown')::jsonb,
    data_quality_score = (e->>'data_quality_score')::int,
    outreach_readiness = (e->>'outreach_readiness')::outreach_readiness
  from jsonb_array_elements(payload) as e
  where i.id = (e->>'id')::uuid
$fn$;

revoke execute on function public.bulk_update_fit_scores(jsonb) from anon, authenticated;
