-- =============================================
-- 036 — Staging table for the import gate check
-- =============================================
-- Proving the preview → confirm gate end to end needs a target that is not the
-- corpus. This table mirrors the columns the CSV importer writes, with text
-- types so a fixture cannot collide with the real enum constraints. Nothing in
-- the product reads it; the gate check empties it before and after it runs.

create table if not exists public.investors_import_staging (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  linkedin_url text,
  job_title text,
  bio text,
  location text,
  country text,
  city text,
  investor_type text,
  investment_stages text[],
  investment_sectors text[],
  investment_geographies text[],
  min_check_size bigint,
  max_check_size bigint,
  currency text,
  portfolio_count integer,
  website_url text,
  avatar_url text,
  source text,
  source_id text,
  source_provider text,
  data_quality_score integer,
  outreach_readiness text,
  is_active boolean,
  created_at timestamptz not null default now()
);

create index if not exists idx_import_staging_source
  on public.investors_import_staging (source, source_id);

alter table public.investors_import_staging enable row level security;
-- No policies: only the service role writes here, and only the gate check does.

comment on table public.investors_import_staging is
  'Target for scripts/check-import-gate.cjs. Never read by the product; emptied by the check.';
