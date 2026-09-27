# Capital OS — Phase 1 Audit & Stabilization Report

**Date:** September 26, 2026
**Engineer:** Buffy (Codebuff) — full engineering ownership
**Status:** Stabilization complete. One P0 infrastructure decision pending (see §4).

---

## 1. Platform health — before vs after

| Check | Before | After |
|---|---|---|
| TypeScript | 45 errors across 14 files | **0 errors** |
| Production build | Untested locally | **Passes** (53 pages, 70 routes) |
| Test suite | Hung indefinitely (no server) | **17 offline tests pass, 39 integration tests self-skip** |
| Git | No repository at all | **Initialized, grafted onto GitHub history, 2 commits** |
| Secrets in repo | Live DB password, admin password, Convex deploy key | **Redacted** |
| Email attachments | Accepted by UI/API, **silently dropped** | **Actually sent (Gmail MIME + Graph)** |
| Production backend | Unknown | **DEAD (Supabase projects deleted)** — see §4 |

---

## 2. What Capital OS is (verified against code, not docs)

An AI-powered fundraising OS for startup founders: company onboarding → investor
discovery across an 83K-investor EDGAR/Apollo-sourced database → deterministic
6-factor fit scoring with explanations → AI research + personalized email drafting
→ Gmail/Microsoft/SMTP sending with open/click tracking → 11-stage fundraising
pipeline → campaigns/sequences → admin suite. Billing architecture (plans +
credit ledger) exists; Stripe adapter is stubbed.

**Architecture as actually built** (docs disagree with code; code wins):

- Next.js 16 App Router + React 19 + Tailwind 4 (53 pages, 70 API routes, ~52K LOC)
- **Supabase is the primary datastore** (not CockroachDB as README claims). The
  CockroachDB `query()`/`queryAs()` API is preserved via `src/lib/db.ts`, a shim
  that regex-parses raw SQL strings and translates them to Supabase REST calls
- Convex (alive: `exciting-bat-92`) carries real-time job state, metrics, notifications
- NVIDIA NIM is the only AI provider, with mock mode (`AI_MOCK_MODE`)
- Auth: Supabase (email/password + Google/Microsoft OAuth); middleware guards dashboard

---

## 3. Defects found and fixed this phase

### Convex (would break scraping job tracking)
1. Schema defined table `scrapeJobs`; all code queried `"scrapingJobs"` → renamed
   schema table to `scrapingJobs` (matches all call sites).
2. `researchJobs.list` reassigned a query after `.withIndex()` — invalid in Convex;
   split into two typed query paths.
3. `rawInvestorsOps.listByStatus` used `.skip()` which doesn't exist on Convex
   `OrderedQuery` → over-fetch + slice.

### Email pipeline (silent feature failure — violates "no fake functionality")
4. **Attachments were silently dropped.** The outreach UI advertises up to 5
   attachments (10 MB); the send route pre-converted them to Buffers; then:
   - `sendViaGmail` built a text/html-only MIME body — attachments never entered the message.
   - `sendViaMicrosoft` omitted the `attachments` field entirely.
   A founder attaching a pitch deck would see "sent" while the investor received
   nothing. Fixed: Gmail now builds proper `multipart/mixed` with RFC-2045-wrapped
   base64 parts; Microsoft now passes `fileAttachment` objects; SMTP decodes
   base64 for nodemailer. Attachment format standardized to base64 across all senders.
5. `unsubscribe` and `meetings/schedule` used `.catch()` on awaited Postgrest
   builders — Supabase resolves `{data, error}` instead of rejecting, so these
   fallbacks were dead code. Rewritten to check `error` / use try-catch.

### Types and UI correctness
6. `InvestorRecord` missing sector/stage/check/fund fields (outreach page).
7. `AnalyticsData` missing `withLinkedIn` (analytics page renders it).
8. `SmtpSendParams` missing `attachments`.
9. `PageHeader` called with nonexistent `subtitle` prop in email-health analytics.
10. Outreach draft parser: invalid `s` regex flags on ES5 target, `match.index` possibly-undefined.
11. `RealtimeDashboard` possibly-undefined `scrapingJobs.total`.

### Test infrastructure
12. `security.test.ts` is an integration suite requiring a live dev server; with no
    server it hung indefinitely on TCP timeouts (the "npm test hangs" bug). It now
    probes the server with a 3s timeout and `describe.skipIf`s the whole suite when
    absent. Added three offline unit suites: AES-256-GCM crypto round-trip/tamper,
    deterministic fit-scoring contract, tracking pixel/link injection.

### Repository
13. No git repo existed. Initialized `main`, fetched GitHub history, grafted the
    working tree onto it (remote was only 2 pitch-deck commits behind; no work lost).
14. Redacted live credentials from `SYSTEM.md` (DB password, admin password) and
    `env-convex.json` (deploy key). `.env.local` verified gitignored.

---

## 4. P0: production backend is dead — decision required

Browser E2E against the deployed app (`capital-os-nine.vercel.app`):

- Landing page: fully functional, zero console errors. ✅
- Signup flow: fill form → submit → **"Failed to fetch"**. ❌

Root cause (verified via Google DNS `nslookup`, so not a local DNS artifact):

- The deployed app calls `keepilpdaphpkofqgcae.supabase.co` → **NXDOMAIN**
- Local `.env.local` references `wdvhraurmpvncrgnmmbf.supabase.co` → **NXDOMAIN**

Both Supabase projects no longer exist (deleted/paused-permanently/removed).
Convex (`exciting-bat-92.convex.cloud`) is alive (HTTP 200).

**Data recovery position:**
- Investor data is NOT lost: physical CSV/JSON backups exist on disk
  (`backups/edgar/`, `backups/edgar-mega/` — 13F-HR, Form D, N-CEN, mega CSV,
  Convex archive). The scraper pipeline can also regenerate from SEC EDGAR for free.
- User/account data (profiles, waitlist, signup) was small and is lost with the
  project — acceptable for a pre-launch product.

**The connected Supabase account (org "NEOP") holds one project: `muwocrmdcyzmwqjvvjfj`,
which is a different product** (election-observation data: polling units, INEC feeds,
result submissions). It must NOT be repurposed for Capital OS. Side observation:
its `spatial_ref_sys` has RLS disabled — low-risk PostGIS metadata, but worth
enabling RLS on.

**Path forward (recommended):** create a fresh free-tier Supabase project
(verified $0/month) in the NEOP org, apply the migration chain
(`supabase/migrations/001–008` + `supabase-rls-fix.sql` + pipeline-stage SQL),
restore investors from the on-disk backups, update env vars in Vercel, redeploy.
Requires user approval to create the project (spends nothing, but creates a
resource under their account).

---

## 5. Architecture issues logged for Phase 2 (not yet fixed)

1. **Pipeline state is on the shared `investors` table.** The uncommitted WIP I
   inherited adds `pipeline_stage` to `investors` (shared across all founders).
   Two founders tracking the same investor overwrite each other. Correct model:
   per-user `user_pipeline_entries` table (user_id + investor_id + stage + notes),
   with `pipeline_events` as the audit trail. The shipped fallback (`outreach_readiness`)
   has the same flaw.
2. **The SQL→Supabase shim is a reliability landmine.** `src/lib/db.ts` regex-parses
   raw SQL and **silently returns `[]`** for any pattern it can't parse. Every
   service and 24 scripts depend on it. Phase 2 should migrate data access to the
   typed Postgrest query builder (or pg-gatewaway-style direct SQL), deleting the
   parser.
3. **Docs contradict the code.** README says CockroachDB-primary; SYSTEM.md says
   "Convex everywhere"; reality is Supabase-primary. `MASTER_DEVELOPMENT_SPEC_V1.1.md`
   is an 18-line stub. Docs must be regenerated from the code.
4. **AI is single-vendor (NVIDIA NIM)** with key rotation but no provider abstraction,
   no structured outputs, no tool calling. Required before the AI execution layer
   (Phases 3–5 of the master plan).
5. **Two shell pages** (`/dashboard/meetings`, `/dashboard/ai-activity`) render
   UIs not backed by real data — violates the no-fake-functionality rule.
6. **Onboarding persistence depends on RLS policies** that were never verified
   against a live project (was flagged in the Aug 28 readiness report; couldn't be
   tested — the backend is dead).

---

## 6. Phase 2 plan (ready to execute)

1. **Resolve §4** (create Supabase project, migrate, restore data, redeploy) — blocked on user approval.
2. **Fix pipeline multi-tenancy**: `user_pipeline_entries` + events table; update the new pipeline API.
3. **E2E the golden path** on the redeployed app: signup → onboarding → discover → save → pipeline → draft → (sandbox) send.
4. **Kill the silent-failure mode** of `db.ts` (throw on unparseable SQL) and start migrating hot paths to the typed client.
5. Regenerate docs from code; expand unit tests to actions/services.
