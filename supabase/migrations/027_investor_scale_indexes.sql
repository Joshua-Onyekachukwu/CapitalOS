-- =============================================
-- 027 — Indexes for a 500k+ investor corpus
-- =============================================
-- The list endpoint sorts by fit_score / created_at / data_quality_score and
-- filters by type, country and readiness, all under is_active = true. Each
-- index below matches one of those access paths, in the order the keyset
-- paginator walks it (sort column, then id as the tie-breaker).
--
-- These are additive. No existing index is dropped here: dropping an index a
-- query still uses is a silent regression, so removal gets its own change once
-- EXPLAIN confirms it is unused.

create index if not exists idx_investors_active_fit_keyset
  on public.investors (is_active, fit_score desc, id)
  where fit_score is not null;

create index if not exists idx_investors_active_created_keyset
  on public.investors (is_active, created_at desc, id);

create index if not exists idx_investors_active_quality_keyset
  on public.investors (is_active, data_quality_score desc, id)
  where data_quality_score is not null;

create index if not exists idx_investors_active_name_keyset
  on public.investors (is_active, full_name, id);

create index if not exists idx_investors_active_type
  on public.investors (is_active, investor_type);

create index if not exists idx_investors_active_country
  on public.investors (is_active, country);

create index if not exists idx_investors_active_readiness
  on public.investors (is_active, outreach_readiness);

-- Feature filters the UI will switch on once the new corpus populates them.
create index if not exists idx_investors_check_size
  on public.investors (min_check_size, max_check_size)
  where min_check_size is not null or max_check_size is not null;

-- Freshness after every page load, so the counts reflect the last ANALYZE.
analyze public.investors;
