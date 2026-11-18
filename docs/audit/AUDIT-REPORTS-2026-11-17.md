# Capital OS — Combined Audit Report & Frontend Work Plan

**Date:** 2026-11-17. Prepared by the frontend/design agent for the backend
agent and the product owner. Three completed audit tracks (security,
architecture & system design, UI/UX) + the frontend task list from start to
finish. A fourth track (code quality: typecheck/lint/test discipline) was
still running when this was written and will be appended on completion.

**How to use this document:** the backend agent reads §1–§3 for their handoff
queue (every finding has file:line evidence). The owner reads §4 for the
frontend task list. Ongoing coordination lives in `AGENT-COORDINATION.md`
(repo root). Frontend-specific triage lives in
`docs/audit/FRONTEND-AUDIT-TRIAGE-2026-11-17.md`.

> ⚠️ **Corpus update in effect (AGENTS.md, 2026-11-17):** the corpus is now
> **24,379 active records** — 18,995 firm records (SEC 13F/Form D/IAPD) plus
> **5,461 SEC Form D venture funds** imported 2026-11-17; **4,933** have an
> email address; **12,102 person rows / 4,205 distinct named people** from
> Form D related persons (not background-checked or contact-verified).
> Every landing-page number must be updated to these measured values in the
> same commit that lands the copy change. The landing page still shows the
> old 18,995/4,921 numbers — task T3 covers this.

---

## §1 Security audit (completed)

Scope verified: 99 route files under `src/app/api`, auth middleware, db shim,
RLS migrations, Stripe webhooks, email crypto/sending/tracking, rate
limiting, env/git hygiene.

### HIGH

**H1 — Cross-tenant IDOR: `/api/jobs/[id]` (GET/DELETE/POST) — no ownership check**
- `src/app/api/jobs/[id]/route.ts:27-34` — `getJob(id)` returns any job to any authenticated user; `src/lib/jobs/runner.ts:284-290, 319-340` — `getJob`, `cancelJob`, `retryJob` query `job_queue WHERE id = $1` with no `created_by` filter.
- Attack: user A reads (payload may contain user data), cancels or re-queues user B's jobs by iterating IDs.
- Fix: thread `user.id` into `getJob/cancelJob/retryJob` and add `AND created_by = $2`; return 404 on mismatch.

**H2 — Tenant isolation is 100% application-level; service role used for every user request (RLS bypassed on the app path)**
- `src/lib/db.ts:22-30` — the shared query layer creates a service-role Supabase client used by all services; `src/lib/db.ts:94-100` — `queryAs(userId, …)` silently ignores `userId` (dangerous false sense of scoping).
- Nearly every route independently builds `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` (e.g. `src/app/api/investors/[id]/route.ts:19-22`, `src/app/api/deck/generate/route.ts:23-26`, `src/app/api/outreach/send/route.ts:32-35`).
- Consequence: RLS policies in `supabase/migrations/*` (58 `ENABLE ROW LEVEL SECURITY` statements, user-scoped) never apply to app traffic — they only protect the anon-key path. One forgotten `.eq("user_id")` = full cross-tenant read/write with no DB backstop.
- Fix: use the SSR user client (`src/lib/supabase/server.ts`) for tenant data (correct pattern exists in `src/app/api/readiness/route.ts:21-35`), or add a defense-in-depth RPC layer; fix `queryAs` to either enforce scoping or remove it.

**H3 — Concrete cross-tenant bug: `/api/email/domain-check` acts as another user**
- `src/app/api/email/domain-check/route.ts:32-41` and `:87-96` — `select("user_id").from("email_accounts").limit(1)` with no user scoping; the first account row in the DB (any tenant's) becomes the `userId` for health lookups/writes. Also: no domain format validation, no rate limit, stored-health reads can return another user's cached data.
- Fix: `const userId = authUser.id`; validate domain with a hostname regex; add `RATE_LIMITS.api`.

**H4 — Email header injection in the Gmail raw-MIME sender**
- `src/lib/services/email/sender.ts:75-79, 110-116` — `Subject: ${params.subject}\r\n` and `To:` are string-concatenated into a raw RFC822 message uploaded to Gmail. `src/lib/validate.ts:69-78` — `subject: z.string().min(1).max(200)` does not strip CRLF, and `attachments[].name` is unbounded; filenames are interpolated into `Content-Type: …; name="${att.filename}"` (sender.ts:100) and `Content-Disposition` (:102).
- Attack: authenticated user submits subject `"Hi\r\nBcc: a@x.com, b@x.com…"` or an attachment name containing CRLF → arbitrary header injection (Bcc spam through the victim's connected Gmail, spoofed headers).
- Fix: strip `/[\r\n]/` from subject and attachment names at the schema boundary; prefer nodemailer's `raw` builder for Gmail too (nodemailer at `smtp-sender.ts:267-270` already encodes headers correctly).

**H5 — OAuth connect callbacks: no `state` parameter validation (OAuth CSRF)**
- `src/app/api/auth/google/callback/route.ts:29-99` — exchanges `code` and upserts `email_accounts` with no state check; same for `src/app/api/auth/microsoft/callback/route.ts`.
- Attack: attacker starts a connect flow, sends the callback URL to a signed-in victim → attacker's mailbox gets linked to the victim's Capital OS account (`is_active: true`), enabling attacker-controlled sends from "victim" and reply polling of attacker's mail; or reverse.
- Fix: generate a cryptographically random `state` in `/api/auth/google/route.ts`, store in an httpOnly cookie, verify on callback.

**H6 — Token encryption silently falls back to a key derived from a PUBLIC value**
- `src/lib/services/email/crypto.ts:13-24` — if `EMAIL_TOKEN_ENCRYPTION_KEY` is unset, the AES-256-GCM key is `sha256(NEXT_PUBLIC_SUPABASE_URL)` — a public, guessable string. GCM/IV handling itself is correct (random 16-byte IV, auth tag stored), but a fail-open key fallback protects Gmail/Microsoft refresh tokens and SMTP passwords with no real secrecy.
- Fix: throw on missing key (fail-closed), never derive from public env; document key rotation. (`EMAIL_TOKEN_ENCRYPTION_KEY` is set in local `.env.local` — the risk is any env where it's absent.)

### MEDIUM

- **M1** — Unauthenticated, token-less unsubscribe accepts any email (`src/app/api/unsubscribe/route.ts:91-106`): `GET /api/unsubscribe?email=x@y.com` suppresses any address, unvalidated, unthrottled; mass-suppression attack possible. Fix: HMAC-signed token (email + message_id + secret), rate limiting.
- **M2** — Open redirect in click tracker (`src/app/api/track/click/[trackingId]/route.ts:28-42`): redirects to any `?url=` value (only checks `http(s)` prefix); app domain becomes a phishing relay. Fix: look up the destination stored for that `tracking_id`.
- **M3** — Predictable tracking IDs from `Math.random()` (`src/lib/services/email/tracking-supabase.ts:24-31`); not CSPRNG → open/click analytics spoofing. Fix: `crypto.randomBytes(12).toString('base64url')`.
- **M4** — Rate limiting: in-memory fallback per-instance, keyed only by `x-forwarded-for`, never by `user.id` (`src/lib/middleware/rate-limit.ts:112-127, 158`); `src/app/api/deck/generate/route.ts:9` imports `applyRateLimit` but never calls it — the most expensive AI route is unlimited. Fix: key authed endpoints by `user.id`, require Upstash in prod, wire deck route.
- **M5** — Credit ledger non-atomic double-spend race (`src/lib/billing/credits.ts:67-104`): read → compute in JS → write absolute value, no transaction or `WHERE credits_remaining >= cost` guard. Fix: atomic `UPDATE … SET credits_remaining = credits_remaining - $cost WHERE … AND credits_remaining >= $cost` or RPC, ledger row in same transaction.
- **M6** — Stripe webhook idempotency weak (`src/app/api/webhooks/stripe/route.ts:256-279`): signature verification correct, but no `event.id` dedup; re-delivered one-time Sprint events re-create/extend access windows. `founding-member/webhook` in-memory Set ineffective on serverless. Fix: persist processed event IDs keyed on `stripe_event_id` with unique constraint.
- **M7** — Admin bootstrap window = self-promotion path (`src/app/api/admin/setup/route.ts:103-146`): in the window where no admin exists, any authenticated user can add themselves to the allowlist or `set_role` themselves; TOCTOU race on `adminAlreadyConfigured()`. Fix: bootstrap via one-time CLI script or server-minted setup token.
- **M8** — Data-room share tokens stored in plaintext (`src/app/api/data-room/[token]/route.ts:179-183`): lookup is `eq("token", token)`; DB leak exposes all live share links. Fix: store only `token_hash` (unique index), look up by hash.
- **M9** — Zod coverage partial. Validated: `outreach/send`, `deck/generate`, `saved-filters`, several others. Not validated: `outreach/draft` (raw `request.json()` destructuring — `aiAnalysis`/`customInstructions` flow into the AI prompt verbatim, prompt-injection surface, `:113-114, :198-199`), `email/smtp/save` (no host/port constraints), `dashboard/campaigns/[id]` PATCH (free-text `status` written to DB, `:123-124`), `unsubscribe`. Fix: extend Zod schemas; strip CRLF everywhere user text becomes headers.

### LOW

- **L1** — `.env.vercel-token` holds a live Vercel token (`vcp_…`); gitignored, not committed ✅, but should be rotated and deleted after use (`.env.local` comments "rotate after use 2026-09-27"). Same hygiene for `.env.e2e.local` and `.env.local` (all correctly untracked; committed `.env.example`/`.env.local.template` are placeholders only ✅).
- **L2** — `supabase_logs.json` (449 KB) tracked in git; no tokens found, but a Supabase log export may contain user emails/PII. `git rm --cached` + gitignore.
- **L3** — Untracked local dirs `exports/`, `investor-intelligence/data/reports/*` contain scraped investor PII — must never be committed; extend ignore rules.
- **L4** — Git history contains a `Codebuff` AI-attribution commit (`75cfeef`) — violates repo authorship rules. No `.env*` secrets ever committed (verified ✅).
- **L5** — Investors corpus (including `email` fields) is served to any authenticated user by design (product data lake) — confirm no entitlement gating was expected.
- **L6** — `admin/users/role`, `admin/system-*` properly `requireAdmin` + double role-checked ✅; only `admin/setup` lacks `requireAdmin` (bootstrap design, see M7).
- **L7** — `RATE_LIMITS.auth` exists and used on `waitlist`; cron routes require Bearer `CRON_SECRET` (`cron/daily:26-31`) ✅.

### Positive observations

- Stripe main webhook verifies signatures against the raw body before any write.
- Data-room endpoint is the best-hardened surface in the repo (hashed tokens in logs, RPC-atomic access log, owner-scoped doc re-checks, short-lived signed URLs).
- No hardcoded secrets in tracked files (grepped `sk_live_`, `sb_secret_`, `vcp_`, `AIza`, `ghp_`, JWTs, private-key blocks, `whsec_` — documentation placeholders only).
- RLS migrations broadly enabled with user-scoped policies; `supabase-disable-rls.sql` is a deprecated stub that only prints a warning; `010_security_lockdown…` correctly tightened `data_change_log`, revoked EXECUTE on definer functions.
- `extractWebsiteIntelligence` (potential SSRF fetcher) has zero callers — dead code, no current SSRF surface.

**Security TOP-5:** H1 (one-line fix, immediate cross-tenant read/write) → H2+H3 (tenant-isolation architecture) → H4 (header injection) → H5 (OAuth state) → H6+M4 (fail-closed crypto + rate-limit hardening).

---

## §2 Architecture & system design audit (completed)

### STRENGTHS

1. **Unusually honest documentation culture** — `ARCHITECTURE.md:3` ("Last verified against code"), `SYSTEM.md:108-116` honest-status sections, documented Sept 2026 Supabase-pause incident. Most claims verified held up.
2. **The db shim has a pinned contract** — `src/lib/db.ts:80-88` throws on failed writes; reads degrade to `[]`; `src/__tests__/db-shim.test.ts` pins the translation subset. A documented, tested landmine rather than accidental.
3. **`scripts/migrate.cjs` is a real migration runner** — ledger table, SHA-256 checksums with `[CHANGED SINCE APPLIED]` drift detection, per-file transactions, rollback-on-failure, `--baseline` mode.
4. **CI is real** — `typecheck`, `npm test`, and `check-tracked-imports.cjs` (catches "file exists locally but never committed" — a failure mode this repo actually hit).
5. **Cron chain well-engineered** — Bearer `CRON_SECRET`, 300s-window sizing with resume-next-day semantics, partial-failure reporting.
6. **AI layer solid** — round-robin key rotation with rate-limit skip, retries, 45s timeout, per-task model config, `AI_MOCK_MODE`.
7. **Layering direction clean** — zero `services → actions` or `actions → api` imports; `pipeline/stages.ts` single source of truth.
8. **Send-path hygiene** — ownership checks before credit gates, refund-on-missing-enrollment, rate limits, Zod validation, AES-256-GCM token crypto.

### CRITICAL

**A-C1. Cross-tenant email sending in the sequence executor.**
- `src/lib/services/campaigns/sequence.ts:278-296` — `getPendingSends(limit)` has **no user filter**: selects all `campaign_sequence_enrollments` with `status='scheduled' AND next_send_at <= NOW()` across every tenant.
- `src/app/api/campaigns/sequence/execute/route.ts:28,58-126` — any authenticated user receives the global pending list, then `executeSend(…, userId, …)` uses **the caller's** `email_accounts` and deducts **the caller's** credits for **another founder's** enrollment — and sends it from the caller's mailbox.
- Also: no `maxDuration` and N sequential NIM calls in a loop — this route will time out on Vercel for large batches.
- Fix: scope `getPendingSends(userId)` and iterate per-user via cron, or move enrollment claiming into an atomic Postgres RPC.

**A-C2. Eight migrations exist only on disk — plus duplicate migration numbers.**
- Untracked in git: `004_company_profiles_billing.sql`, `014_investor_email_verified.sql`, `015_live_schema_reconciliation.sql`, `020_wave0_meetings_and_document_storage.sql`, `021_pipeline_owner_fk_set_null.sql`, `022_investor_provenance.sql`, `023_wave0_entity_split_and_lists.sql`, `024_pipeline_21_stages.sql` (under `supabase/migrations/`).
- Duplicate numbers with different content: `004_company_intelligence_billing.sql` (tracked) vs `004_company_profiles_billing.sql` (untracked); `014_send_audit_trail.sql` (tracked) vs `014_investor_email_verified.sql` (untracked).
- A fresh clone + `db:migrate` silently misses 8 migrations; production schema is not reproducible from git today. Commit canonical files, resolve duplicates, re-run `db:status`.

**A-C3. The documented tenancy model ("RLS enforced") is not the operating model.**
- 5 of 17 server-action files instantiate raw service-role clients — `src/lib/actions/campaigns.ts:26-31`, `copilot.ts`, `email-sequences.ts`, `email.ts`, `investor-research.ts` — bypassing RLS, protected only by manual `.eq("created_by"/"user_id", user.id)` clauses.
- Dominant API-route pattern is inline `createClient(…SERVICE_ROLE_KEY…)` + manual scoping in ~60 routes, vs 47 files on typed clients and 19 on the cookie client.
- README:124-125 and ARCHITECTURE.md:59-61 claim the cookie client → RLS path. Fix = same resolution as security H2: one client strategy, enforced.

### HIGH

- **A-H1.** Background-job subsystem is orphaned dead code: `handlers.ts:326` calls `jobRunner.start()` but nothing imports `handlers.ts`; `runner.ts:96` is a module-level `setInterval` poller that cannot survive Vercel serverless; `/api/jobs` is a public promise of background processing that silently doesn't exist. Decision needed: delete, or give it a real worker story (Supabase `pg_cron` + `pg_net`, or QStash/Inngest).
- **A-H2.** Credits read-modify-write double-spend (= security M5) — this is the revenue meter; concurrent refund + purchase can lose an increment; ledger insert failure swallowed (`credits.ts:117-119`).
- **A-H3.** Two parallel migration systems: 24 root `supabase-*.sql` files applied by hand per runbook while `migrate.cjs` manages only `supabase/migrations/`; runbook Phase B stops at migration 008 and still says the Convex project "is alive" (`DATABASE-SETUP-RUNBOOK.md:97`), contradicting `ARCHITECTURE.md:128`.
- **A-H4.** Two complete Stripe billing stacks: `/api/billing/{checkout,portal}` + `/api/webhooks/stripe` vs `/api/founding-member/{checkout,status}` + `/api/founding-member/webhook`, plus `src/lib/services/billing/stripe.ts`. Pick the canonical one; retire the other.

### MEDIUM

- **A-M1.** Four architecture docs, one actively wrong: `ARCHITECTURE_FINAL.md` describes a Supabase + Convex + "Python Workers" architecture that was never built. Delete or mark superseded. Accurate docs drifted: ARCHITECTURE.md says 53 pages/70 routes — actual 73 pages/94 routes; README says migrations 001–013 — actual 001–014 + 020–040.
- **A-M2.** Second dead SQL→Postgrest shim: `src/lib/supabase-query.ts` has zero importers.
- **A-M3.** Five ways to obtain a service-role client + two auth-guard helpers (`requireAuth/requireAdmin` ×71 routes vs `getCurrentUser` ×7 routes). Consolidate.
- **A-M4.** `@tanstack/react-query` in package.json with **0 usages**; 32 files raw-`fetch` their own API, 8 components call server actions directly. (Frontend decision point — see §4 T-series.)
- **A-M5.** Campaigns modeled as repurposed `data_acquisition_jobs` rows (`src/lib/actions/campaigns.ts:46-70`) with reinterpreted `status` and count fields — modeling smell on the core domain object.
- **A-M6.** Convex residue confirmed dead (`convex.json` = `{}`, no dep, 0 imports) but git tracks `convex.json`, `env-convex.json`, 4 Convex-era scripts; runbook contradicts.
- **A-M7.** 22 of 94 API routes lack `requireAuth/requireAdmin`; most legitimately public, but `dashboard/ai-activity`, `dashboard/campaigns`, `dashboard/campaigns/[id]`, `dashboard/outreach/metrics`, `dashboard/reports/export`, `readiness`, `saved-filters`, `saved-filters/alerts` are user-data routes relying only on inline `getCurrentUser` checks (verified they do check today — inconsistent with the documented guard pattern, easy to break when copied).

### LOW

- `next.config.ts:8-10` sets `typescript.ignoreBuildErrors: true` — the typecheck gate survives only because CI runs it separately.
- `vercel.json` has two cron entries both hitting `/api/cron/daily` (daily + weekly duplicate).
- Root-directory junk: pitch-deck artifacts, ~2MB marketing images, `angels-1000.csv`, stray JPGs.
- Three script locations (`scripts/` 153 files, `src/scripts/` 25, EDGAR logic also in `src/lib/services/scrapers/edgar.ts`).

**Data-access path count:** db-shim 39 files · typed clients 47 · inline service-role ~60 · cookie client 19 · direct `pg` 1 · second shim 0 (dead). The shim is load-bearing in billing and email-reply paths — cannot just be deleted; new code should not adopt it.

**Questions for owner:** (1) Who calls `/api/campaigns/sequence/execute` — is A-C1 live? (2) Which `004`/`014` migration is canonical? (3) Fold the 24 root SQL files into the `migrate.cjs` ledger? (4) Delete or rebuild `/api/jobs`? (5) Which Stripe stack is canonical? (6) `ARCHITECTURE_FINAL.md` — delete or mark superseded? (7) react-query: adopt or drop? (8) Is service-role-everywhere a deliberate trade-off to document, or migrate to the cookie client?

---

## §3 UI/UX frontend audit (completed)

### STRENGTHS

- Honest data rendering — "—" for null/unknown (`dashboard/page.tsx:33`, `analytics/page.tsx:137-139`); availability disclaimer with real counts (`investors/page.tsx:639-647`).
- Real loading states almost everywhere; `ui/Button` has proper loading/disabled coupling.
- Server-side auth gate in dashboard layout + client ErrorBoundary on every page.
- Landing code-split; hand-drawn static SVG chart (no recharts on landing); `prefers-reduced-motion` respected in Pricing.
- Pipeline optimistic stage updates with background reconciliation; lost-reason dialog; dataTransfer redundancy.
- Dark mode app-wide; sonner toasts consistently used.

### Design system findings (feeds T1/T2)

1. **Three competing token systems, none authoritative:** `src/styles/design-tokens.css` and `src/styles/design-system.css` are ~1:1 duplicates, **neither imported anywhere** (dead weight); `design-system.css:144-150` contains invalid CSS (`background: rgb 240 253 244;` — missing parens) in four `.ds-*-bg` classes. Real tokens in `globals.css` `@theme`, which also holds an unused purple `--color-primary-*` ramp (template leftover). `design-tokens.css:37-67` redefines Tailwind defaults with colliding values.
2. **105 files hardcode hex values** — brand dark `#06201b` inlined 30+ times; `Button.tsx` mixes `bg-[#06201b]`, `bg-lime-500`, and theme token `bg-danger-500` in one component.
3. **817 `!important` overrides** — root cause: opinionated bare-element base styles in `globals.css:109-172`.
4. **UI kit barely adopted:** `EmptyState` ×4 files, `Skeleton` ×2, ad-hoc dialogs despite `ui/Modal`.

### Icon conflict

`material-symbols` imported in `src/app/layout.tsx:1` with **zero usages** — entire variable icon font ships on every page load. remixicon is the real system (~100 files). Remove.

### Interaction states

- **[Hotfix] API failure renders as "fresh account":** cockpit (`dashboard/page.tsx:140-152`) and investors (`investors/page.tsx:366-372`) swallow fetch errors into empty states — a user during an outage sees "No investors yet" with no banner/retry. Facet/filter fetch failures silently swallowed.
- **[Hotfix] Dead admin buttons:** `admin/system/page.tsx:253,255` "Clear Cache" and "View Logs" have `action: () => {}` — violates the repo's own no-fake-functionality rule.
- Login "Remember me" is decorative (`login/page.tsx:25,131-139`).
- Onboarding launch sequence is simulated theater (`onboarding/page.tsx:373-445`); step-4 fetch result discarded.
- Waitlist "Copy" gives no feedback, swallows clipboard failure (`Landing/Waitlist.tsx:108-117`).
- **Cockpit stat bug:** `dashboard/page.tsx:300` renders literal `0` instead of "—" when `emailsSent === 0` (falsy-check).
- **Onboarding discards saved wizard state on reload** (`:250-253` forces pitchDeckStyle/needs/traction back to defaults) — data-loss bug.
- **Stage tile drift:** `pipeline/page.tsx:70-82` defines 11 stage ids that don't match the 21 real ids in `lib/services/pipeline/stages.ts:18-38` — several tiles render untinted. Import from the single source of truth.
- Jargon leak: cockpit next-step says "Apply migration 020 to enable meetings" to founders (`dashboard/page.tsx:172`).

### Accessibility

- `eslint-plugin-jsx-a11y` installed but **not enabled** in `eslint.config.mjs` (only 6 baseline rules active via next config).
- Only 14 `aria-label`s in the entire app; icon-only buttons rely on `title`.
- `ui/Modal` has no focus trap/initial focus/focus return; hardcoded `"modal-title"` id (line 68/76) breaks with two modals. Pipeline lost-reason dialog: no Escape, backdrop click discards typed text.
- Mobile sidebar drawer stays in tab order when off-canvas; no `inert`/`aria-hidden`, no Escape (`Sidebar.tsx:174-179`).
- Landing FAQ accordion lacks `aria-expanded`/`aria-controls` (FAQ.tsx:116-131).
- Pipeline DnD is native HTML5 (pointer-only) but has a keyboard path via per-card "Move" menu — announce it.
- Contrast: `text-gray-300` helper text on white, light lime `#8bd466` text links below 4.5:1.

### React correctness / performance

- react-query installed, zero usages; 32 files hand-roll fetch loops; cockpit manually retries 401s.
- Monolithic client pages: onboarding ~1,700 lines; settings 42KB; outreach 35KB; investors 34KB; pipeline 30KB.
- 40+ index-keyed lists; dynamic ones (onboarding team rows, copilot messages, timelines) can corrupt input state.

### Landing claims verdict (per AGENTS.md standard)

| Claim | Location | Verdict |
|---|---|---|
| "18,995 investor firms … SEC 13F, Form D and IAPD" | Features.tsx:12, WhyCapitalOS.tsx:10, FAQ.tsx:20 | ✅ accurate **as of the old corpus — now stale vs the 2026-11-17 AGENTS.md update (24,379 active records / 4,933 emails)** |
| "4,921 … contact email on file" | Features.tsx:12, WhyCapitalOS.tsx:10 | ✅ old number — now 4,933; update in same commit |
| "portfolio fields appear only where the source recorded them" | Features.tsx:12, WhyCapitalOS.tsx:10 | ⚠️ portfolio count is 0 — name cheque/thesis only |
| "18,995 investors" + "SEC Sourced" overlay | DataVizChart.tsx:122-131, FAQ.tsx:84-106 | ❌ wrong noun (**firms**) and wrong source label (SEC **and IAPD**) |
| "verified contactable emails" | none found | ✅ compliant |
| UK/EU coverage claims | none found | ✅ compliant |
| "21-stage pipeline Kanban" | Pricing.tsx:23 | ✅ matches stages.ts |
| "7 branded templates" | Pricing.tsx:21 | ❌ only 3 default sequence templates exist (`sequence.ts:590-702`) — unsupported number |
| Pitch deck (PPTX+PDF), Copilot, drip w/ stop-on-reply | Pricing.tsx | ✅ features exist |

Also: hero/FAQ images load from `/images/real-estate-agent/…` with alt texts like `"faq-image"`, `"union"` — template residue; replace imagery + alt text.

---

## §4 Frontend task list — start to finish

Owner: frontend/design agent. Dependencies: T5/T6/T7/T9 wait on backend
contract requests (CR-1…CR-6 in `AGENT-COORDINATION.md` §4). Status tracked
in `AGENT-COORDINATION.md` §6 and updated as work completes.

| # | Task | What it delivers | Status |
|---|---|---|---|
| T0 | Coordination board + audit documentation | Conflict-free parallel work; this report | **DONE** |
| T1 | `PRODUCT.md` + `DESIGN.md` | Product truth + single-source design tokens (fix the three-token-system problem; `@theme` in globals.css as authority; add `--color-brand-dark`; purge template leftovers) | IN PROGRESS |
| T2 | UI primitive consolidation | Unify buttons/inputs/modals/cards on the ui/ kit; remove material-symbols dep; enable jsx-a11y rules; adopt react-query (or drop — owner decision) | NOT STARTED |
| T3 | Landing page improvements + truth pass | Targeted design upgrades; new corpus numbers (24,379 / 4,933 / person-row caveat) in same commit; fix "7 branded templates" + firms/IAPD labels; replace template imagery | NOT STARTED |
| T4 | Founder dashboard next-action engine | Real prioritized actions, honest empty/error states (fix the error-as-empty-state hotfixes) | NOT STARTED |
| T5 | Investor discovery at scale | Deep pagination, facet counts, virtualized rows for the growing corpus | NOT STARTED (needs CR-1) |
| T6 | Sequence editor | Replace read-only hub with a real editor | NOT STARTED (needs CR-3) |
| T7 | Pipeline conversion analytics UI | Expected vs actual, stage conversion | NOT STARTED (needs CR-4) |
| T8 | Introductions warm-graph | D3 graph over `introductions` table | NOT STARTED |
| T9 | Data room UI | Sharing, expiry, investor-scoped access | NOT STARTED (needs CR-2) |
| T10 | AI copilot action layer UI | Propose → confirm → execute with audit trail | NOT STARTED (needs CR-5) |
| T11 | Admin: feature flags + AI config + billing UI | Completes admin suite gaps (after Stripe-stack decision) | NOT STARTED |
| T12 | Accessibility + responsive sweep | Every dashboard page: focus traps, aria-labels, contrast, keyboard paths | NOT STARTED |
| T13 | Final polish + green build | Motion/a11y audit, `tsc` + `next build` clean, handoff notes | NOT STARTED |

**Frontend hotfixes that jump the queue** (small, independent of the big
tasks, no backend dependency): error-as-empty-state on cockpit + investors;
dead admin buttons; cockpit `0`-vs-"—" bug; onboarding wizard state loss;
stage-tile constant drift; jargon leak on cockpit next-step.

---

## §5 Code quality & engineering practices audit (completed)

### STRENGTHS

- `npm run typecheck` passes with **0 errors** under `strict: true` repo-wide; zero `@ts-ignore`/`@ts-expect-error`/empty catch blocks.
- Tests assert real behavior (factor weights sum to 1.0 with explanations; credit ordering before send + refund-on-failure; currency normalization edge cases).
- E2E honest: real signed-in flows, self-skip without credentials rather than pretending; `pricing.spec.ts` pins layout after a real regression.
- Stripe webhook: raw-body signature verification before any DB write; partial-update semantics.
- Sentry properly gated via `instrumentation.ts` + conditional `withSentryConfig`.
- `src/lib/services/investors/query.ts` exists to stop filter-logic drift.

### FINDINGS

- **F1 (HIGH)** — `npm run lint`: **3,614 problems (2,257 errors)** repo-wide; scoped to `src/`: **608 (460 errors, 148 warnings)** — 390 `no-explicit-any`, 141 `no-unused-vars`, 42 `react-hooks/set-state-in-effect`. `next.config.ts:8-10` sets `typescript.ignoreBuildErrors: true`, which now only hides *future* regressions (typecheck is clean). Fix: lint budget in CI, burn down from `lib/db.ts` (~35 anys) and `supabase-query.ts` (~30), drop the ignore flag.
- **F2 (HIGH)** — `src/lib/validate.ts` (243 lines, 15 schemas) is **dead code**: only 2 of 94 routes use zod. `validateBody` (sync, line 168) has a real bug: `JSON.parse("{}")` always — it never reads the request body. Fix: route through `validateBodyAsync`/`validateQuery`, delete broken `validateBody`.
- **F3 (HIGH)** — **61 of 233 tests silently skip** on any offline run (security 39, authflow 9, access-control 13 probe `localhost:3456`); auth-gating/IDOR checks vanish in CI. Suite takes 110s for 1.7s of test time (jsdom + top-level 3s fetch probe). No tests at all for Stripe webhook, billing plans/entitlements, RLS policies. Fix: separate integration project/script, CI against preview deployment; add webhook/billing tests.
- **F4 (MEDIUM)** — `test:coverage` script fails: `@vitest/coverage-v8` not installed, no coverage block, no thresholds.
- **F5 (HIGH)** — service-role client **inline-constructed in 93 files / 105 occurrences** while cached `getServiceClient()` used in only 16. Fix: sweep to `getServiceClient()`, then lint-enforce (`no-restricted-imports` for `@supabase/supabase-js` outside `lib/supabase/`).
- **F6 (MEDIUM)** — `requireAuth()` returns `AuthUser | NextResponse` forcing the `instanceof` dance into ~60 routes; 403 depends on dead-name `COCKROACH_ADMIN_EMAILS` env var. Fix: `withAuth(handler)` wrapper; rename env var with alias.
- **F7 (HIGH)** — untracked migrations + duplicate `004`/`014` numbers (same finding as architecture A-C2, independently confirmed; code expects migrations 015–024 — `024` defines the current 21-stage pipeline). Fresh clone gets a schema missing the pipeline. Fix: commit + renumber + CI check that `supabase/migrations/` is clean.
- **F8 (HIGH)** — repo hygiene: **290.8MB untracked** (exports/, backups/, outreach-demo/, investor-intelligence/data/, 20+ ad-hoc scripts); **tracked junk**: Trezo template leftovers incl. `public/images/real-estate-agent/backup/**` (~40 files), `landing page images/` (14 stock images), 4MB of stray root images, `supabase_logs.json` (449KB), **`angels-1000.csv` (539KB — real investor contact data, tracked in git)**, `test-data/*.csv` with realistic fake emails. Fix: `git rm --cached` the junk + PII CSVs, extend `.gitignore`, commit-or-branch the 12 modified files.
- **F9 (MEDIUM)** — dead deps: `@tanstack/react-query` (0 imports), `swiper` (CSS imported in layout.tsx:3-4, no component used anywhere), two icon libraries; version skews (`eslint-config-next@16.3.2` vs `next@16.3.7`; `playwright@1.57` vs `@playwright/test@1.65`). `.convex/` stale scaffolding. Fix: remove react-query + swiper (aligns with DESIGN.md doctrine), one icon lib, align versions, delete `.convex/`.
- **F10 (HIGH, config)** — bare `npm run lint` takes **40+ minutes** because `eslint.config.mjs` ignores only `.next/out/build` and traverses the 290MB data dirs. No `.prettierrc`/`.prettierignore`/`.gitattributes` (CRLF↔LF churn on Windows, 17 files in current diff are line-ending noise). Fix: flat-config `globalIgnores` for data dirs, prettier config + ignore, `* text=auto eol=lf`.
- **F11 (MEDIUM)** — **96 of 140 tsx files are `'use client'` (69%)**; dashboard pages fetch own API routes in `useEffect` with hand-rolled state; two data-fetching doctrines split by page age (newer pages are server components). The 42 `set-state-in-effect` errors are exactly this pattern. Fix: doctrine = server components for reads + client islands (adopted in DESIGN.md §10).
- **F12 (MEDIUM)** — error handling consistent but shallow: **0 `captureException` calls in src/** — Sentry only sees unhandled errors; every handled failure is console.error only. Envelope shapes drift; no machine-readable error codes. Fix: one `handleRouteError(err, route)` helper (console.error + captureException + typed codes), mechanical sweep.

### Code-quality TOP-5

1. Commit the 7 untracked migrations + renumber duplicates (F7 = A-C2).
2. Make lint CI-viable (F10 ignores) and burn down the 460 src errors (F1); remove `typescript.ignoreBuildErrors`.
3. Consolidate service-role client to `getServiceClient()` + shared route-error helper with `captureException` (F5 + F12).
4. Untrack repo junk + PII (F8) — backend agent.
5. Split integration tests out of unit suite; fix coverage; add Stripe-webhook/billing tests (F3/F4).

**Cross-lane note (frontend agent, 2026-11-17):** the eslint `globalIgnores`
fix (F10) and jsx-a11y enablement touch the same `eslint.config.mjs` — I am
applying both in T2 since the file sits in my lane's workflow; flagging here
for review. react-query removal (F9) aligns with the DESIGN.md doctrine
decision (drop, not adopt).

---

## §6 Backend agent — workstream, authorities and review protocol

**Written by the backend agent, 2026-11-17.** This section is the counterpart to
§4: what I own, what I am doing next, and how the two lanes review each other
without colliding.

### 6.1 Landed before this board existed

Commit `5380eca` (Phase 0): 5,461 Form D venture funds + 12,102 person rows /
4,205 distinct people imported, tagged `source='sec_formd_bulk'` with rollback;
per-founder match scoring; fund facts + team on the investor profile; corpus
counts on the dashboard; `EMAIL_PROVIDER=outbox`; send → pipeline advance.
Measured corpus: **24,379 active records, 4,933 emails (none verified)**.

This work touched `dashboard/page.tsx` and `investors/[id]/page.tsx` before the
coordination file existed. Those edits are committed. **From now on, UI changes
are the frontend agent's lane** — I file a contract request or a review note
instead of editing components.

### 6.2 Authorities (binding for both agents)

| Area | Owner | Rule |
|---|---|---|
| Supabase schema, migrations, RLS, seeds | **Backend** | Frontend requests columns/tables via CRs; never edits SQL |
| Corpus import, enrichment, contact data | **Backend** | Frontend consumes tables read-only via APIs |
| `src/app/api/**`, `src/lib/services/**`, `src/lib/db*`, `scripts/**` | **Backend** | Frontend requests endpoints/fields via CRs |
| Git push, Vercel deploys, production DB writes | **Backend** | Frontend commits locally; I push atomic commits |
| `src/app/**/page.tsx`, `src/components/**`, styles, design tokens | **Frontend** | I do not edit these; I review API-facing diffs |
| `PRODUCT.md`, `DESIGN.md`, landing design + copy | **Frontend** | Numeric claims supplied by me, applied by them in the same commit |
| `AGENT-COORDINATION.md`, audit docs | **Shared** | Append-only; no rewriting the other's entries |
| Feature-status truth (`docs/30`) | **Shared** | Both update their own rows |

**Escalation:** if a change spans both lanes (e.g. a new endpoint plus its UI),
the API contract is agreed in `AGENT-COORDINATION.md` §4 first, then each agent
builds their half. The owner decides if we disagree.

### 6.3 My queue (ordered, with acceptance criteria)

| # | Task | Acceptance | Status |
|---|---|---|---|
| B1 | Signed-in loop proof: discover → profile → match → shortlist → draft → outbox → pipeline | Disposable account completes the loop; every step reads real rows; failures fixed | **DONE (frontend, `b73bf05`)** — reviewed; defects fixed |
| B2 | Tenant isolation: H1 jobs IDOR, H3 domain-check identity, A-C1 global pending sends | Two accounts cannot read, send as, or execute for each other; regression test | **DONE (query-scoped + 6 regression tests)** — live two-account probe open |
| B3 | Migration reproducibility: 8 untracked migrations, duplicate 004/014 | Fresh clone + `db:migrate` reaches current schema; `db:status` clean | QUEUED |
| B4 | Manager-level entity resolution: collapse 5,461 fund vehicles to managers/families | Distinct-manager count measured; discovery does not show the same manager as 9 investors | **MEASURED — 3,398–4,327 distinct managers; collapse not applied (see `MANAGER-COLLAPSE-2026-11-18.md`)** |
| B5 | Contact discovery + verification from verified fund sites | Verified vs unverified contact counts; suppression respected; robots/ToS honoured | QUEUED |
| B6 | Match calibration: hand-label ~50 funds, measure precision@10 | Published precision figure; weights tuned only against it | QUEUED |
| B7 | Email safety bundle: H4 header injection, H5 OAuth state, H6 fail-closed key, M1 unsubscribe token, M2 click redirect | Security checks pass; no header from user text | **PARTIAL — H4/H5/H6 done with 5 regression tests; M1/M2 need schema work** |
| B8 | Weekly Form D delta ingestion with idempotent upsert | New filings appear without duplicates; change log exists | QUEUED |

### 6.4 Review protocol

1. **Before either agent pushes**, the other reads the diff for their lane. I
   review any frontend change that consumes an API I own; they review API
   changes that alter response shapes their UI reads.
2. **No staging each other's files.** I stage explicit paths only; if a push
   would include their commit, that is fine because commits are atomic.
3. **Contract changes are announced first** in `AGENT-COORDINATION.md` §4, not
   discovered from a broken page.
4. **Conflicts:** the file moves to the conflict list; whoever committed first
   wins and the second rebases. The owner breaks ties.
5. **Review SLA:** within the same work session for blocking changes; 24h for
   non-blocking.

### 6.5 Decisions needed from the owner

1. **Stripe:** canonical stack — `billing/*` or `founding-member/*`? (blocks T11)
2. **Jobs:** delete `/api/jobs` + runner, or rebuild on `pg_cron`/QStash?
3. **Service-role migration:** do we migrate tenant routes to the cookie client
   now (slower, safer) or document service-role-everywhere as the operating
   model and enforce manual scoping?

### 6.6 Convex removal — done 2026-11-17

Convex had zero runtime imports and no dependency; it was already declared
removed in `ARCHITECTURE.md` while files and env vars still implied it was live.

Deleted (tracked): `convex.json`, `env-convex.json`, `scripts/convex-status.js`,
`scripts/import-to-convex.js`, `scripts/migrate-to-convex.js`,
`scripts/sync-to-convex.js`, `scripts/qualify-and-promote.js` (Convex-only
pipeline). Removed the local `.convex/` backend, Convex keys from
`.env.local.template` and `env-vercel.json`, and the “project is alive” line in
`docs/DATABASE-SETUP-RUNBOOK.md`. `ARCHITECTURE_FINAL.md` is marked superseded.
`scripts/edgar-mega.js` now writes an `archive-*.json` instead of a “Convex
archive”. Historical audit documents keep their references as records.

**Rule going forward:** no Convex env, deploy step, import or script returns.

## §7 Pending

- None — all four audit tracks complete. Worklog continues in
  `AGENT-COORDINATION.md` §8.
