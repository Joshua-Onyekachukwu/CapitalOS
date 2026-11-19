# Scaling notes: 500K investors is a target, not a claim

Status: 2026-11-19. This is a decision record, not marketing copy.

## The position

- The product is **built for** a 500K+ investor network. It does **not** have
  one today, and nothing user-facing may say or imply that it does.
- Current measured corpus (organic): 24,456 investor rows, 5,461 firm rows,
  12,102 related-person rows. Demo/synthetic rows are separate and flagged.
- The priority now is architecture that survives 20× growth, not a number.

## What that means concretely

Every design choice below exists because it is cheap now and expensive to
retrofit at 500K. If a future change breaks one of these, the change is wrong.

1. **Reads never scan the corpus.**
   - Facet counts come from `investor_facets` / `investor_facet_meta`, rebuilt
     by `refresh_investor_facets()`, not from `select *` + JS counting.
   - Discover pages in the database with `limit`/`range` plus a stable `order by`.
     Never fetch all matching ids and slice in Node.
   - Any new "total" or "breakdown" gets a rollup table or a `count(*) head`
     query with the same filters — not a full materialisation.

2. **Filters must be index-backed.**
   - `is_active = true` is part of every list query; partial indexes on the hot
     combinations (type, country, readiness, stage/sector arrays) carry it.
   - Free-text search uses `search_vector` / trigram indexes, not `ilike` on
     unindexed columns. If a filter has no index, it does not ship to 500K.

3. **Vectors are optional, never required.**
   - `thesis_embedding halfvec(2048)` + HNSW, null when absent. Matching must
     degrade to the weighted fit score when a row has no embedding, which is
     the majority of any real corpus.
   - Embedding is an async enrichment step, never inline in a page render.

4. **Writes are batched, idempotent and resumable.**
   - Bulk import goes through chunked inserts with `on conflict (id) do
     nothing`, a retry wrapper and a final row-count check (see
     `scripts/demo-data/seed.mjs`). The Supabase pooler drops long connections;
     partial loads that report success are the failure mode to avoid.
   - Ingestion that can take minutes belongs in a job (queue/worker), not in a
     request handler.

5. **Every row carries provenance.**
   - `source`, `source_provider`, `source_id`, `verification_status`,
     `is_synthetic`, `demo_batch`. That is what makes merge, dedupe, "why do we
     believe this" and synthetic-data removal possible at scale.
   - `investors_source_unique (source, source_id)` prevents the same filing
     becoming two investors.

6. **Synthetic data is a separate lane.**
   - `is_synthetic` + `demo_batch` on investors, firms, company_profiles and
     waitlist. Public counters and admin traction stats filter it out.
   - Demo rows are removable in batches, so a real corpus can land beside them
     and the demo can be rebuilt from the generator.

7. **Storage budget is a product constraint.**
   - Measured: 74,456 investor rows ≈ 546 MB (dominated by 2048-dim vectors on
     organic rows). Synthetic rows carry no vectors.
   - At 500K, vectors alone are tens of GB. Plan: store embeddings for the
     subset that has thesis text and is active, keep `halfvec` (not `vector`),
     and partition or archive inactive rows before that point.

8. **The demo path stays green.**
   - Onboarding → Discover → score → outreach draft → queue is checked in a
     browser after any schema or query change. A 500K-ready design that breaks
     the 50K demo is a regression.

## Not doing now

- No sharding, no separate search cluster, no 500K seeding. Those are triggered
  by measured latency/cost, not by ambition.
- No promise of coverage. The corpus grows by ingesting public filings and
  verified sources, and the UI states which fields are sparse.

## Revisit triggers

| Signal | Action |
| --- | --- |
| p95 Discover query > 800 ms | Add/verify composite partial indexes; consider covering index |
| Facet refresh > 30 s | Move refresh to a scheduled job; add per-dimension deltas |
| Investor table > 100 GB | Archive inactive rows; partition by `is_active`/date |
| Import run > 30 min | Move to queue worker with checkpointing |
| Vector recall complaints | Rebuild HNSW with higher `ef_construction`; re-embed with current model |
