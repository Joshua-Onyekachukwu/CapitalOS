# Capital OS — System Handbook

> **Last verified against code:** September 26, 2026. This replaces the older
> version whose architecture tables and credentials no longer matched reality.
> Deep-dive documents: `ARCHITECTURE.md` (design), `docs/DATABASE-SETUP-RUNBOOK.md`
> (provisioning/restore), `docs/19-phase1-audit.md` (current known issues).

## What this system is

An AI-powered fundraising operating system for startup founders. Founders sign
up, describe their company, discover and qualify investors from an 83K+ record
database, generate personalized outreach, send tracked emails, and manage every
relationship through an 11-stage fundraising pipeline.

## Live components

| Component | Provider/Ref | Status (2026-09-26) | Notes |
|---|---|---|---|
| Web app | Vercel — `capital-os-nine.vercel.app` | deployed | env vars in Vercel project settings |
| Database + Auth | Supabase | **was destroyed; being re-provisioned** | see runbook; free tier auto-pauses inactive projects |
| Real-time state | Convex — `exciting-bat-92.convex.cloud` | healthy | jobs, metrics, notifications |
| AI | NVIDIA NIM (`integrate.api.nvidia.com`) | configured | keys rotate in `src/lib/ai/keys.ts`; `AI_MOCK_MODE` for offline |
| Email | Gmail API / Microsoft Graph / SMTP | configured per-user | OAuth tokens AES-256-GCM encrypted at rest |
| Repo | GitHub `Joshua-Onyekachukwu/CapitalOS` | active | `main`; CI absent (planned) |

> ⚠️ **Incident record (Sept 26, 2026):** production signup failed with
> "Failed to fetch" — the Supabase projects referenced by the deployment had
> been removed/paused (NXDOMAIN on both refs). Investor data survives in
> `backups/edgar*/` and can be regenerated from SEC EDGAR. Free-tier Supabase
> projects pause after ~7 days of inactivity: **if production is idle, pause
> protection = periodically restore/use the project or upgrade the plan.**

## Environments & configuration

All secrets live in `.env.local` (gitignored) and Vercel env settings. Never
commit them; the historical versions of `SYSTEM.md`/`env-convex.json` that
contained real credentials were redacted in commit `41a064f`.

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | app + scripts | service key server-only |
| `SUPABASE_DB_PASSWORD` | migration/backup scripts | direct Postgres path |
| `NVIDIA_API_KEY` / `NVIDIA_API_KEY_1..N` | AI client | rotation supported |
| `AI_MOCK_MODE` | AI client | `true` = no external AI calls |
| `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `CONVEX_DEPLOY_KEY` | Convex | codegen needs the latter two |
| `GOOGLE_CLIENT_ID/SECRET`, `MICROSOFT_CLIENT_ID/SECRET` | OAuth senders | token refresh |
| `EMAIL_TOKEN_ENCRYPTION_KEY` | crypto.ts | hex key; falls back to derived key |
| `NEXT_PUBLIC_APP_URL` | links, tracking, unsubscribe | set to production URL |
| `COCKROACH_ADMIN_EMAILS` | admin allowlist | legacy name, still the admin gate input |

## Auth & authorization model

- Supabase Auth: email/password + Google + Microsoft OAuth.
- `src/middleware.ts` protects `/dashboard/**`, `/onboarding`, etc.
- API routes: `requireAuth` (any user) / `requireAdmin` (role metadata +
  email allowlist) from `src/lib/middleware/api-auth.ts`.
- Row security: RLS policies per tenant table via `supabase-rls-fix.sql`;
  server actions use the cookie-authenticated client so RLS applies.
- Known gap (Phase 2): pipeline stage state lives on the shared `investors`
  table until `user_pipeline_entries` lands.

## Data flows (operator view)

1. **Ingestion:** `node scripts/edgar-bulk-fast.js [--13f|--form-d|--stats]` →
   normalize → Supabase `investors` → CSV/JSON backup in `backups/`.
2. **Fit scoring:** `npx tsx src/scripts/qualify-investors.ts` (deterministic,
   explainable; writes `fit_score`, breakdown, `outreach_readiness`).
3. **Outreach:** draft (NIM) → founder approval → send (Gmail/Graph/SMTP with
   compliance footer + tracking) → `email_messages` + tracking events →
   reply polling updates health metrics.
4. **Real-time:** Convex mutations from pipelines/jobs; dashboards subscribe.

## Verification & tests

```bash
npm run typecheck    # must be 0 errors
npm test             # 44 offline unit tests; integration suite self-skips
npm run build        # production build gate
```

Test map: `db-shim.test.ts` (SQL translation contract + documented failure
modes), `email-sender.test.ts` (provider routing, MIME attachments, refresh,
compliance), `email-crypto.test.ts`, `email-tracking.test.ts`,
`fit-scoring.test.ts`, `security.test.ts` (integration; needs dev server on
:3456, auto-skips otherwise).

## Routine operations

| Task | Command / procedure |
|---|---|
| Run locally | `npm run dev` → http://localhost:3456 |
| Regenerate Convex types | `CONVEX_DEPLOYMENT=… CONVEX_DEPLOY_KEY=… npx convex codegen` (run from repo root) |
| Restore paused Supabase | dashboard → Restore → run runbook Phase C checks |
| Full DB provisioning | `docs/DATABASE-SETUP-RUNBOOK.md` (follow order exactly; `supabase-production-fixes.sql` is destructive) |
| Redeploy | push to `main` (Vercel auto-deploy) after env/schema changes are in place |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Failed to fetch" on auth | Supabase project paused/removed | restore project; verify with `nslookup <ref>.supabase.co` |
| Onboarding doesn't persist | RLS policies missing on `company_profiles` | run `supabase-rls-fix.sql`; verify via runbook Phase C |
| Query returns `[]` unexpectedly | SQL outside shim's subset, or Supabase error logged | check server logs for `[db]`; prefer typed client for new code |
| Convex type errors | stale generated types | re-run codegen with deployment env |
| Attachments not received | fixed Sept 2026 (MIME/Graph); verify version deployed | regression tests exist in `email-sender.test.ts` |

## Known incomplete work (honest status)

- Shell pages: `/dashboard/meetings`, `/dashboard/ai-activity` (UI without real data).
- Billing: architecture + ledger done; Stripe adapter stubbed.
- Search: `ilike`-based; tsvector upgrade planned.
- No CI pipeline yet (build/typecheck/test gates run locally).
- Docs elsewhere in `docs/` may predate the Supabase-primary migration — treat
  this file, `ARCHITECTURE.md`, the runbook, and the audit as authoritative.
