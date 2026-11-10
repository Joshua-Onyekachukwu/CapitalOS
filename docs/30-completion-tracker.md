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
| 2 | Investor discovery | PARTIAL | **PARTIAL** | Search/filters real. Firm-name, cheque-size and thesis filters now also sit on the main investor database list, sharing Discover's parser; the page states coverage (14 cheque, 26 thesis) so narrow results are explainable. Portfolio and lead/follow remain data-blocked (no portfolio rows). |
| 3 | Investor intelligence profiles | PARTIAL | **PARTIAL** | Provenance + evidence tiers real. Thesis 26 rows, cheque 14 rows, no portfolio. Blocked on population. |
| 4 | Fundraising CRM | PARTIAL | **PARTIAL** | Tasks, reminders (due dates, overdue, snooze) and a merged timeline are built (`crm_tasks`, migration 038, applied live). Lists have a hub and membership UI. Per-investor activity (tasks, meetings, stage moves, saves, emails) is on each investor record. Still missing: bulk update and shared/team assignment (blocked on the org model). |
| 5 | Intelligent matching | PARTIAL | **PARTIAL** | Engine real; inputs empty. `fit_feedback` table exists (023), feedback loop not wired. |
| 6 | Investor outreach | PARTIAL | **BLOCKED** | `email_messages` = 0. Needs a mailbox + warmup. Sending path is unit-covered, not proven live. |
| 7 | Warm introductions | MISSING | **PARTIAL** | Record-keeping is real: `introductions` (038) with route (direct/warm/cold), via contact, target and status. No warm graph and no data source — the graph still needs D3. |
| 8 | Fundraising pipeline | PARTIAL | **PARTIAL** | 21 stages shipped (`docs/28`). Drag-and-drop between stages, lost-reason capture on drop (stored on the entry and the event) and per-investor stage history are now built. Still missing expected-vs-actual and conversion math. |
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
| Grants / accelerators | MISSING | **PARTIAL** | `/dashboard/opportunities` records grants, accelerators, events and challenges with the founder's own status. No source integration: nothing is discovered or refreshed. |
| Fundraising reports | PARTIAL | **PARTIAL** | `/dashboard/reports`: pipeline, outreach and conversion sections, CSV export of pipeline and outreach, and a print view. No true PDF generation, and conversion sections read empty until sends exist. |
| Collaboration | MISSING | **NOT STARTED** | No org/team model. Every table is single-owner. |
| Deliverability console | PARTIAL | **PARTIAL** | The four email-health pages are merged into `/dashboard/deliverability` (Overview / Analytics / Domain / Warm-up) with redirects from the old paths. Health tables are empty because nothing has been sent. |
| Investor comparison & bulk shortlist | MISSING | **COMPLETE (code)** | Select up to four investors for a side-by-side comparison and bulk-save a selection to the shortlist. Not exercised with a signed-in session. |
| Sequences | MISSING | **PARTIAL** | `/dashboard/sequences` is a read-only hub over `campaign_sequences` and steps. No sequence editor. |

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

## Shipped since the last pass (2026-11-10)

Commit `3c464b4` plus the pipeline/compare work after it. Every page below is a
real surface reading real tables; none invents data. Empty states say so.

- CRM (tasks, reminders, global and per-investor merged timeline), Lists
  (hub + membership), Introductions, Opportunities, Reports (CSV + print),
  Intelligence, Sequences — the eight pages listed as "not built at all".
- Deliverability consolidation with tabs and redirects.
- Investor database: firm-name, cheque-size and thesis filters, comparison
  (≤ 4) and bulk shortlist.
- Pipeline: drag-and-drop, lost-reason capture, per-investor stage history.
- Intelligence page is built from `investor_facets` and states plainly which
  streams (news, portfolio, competitor, grants) are not connected, rather than
  simulating them.

Verified: `npx tsc --noEmit` clean, `next build` clean, Vercel deployment READY,
landing 200, every new route 307s to `/login` when signed out.
**Not verified:** any signed-in interaction (no E2E credentials here), and
nothing that depends on sent mail (0 emails) or firm data (0 firm links).

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
| `tsc --noEmit` | 0 errors | 0 (2026-11-10) | MET |

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
