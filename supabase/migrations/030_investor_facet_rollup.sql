-- =============================================
-- 030: Investor facet rollup
-- =============================================
-- The facets endpoint used to scan a 5,000-row sample of `investors` on every
-- request and count sectors/stages/types in JS. That is both stale (a sample is
-- not the corpus) and expensive once the corpus grows to 500k. This migration
-- moves the counting into one SQL refresh and stores the result, so a facet
-- request is two indexed reads regardless of corpus size.
--
-- The rollup also records how many rows actually have each sparse field
-- (cheque size, thesis text, lead preference, firm link). The UI needs those
-- numbers to label a filter honestly instead of implying the corpus is complete.
--
-- NOTE: investment_sectors / investment_stages are enum arrays, so every
-- comparison and output here casts to text. Comparing an enum to '' is an
-- invalid enum input, which fails the whole migration.

create table if not exists investor_facets (
  dimension    text        not null,
  value        text        not null,
  count        integer     not null default 0,
  refreshed_at timestamptz not null default now(),
  primary key (dimension, value)
);

create index if not exists idx_investor_facets_lookup
  on investor_facets (dimension, count desc);

create table if not exists investor_facet_meta (
  singleton          boolean     primary key default true check (singleton),
  total              integer     not null default 0,
  with_email         integer     not null default 0,
  with_linkedin      integer     not null default 0,
  verified           integer     not null default 0,
  ready              integer     not null default 0,
  needs_verification integer     not null default 0,
  with_thesis        integer     not null default 0,
  with_cheque        integer     not null default 0,
  with_lead_pref     integer     not null default 0,
  firms_linked       integer     not null default 0,
  refreshed_at       timestamptz not null default now()
);

-- Rollup tables are server-only: the API reads them with the service role.
-- RLS with no policies means anon/authenticated keys cannot read them even if
-- someone grants table privileges later.
alter table investor_facets enable row level security;
alter table investor_facet_meta enable row level security;

create or replace function refresh_investor_facets()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from investor_facets;

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

  -- One scan for every headline availability count.
  insert into investor_facet_meta (
    singleton, total, with_email, with_linkedin, verified, ready,
    needs_verification, with_thesis, with_cheque, with_lead_pref,
    firms_linked, refreshed_at
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
    refreshed_at       = now();
end;
$$;

revoke all on function refresh_investor_facets() from public;
revoke all on function refresh_investor_facets() from anon, authenticated;
grant execute on function refresh_investor_facets() to service_role;

-- Seed the rollup immediately so the first request after deploy is already
-- served from the table rather than triggering a cold refresh.
select refresh_investor_facets();
