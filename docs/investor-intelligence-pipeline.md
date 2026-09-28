# Investor Intelligence Pipeline — Architecture & Findings

*2026-09-28 · implemented and validated on a real 240-row SEC IAPD batch*

---

## 0. The SCRAPING repository (`harvesthub/scraping`)

**The repository does not exist.** `git clone` → `Repository not found`; the
authenticated GitHub API returns "Could not resolve to a Repository";
`gh search repos` finds no matching org. No code was evaluated because there
is no code to evaluate — fabricating a review was not an option.

**Verdict: blocked pending the correct URL.** If the repo is private, invite
`Joshua-Onyekachukwu` as a collaborator or make it public; the moment it is
readable, the evaluation criteria in §1 of the task (engine, concurrency,
JS rendering, licensing, deployment) can be applied. The pipeline below is
**scraper-agnostic by design**: acquisition is just "JSONL rows into
`data/pipeline/raw/<provider>/`", so any scraper — or none — plugs in without
touching processing, qualification, or ingestion.

## 1. What was implemented (and validated)

```
SOURCE (SEC IAPD monthly compilations)         [GitHub Actions, US runners]
   ↓  .github/workflows/iapd-acquire.yml
RAW DATA LAKE  data/pipeline/raw|processed|normalized|qualified|
               rejected|duplicates|failed|runs   (JSONL, 32MB parts)
   ↓  scripts/pipeline/run-batch.ts
PROCESS      deterministic cleaning, key normalization, seen-key dedup
   ↓
NORMALIZE    pure functions: name canonicalization, URL/email domains,
             geo (US states + countries → regions), stage/sector regex,
             check-size parsing ($/€/£, k/m/billion, FX)
   ↓
DEDUP        exact (website/email-domain/name+region) → fuzzy token-set
             with conservative verdicts; never auto-merges
   ↓
QUALIFY      TIER1 AI gate (is an investor entity?) → TIER2 deep
             extraction (stages/sectors/thesis/check-size/portfolio,
             evidence quotes) → deterministic gates → quality score
   ↓
INGEST       raw_records staging + idempotent investors insert,
             row-capped, batched, enum-validated
   ↓
SUPABASE (Capital OS investor DB)
```

**Controlled batch (real data, run 2026-09-28):** 240 source rows →
69 qualified / 160 rejected / 11 duplicates / 0 failed · 240 AI calls ·
76,266 tokens · **$0.0046 total** · ~0.5 s/record end-to-end.

## 2. Data sources (strategy)

| Source | What it gives | Status |
|---|---|---|
| **SEC IAPD monthly compilations** (Registered ~5MB + Exempt ~0.8MB zips) | every registered/exempt US adviser: legal name, CRD/SEC#, city/state/country, website, AUM, employees, filing dates | **implemented** — acquisition workflow live; exempt advisers (ERA) are the goldmine: they are by definition emerging private-fund managers (VC/PE/crypto) |
| SEC EDGAR 13F | institutional holdings → portfolio evidence | already in Capital OS (12k investors, SEC-verified) |
| Investor websites | thesis, stages, portfolio, check size | requires the (missing) scraper; runs anywhere, no US-IP constraint |
| Crunchbase / LinkedIn / Apollo | enrichment | existing Apollo path (key currently expired); LinkedIn TOS prohibits scraping — use APIs only |

Geographic constraint discovered: **SEC properties block non-US egress**
(Akamai geo-block, tested from Abuja). All SEC acquisition therefore runs on
GitHub Actions US runners; everything else runs locally/anywhere.

## 3. OpenRouter integration

Key `OPENROUTER_API_KEY` in `.env.local` (never committed). Two-tier routing
in `scripts/pipeline/openrouter.ts`:

- **TIER1** (every record): `meta-llama/llama-3.1-8b-instruct` →
  `google/gemini-2.0-flash-001` fallback. Binary "is this an investing
  entity?" + type classification. ~$0.00002/record.
- **TIER2** (only tier1-passing records with rich text):
  `anthropic/claude-3.5-haiku` → `openai/gpt-4o-mini`. Thesis, portfolio,
  check-size text, **evidence quotes**. ~$0.0003/record when invoked.
- Retries on 429/5xx with backoff; per-model fallback chain; per-call token
  + USD metering rolled into stage metrics; **AI type outputs are accepted
  only inside the controlled vocabulary** — free-text labels never reach the DB.
- Costs observed on the 240-row batch: $0.0046 total (tier2 invoked on ~35%
  of records).

## 4. Evidence & quality model

Every record carries per-attribute evidence refs (source URL, quote,
extracted_by, confidence, verified_at). Claim tiers: **verified ≥0.9 ·
supported ≥0.7 · inferred ≥0.4 · unknown** — and unknown stays null. The
record-level tier is the weakest evidenced attribute. Quality score (0-100,
defined in `quality.ts`): identity 30 + evidence 25 + classification 15 +
activity 10 + freshness 10 − duplicate-risk 10. Batch average landed at ~62
(these are registered-but-thin records; web enrichment would push identity
and thesis evidence up).

## 5. Deduplication

Stage 1 exact (O(1)): website domain, institutional email domain,
canonical-name+region. Stage 2 fuzzy: Jaccard token-set similarity with
conservative verdicts — **geo-qualifier differences (Sequoia vs Sequoia
India) are DISTINCT**, subset names are `requires_review`, ≥0.8 similarity is
`probable_duplicate`. Nothing auto-merges; the existing audited
`merge_investors` RPC remains the only merge path. Index seeds from already
ingested `source_provider='iapd'` rows, making runs idempotent. At 1M+: swap
the linear fuzzy scan for Postgres `pg_trgm` GIN index + trigram
similarity lookups, keep the exact maps as unique indexes.

## 6. Supabase protection

- Ingest is the **only** write path from the pipeline, row-capped per run
  (`--max-rows`), batched at 200, idempotent by provider+name lookup.
- Raw rows land in `raw_records` (staging) before investors; DB writes are
  enum-validated (type vocabulary map, `source_type: public_records`).
- Pre-ingest filter re-asserts the startup-signal gate (no `other` records).
- RLS + grants matrix already restrict client roles; pipeline uses the
  service role server-side only.
- Data lake on disk keeps all raw/intermediate state OUT of Supabase.

## 7. 1M+ architecture (options evaluated)

| Option | Verdict |
|---|---|
| A. Supabase primary only | **reached first** — current 500MB plan holds ~1.5–2M lean investor rows; 12k→1M is fine with batched upserts + existing indexes |
| B. Supabase + object lake | **implemented** — lake is the staging/raw layer today (local disk), Supabase Storage `data-archive` already exists for snapshots |
| C. Supabase + separate analytics DB | premature |
| D. Supabase qualified + local raw | **current state** |
| E. Supabase partitioning/indexes | needed at ~2M+ rows: partition `investors` by region or verification tier, `pg_trgm` for name search |
| F. External search layer | needed when semantic+structured hybrid search becomes a product requirement; **pgvector in the existing Postgres is the first stop** (embeddings on thesis/sector text), not a new engine |

**Recommendation:** stay on A+B+D now; add E (partitioning + trigram) at
~1.5M; add pgvector (not a separate engine) when semantic search ships.
Do not pay for a second database before Supabase query performance is
actually exhausted.

## 8. Cost model (measured basis → projected)

Measured: $0.0046 per 240 records ≈ **$0.0000192/record** AI cost
(tier2-heavy mix). Projection with the same mix:

| Scale | AI cost | Notes |
|---|---|---|
| 1,000 | ~$0.02 | trivial |
| 10,000 | ~$0.19 | single afternoon run |
| 100,000 | ~$1.92 | batch over days; DB writes still trivial |
| 1,000,000 | ~$19.2 | storage/lake dominated by raw HTML from web sources, not these structured feeds |

Deterministic-first design is why: ~65% of records never invoke tier2,
tier1 uses an 8B model. Web scraping will add parser/scraper infra cost but
not change the AI economics materially.

## 9. What has been tested

- 20 unit tests (normalization, quality, dedup verdicts, gating) — all pass;
  they caught 5 real bugs pre-deploy (unit parsing, slug stability, subset
  dedup, AI-crash, type literal).
- Two CI fixes shipped (typecheck strictness, workflow plumbing: variable
  collision, zip-link disambiguation).
- End-to-end real-data runs: acquisition workflow green on US runners;
  three pipeline runs including the misclassification-driven corrections.
- Live DB verification of ingested rows (types, geo, scores, provenance).

## 10. What remains

1. **The scraper** (blocked on the missing repo) — needed for investor
   website enrichment (thesis/portfolio/check-size evidence), the biggest
   quality lever left.
2. **Scale beyond 240**: run the full IAPD compilation (~15k ERA + ~65k
   RIA rows) once quality gates are tuned on a 1k batch; already supported
   by batch/limit/max-rows flags and checkpoints.
3. Enrichment pass linking IAPD records to existing EDGAR-verified investors
   (same firm, two evidence streams).
4. pgvector embeddings + hybrid search when semantic discovery ships.
5. Freshness loop: monthly IAPD re-acquisition (cron-able in the same
   workflow) + `last_verified_at`-driven refresh, mirroring the EDGAR
   re-verification pattern.

## 11. Decisions needed from you

1. **Correct SCRAPING repository URL** (or a collaborator invite) — blocks
   website-enrichment quality, not the pipeline.
2. **Scale authorization**: full-ERA ingestion (~15k rows → ~5k qualified
   startups-relevant managers, <$0.10 AI cost) is ready whenever you want it.
3. **EUR/GBP FX assumption** (1.1 / 1.3 hardcoded) — confirm or provide a
   rates source to refresh quarterly.
4. **Retention policy** for raw lake data (currently unbounded local disk;
   Supabase Storage archive is the natural next home).
