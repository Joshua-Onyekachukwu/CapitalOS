# Batch 002 — SEC Form D pooled funds, Q2 2026

**Run:** `formd-2026-04-01-2026-06-30` · 2026-11-10
**Source:** SEC EDGAR full-text search (EFTS), Form D
**Script:** `investor-intelligence/scripts/acquire/sec-formd-pooled.cjs`
**Raw payloads:** `data/raw/sec-formd/<run>/` (git-ignored)

## Funnel

| Stage | Count |
|---|---:|
| Form D filings scanned | **16,640** |
| Fund evidence detected (distinct names) | **10,910** |
| — Item 3C present | 10,656 filings |
| — Name evidence only | remainder, confidence 0.50 |
| Matched an existing `investors` row | **15** |
| Already staged by batch 001 | **537** |
| **New candidates inserted** | **10,895** |

Cross-batch dedupe was added before this run: a fund's name already present in
`investor_candidates` is skipped, because the same manager files Form D every
quarter under a new accession number. Without that check this batch would have
added 537 duplicate rows.

## Combined state after two batches

| Metric | Q3 2026 | Q2 2026 | Total |
|---|---:|---:|---:|
| Filings scanned | 15,952 | 16,640 | **32,592** |
| Distinct fund candidates | 11,080 | 10,910 | **21,990** |
| Duplicate of corpus | 26 | 15 | **41** |
| New staged candidates | 11,054 | 10,895 | **21,949** |
| Distinct cities | — | — | **1,423** |
| Names with "Series" | 3,035 | 2,653 | **5,688** |
| Fund-titled, non-series | 4,027 | 4,288 | **8,315** |
| Promoted to `investors` | 0 | 0 | **0** |

Top states now: NY 3,928 · DE 2,590 · CA 2,473 · WA 1,576 · TX 1,551.

## What changed in the data model

`alreadyStagedFromEarlierRuns` is now part of each run report, and the candidate
name set is loaded before staging. Deduplication order remains: corpus first
(marked `duplicate` with `duplicate_of`), then earlier candidate batches
(skipped), then within-batch repeats (skipped).

## Honest reading

- 21,949 is **staged candidates**, not investors. Every row scores 16/100 and is
  Tier D (unverified); none is promoted.
- 5,688 (25.9%) are series/SPV-style vehicles that must be collapsed under
  master entities before any "number of investors" claim.
- 8,315 carry a fund name but no manager, website, thesis or cheque size.
- The corpus is unchanged at 18,995; the landing-page claims stay accurate.
- Quarterly filing volume is steady (≈16k filings per quarter, ≈11k fund
  candidates), so public Form D alone converges toward tens of thousands of
  entities, not a million.

## Next actions

1. Collapse `Series` vehicles (5,688 rows) under managers; measure the true
   distinct-entity count.
2. Enrich the non-series fund names from EDGAR Form D XML and fund websites.
3. Add Q1 2026 and Q4 2025 for a full trailing year before widening to UK/EU
   registries.
