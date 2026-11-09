# Wave 0 — Foundations: execution log

Date: 2026-11-04
Plan: `docs/26-phase1-architecture.md` §7
Exit test: existing pages still pass; nothing reads a dropped column.
Result: **passed** — no column or table was dropped, no existing query changed.

## Delivered

Migration `supabase/migrations/023_wave0_entity_split_and_lists.sql` (applied,
ledger 21/21, 0 pending).

| Item | What exists now |
|---|---|
| `investors.scope` | `TEXT NOT NULL DEFAULT 'unknown'` with `investors_scope_check` in (`startup_investor`,`institution`,`unknown`) and a partial index on active rows. All 18,995 records are `unknown` |
| `investor_people` | The missing entity: a human at an org, `firm_id → investors.id`, name/title/email/LinkedIn/bio/location/primary, plus `source`, `source_url`, `last_verified_at`. RLS: read for authenticated, writes service-role only. Empty (0 rows) |
| `fit_feedback` | One verdict per founder per investor (`strong`/`possible`/`poor`) with reasons array and note. RLS owner-only, unique `(user_id, investor_id)` |
| `investor_lists` | Per-founder named lists, unique case-insensitive name per user, RLS owner-only |
| `investor_list_items` | Membership with a note; unique `(list_id, investor_id)`; RLS requires an owned parent list on both `USING` and `WITH CHECK` |

Verified after apply: `scope` present on all 18,995 rows as `unknown`; all four
tables `relrowsecurity = true` with exactly one policy each; both CHECK
constraints present.

## Two planned items deliberately not built

The plan listed five W0 items. Three shipped, two were dropped because the live
schema already covered them. Building either would have created a second source
of truth.

1. **`pipeline_stage_history` — not created.** `pipeline_events`
   (`user_id`, `investor_id`, `entry_id`, `from_stage`, `to_stage`, `notes`,
   `created_at`) already exists and `POST /api/investors/pipeline` inserts into
   it on every stage move. It holds 4 rows today. A second history table would
   have been a duplicate with a different shape.

2. **21-stage migration — no DDL required.** `user_pipeline_entries.stage` is
   `TEXT`, not an enum, so the brief's 21 stages are purely a code change.
   Deferring it to W3 is deliberate: switching `stages.ts` now would render a
   21-column board before the "6 active stages by default" logic exists, and
   would strand the two existing entries without a value mapping.

## Deviation from the approved D1

D1 was approved as "entity split behind a compatibility view". I did not build
the view, and I did not populate `investor_firms`. Reasons, in order:

- **Every one of the 18,995 `investors` rows is an organisation.** There are zero
  people in the corpus. So the "person" table is the genuinely missing entity,
  and it now exists, keyed to the existing org rows.
- **Populating `investor_firms` by copying those rows would duplicate check size,
  stage, sector and geography across two tables** that can then drift. For a
  product whose premise is trustworthy data, a second source of truth is worse
  than an empty one.
- **A compatibility view would have nothing to present.** Its purpose was to hide
  a shape change; since no data moved, no shape changed.

Consequence, stated plainly: `investor_firms` is still empty and the six read
paths that join it (`[id]` profile, dashboard firm count, email-sequences,
investor-research ×2, investor service) still resolve nothing. That is a
pre-existing condition, now documented rather than hidden. It gets fixed in W1
when firm-level data exists to populate it, or by promoting the table when firm
and prospect data actually diverge.

## Checks run

- `node scripts/migrate.cjs` — applied 023, recorded in `schema_migrations`.
- `npm run db:status` — **21 files, 21 applied, 0 pending**.
- `npx vitest run` — **100 passed, 61 skipped** (skipped suites need a live server).
- Schema queries confirming columns, RLS, policies and constraints.

Note: `scripts/apply-migration.cjs` executes a file **without** writing the
ledger, which is why the first apply left 023 "pending" while the schema had
already changed. `scripts/migrate.cjs` is the runner to use. Both paths were
exercised; the second run was harmless because 023 is idempotent.

## Next

**W1 — Population.** Classify all 18,995 records as `startup_investor` /
`institution` / `unknown` from evidence that already exists in the database
(`source_provider`, `edgar_*`, `iapd_*`, type, name shape), not from guesswork,
and leave anything ambiguous `unknown`. Exit test: ≥ 80% classified, and Matches
scores only `startup_investor` rows.
