# Capital OS — Architecture

> **Last verified against code:** September 26, 2026 (Phase 1 audit).
> Where older docs disagreed, this document follows the code.

## One-paragraph summary

Capital OS is a Next.js 16 (App Router) application deployed on Vercel.
**Supabase is the primary datastore and auth provider.** Convex provides
real-time job/metric/notification state. NVIDIA NIM provides LLM completions
behind a small client abstraction. EDGAR/Apollo/CSV pipelines feed the investor
database; Gmail / Microsoft Graph / SMTP send outbound email with open/click
tracking. A legacy CockroachDB deployment was replaced by Supabase; its
`query()/queryAs()` API is preserved through a SQL→Postgrest translation shim.

## System diagram

```
                        BROWSER (React 19, Tailwind 4)
                                   │
                    ┌──────────────┴──────────────┐
                    │   Next.js 16 App Router     │
                    │   53 pages · 70 API routes  │
                    └──────┬──────────────┬───────┘
                           │              │
             server actions│              │REST (service role)
                           ▼              ▼
                ┌────────────────┐   ┌────────────────┐
                │    SUPABASE    │   │     CONVEX     │
                │  (permanent)   │   │  (real-time)   │
                ├────────────────┤   ├────────────────┤
                │ Auth+OAuth     │   │ researchJobs   │
                │ PostgreSQL     │   │ scrapingJobs   │
                │ 30+ tables+RLS │   │ dashboardMetrics│
                │ Storage (docs) │   │ notifications  │
                └────────────────┘   └────────────────┘
                           ▲              ▲
        SQL→Postgrest shim │              │ subscriptions
        (src/lib/db.ts)    │              │
                ┌──────────┴──────────┐   │
                │  services/actions   ├───┘
                │  (business logic)   │
                └──────────┬──────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   NVIDIA NIM client   Email senders   Ingestion pipelines
   (key rotation,      Gmail API       EDGAR · Apollo · CSV
   mock mode)          MS Graph SMTP   normalization · dedup
                                       fit scoring
```

## Data ownership rules

| Concern | Owner | Notes |
|---|---|---|
| Users, sessions, OAuth identities | Supabase Auth | email/password + Google + Microsoft |
| Investors, firms, taxonomy | Supabase `public` schema | shared read, 83K+ rows |
| Per-user data (profiles, saved investors, campaigns, emails, documents) | Supabase tenant tables | **RLS enforced** via `auth.uid()` policies (`supabase-rls-fix.sql`) |
| Billing (plans, credits, ledger) | Supabase | architecture complete; Stripe adapter stubbed |
| Job progress, live metrics, notifications | Convex | reactive queries; no polling |
| AI completions | NVIDIA NIM via `src/lib/ai/` | key rotation, retries, `AI_MOCK_MODE` |
| Files (decks, documents) | Supabase Storage | PDF/PPTX generation via pptxgenjs + pdf-lib |
| Outbound email | Gmail API / MS Graph / SMTP | AES-256-GCM encrypted OAuth tokens; CAN-SPAM footer; open/click tracking |
| Investor acquisition | Node pipelines (`scripts/`, `src/scripts/`) | SEC EDGAR scraping; CSV/Apollo import; backups in `backups/` |

## The SQL→Supabase shim (important, and temporary)

`src/lib/db.ts` preserves the legacy CockroachDB API (`query`, `queryAs`,
`execute`, `transaction`, plus `getPoolStats`/`closePool` stubs) by regex-parsing
raw SQL and translating the recognized subset into Postgrest calls. Services
across the codebase depend on it.

**Current behavior (pinned by tests in `src/__tests__/db-shim.test.ts`):**

- SELECT / INSERT / UPDATE / DELETE / COUNT are translated.
- WHERE operators: `= $N`, `= 'lit'`, `= true/false/NULL/number`, `IN (...)`,
  `!= $N`, `> >= < <= $N` and numeric literals, `ILIKE/LIKE $N`,
  `IS NULL / IS NOT NULL`; `AND`-joined.
- ORDER BY / LIMIT / OFFSET translated. `NOW()` and literal resolution supported.
- SQL outside the supported subset **logs a warning and returns `[]`**.
- Supabase errors are **logged and returned as `[]`** rather than thrown.

Phase 2 plan: migrate data access to the typed Postgrest query builder (or direct
SQL via a Postgres connection) and delete the parser. Until then, this failure
mode is a **known landmine** — new code should prefer the typed client directly.

## Request flows

### Discovery → fit (read path)
`/dashboard/investors` → `/api/investors` (requireAuth) → Supabase `investors`
with filters/facets → deterministic fit scoring (`computeFitScore`, 7 factors:
sector 25%, stage 20%, geography 15%, check size 15%, data completeness 10%,
contactability 10%, recent activity 5%) with per-factor explanations.

### Onboarding (write path)
`/onboarding` wizard → `updateCompanyProfile` server action →
cookie-authenticated Supabase client → RLS (`auth.uid() = user_id`) →
`company_profiles` (24 columns; `UNIQUE(user_id)`; readiness score computed
server-side). Setup order and verification queries: see
`docs/DATABASE-SETUP-RUNBOOK.md`.

### Outreach (external side effects)
Draft: `/api/outreach/draft` → NVIDIA NIM → response parsed into subject/body
(fallback extraction strategies) → founder reviews. Send: `/api/outreach/send` →
`sendEmail` → health guard + suppression check → provider (Gmail multipart
MIME with attachment parts / Graph `fileAttachment` / SMTP) → CAN-SPAM footer +
tracking pixel/link injection → `email_messages` logged. Founder approval is
always required; nothing is auto-sent.

### Pipeline (per-user tracking)
`/dashboard/pipeline` → `/api/investors/pipeline` → stage summary + moves.
Stage definitions live in `src/lib/services/pipeline/stages.ts` (single source
of truth; route files may only export handlers). **Known flaw (Phase 2):**
stage state currently rides on the shared `investors` table (`pipeline_stage`,
legacy `outreach_readiness`), so per-founder isolation is incomplete until the
`user_pipeline_entries` migration lands.

## Environments

| Env | Stack | Notes |
|---|---|---|
| Local | `npm run dev` (port 3456) | `.env.local`; `AI_MOCK_MODE=true` avoids AI costs |
| Production | Vercel (`capital-os-nine.vercel.app`) | env vars set in Vercel; redeploy after changes |
| Supabase | free tier | **Projects get auto-paused on inactivity — this took production down once (Sept 2026). Restore = dashboard → Restore, then run `docs/DATABASE-SETUP-RUNBOOK.md` Phase C verification.** |
| Convex | free tier (`exciting-bat-92`) | `npx convex codegen` needs `CONVEX_DEPLOYMENT` + `CONVEX_DEPLOY_KEY` |

## Key source map

| Path | Role |
|---|---|
| `src/app/(auth)/`, `src/middleware.ts` | auth pages + route protection |
| `src/app/api/**` | 70 REST routes (requireAuth / requireAdmin) |
| `src/lib/actions/*.ts` | server actions (auth → data) |
| `src/lib/services/investor/` | ingestion, normalization, dedup, fit scoring |
| `src/lib/services/email/` | senders, crypto, tracking, suppression, health |
| `src/lib/services/pipeline/stages.ts` | pipeline stage definitions |
| `src/lib/db.ts` | SQL→Postgrest shim (see above) |
| `src/lib/ai/` | NIM client: key rotation, models, retries |
| `convex/` | real-time jobs/metrics/notifications |
| `supabase/migrations/`, `supabase-*.sql` | schema + RLS (apply per runbook) |
| `scripts/`, `src/scripts/` | EDGAR/CSV/Apollo data tooling |
