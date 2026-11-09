# Completion tracker — every PARTIAL / MISSING item from the audits

Date opened: 2026-11-04
Sources: `docs/20` §2 (module verdicts), `docs/20` §2 Section 7 table,
`docs/21` §2.4 (UI-only list). This file is the working board; a module is only
`COMPLETE` here when a command or a live check is cited against it.

Status vocabulary: **COMPLETE** (verified) · **PARTIAL** · **BLOCKED** (external
dependency) · **NOT STARTED**. "Needs re-check" means the audit predates recent
migrations and the claim has not been re-measured since.

## Core modules

| # | Module | docs/20 verdict | Now | Evidence / what remains |
|---|---|---|---|---|
| 1 | Founder dashboard | PARTIAL | **PARTIAL** | Fabricated zeros removed (`docs/21` §16). No next-action engine; cards still depend on empty data. |
| 2 | Investor discovery | PARTIAL | **PARTIAL** | Search/filters real. Cheque-size, thesis, portfolio, lead/follow filters remain non-functional because the columns are empty (population problem, not code). |
| 3 | Investor intelligence profiles | PARTIAL | **PARTIAL** | Provenance + evidence tiers real. Thesis 26 rows, cheque 14 rows, no portfolio. Blocked on population. |
| 4 | Fundraising CRM | PARTIAL | **PARTIAL** | Notes/pipeline real. `investor_lists` tables exist (023) with no UI; tasks and reminders unbuilt. |
| 5 | Intelligent matching | PARTIAL | **PARTIAL** | Engine real; inputs empty. `fit_feedback` table exists (023), feedback loop not wired. |
| 6 | Investor outreach | PARTIAL | **BLOCKED** | `email_messages` = 0. Needs a mailbox + warmup. Sending path is unit-covered, not proven live. |
| 7 | Warm introductions | MISSING | **NOT STARTED** | No table, no graph, no data source. Needs a decision (D3). |
| 8 | Fundraising pipeline | PARTIAL | **PARTIAL** | 21 stages shipped (`docs/28`). Still missing target amount/valuation rollup, expected-vs-actual, conversion math. |
| 9 | AI copilot | REAL | **PARTIAL** | Real context assembly; no registered tool/action layer or execution audit, so it cannot *do* work. |

## Additional modules

| Module | docs/20 | Now | Evidence / remains |
|---|---|---|---|
| Startup profile | REAL | **COMPLETE** | Intact; `target_cheque_min/max` now exposed and writable. |
| Fundraising readiness | PARTIAL | **COMPLETE** | `docs/29` — scored from real fields, live-verified (74 on Quadra Robotics). |
| Pitch deck intelligence | PARTIAL | **PARTIAL** | Generation real. Bucket now exists; analysis of an uploaded deck not re-verified this session. |
| Data room | MISSING | **NOT STARTED** | No sharing table, no investor-scoped access, no expiry. Storage bucket exists. |
| Meeting manager | PARTIAL | **PARTIAL** | `meetings` table + scoped CRUD (`docs/21` §16). Calendar sync and briefs unbuilt. |
| Investor news | MISSING | **NOT STARTED** | No source. Needs D3. |
| Portfolio intelligence | MISSING | **NOT STARTED** | No portfolio table; `portfolio_count` = 0 everywhere. |
| Competitor intelligence | MISSING | **NOT STARTED** | No source. Needs D3. |
| Market intelligence | MISSING | **NOT STARTED** | No source. Needs D3. |
| Grants / accelerators | MISSING | **NOT STARTED** | No taxonomy, no source. |
| Fundraising reports | PARTIAL | **PARTIAL** | CSV export real. No PDF or pipeline report; no conversion metrics to report yet. |
| Collaboration | MISSING | **NOT STARTED** | No org/team model. Every table is single-owner. |

## Admin & infrastructure (Section 7)

| Item | docs/20 | Now | Remains |
|---|---|---|---|
| User management | REAL | **COMPLETE** | — |
| Investor management | REAL | **COMPLETE** | — |
| Organization management | UI ONLY | **UI ONLY** | `investor_firms` still 0 rows. Blocked on population. |
| Data management | REAL | **COMPLETE** | — |
| AI management | PARTIAL | **PARTIAL** | Stats surface only; no model/provider config or caps. |
| Job management | REAL | **COMPLETE** | — |
| Source management | REAL | **COMPLETE** | — |
| Billing management | PARTIAL | **PARTIAL** | Sprint / Retention / B2B catalog applied (`037_lifecycle_plans.sql`) and checkout issues one-time Sprint sessions (`billing_model = 'one_time'`). The charge itself is still blocked on `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`; 0 billing events. |
| Analytics | PARTIAL | **PARTIAL** | PostHog wired, no key set. |
| Support | PARTIAL | **PARTIAL** | `/support` page only. |
| Security | REAL | **COMPLETE** | Cross-tenant suite 50/50 (`docs/25`). |
| Feature flags | MISSING | **NOT STARTED** | No table, no evaluation. |
| Migration drift | BROKEN | **COMPLETE** | 22 files, 22 applied, 0 pending; `db:status` green. |
| Document upload | BROKEN | **PARTIAL** | Bucket exists and upload errors surface. `storage.objects` has **no RLS policies** — uploads depend on server-side path; needs policy work before sharing. |

## Data targets from `docs/20` §7

| Criterion | Target | Measured 2026-11-04 | Verdict |
|---|---|---|---|
| Firm linked | ≥ 60% | 0% (`current_firm_id` null on all) | NOT MET |
| Cheque range | ≥ 40% | 14 / 18,995 | NOT MET |
| Thesis text | ≥ 40% | 26 / 18,995 | NOT MET |
| Email | ≥ 50% | 25.9% | NOT MET |
| `outreach_readiness='ready'` | ≥ 500 | 0 | NOT MET |
| Score 85+ | ≥ 200 | ceiling ~87, cohort unmeasured | NOT MET |
| One real send + reply | yes | 0 sends | NOT MET |
| Deck uploaded and openable | yes | 6 rows, all `file_url` null | NOT MET |
| Fresh DB rebuildable | yes | 22/22 applied | MET |
| `tsc --noEmit` | 0 errors | 0 | MET |

Every unmet data target has the same root cause: the corpus is 60% funds-of-funds
and 35% wealth advisers (`docs/23` §4). No amount of code moves those numbers.

## Corpus change in progress: 500k+

Date noted: 2026-11-05. The 18,995-firm corpus is being replaced with **500,000+
investor records**. Consequences for this tracker:

- Every "NOT MET" row in the data table above is **superseded**, not fixed. Re-measure
  against the new corpus before quoting any number, and update `AGENTS.md` +
  `src/components/Landing/*` in the same commit as the new counts.
- Scale becomes an MVP requirement, not a later task: deep pagination, facet counts and
  search latency at 500k rows must be verified before the demo, not after.
- Modules 2, 3, 4, 5 (discovery, intelligence profiles, CRM, matching) stop being
  data-blocked as soon as the import lands, so their UI gaps become the binding
  constraint.
- Firm linkage (`current_firm_id`) and `investor_people` stay empty until the import
  populates them — the W0 entity split is ready for that but has never been exercised
  at scale.

## Order I will work in

1. **Unblocked code, real data:** pipeline targets + conversion (module 8), data
   room (needs only storage policy work + a table), collaboration (org model),
   feature flags, AI management config.
2. **Blocked on credentials:** outreach (6), billing (B5), analytics.
3. **Blocked on a decision (D3):** introductions (7), news, portfolio,
   competitor, market, grants — each needs a named source before any code.
4. **Population:** modules 2, 3, 4, 5 and the data targets only move when the
   investor corpus is replaced with real venture funds.
