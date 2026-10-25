# Capital OS — Consolidated Product Roadmap

**Date:** October 24, 2026. This roadmap consolidates: the shipped state (verified in `SYSTEM_AUDIT.md`), the in-flight uncommitted work, previously planned items (docs 14/15/17), and newly discovered launch requirements. Rule: **nothing listed as complete is included as new work.**

## What's already delivered (no new work needed)

Discovery UI (search/facets/detail/fit), onboarding, company profiles, pipeline (entries + events + 11 stages), saved filters/notes, outreach draft/send/track/unsubscribe/suppress mechanisms, email health suite, campaigns/sequences skeleton, AI copilot + AI activity + credits, billing architecture, admin suite (12 pages), nightly prod security suites, restore runbook, cross-tenant harness, two completed data ingests (18,995 investors).

## Tier A — Critical fixes & stabilization (P0)

| ID | Task | Why | Status → DoD |
|---|---|---|---|
| A1 | **Commit the in-flight work coherently** (reply-understanding + migration 012, analytics RPC + migration 013, ingestion jsonb fix, auth-SMTP watchdog workflow, Apollo contacts pipeline script, templates) | 22 uncommitted files = lost work + deployed/committed drift | Files committed; typecheck/test/build green; migrations applied to prod |
| A2 | **Apply migrations 012/013 to prod DB** | Analytics page calls `get_analytics_distributions`; reply classification needs 012 | SQL applied; RPC callable; nightly suites still 44/44 |
| A3 | **Supabase Auth custom SMTP + reset-email E2E** | Accounts requiring confirmation can't confirm — every signup is dead weight | `auth-smtp-values.js --verify` receives reset email; signup E2E receives confirmation |
| A4 | **Ware G-infrastructure hygiene** — restart migration/backup scripts (B5 DB-pooler creds), delete Convex claims from README/ARCHITECTURE (B3) | Restores outage-recovery tooling; stops teams repeating destroyed-data incidents | Scripts run; docs match code |
| A5 | **Anti-pause heartbeat + deploy-bundle check** (from INFRA doc §E) | Sept 2026 outage recurrence | CI step runs daily; deploy check fails on unresolvable Supabase ref |

## Tier B — Core product completion (P1, launch-critical)

| ID | Task | Why | DoD |
|---|---|---|---|
| B1 | **Contact acquisition pipeline in production** — run Apollo contacts pipeline on the ledger CSV; verify emails (ZeroBounce, budget-capped); stage as `raw_records`; promote with normalization; re-run batch fit scoring | THE product gap: 0 contactable investors | ≥ 1,000 investors with verified deliverable emails + fit distribution (≥ 20% ≥ 70) |
| B2 | **First real outreach cycle** — connect founder mailbox, complete warmup ≥ 2 weeks, send step-1 to 25–50 verified targets, track opens/clicks, monitor replies | Mechanism tested but unused; confidence in the whole loop is zero tracks to zero sends | 25–50 sends; < 3% bounce; ≥ 1 reply; health score green |
| B3 | **Founder approval loop hardening** — draft persistence (done), approve→send audit trail, per-campaign limits enforced server-side per credits, no auto-send | Guarantees product promise to paying users | Every send traces to an approved draft id + campaign id in `email_messages` |
| B4 | **Reply-understanding wired to UI** (pending A1/A2) — thread view shows classified interest + suggested draft + auto-pause | The single highest-value differentiator in the pipeline story | One real reply produces classified insight in UI |
| B5 | **Stripe founding-member E2E with live keys** | Charging the pilot users requires it | Test-mode session → webhook → founding_members row → credit grant → admin finance page reflects it; then publish |
| B6 | **Pipeline semantics fix** (B4 in audit) — user_pipeline_entries as displayed truth; batch-qualification shown as dataset status | Mixed semantics mislead the user ("12,108 qualified" ≠ their pipeline) | Pipeline UI reads user entries; dataset batch status carries an explicit source label |

## Tier C — Market-ready experience (P2)

| ID | Task | Why | DoD |
|---|---|---|---|
| C1 | Onboarding activation polish — first-session value (a saved, high-fit list within 15 min) | The activation metric for pilot | Time-to-value instrumented (PostHog); wizard completion tracked |
| C2 | Landing truth pass — testimonials honest, investor counts current, pricing copy synced | Trust before paying | Landing matches live data |
| C3 | Product analytics + error monitoring (PostHog, Sentry) — event schema for: signup, onboarding_steps, discover_search, save, draft, approval, send, reply, upgrade | Cannot run a pilot blind | Events flowing; funnel dashboard |
| C4 | Support surface — support email/in-app contact + known-issues page | Pilot users need a hotline | Contact route live; response-time promise documented |
| C5 | Docs regen — README/ARCHITECTURE rewritten from code (remove Convex/CockroachDB ghosts; the audit docs are the new baseline) | Onboarding future contributors/agents | Docs match code; link to docs/audit/* |
| C6 | Privacy posture drafting — NDPB (Nigeria) statement, data export + deletion flow, retention policy | Selling to Nigerians with EU links lays obligations | Statement page + export/deletion flow exists |

## Tier D — Infrastructure & operational readiness (P2, in parallel with C)

| ID | Task | Why |
|---|---|---|
| D1 | Off-site nightly backup export of user data | Investor data regenerates; user data does not |
| D2 | Upstash Redis env verification (prod + preview) | Limiter claims remain theoretical otherwise |
| D3 | Storage bucket policy review | Unknown policy state |
| D4 | Sentry + PostHog deployment (as C3 infra side) | — |
| D5 | Storage of tracking events with 24-month purge cron | Retention hygiene |

## Tier E — Pilot & market validation (P3, runs after B ≈ onramp of money)

See `IMPLEMENTATION_PLAN.md` Phase 5; headline: 10 discovery interviews (4 Lagos angels, 4 founders mid-raise, 2 diaspora), 20 founding-member pilot seats at $9.99, activation metric = saved list + first send within 7 days; pricing experiment: $9.99 founding vs $29 standard vs annual discount; success signals: ≥ 40% of pilot users reach a verified first send, ≥ 30% still active at week 4, ≥ 5 shareable case stories.

## Tier F — Growth & scaling (post-pilot, P3)

Deliberately un-spelled: React Native/PWA, team/multi-seat, public API, calendar integration, pgvector semantic search tuning beyond the hybrid search already present, EDGAR XML partner-name extraction at scale, Crunchbase-class enrichment (needs paid data). Each is gated by measured pilot demand and revenue; nothing here delays launch (per audit work rule 12).

## Sequencing & parallelism

```
A1 ─┬─ A2 ─ B4                      (sequential; migration-gated)
    ├─ A3 ─────────────┐
    └─ A4/A5 (parallel)├─ B1 → B2 → B3 ──┬─ E-pilot
C3/C4/C5/C6 (parallel for most of their work)   ┘            ├─ (B5 in parallel with B1)
D1–D5 (any time; independent)
```

Critical path: **A1 → A2 → B1 → B2.** Estimated elapsed: 2–4 weeks to a first-send pilot, dominated by the warmup calendar, not engineering.
