-- =============================================
-- 043: Demo dataset support + facet rollup fix
-- =============================================
-- Capital OS needs a large, complete, *obviously synthetic* dataset so the
-- product can be demoed and load-tested before the real corpus reaches those
-- numbers. This migration adds the labels that make synthetic rows provable,
-- a place to keep synthetic founder profiles, and fixes the facet rollup that
-- currently fails on every refresh.
--
-- HONESTY RULE: synthetic rows are never traction. Every synthetic row carries
-- is_synthetic = true and a demo_batch. Any count shown to a user, investor or
-- founder must either exclude them or label them. Never delete this flag to
-- make a demo look better.

-- ---------------------------------------------------------------------------
-- 1. Labels
-- ---------------------------------------------------------------------------
alter table public.investors
  add column if not exists is_synthetic boolean not null default false;
alter table public.investors
  add column if not exists demo_batch text;

alter table public.investor_firms
  add column if not exists is_synthetic boolean not null default false;
alter table public.investor_firms
  add column if not exists demo_batch text;

alter table public.company_profiles
  add column if not exists is_synthetic boolean not null default false;
alter table public.company_profiles
  add column if not exists demo_batch text;

create index if not exists investors_demo_batch_idx
  on public.investors (demo_batch)
  where is_synthetic;

create index if not exists investor_firms_demo_batch_idx
  on public.investor_firms (demo_batch)
  where is_synthetic;

create index if not exists company_profiles_demo_batch_idx
  on public.company_profiles (demo_batch)
  where is_synthetic;

-- Synthetic rows must never be silently mixed with organic ones.
comment on column public.investors.is_synthetic is
  'true = generated demo/load-test row. Never real investor intelligence.';
comment on column public.investors.demo_batch is
  'Batch id (e.g. demo-2026-11) so one synthetic load can be replaced atomically.';

-- ---------------------------------------------------------------------------
-- 2. Synthetic founder profiles
-- ---------------------------------------------------------------------------
-- Founder accounts require auth.users rows, which a bulk generator must not
-- create. This table holds the same field shape as company_profiles so the
-- dataset can drive calibration, load tests and an admin demo view without
-- touching real accounts or inflating auth user counts.
create table if not exists public.demo_founders (
  id                      uuid primary key default gen_random_uuid(),
  demo_batch              text not null,
  company_name            text not null,
  website_url             text,
  industry                text,
  sub_industry            text,
  business_model          text,
  company_stage           text,
  country                 text,
  city                    text,
  one_liner               text,
  description             text,
  differentiator          text,
  target_customer         text,
  currently_raising       boolean default true,
  funding_amount          numeric,
  round_type              text,
  target_geographies      text[] default '{}',
  has_pitch_deck          boolean default false,
  mrr                     numeric,
  arr                     numeric,
  customer_count          integer,
  growth_rate             text,
  employee_count          integer,
  founded_year            integer,
  milestones              text[] default '{}',
  readiness_score         integer check (readiness_score between 0 and 100),
  founder_name            text,
  founder_title           text,
  founder_email           text,
  founder_linkedin_url    text,
  is_synthetic            boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists demo_founders_batch_idx
  on public.demo_founders (demo_batch, company_stage);
create index if not exists demo_founders_industry_idx
  on public.demo_founders (industry);

comment on table public.demo_founders is
  'Synthetic founder profiles for demos, calibration and load tests. Never a real founder, never traction, never counted as a signup.';

-- ---------------------------------------------------------------------------
-- 3. Facet rollup: make DELETE legal under Supabase safeupdate, and report
--    how many rows are synthetic.
-- ---------------------------------------------------------------------------
-- Supabase preloads `safeupdate`, which rejects DELETE without a WHERE clause.
-- The previous body used `delete from investor_facets;`, so every refresh
-- failed and the UI kept serving a stale rollup (B-11).
alter table public.investor_facet_meta
  add column if not exists synthetic integer not null default 0;

create or replace function refresh_investor_facets()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `where true` is required by safeupdate; it is a full clear.
  delete from investor_facets where true;

  insert into investor_facets (dimension, value, count)
  select 'type', investor_type, count(*)
  from investors
  where is_active and investor_type is not null
  group by investor_type;

  insert into investor_facets (dimension, value, count)
  select 'country', country, count(*)
  from investors
  where is_active and country is not null and country <> ''
  group by country;

  insert into investor_facets (dimension, value, count)
  select 'readiness', outreach_readiness, count(*)
  from investors
  where is_active and outreach_readiness is not null
  group by outreach_readiness;

  insert into investor_facets (dimension, value, count)
  select 'evidence', verification_status, count(*)
  from investors
  where is_active and verification_status is not null
  group by verification_status;

  insert into investor_facets (dimension, value, count)
  select 'sector', u.v, count(*)
  from investors
  cross join lateral unnest(investment_sectors) as u(v)
  where is_active and btrim(u.v::text) <> ''
  group by u.v;

  insert into investor_facets (dimension, value, count)
  select 'stage', u.v, count(*)
  from investors
  cross join lateral unnest(investment_stages) as u(v)
  where is_active and btrim(u.v::text) <> ''
  group by u.v;

  insert into investor_facets (dimension, value, count)
  select 'cheque', b.band, count(*)
  from (
    select case
      when max_check_size is null then 'unknown'
      when max_check_size < 500000 then 'under_500k'
      when max_check_size < 1000000 then '500k_1m'
      when max_check_size < 5000000 then '1m_5m'
      when max_check_size < 10000000 then '5m_10m'
      else 'over_10m'
    end as band
    from investors
    where is_active
  ) b
  group by b.band;

  insert into investor_facets (dimension, value, count)
  select 'thesis', case
      when investment_thesis is not null and btrim(investment_thesis) <> '' then 'has_thesis'
      else 'no_thesis'
    end, count(*)
  from investors
  where is_active
  group by 2;

  insert into investor_facets (dimension, value, count)
  select 'lead', coalesce(nullif(btrim(lead_preference::text), ''), 'unknown'), count(*)
  from investors
  where is_active
  group by 2;

  insert into investor_facet_meta (
    singleton, total, with_email, with_linkedin, verified, ready,
    needs_verification, with_thesis, with_cheque, with_lead_pref,
    firms_linked, synthetic, refreshed_at
  )
  select
    true,
    count(*),
    count(*) filter (where email is not null and email <> ''),
    count(*) filter (where linkedin_url is not null and linkedin_url <> ''),
    count(*) filter (where is_verified),
    count(*) filter (where outreach_readiness = 'ready'),
    count(*) filter (where outreach_readiness = 'needs_verification'),
    count(*) filter (where investment_thesis is not null and btrim(investment_thesis) <> ''),
    count(*) filter (where max_check_size is not null or min_check_size is not null),
    count(*) filter (where lead_preference is not null and btrim(lead_preference::text) <> ''),
    count(*) filter (where current_firm_id is not null),
    count(*) filter (where is_synthetic),
    now()
  from investors
  where is_active
  on conflict (singleton) do update set
    total              = excluded.total,
    with_email         = excluded.with_email,
    with_linkedin      = excluded.with_linkedin,
    verified           = excluded.verified,
    ready              = excluded.ready,
    needs_verification = excluded.needs_verification,
    with_thesis        = excluded.with_thesis,
    with_cheque        = excluded.with_cheque,
    with_lead_pref     = excluded.with_lead_pref,
    firms_linked       = excluded.firms_linked,
    synthetic          = excluded.synthetic,
    refreshed_at       = now();
end;
$$;

revoke all on function refresh_investor_facets() from public;
revoke all on function refresh_investor_facets() from anon, authenticated;
grant execute on function refresh_investor_facets() to service_role;
