-- =============================================
-- 045: Index every foreign key that references investors
-- =============================================
-- Postgres does not index the child side of a foreign key automatically. Every
-- `delete from investors` (duplicate merges, synthetic batch replacement) then
-- does a sequential scan of each child table per deleted row. With 12k rows in
-- investor_people the synthetic batch removal took ~50 ms per investor, which
-- is minutes at 50k rows and would be hours at 500k.
--
-- These indexes are also what makes merge/cascade predictable at scale. They
-- are plain btree, created idempotently, and cost one write path per child row.

create index if not exists duplicate_candidates_investor_a_idx
  on public.duplicate_candidates (investor_a_id);
create index if not exists duplicate_candidates_investor_b_idx
  on public.duplicate_candidates (investor_b_id);
create index if not exists duplicate_candidates_merge_into_idx
  on public.duplicate_candidates (merge_into_id);

create index if not exists email_tracking_events_investor_idx
  on public.email_tracking_events (investor_id);

create index if not exists introductions_investor_idx
  on public.introductions (investor_id);

create index if not exists investor_candidates_duplicate_of_idx
  on public.investor_candidates (duplicate_of);

create index if not exists investor_people_firm_idx
  on public.investor_people (firm_id);

create index if not exists reply_insights_investor_idx
  on public.reply_insights (investor_id);

-- Self-referencing merge pointer. Without this, every delete of an investor
-- scans the whole investors table to enforce ON DELETE SET NULL, which made
-- batch removal ~65 ms per row.
create index if not exists investors_merged_into_idx
  on public.investors (merged_into_id);
