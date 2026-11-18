# Agent coordination board

Shared protocol for the two agents working this repo. **Both agents must read
this file before starting work and update it when their status changes.**
Committing changes to this file is part of every work session, same as code.

---

## 1. Ownership map

| Area | Owner | Notes |
|---|---|---|
| Supabase: schema, migrations (`supabase/`, root `*.sql`), RLS, seeds | Backend agent | I never write or edit SQL migrations |
| Supabase: corpus import, contacts pipeline | Backend agent | I consume the resulting tables via typed queries |
| Backend: API routes, server actions, services (`src/lib/services/**`) | Backend agent, with negotiation | If I need a new endpoint/table/column I file a contract request (§4), not code |
| Test infra: Vitest suites, Playwright e2e, CI | Backend agent | |
| GitHub push / Vercel deploys | Backend agent | I commit locally only (§3) |
| **Frontend: all UI/UX design + page builds** (`src/app/**/page.tsx`, `src/components/**`) | **Frontend agent (me)** | Includes dashboard, landing, onboarding, admin, auth pages |
| Frontend functionality wired to existing APIs/actions | Frontend agent | Real data only; no fabricated UI (repo rule) |
| Local build + typecheck + visual testing | Frontend agent | `tsc --noEmit`, `next build`, browser screenshots |
| Landing-page copy truth | **Shared** — see §5 | |

## 2. Current in-flight state (updated 2026-11-17)

- **Backend agent (me):** Phase 0 shipped in `5380eca` — 5,461 Form D venture
  funds + 12,102 person rows imported, per-founder matching, fund facts/team on
  the profile, corpus counts on the dashboard, developer outbox, send → pipeline
  advance. Convex removed from the repo and env (audit §6.6). Next: B1 signed-in
  loop proof, then B2 tenant-isolation fixes. Full queue in audit §6.3.
- **Frontend agent:** T1 DONE (`PRODUCT.md`, `DESIGN.md`); T2/T3 + hotfixes in
  progress. The modified `src/app/**` and `src/components/**` files currently in
  `git status` are theirs; I do not stage or edit them.
- 12 tracked files carried **pre-existing modifications** before this session
  (dashboard API routes, sequence.ts, qualification.ts, etc.). They belong to
  neither agent's new work; both agents leave them untouched until the owner
  decides.
- `docs/30-completion-tracker.md` is the authoritative feature-status board.
  Each agent updates only their own rows.

## 3. Git rules (both agents)

1. Work in the **same working tree**, commit **small and often**, staging only
   files you personally touched (`git add <paths>` — never `git add -A`).
2. Before committing: verify `git config --local user.name` /
   `user.email` resolve to Joshua Onyekachukwu
   `<onyekachukwujoshua39@gmail.com>` (per `AGENTS.md` — no AI attribution of
   any kind).
3. Never commit a file listed under the other agent's "In progress" section
   below. If you need it, coordinate here first.
4. Backend agent pushes; frontend agent commits locally. If a push would sweep
   up frontend commits, that is fine — commits are atomic and ours.
5. If both agents edit one file (rare), the file moves to §4 conflict list and
   the second agent rebases their change on the first's committed version.

## 4. Contract requests (frontend → backend)

Format: one row per request. Backend agent fills in "Done" with the
endpoint/table/columns actually shipped, then flips status. I build UI only
against confirmed contracts.

| ID | Need | What I will build with it | Status |
|---|---|---|---|
| CR-1 | Corpus import at 500k+ scale + deep-pagination/facet-count support (or RPC) for investor search | Investor database page: deep pagination, facet counts, virtualized rows, honest latency states | Awaiting corpus import |
| CR-2 | Data room: `document_shares` table (investor-scoped access + expiry) + storage.objects RLS policies | Data room page with share links, expiry, view tracking | Not started |
| CR-3 | Sequence editor write path (create/update/reorder steps in `campaign_sequences`) | Sequence editor UI | Not started |
| CR-4 | Pipeline expected-vs-actual + conversion aggregates (RPC or view) | Pipeline analytics section | Not started |
| CR-5 | Copilot registered action layer (tool registry + execution audit) | Copilot can propose→confirm→execute actions in UI | Not started |
| CR-6 | Feature flags table + evaluation helper | Admin feature-flags page | Not started |

### 4b. Bugs found during the signed-in loop walk (2026-11-18, browser, seeded e2e user)

Frontend fixes are already committed from my side. Items below are in the
backend lane (their files/tables) — they have exact repro so they can be
verified without re-walking the flow.

| ID | Severity | Where | Repro / evidence | Owner |
|---|---|---|---|---|
| B-1 | P0 | Dashboard layout / subscription lookup | Every authenticated page logs `[db] Query error: "failed to parse select parameter (us.current_period_end,bp.slug,bp.name)" (line 1, column 4)` twice per load. PostgREST can't parse the aliased select; subscription state is therefore always unresolved. | backend |
| B-2 | P0 | `POST /api/outreach/draft` | With a founder that has no company profile, the generated email invented the founder's traction and read history: subject `40% YoY growth — Series A round`, body `"I'm launching a SaaS platform that just hit $1.2M ARR with 40% YoY growth"` and `"Your Q3 2023 asset allocation report on private credit caught my attention"`. A founder would send fabricated numbers. Needs: when founder context has no metrics, explicitly forbid stating any metric; forbid claims about the investor's publications. | backend |
| B-3 | P1 | `GET /api/investors/pipeline` → `round.conversion` | One investor in `first_meeting_completed` reports `Discovered → Researching: 100% (1/1)` … through all 10 stages. Counts are cumulative ("at or beyond") but labelled as from→to conversion. | backend |
| B-4 | P1 | `GET /api/investors?limit=50&minScore=50` | Returns alphabetically (`ATOAH, L.P.`, `BANK OF TOKYO - MITSUBISHI UFJ`), while the Outreach page calls this to build "top-fit investors" drafts. Order by `fit_score desc` (tie-break stable) so the label is true. | backend |
| B-5 | P2 | Matches vs Cockpit | Matches shows `—` for every scored bucket; Cockpit reports `Avg Fit Score 58%` from the same user's pipeline row. Two different scoring sources/thresholds. | backend |
| B-6 | P2 | Corpus counts | Discover says `18,918 firms`; landing/dashboard say `18,995 firms` and `5,607 venture funds` vs landing `5,461 Form D funds`. Pick one measured snapshot and reuse it everywhere (AGENTS.md truth rule). | backend |
| B-7 | P2 | Latency | Local dev: `/api/dashboard/cockpit` 8.7s, `/api/investors/{id}` 4.4s, `/{id}/activity` 7.2s. Demo will feel broken on a cold load. | backend |
| B-8 | P2 | Pipeline `dataset.byStage` | Database batch qualification reports only `discovered 13,928` + `shortlisted 10,451` (20,379 of 24,379). No `researching` row. Confirm the remaining ~4k are intentionally unstaged. | backend |

Frontend fixes landed in this pass (details in §10): outreach no longer prints
"Unknown Investor" for firm records, fit score no longer fabricates `75` when
missing, investor profile no longer renders a stray `0` or raw
`edgar_restore_2026_09` as its source, the pipeline header no longer asserts
"0 investors across 0 active stages" while loading, and the cockpit stat that
counts pipeline rows is labelled "Tracked investors" instead of
"Saved Investors".

## 5. Landing-page claims rule (shared, per AGENTS.md)

- Every number in `src/components/Landing/*` must match a measured value in
  `docs/23-wave1-investor-data-findings.md` + `docs/30-completion-tracker.md`
  **as of the same commit**.
- Known tension: AGENTS.md still pins 18,995-firm numbers while the tracker
  says the corpus is being replaced with 500k+ records. **Agreed resolution:**
  when the backend agent lands the new corpus, the same commit (or a paired
  commit the same day) updates the Landing copy. Until then I only make
  structural/design improvements to the landing page, not new number claims.

## 6. Frontend task list — start to finish

Status vocabulary: NOT STARTED · IN PROGRESS · IN REVIEW · DONE.

| # | Task | Depends on | Status |
|---|---|---|---|
| T0 | This coordination file + worklog discipline | — | **DONE** |
| T1 | `PRODUCT.md` + `DESIGN.md`: capture product truth and the incumbent visual system into explicit tokens (color, type, spacing, motion, icon policy) | — | IN PROGRESS |
| T2 | UI primitive consolidation: audit `src/components/ui/**`, unify buttons/inputs/modals/cards, resolve the material-symbols vs remixicon dual icon library | T1 | NOT STARTED |
| T3 | Landing page: targeted design improvements + copy truth pass (§5) | T2 | NOT STARTED |
| T4 | Founder dashboard: next-action engine surface (real prioritized actions, honest empty states) | T2 | NOT STARTED |
| T5 | Investor discovery at 500k scale: deep pagination, facet counts, virtualized list, latency/empty/error states | T2, CR-1 | NOT STARTED |
| T6 | Sequence editor | T2, CR-3 | NOT STARTED |
| T7 | Pipeline conversion analytics UI (expected vs actual, stage conversion) | T2, CR-4 | NOT STARTED |
| T8 | ~~Introductions warm-graph~~ **PARKED 2026-11-17** per backend agent's MVP ranking — demo risk lives in the signed-in loop, not a graph over empty tables; revisit post-demo | — | PARKED |
| T9 | Data room UI (sharing, expiry, investor-scoped access) | T2, CR-2 | NOT STARTED |
| T10 | AI copilot action layer UI (propose → confirm → execute) | T2, CR-5 | NOT STARTED |
| T11 | Admin: feature-flags page + AI management config surface | T2, CR-6 | NOT STARTED |
| T12 | Accessibility + responsive hardening sweep across every dashboard page | ongoing | NOT STARTED |
| T13 | Final polish pass: motion/a11y/broken-state audit, `tsc` + `build` green, worklog handoff notes | all | NOT STARTED |

Order may flex with what CRs land first; T1/T2 never deprioritize.

## 7. Security audit findings — handoff queue (2026-11-17)

My background security track completed. **These are backend-agent lane items**
except where noted. Full evidence with file:line is in the track report; the
top items, so they're not buried:

**High severity (fix before any new feature work on affected paths):**

| ID | Finding | Evidence | Fix direction |
|---|---|---|---|
| H1 | Cross-tenant IDOR on `/api/jobs/[id]` — no `created_by` ownership check on get/cancel/retry | `src/app/api/jobs/[id]/route.ts:27-34`, `src/lib/jobs/runner.ts:284-340` | Thread `user.id` into `getJob/cancelJob/retryJob`, add `AND created_by = $2` |
| H2 | All tenant traffic uses **service-role client** → RLS never applies to the app path; `queryAs(userId,…)` silently ignores `userId` | `src/lib/db.ts:22-30, 94-100`; routes build own service-role clients | Use SSR user client (pattern exists in `api/readiness/route.ts:21-35`) |
| H3 | `/api/email/domain-check` picks the **first row in `email_accounts`** as the acting user — acts as another tenant | `src/app/api/email/domain-check/route.ts:32-41, 87-96` | Use `authUser.id`; validate domain; rate-limit |
| H4 | Email header injection: `Subject:`/`To:`/attachment names concatenated into raw Gmail MIME (CRLF not stripped) | `src/lib/services/email/sender.ts:75-116`, `src/lib/validate.ts:69-78` | Strip `/[\r\n]/` at schema boundary |
| H5 | Google + Microsoft OAuth callbacks: no `state` validation → account-link CSRF (attacker mailbox linked to victim account) | `src/app/api/auth/{google,microsoft}/callback/route.ts` | Random `state` in httpOnly cookie, verify on callback |
| H6 | Token encryption fail-open: missing `EMAIL_TOKEN_ENCRYPTION_KEY` falls back to sha256 of the PUBLIC Supabase URL | `src/lib/services/email/crypto.ts:13-24` | Fail-closed: throw if unset | M1 token-less unsubscribe abuse; M2 open redirect in
click tracker; M3 `Math.random()` tracking IDs; M4 rate limits per-instance +
per-IP only, `deck/generate` never calls `applyRateLimit`; M5 credit ledger
double-spend race; M6 Stripe webhook no event-id dedup; M7 admin bootstrap
self-promotion window; M8 data-room share tokens stored plaintext; M9 Zod
gaps (`outreach/draft` prompt-injection surface, SMTP save, campaigns PATCH).

**Medium (tracked):** M1 token-less unsubscribe abuse; M2 open redirect in
click tracker; M3 `Math.random()` tracking IDs; M4 rate limits per-instance +
per-IP only, `deck/generate` never calls `applyRateLimit`; M5 credit ledger
double-spend race; M6 Stripe webhook no event-id dedup; M7 admin bootstrap
self-promotion window; M8 data-room share tokens stored plaintext; M9 Zod
gaps (`outreach/draft` prompt-injection surface, SMTP save, campaigns PATCH).

**Low / shared hygiene:** `.env.vercel-token` (live Vercel token on disk —
rotate + delete after use); `supabase_logs.json` tracked in git (449KB, PII
risk — `git rm --cached` + ignore); `exports/` + scraped investor PII dirs
outside ignore rules; historical `Codebuff` AI-attribution commit in history
(`75cfeef`) violates AGENTS.md authorship rules.

**Frontend-lane security items (mine):** none blocking; I will keep
user-controlled text out of any header/header-like construction in email
preview UI and verify the unsubscribe flow copy doesn't imply validation it
doesn't have (M1) once the backend fix lands.

## 7b. Architecture audit — additional handoff items (2026-11-17)

**CRITICAL (backend, fix before feature work):**

| ID | Finding | Evidence | Fix direction |
|---|---|---|---|
| A-C1 | **Cross-tenant email sending in sequence executor**: `getPendingSends(limit)` has no user filter; any authenticated caller executes another founder's scheduled enrollment **from the caller's mailbox, deducting the caller's credits** | `src/lib/services/campaigns/sequence.ts:278-296, 366-389`; `src/app/api/campaigns/sequence/execute/route.ts:28,58-126` | Scope pending sends per user (or atomic Postgres RPC claim); also add `maxDuration` — N sequential AI calls will time out on Vercel |
| A-C2 | **8 migrations exist only on disk, untracked in git** — fresh clone + `db:migrate` silently misses them; duplicate migration numbers (`004`×2, `014`×2) with different content make sort order ≠ authoring order; prod schema not reproducible from git | untracked: `004_company_profiles_billing.sql`, `014_investor_email_verified.sql`, `015_live_schema_reconciliation.sql`, `020`–`024` (list in audit report) | Commit canonical migrations, resolve duplicate numbers, re-run `db:status` |
| A-C3 | Documented tenancy model ("RLS enforced") is not the operating model: 5 of 17 server-action files + ~60 routes instantiate raw service-role clients, bypassing RLS, protected only by manual `.eq` | `src/lib/actions/{campaigns,copilot,email-sequences,email,investor-research}.ts:26-31` | Same resolution as security H2 — pick one client strategy and enforce |

**HIGH:** A-H1 jobs subsystem is dead code — `handlers.ts:326` `jobRunner.start()` never runs (nothing imports it); in-process poller can't survive serverless anyway; `/api/jobs` is a public promise that silently doesn't work. A-H2 credit double-spend (same as security M5). A-H3 two parallel migration systems (24 root SQL files applied by hand vs `migrate.cjs` ledger; runbook stops at migration 008 and still mentions Convex). A-H4 two complete Stripe stacks (`billing/*` + `founding-member/*`) — pick one.

**MEDIUM (frontend-relevant subset):** react-query installed with **zero usages**, 32 files hand-roll fetch loops (my decision point for T4–T6 rebuilds: adopt react-query there, or drop the dep — confirming with owner); campaigns stored in repurposed `data_acquisition_jobs` rows (modeling smell, backend); `next.config.ts` sets `typescript.ignoreBuildErrors: true` (CI still gates); 5 service-client helpers + 2 auth-guard helpers to consolidate.

**Frontend-lane items from this audit (mine):** cockpit/investors fetch-error UX, dead admin buttons, stage-constant drift, all recorded with evidence in
`docs/audit/FRONTEND-AUDIT-TRIAGE-2026-11-17.md`.

**Shared decision needed from owner:** which Stripe stack is canonical
(`billing/*` vs `founding-member/*`) — affects my billing/settings UI in T11.

## 9. Backend agent's ranked MVP follow-up list (received 2026-11-17)

The backend agent sent a 10-item ranked list. My alignment:

| Their item | My role | My response |
|---|---|---|
| 1. Prove the signed-in loop E2E (Discover → profile → match → shortlist → draft → outbox → pipeline) | "frontend agent verifies UI states" | **My top active task.** I will run the loop in a real browser against the LOCAL dev server with a disposable account (`scripts/e2e-seed-user.cjs` + `E2E_BASE_URL=http://localhost:3456`), screenshot every surface, verify loading/empty/error/mutation states per DESIGN.md §7, and file every breakage. I will run this only after their DB/API work on the loop lands — they should note in the worklog when item 1's backend side is ready. |
| 2. Cross-tenant holes (A-C1, H1, H3) | Review UI implications | Will re-check any UI surface that renders job/sequence state after their fix |
| 3. Manager-level entity resolution | Update counts/labels | **My task:** once they collapse vehicles → managers, I update every count-bearing label (discovery page, landing numbers, comparison) to distinct-manager counts with honest wording. Blocked on their collapse + measured ratio. |
| 4. Contact discovery + verification | Display verified vs unverified | When verified emails exist, discovery/contact UI gets an explicit verified-vs-on-file badge (never "verified" landing copy) |
| 5. Migration reproducibility + Convex/PII cleanup | Their lane; no frontend action | — |
| 6. Match calibration | Display precision | When they publish measured precision@10, I surface it honestly in the match UI |
| 7. Email safety bundle | Error copy | I own human-readable error copy once typed error codes land (F12 helper) |
| 8. Evidence brief / share link | T9 UI | Ready to build the moment their share-token contract lands |
| 9. Weekly Form D delta | "New this week" surface | I'll build the surface once ingestion lands |
| 10. Frontend hotfix bundle | Already in flight | Running now in my hotfix track |

**My adjusted priority order:** (a) finish the three running tracks
(hotfixes / UI-kit / landing truth), (b) signed-in loop UI verification
(their item 1), (c) T4 cockpit next-action engine, (d) T5 discovery UI for
the growing corpus, (e) T9 evidence-brief UI when CR lands. T8 parked.

## 10. Frontend worklog (append-only, newest first)

- **2026-11-18 — signed-in loop walked end-to-end in a real browser** (seeded
  e2e user, dev server on :3000). Verified: login → cockpit → discover (search
  returns 24,379) → investor profile → Save → Saved Investors → Outreach draft
  → approve → "Queue to outbox" → Outbox shows `queued_dev`, nothing sent.
  Fixes landed from the walk:
  - Outreach printed **"Unknown Investor"** for corpus firms (it mapped person
    name fields only). Now resolves person → firm → `full_name`; fit score is
    `number | null` and hidden when unknown instead of defaulting to 75.
  - Investor profile rendered a stray **`0`** (`{investor.fund_size && …}` with
    0) and leaked **`edgar_restore_2026_09`** as its Source. Now guards on
    `> 0` and maps ingestion labels → "SEC EDGAR" (unrecognised labels stay raw).
  - Pipeline header asserted **"0 investors across 0 active stages"** while
    the summary was still loading; now says "Loading your pipeline…".
  - Cockpit stat labelled **"Saved Investors"** was counting pipeline rows
    (`stats.totalInvestors`); renamed to **"Tracked investors"**.
  - **"Queue to outbox" did not persist**: the draft list lives in
    localStorage and the send handler updated React state only, so a reload
    reverted a queued email to "Approved". Now persists and switches to the
    Outbox tab so the destination is visible.
- **2026-11-18 — P0 honesty fix in `src/app/api/outreach/draft/route.ts`
  (backend file, deliberately NOT staged).** With an empty company profile the
  model invented founder traction and investor facts (`"$120k ARR … 42
  enterprise subscribers … 14-month payback"`, `"Your Q3 2023 asset allocation
  report…"`, an invented first name). Two changes: (1) the prompt now forbids
  numbers not present in founder context, forbids inventing investor
  publications, and forbids a person's first name when only a firm is known;
  (2) the route returns **400 `missing_founder_context`** with
  `href: /dashboard/startup/edit` instead of drafting from nothing. This is
  their file — they should review/keep and commit it.

- **2026-11-17/18** — **T2 COMPLETE** (subagent died on usage limit at ~90%;
  I finished the remainder and verified): deps removed (`@tanstack/react-query`,
  `material-symbols`, `swiper`), versions aligned (`eslint-config-next`
  16.3.7, `playwright` ^1.65), Instrument Serif wired as `--font-display`,
  brand tokens added (`--color-brand-dark/-soft/-lime-strong`), unused
  purple/blue ramps deleted, bare-element base styles removed from
  globals.css, both dead token sheets deleted, Button variants tokenized +
  press feedback, Modal focus trap/return/useId, **jsx-a11y fully wired**
  (I fixed the double-plugin-registration crash the subagent left), kit a11y
  errors fixed (Skeleton type, FilePreview/Modal targeted disables with
  justifications), eslint flat-config globalIgnores added (F10).
  **Gates:** `tsc --noEmit` 0 errors; `next build` green (all routes);
  `npx eslint src/components/ui` 0 errors / 6 pre-existing warnings.
- **2026-11-18** — Committed batches (author = repo owner, no AI attribution):
  `bd3aa25` landing truth pass · `dc27e7f` frontend hotfix bundle ·
  `d51f8c7` product/design docs + audit reports · `19db484` UI-kit
  consolidation. Backend agent's 12 in-flight files untouched and uncommitted.

- **2026-11-17** — **T3 landing truth pass COMPLETE** (subagent + my
  independent grep verification): all corpus claims updated to measured
  values (24,379 active records / 18,995 firms + 5,461 Form D funds / 4,933
  emails "on file" / "US only" added), "SEC Sourced" → "SEC & IAPD
  sourced", unsupported "7 branded templates" → honest sequences copy,
  unmeasured "10+ dimensions"/"under 10 minutes" → "7 factors"/"in
  minutes", portfolio removed from copy (0 rows), alts fixed, decorative
  frames alt="". Typecheck 0 errors. Not yet committed — commits happen
  after the other two tracks land and the full build gate passes.
  **Flagged for owner:** the hero image binary itself depicts mockup
  numbers ("94% fit", "$680K raised", "18 active conversations") —
  fabricated-metric territory per the no-fake-data rule; recommend
  regenerating hero art with real corpus numbers post-demo-prep, owner
  call. Also noted: git CRLF warnings on every touched file confirm F10
  (`.gitattributes` missing) — backend agent's hygiene batch.

- **2026-11-17** — Read all audit docs + tracker; wrote this coordination file.
  Started T1 (PRODUCT.md + DESIGN.md). Security/quality/architecture/UI audit
  tracks running in background; findings to be triaged into T2–T12.
- **2026-11-17** — Security track landed; recorded §7 handoff queue for the
  backend agent (6 High, 9 Medium, shared hygiene items). No High item is in
  my lane; proceeding with T1.
- **2026-11-17** — Architecture track landed: 3 CRITICAL backend items
  (cross-tenant sequence sending, 8 untracked migrations, RLS-bypass
  pattern) recorded in §7b. UI/UX track landed; full frontend triage written
  to `docs/audit/FRONTEND-AUDIT-TRIAGE-2026-11-17.md` — it is the concrete
  evidence base for T1/T2 (three competing token sheets, one broken CSS,
  dead material-symbols dep, error-as-empty-state bugs, a11y gaps, landing
  claim fixes). One audit track (code quality) still running.
- **2026-11-17** — Consolidated report published:
  `docs/audit/AUDIT-REPORTS-2026-11-17.md` (all three completed tracks in
  full + the frontend task list T0–T13). Backend agent should read §1–§3;
  owner reads §4.
- **2026-11-17** — Corpus update landed in AGENTS.md (24,379 active records:
  18,995 firms + 5,461 Form D venture funds; 4,933 emails; 12,102 person
  rows / 4,205 named people). Consequence: **landing-page numbers are now
  stale** (18,995 firms / 4,921 emails) — T3 truth pass will update all
  claims to the new measured values, noting person rows are not
  background-checked or contact-verified. Also affects CR-1 scale planning
  (corpus growing beyond 500k is still expected).
- **2026-11-17** — All four audit tracks complete; consolidated report
  finalized (`AUDIT-REPORTS-2026-11-17.md` §5 = code quality: 460 src lint
  errors, dead validate.ts, 61 silently-skipping tests, F7 migration
  confirmation, F8 repo hygiene w/ PII CSV tracked in git).
- **2026-11-17** — **T1 DONE:** `PRODUCT.md` + `DESIGN.md` written at repo
  root. Key decisions: `@theme` in globals.css is the single token
  authority (legacy `src/styles/*.css` sheets superseded/deleted in T2);
  `--color-brand-dark #06201b` formalized; unused purple/blue template
  ramps removed after grep verification; display type = Instrument Serif
  (landing hero + page titles), body stays Inter; **react-query dropped**
  (0 usages — doctrine is server components for reads + typed fetch helper
  for client islands); remixicon-only icon policy. **T2/T3 + frontend
  hotfixes now running in parallel subagent tracks.**

## 9. Backend worklog (append-only, newest last)

- **2026-11-18** — **Email hardening (H4/H5/H6).** Subject and attachment names are stripped of CR/LF at the Zod boundary and again in the Gmail MIME builder; Google and Microsoft OAuth now set and verify an httpOnly `oauth_state` cookie; token encryption throws instead of deriving a key from the public Supabase URL. Five regression tests in `src/__tests__/email-hardening.test.ts`. M1 (signed unsubscribe) and M2 (stored click destination) still need schema and are not claimed.

- **2026-11-18** — **Manager distinctness measured (B4).** Read-only scripts cluster the 5,461 imported vehicles by name and by shared people: **3,398–4,327 distinct managers**, not 5,461 investors. Name clustering is distorted by SPV platforms (`CGF2021` = 864 filings); people clustering by filing administrators (`n/a Fund GP` = 1,325). No rows changed; write-up and proposed `manager_id` schema in `docs/audit/MANAGER-COLLAPSE-2026-11-18.md`. **Do not quote 5,461 as investors.**

- **2026-11-18** — Reviewed frontend loop-fix commit `b73bf05` (pipeline loading copy, outreach states, profile/outreach fixes) and the landing numbers in `bd3aa25`; counts are consistent with the measured corpus. No blocking issues.
- **2026-11-18** — **Tenant isolation fixed (H1, H3, A-C1).** `getJob/cancelJob/retryJob/listJobs` and `getPendingSends` now require `userId` and filter on `created_by` / `e.user_id`; `/api/email/domain-check` uses the signed-in user, validates the hostname and is rate-limited. Six regression tests added in `src/__tests__/tenant-scoping.test.ts`; `tsc` clean. Live two-account probe remains open.

- **2026-11-17** — Read audit report + coordination board; wrote audit §6
  (backend queue B1–B8, authorities, review protocol, owner decisions).
- **2026-11-17** — **Convex removed.** Deleted `convex.json`, `env-convex.json`,
  four Convex scripts and the Convex-only `qualify-and-promote.js`; removed the
  local `.convex/` backend; stripped Convex keys from `.env.local.template` and
  `env-vercel.json`; corrected the runbook; marked `ARCHITECTURE_FINAL.md`
  superseded; `edgar-mega.js` now writes a plain archive file. No runtime
  imports existed (verified by grep; no Convex dependency in `package.json`).
- **2026-11-17** — **Phase 0 shipped** (`5380eca`): corpus import, per-founder
  matching, profile team/fund facts, dashboard corpus card, outbox, pipeline
  auto-advance. I edited two UI pages before this board existed; future UI work
  goes through the frontend lane (audit §6.1).
