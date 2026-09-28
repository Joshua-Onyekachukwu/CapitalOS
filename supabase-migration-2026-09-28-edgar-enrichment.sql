-- EDGAR enrichment columns (applied 2026-09-28).
-- Structured, evidence-backed fields filled from the SEC submissions API
-- (data.sec.gov/submissions/CIK##########.json). source_id on these rows IS
-- the SEC CIK (10-digit, zero-padded) — no duplicate identity columns added.
-- All fields remain null when the source does not answer them: unknown stays
-- unknown. record_status implements the quarantine lifecycle.

alter table investors add column if not exists record_status text not null default 'valid'
  check (record_status in ('valid', 'needs_review', 'invalid', 'archived'));
alter table investors add column if not exists edgar_last_filing_date date;
alter table investors add column if not exists edgar_sic_code text;
alter table investors add column if not exists edgar_sic_description text;
alter table investors add column if not exists edgar_city text;
alter table investors add column if not exists edgar_state text;
alter table investors add column if not exists edgar_holdings_count int;
alter table investors add column if not exists edgar_holdings_usd numeric;

create index if not exists investors_record_status_idx on investors (record_status);
create index if not exists investors_sic_idx on investors (edgar_sic_code);
