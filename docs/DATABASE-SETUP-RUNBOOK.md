# Capital OS — Database Setup Runbook

**Purpose:** the exact, safe order for provisioning a (new or restored) Supabase
project for Capital OS. Written after the Phase 1 audit; follow it literally.

> ⚠️ **Order matters.** One file in this repo (`supabase-production-fixes.sql`)
> contains `DELETE FROM investors` dedup statements. Running it after a data
> restore will delete investor rows. The order below is safe.

---

## Phase A — Provision the project

1. Supabase dashboard → New project (or **Restore** if reviving a paused one).
2. Wait for `ACTIVE_HEALTHY`.
3. Note: project ref, anon key, service-role key, DB password → keep in `.env.local` only.

## Phase B — Apply schema (SQL editor or MCP `apply_migration`, in this order)

| # | File | What it does | Idempotent? |
|---|------|--------------|-------------|
| 1 | `supabase/migrations/001_profiles_and_triggers.sql` | profiles + auth triggers | yes |
| 2 | `supabase/migrations/002_investor_intelligence.sql` | investors core | yes |
| 3 | `supabase/migrations/003_intelligence_pipeline.sql` | ingestion pipeline | yes |
| 4 | `supabase/migrations/004_company_intelligence_billing.sql` | company_profiles + billing | yes |
| 5 | `supabase/migrations/005_billing_state_threads_jobs.sql` | subscriptions/threads/jobs | yes |
| 6 | `supabase/migrations/006_search_intelligence_enhancements.sql` | search + intelligence | yes |
| 7 | `supabase/migrations/007_followup_sequences.sql` | sequences | yes |
| 8 | `supabase/migrations/008_email_tracking.sql` | tracking columns | yes |
| 9 | `supabase-pipeline-stage.sql` | pipeline_stage + pipeline_events + RLS | yes |

**Do NOT run** `supabase-production-fixes.sql` (destructive dedup) unless
explicitly requested — and never after the data restore in Phase D.

## Phase C — Apply RLS (this is the fix that unblocks onboarding)

Run **`supabase-rls-fix.sql`** (v3, idempotent — safe to re-run).

It enables RLS and creates correct `auth.uid()` policies on all tenant tables,
including `company_profiles` (SELECT/INSERT/UPDATE/DELETE via `auth.uid() = user_id`),
`company_team_members` and `company_documents` (via `company_id IN (SELECT id FROM
company_profiles WHERE user_id = auth.uid())`).

**Verification query (must return rows):**

```sql
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'company_profiles';
-- expect 4 policies

SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('company_profiles','company_documents','company_team_members');
-- expect relrowsecurity = true on all three
```

## Phase D — Restore investor data (new projects only; skipped for revived projects that still have data)

1. Restore from on-disk backups (fastest, ~25 s for 12k rows):

   ```bash
   npx tsx src/scripts/restore-investors.ts [csvPath]
   ```

   Requires `SUPABASE_SERVICE_ROLE_KEY` + `NEXT_PUBLIC_SUPABASE_URL` in
   `.env.local`. Accepts both key formats (legacy JWT `eyJ…` or modern
   `sb_secret_…`) and live-probes the REST API before importing.
2. Or regenerate via the EDGAR scraper (free, current data):
   `node scripts/edgar-bulk-fast.js` after configuring env.
3. The import is **idempotent** — dedup runs on `(source, source_id)` via the
   `investors_source_unique` unique index (`ON CONFLICT DO NOTHING`), so
   re-runs report `Inserted: 0, Duplicates: N` instead of creating dupes.
   EDGAR CSVs carry no email/linkedin columns, so those dedup paths never apply.
4. Stage values outside the `investment_stage` enum (e.g. `buyout`) are
   dropped by `normalizeStage` — canonical allowlist, must match the DB enum.
5. Verify:

```sql
SELECT count(*), count(email) FROM investors;
SELECT source, count(*) FROM investors GROUP BY source;
SELECT count(*) - count(DISTINCT (source, source_id)) AS dupe_identities FROM investors WHERE source_id IS NOT NULL; -- expect 0
```

**Status (2026-09-27, project tvekoojdilkjptjzpvqo):** 12,203 investors restored
from `mega-all-investors-2026-08-26.csv` — all active, all with stage data,
0 duplicate identities. Verified via SQL after a double-import was detected and
cleaned (the original run double-inserted because dedup keyed on email/linkedin
only, absent in this CSV).

## Phase E — Wire the app

1. `.env.local` (local): new `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, plus `SUPABASE_DB_PASSWORD` if scripts need it.
2. Vercel: update the same vars in Project → Settings → Environment Variables
   (Production + Preview) → **Redeploy** (env changes require a new deployment).
3. Convex env unchanged (project is alive).

## Phase F — End-to-end verification (must all pass before "onboarding works" is claimed)

1. Visit production → Sign up with a fresh test account → expect email
   verification or immediate session (per Supabase auth settings).
2. Complete the 7-step onboarding wizard; at each step confirm no console
   errors and that the step advances.
3. SQL check (service role / SQL editor):

```sql
SELECT company_name, onboarding_step, onboarding_completed, readiness_score
FROM company_profiles ORDER BY created_at DESC LIMIT 1;
```

4. Reload `/dashboard` → company card shows the real name + readiness score.
5. `/dashboard/investors` returns results (data restored).
6. Log out → log back in → profile persists.

**Status (2026-09-27): COMPLETE — full E2E passed on production.**
Root cause of the outage: the Supabase env vars on Vercel still pointed at the
dead project (git push alone never fixes baked `NEXT_PUBLIC_*` values — a
redeploy is required). Fix applied via Vercel CLI: replaced
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` /
`SUPABASE_SERVICE_ROLE_KEY` on the Production target, then
`vercel redeploy <latest-prod-url> --target production`. Verified the new bundle
embeds the new ref + anon key (chunk `(auth)/signup` → supabase client chunk).
E2E on capital-os-nine.vercel.app with `buffy.qa+prod-e2e-20260927@gmail.com`:
signup ✓ → email confirm via SQL (Supabase requires confirmation) → login ✓ →
dashboard shows 12,203 investors ✓ → 7-step onboarding completed ✓ →
investor search ("Point72" → 5 results) ✓ → pipeline move Discovered→Qualified
✓ (DB-verified: `user_pipeline_entries` + `pipeline_events` rows for the prod
user; note the stage-card counters lag until reload — server state is correct).

**Known-good code path (verified in code, not yet against a live DB):**
`onboarding/page.tsx` → `updateCompanyProfile()` server action →
cookie-authenticated Supabase client → RLS `auth.uid() = user_id` policies →
`company_profiles`. All 24 written columns exist in migration 004 with matching
types; `UNIQUE(user_id)` supports the get-or-create pattern.
