# Implementation Plan — Capital OS

**Date:** October 24, 2026. Companion to `PRODUCT_ROADMAP.md` (which explains *why* each item exists). This is the *how* — every task has acceptance criteria, tests, and effort bands (S ≤ 0.5d, M 1–2d, L 3–5d).

## Phase 1 — Critical fixes & stabilization (P0)

### Task 1.1 — Land the in-flight 22-file workset (M)
- **Who/what:** commit reply-understanding + `supabase/migrations/012_reply_understanding.sql`, analytics distributions RPC + `013_analytics_distributions_rpc.sql`, ingestion jsonb-double-encode fix (db.ts/ingestion.ts/normalization.ts/process-raw-records.ts), `auth-smtp-watchdog.yml`, `scripts/apollo-contacts-pipeline.js` + `docs/AUTH-SMTP-SETUP.md` + `docs/GO-LIVE-PLAN.md`, `supabase/templates/*`.
- **Acceptance:** clean working tree; `npm run typecheck` + `npm test` + `npm run build` green; commit history preserves each logical unit.
- **Tests:** run vitest locally; confirm 87 offline still pass.
- **Effort:** M (just needs careful's staging, code is written).

### Task 1.2 — Apply migrations 012/013 to production (S)
- **Acceptance:** `get_analytics_distributions` RPC callable via service role; 012 tables/policies present; `admin_audit_log` rows for the apply actions.
- **Tests:** re-run nightly access-control + cross-tenant suites after apply (`node scripts/cross-tenant-test.cjs --base-url https://capital-os-nine.vercel.app`) expecting 44/44.

### Task 1.3 — Supabase Auth custom SMTP (S)
- Steps per `docs/AUTH-SMTP-SETUP.md`: Gmail app password → Supabase Custom SMTP → watchdog cron configured.
- **Acceptance:** `node scripts/auth-smtp-values.js --verify` receives reset email; production signup of a fresh test account confirms via received email; `auth-smtp-watchdog.yml` commits and at least 3 nightly runs green.
- **Tests:** authflow suite on prod (signup → confirm → sign-in → reset).

### Task 1.4 — Repoint dead direct-DB scripts + purge docs ghosts (M)
- Rotate `SUPABASE_DB_PASSWORD`; pooler hostname (`aws-1-<region>.pooler.supabase.com`) in scripts/restore + backup tooling; README + ARCHITECTURE rewritten to match current code (no Convex, ~19K investors, real Stripe implemented); archive stale docs of the Aug era into `docs/archive/` (do not delete, preserve history).
- **Acceptance:** restore dry-run works; grep finds no Convex claim outside history.

### Task 1.5 — Outage guards (M)
- Daily anti-pause heartbeat (CI cron → health endpoint), deploy-time check that the `NEXT_PUBLIC_SUPABASE_URL` bundle ref resolves.
- **Acceptance:** heartbeat in actions; artifact guard blocks bad deploys.

## Phase 2 — Core product completion (P1)

### Task 2.1 — Contact data acquisition run (L) — *the* task
1. Configure Apollo key (`APOLLO_API_KEY`) + ZeroBounce budget key.
2. `node scripts/apollo-contacts-pipeline.js --input data/your-apollo-export.csv --dry-run` — review accepted/rejected counts.
3. Live run → `--verify --verify-budget 500 --verify-only` (~$4 first batch; scale after quality is proven).
4. `--stage-records` → `npx tsx src/scripts/process-raw-records.ts 500 --provider=apollo-contacts`.
5. Batch re-score: `npx tsx src/scripts/qualify-investors.ts` (contactability factor now non-zero).
- **Acceptance:** ≥ 1,000 investors with verified deliverable emails; duplicate emails resolved against existing rows (idempotent via unique indexes); fit distribution report (≥ 20% ≥ 70).
- **Tests:** idempotency (double run = no dupes); dedup counts; sample of 25 records manually verified against live sources (no fit-score inflation).
- **Risks:** Apollo data quality mismatches (employee-count gates), email verification budget overruns (capped by `--verify-budget`).

### Task 2.2 — First campaign loop (L calendar, M effort)
1. Connect founder Gmail/Graph via settings OAuth (SMTP fallback: app password).
2. Start warmup; 2-week ramp (5→35/day; do not override).
3. Select 25–50 targets from Task 2.1 in Discover → save → campaign → AI 3-step sequence → review every draft → enroll → step 1 send.
4. Daily: email health card, bounce < 3%, complaint → critical.
- **Acceptance:** 25+ sends, tracked opens/clicks, ≥ 1 reply parsed by reply-understanding into a `reply_insights` row and shown in outreach thread; stop-on-reply observed on that thread; suppression of a bounce automatically appears in Suppression tab.
- **Tests:** on live data (the point), plus regression suites (sender, tracking) still green after any fix-the-loop produces.

### Task 2.3 — Approval & billing enforcement audit trail (S)
- Every `email_messages` row must reference `campaign_id`, `sequence_id`, `approved_draft_id` (+ user), and pre-send credit deduction visible in `credit_ledger`.
- **Acceptance:** SQL join from send → approval chain returns rows; attempt a send with 0 credits → 402 path.

### Task 2.4 — Stripe founding-member E2E (M)
- Add live keys (user-in-dashboard; never in chat); webhook endpoint configured in Stripe with secret; test-mode first.
- **Acceptance:** test purchase → `founding_members` row → webhook processed idempotently (double-delivery safe) → admin finance reflects; then production keys.

### Task 2.5 — Pipeline semantics (S)
- `/api/investors/pipeline` routes `user_pipeline_entries` to the stored pipeline display; batch stage renamed `dataset_status` in payload; UI labels updated.
- **Acceptance:** the two-tenant harness passes; perceived counts explainable in one sentence.

## Phase 3 — Market-ready experience (P2, parallelizable)

- **PostHog** event schema + funnel; **Sentry** wiring (Final DSN in Vercel); 1 day each. Events: `signup_started/completed`, `onboarding_step_n`, `investors_searched (query_shape)`, `investor_saved`, `draft_generated`, `draft_approved`, `email_sent`, `reply_received`, `upgraded`.
- Landing truth pass; testimonials honesty; support route; docs regen (CD Phase C5).
- Privacy pack: export/deletion flow + NDPB posture page (M).

## Phase 4 — Infra & ops hardening (P2)

- Off-site nightly export (email_messages/users/company_profiles → object store) (M).
- Upstash env verify + burst probe (S manual).
- Bucket policy review (S manual).

## Phase 5 — Pilot & validation (P3-E in roadmap)

- Discovery interviews ×10 (script nudge: how do you keep the list, send, follow up, decide; what did the last interesting investor conversation lack).
- 20 founding members recruited via founder-network + accelerator intros; $9.99 founding; measured activation: saved list ≤ 1 session + first send ≤ 7 days.
- Weekly learning review; ship stop rules from GO-LIVE-PLAN (bounce > 3%, health red) unchanged.
- Kill criteria: < 5 of 20 pilots reach first send in 14 days → fix the flow before recruiting more; pilots who reach it but churn → interview for the missing value, not more features.

## Rollout order & parallelism

```
Week 1: 1.1–1.5 (stabilization, all parallel except 1.1→1.2)
Week 2: 2.1 (long-running data work) ∥ 2.4 Stripe ∥ Phase 3 hooks (Sentry/PostHog)
Weeks 3–4: 2.2 campaign calendar (warmup-gated) ∥ 2.3/2.5 ∥ Phase 4
Week 5–6: Phase 5 pilot running; support load; iterate on B-tier feedback
```

Total engineering effort: **≈ 12–18 focused days**; total elapsed: **4–6 weeks** (calendar-driven by warmup + pilot recruitment).

## Minimum production-ready definition (executed checks, honestly marked)

- [x] Build/typecheck/test gates green (verified this audit)
- [ ] Migrations 012/013 applied + suites green post-apply
- [ ] 1,000+ verified contacts + fit distribution
- [ ] First 25–50 sends with ≥ 1 tracked reply + green health
- [ ] One Stripe purchase E2E + billing ledger consistency
- [ ] Sentry+PostHog live for 1 week with zero unknown error class
- [ ] Support reachability + privacy posture page
- [ ] 7 consecutive green nights on the security suites
