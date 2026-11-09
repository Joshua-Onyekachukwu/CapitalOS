# Capital OS — Blueprint Audit & MVP Development Plan

**Date:** 2 November 2026
**Scope:** Feature-by-feature comparison of the Capital OS blueprint against the code and live database as they exist today.
**Method:** Static read of every page/API/service, plus read-only queries against the live Supabase project (`tvekoojdilkjptjzpvqo`) for real row counts, column fill rates, and storage buckets.

**Classifications**

| Label | Meaning |
|---|---|
| **REAL** | Implemented, wired end-to-end, and backed by data or a working external call |
| **PARTIAL** | Implemented but missing a materially important piece |
| **UI ONLY** | The interface exists; the underlying behaviour does not |
| **MISSING** | Not implemented |

---

## 0. Headline finding

Capital OS is **not** a demo. It has 49 pages, 76 API routes, 43 services, and 16 migrations — the workflow skeleton of the whole blueprint already exists. The problem is not missing screens.

The problem is **the data is wide but shallow, and several load-bearing pieces are silently broken**:

1. **18,995 investors — but almost none are usable.** Zero cheque sizes, zero investment theses, zero firm links, and **not a single investor is `outreach_readiness = 'ready'`**.
2. **The `investor_firms` table has 0 rows.** Every "organization" and "firm" concept in the UI is empty.
3. **The pitch-deck upload is broken because the storage bucket does not exist.** Only `data-archive` exists; `company-documents` was never created.
4. **The dashboard analytics and cockpit routes were throwing at runtime** (`createClient()` called with no arguments). Fixed during this audit.
5. **The app's own scoring says everything is low quality**: no investor scores above 69 on `data_quality_score`, none above 79 on `fit_score`.

So the MVP work is **enrichment + repair + consolidation**, not new feature construction. That matches your read: we already have the things, we need to arrange them and make them actually hold data.

---

## 1. Live database reality (measured)

### Table row counts

| Table | Rows | Note |
|---|---:|---|
| `investors` | 18,995 | core catalog |
| `raw_records` | 16,840 | scraped, not fully promoted |
| `investor_data_sources` | 5,069 | provenance exists — good |
| `profiles` | 406 | |
| `background_jobs` | 272 | job machinery works |
| `duplicate_candidates` | 86 | |
| `admin_audit_log` | 76 | |
| `investor_sectors` | 24 | |
| `company_profiles` | 4 | |
| `company_documents` | 6 | orphaned — bucket missing |
| `investor_profiles` | 4 | AI summary layer barely used |
| `email_accounts` | 3 | |
| `saved_investors` | 1 | |
| `user_pipeline_entries` | 2 | |
| `user_subscriptions` | 4 | |
| **`investor_firms`** | **0** | **firm layer empty** |
| **`email_messages`** | **0** | **outreach never actually sent** |
| `email_threads` | 0 | |
| `email_tracking_events` | 0 | |
| `reply_insights` | 0 | |
| `campaigns` | 0 | |
| `copilot_conversations` | 0 | |
| `investor_search_history` | 0 | |

### Column fill rates on `investors` (of 18,995)

| Column | Populated | % |
|---|---:|---:|
| `full_name` | 18,995 | 100% |
| `country` | 18,073 | 95% |
| `city` | 17,951 | 95% |
| `location` | 17,620 | 93% |
| `job_title` | 12,203 | 64% |
| `bio` | 12,203 | 64% |
| `is_verified = true` | 12,202 | 64% |
| `source_id` | 12,241 | 64% |
| `edgar_last_filing_date` | 12,195 | 64% |
| `thesis_embedding` | 18,880 | 99% |
| `website_url` | 5,496 | 29% |
| **`email`** | **4,921** | **26%** |
| **`linkedin_url`** | **796** | **4%** |
| `qualification_notes` | 5,424 | 29% |
| **`min_check_size`** | **0** | **0%** |
| **`max_check_size`** | **0** | **0%** |
| **`investment_thesis`** | **0** | **0%** |
| **`current_firm_id`** | **0** | **0%** |
| **`portfolio_count`** | **0** (non-zero) | **0%** |
| `first_name` / `last_name` | **0** | **0%** |
| `phone`, `twitter_url` | 0 | 0% |
| `role_normalized`, `content_hash`, `avatar_url` | 0 | 0% |

### Score distribution (computed over the full table)

`fit_score` — 0: 1 · 1–49: 207 · 50–69: 786 · 70–79: 6 · 80–89: 0 · **90+: 0**
`data_quality_score` — 0: 74 · 1–49: 917 · 50–69: 9 · 70+: **0**

> **This is the single most important number in the audit.** The blueprint's target is founders getting matched to genuinely relevant investors. Today the platform cannot produce a single 90+ match, because the fields that drive a 90+ score (cheque size, thesis, firm, portfolio) are entirely empty for every record.

### Enum spread (sample of 1,000)

- `verification_status`: `ai_classified` 393, `verified` 603, `unknown` 4 — the evidence tiering the blueprint asks for **exists**.
- `outreach_readiness`: `needs_verification` 798, `not_ready` 202 — **zero** `ready`.
- `investor_type`: `angel_investor` only in the sample — the 18-category taxonomy is not being applied.
- `source_provider`: `edgar_restore_2026_09`, `iapd`, `sec_edgar` — **one dominant provider**, the exact single-provider dependency the blueprint warns against.

### Storage

Buckets: **`data-archive` (private) only.**
`company-documents` **does not exist** → `uploadCompanyDocument()` fails at the storage step and returns `null`. This is the confirmed root cause of "can't upload the pitch deck".

### Tables referenced in code but absent from the database

`investor_notes`, `meetings`, `introductions`, `send_audit_trail`, `investor_introductions`.
Notes are instead written to `data_change_log` (attributed, works). Meetings are derived from `email_messages` (which has 0 rows).

### Schema drift

Migrations are **not** the source of truth. These tables are used by the app and exist live, but are created outside the migration set:

`campaigns`, `user_pipeline_entries`, `pipeline_events`, `copilot_conversations`, `saved_filters`, `email_warmup`, `email_suppression_list`, `email_sending_log`, `email_health_events`, `email_health_scores`, `email_domain_health`, `waitlist`, `founding_members`, `audit_log`, plus views `v_investors_with_firms`, `v_pending_duplicates`, `v_data_health`, `v_provider_usage`.

**Consequence:** a fresh environment cannot be rebuilt from `supabase/migrations/`. This must be fixed before any real deployment work.

---

## 2. Blueprint module-by-module verdict

### 1. Founder dashboard — **PARTIAL**
- **REAL:** `/dashboard` shell, `/api/dashboard/cockpit`, per-user scoping, recent investors, pipeline summary.
- **Was broken:** `computeCockpit` called `createClient()` with no arguments (no URL/key) → runtime throw. Now fixed to use the cookie-scoped SSR client, so RLS actually applies.
- **Gap:** `highFitInvestors`, `meetingsScheduled`, `avgFitScore`, `investorsThisWeek`, `topSectors` are hard-zeroed in the response. `totalFirms` is hard-`0`.
- **Gap:** no "recommended next actions" engine.

### 2. Investor discovery — **PARTIAL**
- **REAL:** `/dashboard/investors` + `/dashboard/investors/discover`; `/api/investors` with pagination, `search`, `type`, `country`, `city`, `readiness`, `verified`, `minScore`, `hasEmail`, `hasLinkedin`, `stage`, `sector`, `sectors`, `stages`, `evidence`, sorting; `/api/investors/facets` for facet counts; `/api/investors/fit-analysis`; `/api/saved-filters`.
- **MISSING:** cheque-size filter (no data), investment-thesis filter (no column data), portfolio-company filter (no data), firm/organization filter (0 rows in `investor_firms`), lead/follow preference (no column), "active investment status" beyond `is_active`, saved-search **alerts** (saved filters persist but nothing notifies), bulk shortlist.
- The code even carries a comment: *"this dataset has no firm names on investor rows (`current_firm_id` is null)"* — a known, documented dead end.

### 3. Investor intelligence profiles — **PARTIAL**
- **REAL:** `/dashboard/investors/[id]`, `/api/investors/[id]`, provenance via `investor_data_sources` (5,069 rows), `verification_status` tiers, `last_verified_at`, `evidence_streams`, embeddings on 99% of rows.
- **MISSING:** thesis text, cheque range, portfolio companies, exits, co-investors, firm details — all 0%. Profile-completeness indicator exists only as `data_quality_score`, which caps at 69.
- `investor_profiles` (AI summary) has **4 rows** — the intelligence layer is effectively unused.

### 4. Fundraising CRM — **PARTIAL**
- **REAL:** `saved_investors` (user-scoped RLS), `user_pipeline_entries`, `pipeline_events`, notes via `data_change_log`, CSV import/export (`csv-import.ts`, `/admin/data-sources/import`), dedup (`duplicate_candidates`, `/admin/review/duplicates`), Kanban `/dashboard/pipeline`.
- **MISSING:** tasks, follow-up reminders, custom fields, custom stages (stages are a fixed 11-stage list in `pipeline/stages.ts`), contact ownership/teams, interaction timeline UI, bulk update.

### 5. Intelligent investor matching — **PARTIAL (weakest area)**
- **REAL:** `qualification.ts` (457 lines) computes `fit_score` with weighted, explained factors and a `fit_score_breakdown` JSON; `matching.ts` has `findMatchingInvestor` and `detectDuplicates`; `fit-scoring.test.ts` exists.
- **Why it underperforms:** the scorer is starved of inputs. With no cheque size, no thesis, no firm and no portfolio, it can only weigh sector/stage/location/quality — which is why the ceiling is 79.
- **MISSING:** founder feedback loop, "next best investor" recommendation, disqualifier highlighting, confidence/freshness surfaced in the match object, semantic (pgvector) ranking actually used in the match path.

### 6. Investor outreach management — **PARTIAL**
- **REAL:** `/dashboard/outreach`, `/api/outreach/draft`, `/api/outreach/send`, `/api/outreach/sequence`, sequences (`campaign_sequence_*`), 7 branded templates, open/click tracking routes, suppression list, warmup, domain health, sending guard, SMTP + IMAP + OAuth (Google/Microsoft), reply detection + reply understanding.
- **MISSING / unproven:** **`email_messages` = 0 rows.** Nothing has ever been sent through this stack. Sending limits exist in `sending-guard.ts` but are untested against the real provider. LinkedIn templates absent. Calendar meeting-request flow unproven.

### 7. Warm introductions & relationship mapping — **MISSING**
- No tables, no UI, no graph. `introductions` and `investor_introductions` do not exist.
- **This is correctly the lowest priority** and should stay out of the MVP.

### 8. Fundraising pipeline — **PARTIAL**
- **REAL:** `/dashboard/pipeline` Kanban, 11 stages, `user_pipeline_entries` + `pipeline_events`, conversion-oriented stage model.
- **MISSING:** target amount / target valuation / instrument / target cheque, expected vs actual funding totals, conversion-rate math, timeline view. `company_profiles.funding_amount` exists but is not aggregated into pipeline.

### 9. AI copilot — **REAL**
- `/dashboard/copilot`, `/api/copilot`, `/api/copilot/conversations`, `actions/copilot.ts` (290 lines) genuinely queries `investors`, `saved_investors`, `company_profiles`, `email_messages`, `campaigns` and builds a real context prompt with explicit "cite specific investors, no fluff" instructions.
- **Gap:** `copilot_conversations` = 0 rows, so memory persistence is unexercised.

### Additional modules

| Module | Verdict | Evidence |
|---|---|---|
| Startup profile | **REAL** | `company_profiles`, team members, `/dashboard/startup`, onboarding saves all fields |
| Fundraising readiness | **PARTIAL** | `readiness_score` column exists and is selected; no scoring service found |
| Pitch deck intelligence | **PARTIAL** | `deck/generator.ts` (633 lines) + `pptxgenjs`, `/dashboard/decks`, `/api/deck/generate` — *generation* works; *analysis/upload* is broken (bucket) |
| Data room | **MISSING** | no table, no investor-scoped sharing |
| Meeting manager | **PARTIAL** | `/dashboard/meetings` + `/api/dashboard/meetings` + `/api/meetings/schedule`; derived from `email_messages` (0 rows), so empty |
| Investor news intelligence | **MISSING** | none |
| Portfolio intelligence | **MISSING** | `portfolio_count` all zero |
| Competitor intelligence | **MISSING** | none |
| Market intelligence | **MISSING** | none |
| Grants / accelerators | **MISSING** | no taxonomy |
| Fundraising reports | **PARTIAL** | CSV export exists; no PDF/pipeline report |
| Collaboration | **MISSING** | no org model, single-user only |

### Section 7 items (admin & infrastructure)

| Admin module | Verdict |
|---|---|
| User management | **REAL** — `/admin/users`, role API, `requireAdmin` on `app_metadata` only |
| Investor management | **REAL** — `/admin/investors`, enrich, qualify, dedup |
| Organization management | **UI ONLY** — `/admin/investor-firms` exists, table has 0 rows |
| Data management | **REAL** — import, Apollo, EDGAR scrape, dedup review |
| AI management | **PARTIAL** — `/admin/ai` shows stats; no model config |
| Job management | **REAL** — `background_jobs` 272 rows, `/admin/data-sources/jobs`, `/api/jobs/[id]` |
| Source management | **REAL** — `/admin/data-sources`, `data_providers`, 5,069 provenance rows |
| Billing management | **PARTIAL** — plans/events/subscriptions tables; `/admin/finance`; 0 billing events |
| Analytics | **PARTIAL** — PostHog wired (no-op without key) |
| Support | **PARTIAL** — `/support` page only |
| Security | **REAL** — `admin_audit_log`, security lockdown migration, cron security alert |
| Feature flags | **MISSING** |

### Security posture

- RLS is enabled on all 35 tables declared in migrations. Tenant tables (`saved_investors`, `company_profiles`, `company_documents`, `email_*`, `campaign_*`, `credit_*`) are `auth.uid()`-scoped.
- `investors` is a **shared authenticated-read catalog** — a deliberate design choice; dashboard stats must therefore never count it. Fixed in this audit.
- `requireAdmin` correctly reads only `app_metadata.role`, never user-editable `user_metadata`.
- **Cannot verify live policies**: the `DATABASE_URL` in `.env.local` points at a deleted cluster (`cluster marble-queen-32541 not found`). RLS verification is migration-source-only until that's corrected.

---

## 3. What I fixed during this audit

| Fix | File |
|---|---|
| Repaired corrupted JSX (duplicated/malformed blocks left by an interrupted edit) | [onboarding/page.tsx](../../src/app/onboarding/page.tsx) |
| Rewrote corrupted component | [Pricing.tsx](../../src/components/Landing/Pricing.tsx) |
| `createClient()` with no args → cookie-scoped SSR client (was a runtime throw) | [analytics/route.ts](../../src/app/api/dashboard/analytics/route.ts) |
| Same fix in cockpit | [cockpit/route.ts](../../src/app/api/dashboard/cockpit/route.ts) |
| Null-guard on investor map lookup | [cockpit/route.ts](../../src/app/api/dashboard/cockpit/route.ts) |
| Typed the qualification batch rows (7 `never`-type errors) | [qualification.ts](../../src/lib/services/investor/qualification.ts) |
| Nullable `fileUrl` guard | [documents/page.tsx](../../src/app/dashboard/documents/page.tsx) |
| Removed two orphaned, corrupt scratch scripts (unreferenced) | `src/scripts/build-pitch-deck.ts`, `src/scripts/test-deck-generator.ts` |

**Verification:** `npx tsc --noEmit` → **0 errors** (was 104: 5 JSX-fatal + 99 type errors).

---

## 4. MVP definition

The MVP is **one complete loop a real founder can run end to end**, not nine half-modules:

> **Sign up → profile company → find 25 genuinely relevant investors → understand why each one fits → shortlist → draft a personalised email → send it → see the reply in the pipeline.**

Everything else in the blueprint is deliberately deferred.

### MVP must-haves (in dependency order)

**Track A — Repair (blocking, small)**
1. Create the `company-documents` storage bucket + per-user storage RLS, and switch document viewing to signed URLs. *Unblocks pitch-deck upload.*
2. Correct `DATABASE_URL` so RLS can be verified.
3. Reconcile migrations with live schema (generate `015_baseline_reconcile.sql` from the 18 drifted tables/views).

**Track B — Data depth (the real MVP work)**
4. **Investor firms**: populate `investor_firms` from EDGAR/IAPD firm data and backfill `current_firm_id`. Without this, "organization" is empty everywhere.
5. **Cheque size + thesis + investor_type**: add enrichment for `min_check_size`, `max_check_size`, `investment_thesis`, and the 18-category taxonomy. Backfill from EDGAR holdings + IAPD + public theses.
6. **Contactability**: raise `email` from 26% and `linkedin_url` from 4% for the top ~2,000 fit-scored investors only (cost control), then recompute `outreach_readiness` so `ready` is non-zero.
7. **Re-score** with the now-populated fields and report the new distribution — target: a real cohort at 85+ with visible breakdowns.

**Track C — Workflow completion (thin slices on existing surfaces)**
8. Pipeline: add target amount, target valuation, instrument, target cheque; compute expected vs actual and conversion rates.
9. Outreach: prove one send end-to-end (SMTP test → real send → `email_messages` row → reply ingestion → pipeline move).
10. Copilot memory: persist to `copilot_conversations`.
11. Dashboard: replace hard-zeroed stats with real aggregates once 4–6 land.

**Track D — Guardrails**
12. Onboarding: fix the document step (the duplicated upload handler was removed; verify one clean handler + visible error state instead of silent `console.error`).
13. Global search quality: verify `search → shortlist → match → contact` on a seeded test account before calling it done.

### Explicitly deferred (Phase 3+)

Warm-introduction graph, data room, news/portfolio/competitor/market intelligence, grants discovery, teams/collaboration, feature flags, accelerator workspaces, enterprise API.

---

## 5. Sequencing rationale

- **A before B**: enrichment costs money and needs reliable storage/migrations underneath.
- **B before C**: pipeline and outreach are already built; they look empty because the data is empty. Building more workflow on empty data repeats the mistake the blueprint warns about (*"building features that look complete but do not perform their advertised actions"*).
- **B is the differentiator**: matching quality is 80% data completeness. Fixing `min_check_size` / `max_check_size` / `investment_thesis` / `current_firm_id` moves the score ceiling more than any algorithm rewrite.
- **#5 is where the 90+ question gets answered.** You cannot legitimately rank anyone above 90 while four scoring factors are permanently zero.

---

## 6. Honest risks

1. **Enrichment cost.** Cheque size and thesis are not in EDGAR. Expect AI extraction from firm websites/Form D. Must be batched via `background_jobs` with per-run caps — the blueprint's own cost-control requirement.
2. **Licensing.** Crunchbase is licence-gated; the blueprint already flags this. EDGAR, IAPD/Form ADV, Companies House and firm sites are the safe primary sources — and the app already only uses those three.
3. **Single provider.** Current data is ~one EDGAR restore. Adding IAPD firm linkage is the cheapest diversification.
4. **`email_messages` = 0 is a red flag.** The entire outreach stack is unproven. Do not promise "outreach works" until one real send and one real reply are observed.
5. **Schema drift** means CI cannot rebuild the DB. Treat #3 as non-negotiable before anyone else touches the repo.

---

## 7. Success criteria for MVP sign-off

| Criterion | Target |
|---|---|
| Investors with firm linked | ≥ 60% of active records |
| Investors with cheque range | ≥ 40% |
| Investors with thesis text | ≥ 40% |
| Investors with email | ≥ 50% |
| Investors at `outreach_readiness = 'ready'` | ≥ 500 |
| Investors scoring 85+ | ≥ 200, each with a working breakdown |
| One real email sent, replied, and reflected in pipeline | yes |
| Pitch deck uploaded and openable | yes |
| Fresh DB rebuildable from migrations alone | yes |
| `tsc --noEmit` | 0 errors |

---

## Appendix — Blueprint section map

| Blueprint section | This doc |
|---|---|
| 1. Core modules 1–9 | §2 |
| 2. Additional modules | §2 table |
| 3. Investor database & quality | §1, §2 (modules 2–3) |
| 4. AI & automation | §2 (matching, copilot) |
| 5. Infrastructure & integrations | §1 (drift), §2 (outreach) |
| 6. Security & reliability | §2 (security posture) |
| 7. Admin dashboard | §2 table |
| 8. Monetization | §2 billing row — deferred |
| 9. Navigation | §2 — already matches blueprint IA |
| 10. Roadmap | §4, §5 |
| 11. Metrics | §7 |
| 12. Avoid list | §5 (rationale) |
| 13–14. Strengths & priority | §0, §4 |
| 15. Audit | this document |
