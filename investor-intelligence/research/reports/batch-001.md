# Batch 001 — SEC Form D pooled funds, Q3 2026

**Run:** `formd-2026-07-01-2026-09-30` · 2026-11-10
**Source:** SEC EDGAR full-text search (EFTS), Form D filings
**Window:** 2026-07-01 → 2026-09-30 (weekly windows)
**Script:** `investor-intelligence/scripts/acquire/sec-formd-pooled.cjs`
**Raw payloads:** `data/raw/sec-formd/<run>/` (git-ignored)
**Report JSON:** `data/reports/formd-2026-07-01-2026-09-30-*.json`

## Funnel

| Stage | Count | Basis |
|---|---:|---|
| Form D filings scanned | **15,952** | everything EFTS returned for the quarter |
| Fund evidence detected | **11,080** | Item 3C and/or fund-name evidence, deduped within the batch |
| — Item 3C (pooled investment fund) | 10,354 filings → 9,776 distinct names | authoritative fund signal |
| — Name evidence only (no 3C) | 1,451 filings → 1,304 distinct names | confidence 0.50, needs review |
| Already in the 18,995-row corpus | **26** | exact normalised-name match |
| **New candidates staged** | **11,054** | `investor_candidates.status = 'new'` |
| Writes into `investors` | **0** | promotion is a separate reviewed step |

Location coverage is 11,080/11,080 (100%): every candidate has a city; 10,382
also carry a two-letter state. Top states: NY 2,017 · DE 1,392 · CA 1,177 ·
TX 871 · WA 765 · FL 647 · CT 440 · MA 308.

## What these records actually are

Form D proves an issuer is raising money and, under Item 3C, that it is a pooled
investment fund. It does **not** prove stage, sector, cheque size, thesis, or
that the fund invests in startups at all. Name analysis of the 11,080:

| Subtype (by name) | Count | Interpretation |
|---|---:|---|
| Contains "Series" | 3,035 | likely SPV/feeder series of a master fund, not separate managers |
| Contains "Fund" (excluding "Series") | 4,027 | fund vehicles; manager unknown |
| SPV / feeder / aggregator / opportunity | 1,419 | deal-specific vehicles |
| Contains "Capital" | 1,483 | mixed: managers and holding vehicles |

This is why no candidate is promoted: 3,035 SPV series would otherwise inflate
the database by calling each one an investor.

## Qualification state

Preliminary score is **16/100, Tier D (unverified)** for every new candidate.
Only three dimensions have evidence:

| Dimension | Weight | Awarded | Why |
|---|---:|---:|---|
| Recency | 5 | 5 | filed inside the window |
| Geography | 15 | 7.5 | US is in scope; founder fit unknown |
| Completeness | 5 | 3.75 | name, city, source |
| Stage alignment | 25 | 0 | no stage evidence |
| Sector relevance | 15 | 0 | no sector evidence |
| Cheque compatibility | 15 | 0 | no cheque evidence |
| Demonstrated early-stage activity | 10 | 0 | fund vehicle, not a track record |
| Founder-profile compatibility | 10 | 0 | no preference evidence |

A 16 does not mean "poor investor"; it means **insufficient evidence**. The
score moves only when enrichment supplies the missing dimensions.

## Deduplication

- 26 candidates matched an existing investor by normalised name and are stored
  as `status = 'duplicate'` with `duplicate_of` pointing at the corpus row.
- 11,054 are `new`.
- 725 intra-batch duplicate names were dropped before staging (11,805 filings
  with fund evidence → 11,080 distinct names; series names repeat across weekly
  windows).
- Re-running the same window is safe: `unique (source_provider, source_id)`.

## Errors and limits

- EFTS paginates only within the 10,000-result window; weekly splitting keeps
  every request below that. A form-heavy week would need daily windows.
- `biz_locations` is the issuer's business address, not necessarily the fund's
  investment geography.
- No websites, people, emails or cheque sizes were collected: Form D does not
  contain them. `investor_firms` and `investor_people` remain empty by design.
- 1,304 candidates rest on name evidence alone and should be reviewed before
  any enrichment spend.

## What this batch proves

The acquisition loop works end to end against a permitted, authoritative source:
15,952 filings → 11,080 classified fund candidates → 11,054 new staged rows with
provenance, deduplication against the corpus, and resumable checkpoints. It also
shows the operation's real constraint: public filings supply identity and
location, not investment suitability.

## Next actions

1. Collapse the 3,035 series/SPV rows into master entities (blocking issue for
   any count of "investors").
2. Enrich managers: website, team, thesis, stage and cheque from fund sites and
   Form D XML; only then can a candidate exceed Tier D.
3. Add UK Companies House once a free API key is available (SIC 64301/66300).
4. Re-run Q2 and Q4 2026 for seasonal coverage, then move to 2025 for history.
