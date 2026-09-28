-- Investor intelligence foundation (applied 2026-09-28).
-- Extends investors with provenance, freshness and dedup keys per the
-- data-architecture extension plan. Idempotent.
--
-- Facts vs inference: verification_status marks the epistemic class of a row
-- (verified = directly source-supported, derived = computed from verified
-- data, ai_classified = model interpretation, unknown = nothing verified).
-- last_verified_at drives staleness; content_hash enables incremental
-- re-ingestion (skip unchanged sources).

create extension if not exists pg_trgm;

alter table investors add column if not exists name_normalized text;
alter table investors add column if not exists verification_status text not null default 'unknown'
  check (verification_status in ('verified', 'derived', 'ai_classified', 'unknown'));
alter table investors add column if not exists last_verified_at timestamptz;
alter table investors add column if not exists content_hash text;

create index if not exists investors_name_normalized_idx on investors (name_normalized);
create index if not exists investors_full_name_trgm_idx on investors using gin (full_name gin_trgm_ops);
create index if not exists investors_bio_trgm_idx on investors using gin (bio gin_trgm_ops);

-- Canonical form of a firm/investor name for dedup keys:
-- lowercase, trimmed, whitespace-collapsed, common legal suffixes stripped.
-- POSIX character classes are used instead of \s so the function survives
-- any SQL transport layer. Ambiguous short forms ("VC", "Capital") are
-- deliberately NOT stripped — dedup merges require clear evidence.
create or replace function normalize_investor_name(name text)
returns text
language sql
immutable
as $fn$
  select lower(btrim(regexp_replace(regexp_replace(btrim(coalesce(name, '')), '[[:space:]]+', ' ', 'g'), '[[:space:]]*(,?[[:space:]]*(l[.]?l[.]?c[.]?|l[.]?l[.]?p[.]?|inc[.]?|ltd[.]?|limited|lp|plc|corp[.]?|corporation|co[.]?|company|gmbh|sas))$', '', 'i')))
$fn$;

update investors set name_normalized = normalize_investor_name(full_name) where name_normalized is null or name_normalized <> normalize_investor_name(full_name);
update investors set verification_status = 'verified' where is_verified = true and verification_status = 'unknown';
