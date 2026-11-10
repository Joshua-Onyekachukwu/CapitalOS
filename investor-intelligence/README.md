# Capital OS — Investor Intelligence operation

This directory is the working repository for the global investor acquisition
operation. It is deliberately separate from the product code: data collection,
classification and qualification live here; only reviewed, promoted records reach
the app's `investors` table.

**Status, 2026-11-10:** two acquisition batches complete — **21,949 new fund
candidates** staged from SEC Form D (Q2 and Q3 2026), from 32,592 filings.
All are **unverified candidates**, not qualified investors; none is promoted.
See `research/reports/batch-001.md` and `batch-002.md`.

---

## 1. Repository audit — what already existed

Measured against the live database and the repo, not assumed:

| Asset | State |
|---|---|
| `investors` | **18,995** rows, US-only (SEC 13F restore 11,943 · IAPD 6,792 · EDGAR 260) |
| Emails on file | 4,921 (25.9%), **none verified** |
| Cheque size / thesis | 14 / 26 rows (0.07% / 0.14%) |
| `investor_firms` | **0 rows** — no firm entities have ever been created |
| `investor_people` | 0 rows — no decision-makers stored |
| `investor_data_sources` | 5,069 provenance rows |
| `investors_import_staging` | 0 rows — exists as a gate-check target only |
| Existing pipeline | `scripts/pipeline/*` (lake, normalize, dedup, qualify, ingest), `scripts/edgar-*.js`, GitHub IAPD workflow |
| Docs | `docs/23` (wave-1 findings), `docs/34` (import plan), `docs/investor-intelligence-pipeline.md` |

What that means:

- The **acquisition plumbing already existed and is reusable**: a JSONL lake,
  deterministic normalisation, conservative fuzzy dedupe, qualification gates,
  and an ingestion path that stages before writing to `investors`.
- What was **missing** was breadth: every source was a US regulator, firm
  entities were never separated from people, and there was no candidate backlog
  that enrichment could work through. That is what this operation adds.
- The existing pipeline's ingest will be used only after enrichment gives a
  candidate enough evidence to survive qualification. Nothing in this directory
  writes to `investors` directly.

## 2. Architecture

```
 SOURCE                       RAW (on disk)                 CANDIDATES (DB)
 SEC EFTS / future sources → data/raw/<provider>/<run>/  →  public.investor_candidates
                              exactly what the source        provenance, classification,
                              returned (JSONL)               confidence, status
                                    ↓                              ↓
                              data/processed/<provider>/     ENRICHMENT (next)
                              normalised candidates          website, stage, sector,
                                                             cheque, people, thesis
                                    ↓                              ↓
                              data/reports/<run>.json        QUALIFICATION → promotion
                                                             (`investors`, reviewed)
```

Rules the code enforces:

1. **Raw is immutable.** Every run writes the source payload untouched, so a
   classifier can be re-run without refetching.
2. **Candidates are not investors.** `investor_candidates` has no product reads
   and RLS with no policies (service role only).
3. **Deduplication is exact and conservative.** Names are normalised
   (case, punctuation, legal suffixes) and matched against all 18,995 existing
   investors; a name match is flagged `duplicate` with the corpus id, never
   merged automatically.
4. **Unknown is not zero.** A preliminary score only counts dimensions with
   evidence (recency, geography, completeness). Candidates lacking stage,
   sector and cheque evidence score 16/100 and are stamped Tier D (unverified).
5. **Idempotent.** `unique (source_provider, source_id)` means re-running a
   window cannot duplicate rows.

## 3. Directory map

```
investor-intelligence/
├── README.md
├── sources/source_registry.csv     113 sources, access method + licence status
├── schemas/                        investor · firm · person · source
├── research/
│   ├── methodology.md
│   ├── qualification_framework.md
│   └── reports/batch-001.md
├── scripts/acquire/sec-formd-pooled.cjs
├── data/raw/                       source payloads (git-ignored)
├── data/processed/                 normalised candidates (git-ignored)
├── data/checkpoints/               resumable run state (git-ignored)
└── data/reports/                   run metrics (committed)
```

## 4. Running an acquisition

```bash
# dry run: fetch and classify, write files, no database writes
node investor-intelligence/scripts/acquire/sec-formd-pooled.cjs \
  --start 2026-07-01 --end 2026-09-30 --dry-run

# real run
node investor-intelligence/scripts/acquire/sec-formd-pooled.cjs \
  --start 2026-07-01 --end 2026-09-30 --max 20000
```

The acquirer splits the range into weekly windows (EFTS caps pagination at
10,000 results), paginates 100 per request, sleeps 140 ms between requests
(≈7 req/s, under the SEC's 10 req/s fair-access limit) and records completed
windows in `data/checkpoints/` so an interrupted run resumes.

## 5. Source rules

- Public, licensed or explicitly permitted sources only. `source_registry.csv`
  records the access method and licence status per source; anything marked
  `commercial_only` or `unknown` is **not** collected until reviewed.
- No bypassing authentication, paywalls, CAPTCHAs or rate limits.
- Public professional data only; no sensitive personal data.
- No guessed email addresses. An email is only stored if it was published.
- SEC fair access: identifying `User-Agent` (set `SEC_USER_AGENT`), ≤10 req/s.

## 6. Honest position on 1,000,000 records

The target is 1M records; the evidence does not support 1M *qualified* investors
from public sources. Rough, defensible ceiling from accessible public data:

| Layer | Realistic scale | Why |
|---|---|---|
| Raw public fund/manager entities (US + UK + EU registries) | 150k–300k | Form D/D, ADV, Companies House, national registers |
| Distinct organizations after dedupe (SPVs collapse into managers) | 40k–90k | Most Form D rows are single-deal SPV series |
| Organizations with any usable public contact | 20k–50k | Contact data is the binding constraint |
| Pre-seed/seed-qualified with evidence (stage, cheque, thesis) | 10k–30k | Requires enrichment or licensed data |

1M records is achievable as **raw entity rows** only with licensed datasets
(Crunchbase/PitchBook/Dealroom at commercial cost) plus broad web acquisition.
It is not achievable as 1M qualified early-stage investors. Any report claiming
otherwise would be counting SPVs and duplicate series as investors.

## 7. Next batches (priority order)

1. **Collapse SPV series** — 5,688 of the 21,990 candidates are series/feeder
   vehicles. Group them under their master fund/manager before enrichment, then
   report the true distinct-entity count.
2. **Website + manager enrichment** from EDGAR Form D XML and open web pages;
   fills the fields that currently cap the score at 16.
3. **UK Companies House** (free API key, SIC 64301/66300) — the largest
   English-language non-US registry.
4. **Canada / Singapore / India / Nigeria** registries and association member
   lists where terms permit.
5. **Licensed data evaluation** — one paid dataset (Dealroom or Crunchbase) is
   the only realistic route to cheque sizes and thesis text at scale.
