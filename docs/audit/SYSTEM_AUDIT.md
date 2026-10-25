# Capital OS — System Audit

**Date:** October 24, 2026 · Read-only audit; no production changes were made.
**Codebase audited:** `main` @ `4f93b38` (2026-09-30) **plus 22 uncommitted files** carrying in-flight work (reply-understanding, analytics distributions RPC, auth-SMTP watchdog, Apollo contacts pipeline, migrations 012/013).

## 1. What Capital OS is (verified against code, not docs)

An AI-powered **fundraising operating system for startup founders**: sign up → 7-step company onboarding → discover investors from an SEC-EDGAR/IAPD-derived database → deterministic explainable fit scoring → AI research + personalized outreach drafts → founder-approved sending via Gmail/Graph/SMTP with tracking → 11-stage pipeline, campaigns, sequences, analytics, admin suite, credit-based billing architecture.

It is a **founder-side** product. All "investor" features are for discovering and contacting investors, not for investors managing deal flow.

Scale today (live-verified 2026-10-24 via service-role REST against production project `tvekoojdilkjptjzpvqo`):

| Probe | Result |
|---|---|
| `investors` rows | **18,995** (18,918 active) |
| investors with email / linkedin / fit ≥ 80 | **0 / 0 / 0** |
| `raw_records` (staging) | 16,840 |
| auth users (first page) / `profiles` | 200+ / 314 |
| `company_profiles` / documents / team members | 3 / 4 / 3 |
| `email_accounts` / `email_messages` | 3 / **0** |
| sequences, enrollments, campaigns, tracking events | all 0 |
| `duplicate_candidates` pending | 10 |
| `background_jobs` | 208 (mostly nightly security suites + credential-health probes) |
| `admin_audit_log` | 76 |
| signups | occurring today (2026-10-24, several within minutes) |

## 2. Architecture as actually built (verified)

- **Next.js 16.3 App Router + React 19 + Tailwind 4**, deployed on Vercel (`capital-os-nine.vercel.app`). 53 pages, ~70 API routes, ~52K LOC. Production build **compiles successfully** (verified: 126 static pages generated in run of 2026-10-24).
- **Supabase is the sole datastore and auth provider** (project `tvekoojdilkjptjzpvqo`, live and healthy). 30+ tables (36 core tables across migrations 001–013 + RLS lockdowns 010/011), RLS on all tenant tables, pgvector search columns present.
- **Convex is dead weight.** `convex/` does not exist in the working tree and `src/` contains **zero references** to Convex. README and ARCHITECTURE.md still claim "Convex is the real-time layer" — stale. Everything runs through Supabase + server actions/routes now. `.convex/` is leftover local build cache; `env-convex.json` is legacy (redacted).
- **AI:** NVIDIA NIM (`integrate.api.nvidia.com`) with key rotation and `AI_MOCK_MODE`; OpenRouter used in the (committed) investor intelligence pipeline for qualification. In-flight work adds nothing new here.
- **Email:** Gmail API, Microsoft Graph, custom SMTP (nodemailer), IMAP-based reply polling (imapflow/mailparser), AES-256-GCM-encrypted OAuth tokens, open/click tracking, CAN-SPAM footer, suppression, warmup, health scoring.
- **Testing:** Vitest. Verified run 2026-10-24: **87 tests passed, 61 self-skipped** (authflow + security suites require a live dev server; they run nightly against production via GitHub Actions).
- **CI:** `.github/workflows/security-nightly.yml` (03:15 UTC) runs the access-control + authflow suites against **production** with GitHub-issue/Slack/Resend alerting; `auth-smtp-watchdog.yml` is new and uncommitted.

## 3. Feature inventory by functional area

Status legend: Complete / Partial / UI only / Backend only / Missing / Broken / Unverified (as defined in the audit brief). "Verified" evidence is stated per row.

### 3.1 Identity & onboarding

| Feature | Files / tables | Status | Evidence & remaining work |
|---|---|---|---|
| Email/password signup, login, logout | `src/app/(auth)/*`, `supabase.auth`, `src/lib/supabase/*` | **Complete** | Live probe 2026-10-24: `/signup` 200, session flows in `authflow.test.ts` run nightly against prod; signups occurring today. Password reset verified in runbook E2E (2026-09-27). |
| Google / Microsoft OAuth sign-in | `/api/auth/google*`, `/api/auth/microsoft*` | **Partial** | Code complete; redirect URIs registered for prod (docs/GOOGLE-OAUTH-PRODUCTION-SETUP.md). **Unverified on live today** — no MCP/browser access to complete an OAuth round trip during this audit; needs one manual click test. |
| Password reset | `/forgot-password`, `/reset-password` | **Complete** | Enumerability/tests in authflow suite (429 quota behavior tested); reset email arrives per AUTH-SMTP-SETUP once custom SMTP configured — **SMTP setup is in-flight (uncommitted)**. |
| 7-step onboarding wizard | `/onboarding`, `company_profiles` (24 cols, UNIQUE(user_id)) | **Complete** | Full E2E passed on production 2026-09-27 (runbook Phase F), incl. RLS persistence + readiness score. |
| Startup profile pages | `/dashboard/startup`, `/start[up]/edit` | **Complete** | Backed by `company_profiles`; old I002 hardcoded-data issue resolved. |

### 3.2 Investor intelligence (discovery & qualification)

| Feature | Files / tables | Status | Evidence & remaining work |
|---|---|---|---|
| Investor list/search/facets | `/api/investors*`, `investors` table, search_vector + pgvector | **Partial** | Endpoints verified live (200; faceted filters; pagination; `audit-pages.cjs` returned 100 rows with full field surface incl. `search_vector`, `thesis_embedding`, IAPD columns). **The dataset itself is the gap:** 18,995 records, **0 emails/linkedins/fit≥80** — EDGAR/IAPD fund-and-firm names, no contactable people. tsvector/pgvector present; hybrid-search quality on real queries **Unverified**. |
| Investor detail + AI research | `/dashboard/investors/[id]`, `/api/investors/[id]/research`, NIM | **Complete** (mechanism) | Research generation via NIM with fallback chain; works in mock mode offline. |
| Deterministic fit scoring (7-factor, explainable) | `src/lib/services/investor/fitness*`, `fit-scoring.test.ts` | **Partial** | Scoring logic + 5 unit tests green. But batch qualification has not produced scores ≥80 and the current dataset lacks contactability (10% of score). `section image` note: the "qualification notes" column exists. |
| Saved investors / saved filters / notes | `saved_investors`, `saved_filters`, notes via `data_change_log` | **Complete** | Notes-insert production bug was caught by the nightly suite and fixed (commit 1bef7c9). Suppression/warmup IDOR probes green. |
| Pipeline (11 stages) | `/dashboard/pipeline`, `/api/investors/pipeline`, `user_pipeline_entries`, `pipeline_events` | **Complete** (verified live) | `audit-pages.cjs` live probe: stage summary 200 (discovered=6,810, qualified=12,108, others 0); per-stage detail 200. Two-tenant isolation harness 44/44 green. **Note:** stage summary counts derive from batch `outreach_readiness`, not user moves — semantics differ from per-founder pipeline entries; the per-user state model exists and is DB-verified (runbook). |
| Batch ingestion (EDGAR 13F/Form-D/N-CEN, IAPD) | `scripts/edgar-bulk-fast.js`, `src/scripts/*`, `raw_records`, IAPD converter | **Partial** | Committed pipeline ingested → 18,995 investors, 16,840 raw records. In-flight (uncommitted) changes to `ingestion.ts`/`normalization.ts`/`process-raw-records.ts` fix jsonb double-encoding in the DB shim (root cause of unusable `raw_data`). Ongoing: vendor the full IAPD monthly cycle; monthly freshness cron referenced in commit 6ebc984. |
| **Contact enrichment (Apollo/ZeroBounce)** | `scripts/apollo-contacts-pipeline.js` (**uncommitted**), `docs/GO-LIVE-PLAN.md` (**uncommitted**) | **Missing in committed code** — the single biggest gap | Go-live plan depends on it: filter Apollo CSV → infer domains/emails → verify (ZeroBounce pay-per-verify) → stage as `raw_records[source_provider=apollo-contacts]` → promote. Without contact data the outreach engine has nothing to send. |
| Duplicate detection/review | `duplicate_candidates`, `/admin/review/duplicates` | **Complete** (mechanism) | 10 pending in prod; review UI + API exist; admin dedup route gated `requireAdmin`. |

### 3.3 Outreach & campaigns

| Feature | Files / tables | Status | Evidence & remaining work |
|---|---|---|---|
| AI email drafting | `/api/outreach/draft`, NIM, `outreach_readiness` | **Complete** (mechanism) | Parser robustness fixed in Phase 1; drafts are founder-approved only. Drafts persist (localStorage + DB). |
| Sending (Gmail/Graph/SMTP + attachments) | `src/lib/services/email/sender*`, `email_messages` | **Complete** (mechanism), **Unused in practice** | Attachment bug fixed Sept 2026; MIME/Graph tests green (13 sender tests). Production shows **0 emails ever sent**; 3 connected `email_accounts`. Custom SMTP CHECK-constraint fix landed (allow `custom_smtp`). |
| Open/click tracking, unsubscribe | `/api/track/*`, `/api/unsubscribe`, `email_tracking_events` | **Complete** (mechanism), **Unused** | 8 tracking tests; no-op unsubscribe bug fixed (commit 0a89fe8). Zero production events — because nothing has been sent. |
| Reply detection & reply-understanding | `reply-poller.ts`, `reply-understanding.ts` (**uncommitted**), `reply_insights`, migration 012 (**uncommitted**) | **In flight** | Poller via IMAP; AI classification of interest level + suggested draft; tests exist (`reply-understanding.test.ts`, 8 passing offline). Requires migration 012 + Supabase Auth SMTP watchdog (also in-flight). |
| Campaigns, sequences, enrollment | `/dashboard/campaigns*`, `campaign_sequence_*` tables | **Complete** (mechanism), **Unused** | Sequence create/execute endpoints + stop-on-reply + business-hours scheduling; all tables empty in prod. |
| Outreach metrics / email analytics / distributions RPC | `/dashboard/outreach/metrics`, `/api/email/analytics`, migration 013 (**uncommitted**) | **In flight** | Analytics page refactor (−104 lines) + distributions RPC migration are uncommitted; **must be applied to the DB before deployment** or analytics calls will 404 the RPC. |
| Email health (warmup, domain checks, suppression, credential-health probe) | `/dashboard/email-health/*`, `email_warmup`,`email_suppression_list`, `credential-health.ts` | **Complete** | Nightly Gmail grant-health probe live-verified via `background_jobs` (208 rows incl. credential_health + security_nightly). Suppression round-trip tested in smoke suite. |
| Meetings | `/dashboard/meetings`, `/api/dashboard/meetings` | **Partial** | Now backed by a real API (meeting-readiness investors) + `meetings/schedule` link generation; no calendar integration (documented "Planned"). |
| AI activity / credits | `/dashboard/ai-activity`, `/api/dashboard/ai-activity`, `credit_ledger` | **Complete** | Reads real `credit_ledger` entries (page verified fetching `/api/dashboard/ai-activity`). Ledger writes service-only. `billing_events` empty (no payments yet). |

### 3.4 Billing & monetization

| Feature | Files / tables | Status |
|---|---|---|
| Plans + credits + ledger | `billing_plans` (3 rows), `user_subscriptions` (3), `credit_costs` (8), `credit_ledger` | **Complete** (architecture); reads work |
| Stripe founding-member checkout + webhook | `/api/founding-member/{checkout,webhook,status}`, `/founding-member` | **Complete** (code) — signature verification via `stripe.webhooks.constructEvent`; **Unverified against live Stripe** (no keys configured at audit time; `billing_events` = 0). |

### 3.5 Admin & operations

| Feature | Status | Evidence |
|---|---|---|
| Admin suite (12 pages: users, investors, firms, finance, AI, system, audit-logs, data-sources, scrape, duplicates, intelligence, data-health) | **Complete** (mechanism) | All admin routes `requireAdmin` — statically scanned and live-401/403-matrix tested nightly; role-change endpoint IDOR-probed; allowlist + role bootstrap logic fixed Oct (setup-status commits). |
| Waitlist | `waitlist` table + `/api/waitlist` | **Complete** (mechanism); row count not probed live; waitlist admin read is `authenticated`-read per grant matrix (see Security doc — minor). |
| Nightly security suites + alert channels | `security-nightly.yml` | **Complete**; runs nightly against production; alert issue/Slack/Resend implemented (Slack/Resend self-skip until secrets set). |
| Smoke test on demand | `scripts/smoke-prod.cjs` (17 assertions) | **Complete**; resilient to network flakes (commit 262e26c). |

### 3.6 Public site

| Feature | Status | Evidence |
|---|---|---|
| Landing, privacy, terms, unsubscribe pages | **Complete** | 200s live-verified 2026-10-24. |
| Testimonials | **Partial** | Older audit flagged fabricated testimonials; not re-verified this audit (content not re-read) — treat as **Unverified**, check before launch marketing. |

## 4. Bugs and defects — current outstanding

Reproducible issues found/implied during this audit (severity, evidence, fix):

| # | Sev | Issue | Evidence | Fix |
|---|---|---|---|---|
| B1 | **High** | **No contactable investors.** 0 emails / 0 linkedins / 0 fit≥80 across 18,918 active investors. Outreach, campaigns, sequences, tracking, health — all idle by data starvation. | Live service-role counts (2026-10-24) | Ship + run the Apollo contacts pipeline (uncommitted), verify emails, batch-qualify. |
| B2 | **High** | **Committed code depends on uncommitted migrations.** The analytics page + `/api/dashboard/analytics` (in working tree) call `get_analytics_distributions` RPC (migration 013); reply-understanding needs migration 012; auth email delivery needs custom-SMTP watchdog work. | Uncommitted working tree diff; `analytics` payload shows zeros consistent with absent RPC | Commit code + migrations together; run 012/013 on prod before deploying. |
| B3 | Medium | README/ARCHITECTURE describe Convex as live real-time layer; `convex/` is gone; no import anywhere. | `grep -r convex src/` → 0 hits; directory absent | Regenerate docs; remove Convex env vars from Vercel. |
| B4 | Medium | Pipeline stage-summary counts come from shared `outreach_readiness` (6,810/12,108 = batch results), while per-user pipeline entries are separate. UI semantics ("your pipeline") vs data ("batch qualification state") are mixed. | `audit-pages.cjs` output equality with byReadiness ground truth | Decide display: user_pipeline_entries as the primary; render batch state as a separate "database status" signal. |
| B5 | Medium | Direct Postgres DNS (`db.<ref>.supabase.co`) does not resolve; pooler tenant exists in `aws-1-eu-west-1` but stored `SUPABASE_DB_PASSWORD` fails auth. Migration/backup scripts relying on direct PG are dead. | Local connection attempts 2026-10-24 | Rotate DB password; switch scripts to pooler hostname; document region. |
| B6 | Low | `middleware.ts` runs on legacy middleware; Next 16.3 build logs a middleware-to-proxy migration notice. | Build log | Schedule codemod (`npx @next/codemod middleware-to-proxy`) before Next 17. |
| B7 | Low | Nightly suites self-skip locally (61 tests skipped) — green "87 passed" is misleading without the dev server. | Vitest run output | Run integration suites against prod nightly (already done in CI); surface skipped counts in README badge. |
| B8 | Info | `investors.email` count query with `.not('email','is',null)` returns 0 — consistent with truly empty data, not a query bug (analytics zeros match). | Ground truth cross-check | — |

Previously-logged defects that are now **fixed and verified** (do not re-open): attachments silently dropped (Sept 2026, tests exist); CSRF hole on auth endpoints (caught by nightly suite, fixed with host-aware origin check); broken notes inserts (caught by nightly suite, fixed); cross-tenant RLS holes in `data_change_log`, SECURITY DEFINER functions, audit-log INSERT TO (migrations 010/011, two-tenant harness 44/44); `email_accounts.provider` CHECK rejecting `custom_smtp`.

## 5. Docs-vs-code drift (recurring theme)

| Document | Drift |
|---|---|
| README.md | Claims "Convex (real-time)" and "83K+ investor database" and "Stripe adapter stubbed" — real-time claim false (no Convex), DB is ~19K with zero contacts, Stripe checkout implemented. |
| ARCHITECTURE.md | Same Convex claim; "30+ tables" ok; diagram includes Convex box that no longer exists. |
| docs/14-feature-status.md, PRODUCTION-READINESS-REPORT.md, PROJECT-STATUS-REPORT.md (Aug 2026) | Superseded — many items listed "Critical" are done (migrations applied, RLS verified, security suites live). Keep for history only. |
| docs/DATABASE-SETUP-RUNBOOK.md, docs/11-security.md, docs/AUTH-SMTP-SETUP.md, docs/GO-LIVE-PLAN.md | **Authoritative and current** (Sept 27–30 + in-flight). |

## 6. Access limitations recorded

- Supabase official MCP connects to a **different account/project** (ORQ8, `gttkaxbcdtpsusmconxm`) — not usable to inspect the Capital OS project directly. Live verification was done via the service-role REST API from the repo's own env instead.
- Direct Postgres (pg port 5432 / pooler) unreachable with stored credentials (B5).
- Stripe/Resend/Upstash dashboards not accessible at audit time → "not configured or unverifiable" is recorded rather than assumed.
- OAuth round trip (Google Sign-in click-through) not executed during this audit.

## 7. Verified gates (executed 2026-10-24)

| Gate | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm test` (vitest) | 87 passed, 61 self-skipped (integration; suites are CI-covered nightly) |
| `npm run build` | Compiled successfully, 126 pages/routes generated |
| Production HTTP (landing/login/signup/privacy; protected-route 3xx→login; API 401s; cron 401 without secret) | All correct |
| Live API/data (pipeline summary & detail, analytics, investor list, ground-truth counts) | 200s and consistent numbers as tabulated above |
| Nightly suites (historical, per grid history) | Two production bugs previously caught/fixed; currently green per docs/security history (not re-run this audit) |
