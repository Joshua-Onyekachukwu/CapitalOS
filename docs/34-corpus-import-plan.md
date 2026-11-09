# Replacing the investor corpus — import, enrichment and re-score plan

**Date:** 9 November 2026
**Status:** plan, not started. Every current number below is the measured value from
`docs/30-completion-tracker.md`, not an estimate.
**Related:** `docs/20` §7 (success criteria), `docs/23` (wave-1 findings),
`docs/27` (W0 entity split), `docs/33` §7 (scale targets).

The 500k import is **later**, by decision. Until it lands the product works with the
18,995 firms it already has, and the code is written to say "not recorded" rather than
invent a value. This document is what happens when the decision changes, so nobody has to
rediscover the order.

---

## 0. Where we start (measured)

| Field | Filled | Of 18,995 |
|---|---:|---:|
| `full_name` | 18,995 | 100% |
| `country` / `city` | ~17,950 | 95% |
| `email` | 4,921 | 26% |
| `linkedin_url` | 796 | 4% |
| `current_firm_id` | 0 | 0% |
| `min_check_size` / `max_check_size` | 14 | 0.07% |
| `investment_thesis` | 26 | 0.14% |
| `outreach_readiness = 'ready'` | 0 | 0% |
| Top `fit_score` | 87 | — |
| Top `data_quality_score` | 69 | — |

The ceiling is 87 because four weighted factors have no inputs. No algorithm change moves
it; only data does.

---

## 1. Non-negotiables before a single new row is written

1. **Migrations are the source of truth.** `docs/30` records 22/22 applied and 0 pending.
   Any new table for this import ships as a migration in the same commit as the code that
   uses it.
2. **Scale work lands first.** `docs/33` §7 targets (list p95 < 400 ms, facets < 600 ms,
   text search < 500 ms) must pass at current volume and be re-run at 500k. Keyset
   pagination, the facet rollup (`030_investor_facet_rollup.sql`) and the composite
   indexes (`027_investor_scale_indexes.sql`) already exist; the load test does not.
3. **A backup you have restored once.** Not a `pg_dump` that was never read back.

---

## 2. Staging, never direct

`036_import_staging_table.sql` already provides the landing table. The shape is:

```
source file → staging (raw text, no constraints) → normalize → validate → promote → index → score → measure
```

**Staging rules:**

- Every staging row keeps `source_provider`, `source_url`, `fetched_at`, `content_hash`
  and the raw payload. Provenance is not optional; `investor_data_sources` is what lets a
  founder ask "where did this come from?".
- Nothing promotes automatically. Promotion is a scripted step with a dry-run mode that
  prints counts per rule.
- `content_hash` (unique) makes re-imports idempotent — an interrupted run resumes by
  skipping hashes already promoted.

---

## 3. Batching and jobs

| Concern | Rule |
|---|---|
| Batch size | 5,000 rows per upsert; 500 per transaction inside a batch |
| Job record | One `background_jobs` row per stage, with `total`, `processed`, `failed` |
| Resumability | Cursor on `staging.id`; re-running continues from the last committed batch |
| Cap per run | 50,000 promotions per run so a bad rule cannot rewrite the table in one go |
| Failure policy | Row-level failures are written to `import_failures` with the rule that rejected them; the batch continues |
| Rate limits | Never in the request path — jobs only, `cron/daily` triggers the next batch |

---

## 4. Normalisation and dedupe (the part that decides quality)

1. **Entities split first** (`docs/27`): firm, person, fund. One firm owns many people.
   A person with no firm is still a person, not an orphan — `current_firm_id` stays null
   and the UI says so.
2. **Firm keys**: normalized legal name + country + website domain. Fuzzy match only
   inside the same country, with a manual review queue for 0.85–0.95 similarity.
3. **Person keys**: normalized name + firm + LinkedIn slug (when present) + email domain.
   Email alone is not an identity: two partners share a domain.
4. **Dedupe output is a queue**, not a delete: `duplicate_candidates` (86 rows today) is
   reviewed through `/admin/review/duplicates`.
5. **Never merge on name alone.** "Sequoia Capital" and "Sequoia Capital India" are
   different firms with the same prefix.

---

## 5. Enrichment, cheapest first, capped

Order matters because each step costs money and the earlier steps make the later ones
worth doing.

| Step | Source | Field | Cost control |
|---|---|---|---|
| 1 | SEC 13F / Form D / IAPD (already in corpus) | firm, person, filing date, SIC | free |
| 2 | Firm website (one page per firm) | thesis text, cheque range, stage focus | top 5,000 by fit, 1 fetch/firm/day |
| 3 | Form D offerings | cheque size evidence | free |
| 4 | Partner pages | `linkedin_url`, title | top 2,000 only |
| 5 | Email pattern + verification | `email`, `verification_status` | top 2,000, never guessed as verified |

Rules that keep the UI honest:

- A guessed value is stored as a guess (`verification_status = 'ai_classified'`), never as
  `verified`.
- A missing field stays null. The UI renders "not recorded"; it does not render 0.
- `outreach_readiness` is **computed** from what is actually present. It flips to `ready`
  only when the email is verified and the firm and stage are known.

---

## 6. Re-score and re-measure

1. Re-run `qualification.ts` over the promoted set in batches of 500, writing
   `fit_score` + `fit_score_breakdown` (the breakdown is the evidence a founder reads).
2. Refresh the facet rollup (`refresh_investor_facets` from `030`).
3. Re-run the load test and record p95 for list, facets, text search, match list.
4. Re-run the success criteria in `docs/20` §7 and publish the measured row — including
   the ones that are still not met.
5. Update `AGENTS.md` and **every** landing claim in the same commit as the new counts
   (`src/components/Landing/Features.tsx`, `WhyCapitalOS.tsx`, `FAQ.tsx`,
   `DataVizChart.tsx`). A number in the marketing copy that is not in `docs/30` is a bug.

---

## 7. Definition of done for this import

| Check | Target |
|---|---|
| Firms with a linked firm record | ≥ 60% |
| Cheque range present | ≥ 40% |
| Thesis text present | ≥ 40% |
| Email present | ≥ 50%, none labelled verified without verification |
| `outreach_readiness = 'ready'` | ≥ 500 |
| `fit_score` ≥ 85 with a working breakdown | ≥ 200 |
| List p95 at full volume | < 400 ms |
| Interrupted import resumed with no duplicate rows | proven once |
| Landing copy matches measured values | exact |

Not in scope here: warm introductions, news/portfolio/competitor intelligence, grants.
Those need a named source before they need an import (`docs/33` §5).
