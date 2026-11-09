# Capital OS — Phase 1: Product Architecture & Implementation Plan

**Status:** Proposed — awaiting approval. No implementation has begun for this phase.
**Supersedes:** nothing. Builds on `docs/20-blueprint-audit-and-mvp-plan.md` (the audit).
**Date:** 2026-11-02

---

## 0. How to read this document

This is the answer to Phase 1 of the brief: *complete application architecture, page
structure, navigation, user journeys, module relationships, and implementation roadmap —
before any code is written.*

Everything below is grounded in an inspection of the actual repository and the live
Supabase project, not in what the blueprint hopes exists. Where the blueprint asks for
something, this document says what already satisfies it, what needs extending, what
needs building, and — where I recommend not building it yet — why.

Two sections matter more than the rest and are worth reading first:

- **§2 Ground truth** — the five findings that constrain every decision after them.
- **§14 Scope decisions** — where I am proposing *less* than the blueprint asks, and why.

---

## 1. The product thesis this architecture serves

The blueprint is explicit that Capital OS must not become "another investor directory,
CRM, AI chatbot, or collection of disconnected fundraising tools." The organising
principle I am proposing is a single connected loop, and every page either feeds that
loop or is deferred:

```
    ┌──────────────────────────────────────────────────────────────┐
    │                                                              │
    ▼                                                              │
 COMPANY PROFILE ──► DISCOVER ──► MATCH ──► SHORTLIST ──► OUTREACH ─┘
   + READINESS         │           │           │            │
        │              │           │           │            ▼
        │              ▼           ▼           ▼        CONVERSATION
        │           DATABASE    MATCHES      LISTS           │
        │              │           │           │            ▼
        │              └───────────┴───────────┴──►      MEETINGS
        │                                          │         │
        ▼                                          ▼         ▼
    DOCUMENTS ◄─────────────── PIPELINE ◄──────────────────────┘
    & DECKS                       │
                                  ▼
                              COMMITMENT
```

A founder must be able to go from *sign up* to *an investor replied* without hitting a
dead end, a fake number, or a button that lies. That is the MVP. Intelligence
(market, competitors, news, portfolio) is a **force multiplier on this loop** and is
sequenced after it works, not alongside it.

**The single most important product question this architecture has to answer:** why
should a founder trust that a given investor is a good fit? Today the answer is "a
score with no evidence." The architecture fixes that by making *explanation and evidence*
first-class stored data, not a rendered string.

---

## 2. Ground truth — what actually exists today

Measured against the live project and repository, not estimated.

### 2.1 Inventory

| Surface | Count |
|---|---|
| App pages (`page.tsx`) | 49 |
| API routes (`route.ts`) | 76 |
| Service modules (`src/lib/services`) | 43 |
| SQL migrations | 16 files |
| Sidebar navigation items (today) | 25 items across 6 groups |

So the breadth the blueprint asks for is largely *present as surface area*. The problem
is depth and connection, not quantity.

### 2.2 The five findings that drive this plan

**F1 — The investor database is 18,995 records wide and structurally shallow.**

These columns exist and are populated on **0% of rows**:

| Column | Population | Consequence |
|---|---|---|
| `min_check_size` / `max_check_size` | 0% | Cheque-size filtering is non-functional |
| `investment_thesis` | 0% | Thesis matching and "why this investor" is non-functional |
| `current_firm_id` | 0% | Every investor renders without a firm |
| `portfolio_count` | 0% | Portfolio intelligence has nothing behind it |

`investor_firms` has **0 rows**. Email is present on **26%** of records, LinkedIn on
**4%**. **Zero** investors have `outreach_readiness = 'ready'`. Highest `fit_score` is
**79**; highest `data_quality_score` is **69**.

*Direct answer to a question you asked earlier:* nobody legitimately scores above 90
today, and nobody will until four scoring factors have data behind them. This is a data
problem wearing an algorithm costume. §12 makes depth a first-class milestone rather
than an afterthought.

**F2 — Outreach has never sent a real email.** `email_messages` has 0 rows. The entire
campaign/sequence/SMTP/tracking stack is built and unproven. It must be the first thing
we make *actually work*, because every downstream metric (response rate, conversion,
meetings) is currently undefined.

**F3 — Document upload fails because the bucket does not exist.** The
`company-documents` storage bucket is absent (only `data-archive` exists), so
`uploadCompanyDocument()` fails, returns `null`, and the UI swallows it into a
`console.error`. Also: `meetings`, `investor_notes`, `introductions` are referenced by
code but **do not exist** as tables. Drafting a page on top of a missing table is how
you get a UI-only module.

**F4 — Migrations are not the source of truth.** 18 tables/objects exist in the live
database that no migration file creates — notably `user_pipeline_entries`, which the
pipeline depends on. A fresh environment cannot be rebuilt from the repo. Every new
table we add must be migration-backed *and* the existing drift reconciled, or the debt
compounds.

**F5 — Two dashboard APIs were throwing at runtime.** `/api/dashboard/analytics` and
`/api/dashboard/cockpit` called `createClient()` with no arguments. Both are now fixed
to use the cookie-scoped SSR client so RLS applies. This is why the dashboard could show
wrong or empty data.

### 2.3 What is genuinely built and working (REAL)

These are load-bearing and must be preserved, not rewritten:

- Supabase Auth with email/password, Google, Microsoft OAuth; session middleware;
  password reset; signup with profile trigger.
- Company profile CRUD and onboarding flow.
- Investor search, faceted filtering, discovery UI, and investor detail pages.
- Investor qualification/fit scoring engine with explainable factor breakdown
  (`src/lib/services/investor/qualification.ts`) — the *engine* is good; its *inputs*
  are empty.
- Per-user pipeline entries with stage transitions and stage counts.
- Admin surface: dedup, enrichment jobs, data sources, audit logs, users, finance.
- Email sending infrastructure (SMTP, sequences, tracking, reply understanding) —
  built, unproven.
- Billing scaffolding (plans, entitlements, credits, founding-member checkout).
- Privacy: export and account deletion.

### 2.4 What is UI-only or fake

- `meetings` page (no table).
- Dashboard "meetings scheduled", "high-fit investors", "investors this week",
  "top sectors" — hardcoded zeros or `[]` in `cockpit/route.ts`.
- `portfolio_count`, firm names, cheque sizes — rendered but unbacked.
- Warm introductions — no table, no data, no surface.
- Market / competitor / news intelligence — absent entirely.
- Grants & accelerators — absent entirely.
- Copilot — exists as a chat surface without a registered tool/action layer.

---

## 3. Proposed information architecture

### 3.1 Design principles applied

1. **One job per navigation item.** Today `Discover`, `Investor Database`, `Saved
   Investors` and `Fit Analysis` are four nav items describing one activity. They become
   one group of four *views* under a single section.
2. **Flows are not destinations.** `Onboarding` and `Edit Profile` disappear from the
   sidebar — they are a flow and a button.
3. **Consolidate into tabs, not new pages.** Where the blueprint asks for a new
   capability that belongs to an existing surface (e.g. outreach metrics, email health),
   it becomes a tab.
4. **Admin data tooling leaves the founder's nav.** `Data Health`, `Email Monitor`,
   `Waitlist` move under `/admin`.
5. **Every nav item must have a working primary action** when it is shown. If it cannot,
   it is hidden behind a feature flag rather than presented as functional.

**Result: 25 items → 20 items in 8 groups, with 6 genuinely new destinations.**

### 3.2 Proposed navigation

| Group | Item | Route | Status |
|---|---|---|---|
| **Workspace** | Overview | `/dashboard` | Extend |
| | Copilot | `/dashboard/copilot` | Extend (real tools) |
| **Investors** | Discover | `/dashboard/investors/discover` | Keep |
| | Matches | `/dashboard/investors/matches` | Rename from `/fit` |
| | Database | `/dashboard/investors` | Keep |
| | Lists | `/dashboard/lists` | **New** (absorbs `/saved`) |
| **Relationships** | CRM | `/dashboard/crm` | **New** |
| | Meetings | `/dashboard/meetings` | Complete (needs table) |
| | Introductions | `/dashboard/introductions` | **New** |
| **Outreach** | Outreach | `/dashboard/outreach` | Keep (add tabs) |
| | Sequences | `/dashboard/sequences` | Rename from `/campaigns` |
| | Deliverability | `/dashboard/deliverability` | Merge of `email-health` trio |
| **Pipeline** | Pipeline | `/dashboard/pipeline` | Keep |
| | Reports | `/dashboard/reports` | Rename from `/analytics` |
| **Company** | Profile | `/dashboard/startup` | Keep |
| | Readiness | `/dashboard/readiness` | **New** |
| | Documents | `/dashboard/documents` | Fix + add Data Room tab |
| **Intelligence** | Intelligence | `/dashboard/intelligence` | **New** (Market / Competitors / News tabs) |
| | Opportunities | `/dashboard/opportunities` | **New** (grants, accelerators) |
| **Settings** | Settings | `/dashboard/settings` | Keep (add tabs) |

**Removed from founder navigation:** `/onboarding` (a flow), `/dashboard/startup/edit`
(a button on Profile), `/dashboard/investors/fit` (→ Matches), `/dashboard/outreach/metrics`
(tab), `/dashboard/data-health*`, `/dashboard/data-health/email-monitor`,
`/dashboard/data-health/waitlist` (→ `/admin`), `/dashboard/email-health/*` (→ Deliverability tabs).

Routes are renamed with permanent redirects from the old paths so no existing link or
bookmark breaks.

### 3.3 Navigation groups rationale

- **Workspace** is "where am I and what should I do" — Overview and Copilot.
- **Investors** is "who might fund me" — discovery, matching, the database itself, and
  my curated lists.
- **Relationships** is "who do I know and what is the state of that relationship" — the
  CRM, meetings, and introductions. Deliberately separated from Outreach: *relationship*
  is durable state; *outreach* is an activity performed against it.
- **Outreach** is "what am I sending" — messages, sequences, and the deliverability
  health that determines whether anything arrives.
- **Pipeline** is "how is the round going" — stages and reporting.
- **Company** is "what am I selling" — profile, readiness, materials.
- **Intelligence** is "what is happening in my market" — additive context.

---

## 4. Page-by-page specification

Tier 1 pages are MVP-critical and specified in full. Tier 2 are specified compactly and
built after the loop closes. Tiers exist so implementation has a defensible order; they
are not a judgement about importance to the product.

### 4.1 Tier 1 — MVP loop

---

#### 4.1.1 Overview — `/dashboard`

| | |
|---|---|
| **Purpose** | Answer "where does my raise stand and what do I do next" in one screen. |
| **User** | Founder, authenticated, company profile exists. |
| **Data** | All per-user, RLS-scoped: round target/raised, readiness score, saved count, contacted count, replies, meetings, stage distribution, next actions, recent activity. |
| **Actions** | Advance a stage inline; open a match; draft outreach; complete a readiness task; jump to copilot with context. |
| **AI** | "Next best action" generated from actual state, with the reason and the record it refers to. |
| **Entities** | `company_profiles`, `user_pipeline_entries`, `saved_investors`, `email_messages`, `meetings`, `readiness_assessments`, `company_documents`. |
| **States** | **Empty (new user):** onboarding checklist, zeroed counters, no fabricated numbers, no demo investors. **Loading:** skeletons per card. **Error:** per-card boundary + retry, never a blank page. **Partial:** cards whose backing data is missing say "not yet available" with the reason. |

**Non-negotiables:** every number is a query result. A card with no data renders its
empty state, not a zero that looks like real data. This directly addresses the complaint
about seeing things that should not be there.

---

#### 4.1.2 Discover — `/dashboard/investors/discover`

| | |
|---|---|
| **Purpose** | Find investors worth pursuing, with enough signal to judge fit. |
| **Data** | Investor corpus (shared, read-only). Filters: type, stage, sector, geography, cheque size, thesis, lead/follow, activity, verified-only. |
| **Actions** | Filter, sort, paginate, save search, bulk shortlist, compare (≤4), open profile, add to list, add to pipeline. |
| **Entities** | `investors`, `investor_firms`, `investor_sectors`, `investor_search_history`, `saved_searches`, `investor_lists`. |
| **States** | Empty result set explains *which filter* excluded everything and offers to relax it. Filters whose backing column is unpopulated (cheque size, thesis) are **marked "limited data"** rather than silently returning nothing. |

**Dependency:** this page is only as good as F1. Cheque-size and thesis filters must
either work or be visibly disabled — not present and useless.

---

#### 4.1.3 Matches — `/dashboard/investors/matches`

| | |
|---|---|
| **Purpose** | Rank investors against *this* company and explain each ranking. |
| **Data** | `fit_score` + `fit_score_breakdown` (per-factor score, weight, explanation), `data_quality_score`, `outreach_readiness`, matched/unmatched criteria, disqualifiers. |
| **Actions** | Re-score, filter by band (strong / possible / poor), read the explanation, accept fit feedback ("good match" / "not a fit") to feed the model, shortlist, open profile. |
| **Entities** | As above + `fit_feedback` (new). |
| **States** | If the company profile lacks the fields scoring needs, the page says exactly which fields are missing and links to fix them — instead of showing a low score with no explanation. |

**Non-negotiable:** no score without a factor breakdown and a confidence level. A
mysterious score is a product bug per §12 of the blueprint.

---

#### 4.1.4 CRM — `/dashboard/crm` **(new)**

| | |
|---|---|
| **Purpose** | The durable record of every investor relationship the founder owns. |
| **Data** | Per-user: investor, contact, stage, owner, tags, notes, last contact, next follow-up, interaction timeline (email + meeting + note events merged chronologically). |
| **Actions** | Create/update relationship, edit stage, assign owner, add note, add task/reminder, log a call, tag, filter, bulk update, export CSV, import CSV. |
| **Entities** | `user_pipeline_entries` (extend with owner/tags/next_action), `investor_notes` (**new**), `crm_tasks` (**new**), `crm_tags`/`crm_tag_links` (**new**), `email_messages`, `meetings`. |
| **States** | Empty: "no relationships yet — shortlist from Discover". Duplicate add is caught, not silently created. |

**This is the module that resolves the blueprint's "do not create disconnected investor
records" requirement.** `saved_investors` and `user_pipeline_entries` currently split the
same concept; they converge here behind one view while keeping their existing tables.

---

#### 4.1.5 Pipeline — `/dashboard/pipeline`

| | |
|---|---|
| **Purpose** | Visualise and advance the round. |
| **Data** | Per-user stage entries; counts; expected amounts; days in stage; round totals. |
| **Actions** | Drag between stages, bulk move, set expected cheque, set probability, record lost reason, filter, open relationship. |
| **Entities** | `user_pipeline_entries` (extend: `expected_amount`, `probability`, `lost_reason`, `stage_entered_at`), `pipeline_stage_history` (**new**). |
| **States** | Stage with no entries collapses but stays visible. Transitions are optimistic with rollback on failure. |

Current stage set is small; the blueprint lists ~21. **Proposal:** keep a curated 11 for
MVP (Discovered, Researching, Shortlisted, Contacted, Responded, Meeting, Diligence,
Term Sheet, Committed, Passed, On Hold) and make the stage list user-configurable later.
21 default stages is a wall of empty columns for a founder with 12 investors.

---

#### 4.1.6 Outreach — `/dashboard/outreach`

| | |
|---|---|
| **Purpose** | Compose, send, and track investor messages. |
| **Tabs** | Drafts · Sent · Metrics. |
| **Data** | Drafts, sent messages, thread state, opens/clicks (tracked), replies (polled), suppression list. |
| **Actions** | Generate draft (AI, grounded in investor + company), edit, approve, send, schedule, follow up, suppress, view thread. |
| **Entities** | `email_messages`, `email_threads`, `email_tracking_events`, `email_accounts`, `send_audit_trail`, `reply_insights`. |
| **States** | **Blocking dependency:** no verified sending account → the page shows a setup gate, not a disabled send button. Send failure surfaces the provider error verbatim. |

**Critical:** per blueprint §24, we do not simulate delivery. Until a real send succeeds
against a real inbox, this module is `PARTIAL` and labelled so.

---

#### 4.1.7 Documents — `/dashboard/documents`

| | |
|---|---|
| **Purpose** | Store the founder's fundraising materials and expose them to investors safely. |
| **Tabs** | Documents · Data Room. |
| **Data** | Uploaded files, type, size, version, analysis status, data-room folders, share links, access log. |
| **Actions** | Upload (PDF/PPTX/DOCX/XLSX), preview, replace (new version), delete, create folder, share (scoped link with expiry), revoke, view access log, run deck analysis. |
| **Entities** | `company_documents`, `company-document` storage bucket (**create**), `data_room_folders`, `data_room_shares`, `data_room_access_log`, `deck_analyses`. |
| **States** | Upload progress, per-file failure with the real reason, retry. **This page is currently broken (F3) and is fixed first.** |

**Security requirement:** no public URLs for confidential documents. Access is via
short-lived signed URLs, and share links are revocable and logged. The current
`getPublicUrl` path is replaced.

---

#### 4.1.8 Readiness — `/dashboard/readiness` **(new)**

| | |
|---|---|
| **Purpose** | Tell a founder honestly whether they are ready to raise, and what to fix. |
| **Data** | 8 categories: company & legal, product, traction, team, market, financials, materials (deck + data room), fundraising strategy. Each with score, evidence, gaps. |
| **Actions** | Run assessment, expand a category, mark a gap resolved, attach evidence, re-run. |
| **Entities** | `readiness_assessments`, `readiness_items`, `company_profiles`, `company_documents`. |
| **States** | Not-yet-assessed: explain the 8 categories and offer to run. Insufficient data: score withheld rather than invented, listing what is missing. |

**Why this is Tier 1:** the blueprint's journey step 1 is "understand their fundraising
needs and readiness." Without it, Discover has no inputs and Matches cannot explain
itself. It is the upstream of the whole loop.

---

#### 4.1.9 Company Profile — `/dashboard/startup`

| | |
|---|---|
| **Purpose** | The single source of truth about the company that every other module reads. |
| **Data** | Name, one-liner, sector, stage, business model, geography, traction, raise amount, valuation, instrument, team, links, branding. |
| **Actions** | Edit all fields, upload logo, set raise parameters, set target cheque range. |
| **States** | Completeness meter showing exactly which fields downstream features need. |

This already works. The change is making it **feed** matching, readiness, and outreach
rather than sitting inert.

---

#### 4.1.10 Copilot — `/dashboard/copilot`

| | |
|---|---|
| **Purpose** | Execute multi-step fundraising work in natural language against real data. |
| **Data** | Full company context + retrieved records (investors, relationships, pipeline, documents, messages). |
| **Actions** | See §11 — a registered tool layer, not free-form text. |
| **Entities** | `copilot_conversations`, `copilot_messages`, `copilot_tool_calls`, `copilot_approvals`, `company_memory`. |
| **States** | Every tool call shows pending/running/succeeded/failed. Failed steps are reported, not hidden. Requires approval for external or destructive actions. |

**Non-negotiable:** the copilot may never claim an action completed unless the tool
returned success **and** the change was read back and verified.

---

### 4.2 Tier 2 — specified compactly, built after the loop closes

| Page | Purpose | Key entities | Depends on |
|---|---|---|---|
| **Lists** `/dashboard/lists` | Named, shareable investor collections | `investor_lists`, `investor_list_items` | Discover |
| **Meetings** `/dashboard/meetings` | Schedule, prepare, run, summarise | `meetings`, `meeting_briefs`, `meeting_notes`, `crm_tasks` | CRM, Calendar |
| **Introductions** `/dashboard/introductions` | Map credible paths to investors | `contacts`, `relationships`, `introduction_requests`, `introduction_outcomes` | CRM, evidence source |
| **Sequences** `/dashboard/sequences` | Multi-step follow-up campaigns | `campaign_sequences`, `campaign_sequence_steps`, `campaign_sequence_enrollments` | Outreach (proven sending) |
| **Deliverability** `/dashboard/deliverability` | SPF/DKIM/DMARC, warmup, bounce, suppression | `email_accounts`, `email_health_snapshots`, `email_suppression` | Real sending |
| **Reports** `/dashboard/reports` | Pipeline conversion, outreach performance, funnel | Read models over existing tables | Pipeline + Outreach |
| **Intelligence** `/dashboard/intelligence` | Market / competitor / news tabs | `market_signals`, `competitor_watch`, `investor_news` | Background ingestion |
| **Opportunities** `/dashboard/opportunities` | Grants, accelerators, fellowships | `opportunities`, `opportunity_applications` | Curation source |
| **Settings** `/dashboard/settings` | Profile, company, team, integrations, billing, email | `company_team_members`, `user_subscriptions`, `email_accounts` | — |

---

## 5. User journeys

Each journey names the modules traversed and the state that must persist between them.
The persistence column is the point: **a journey that does not write state is not a
journey, it is a click.**

### J1 — Signup → first useful session

```
/signup → verify email → /onboarding (5 steps) → /dashboard (empty but honest)
```

1. Account created, `profiles` row via trigger.
2. Onboarding collects: company basics → sector/stage → raise parameters → traction →
   materials (optional).
3. On completion: `company_profiles` populated, readiness assessment auto-runs,
   matching auto-scores top 25.

**Persists:** `profiles`, `company_profiles`, `readiness_assessments`, `fit_score` on
top candidates.
**Failure mode today:** onboarding completes but matching and readiness never run, so
the dashboard is empty and the founder concludes the product is empty.

### J2 — Discover → shortlist

```
Discover (filter) → compare → open profile → shortlist → Lists / CRM
```

**Persists:** `investor_search_history`, `saved_searches`, `investor_lists`,
`saved_investors`, `user_pipeline_entries` (stage = discovered → shortlisted).
**Failure mode today:** `Saved Investors` and `Pipeline` create separate records for the
same investor. J2 must converge them.

### J3 — Match → trust the match

```
Matches → read factor breakdown → open investor → confirm/adjust → add to pipeline
```

**Persists:** `fit_score_breakdown` (already stored), `fit_feedback` (new) so the ranking
learns.
**Failure mode today:** no explanation the founder can check, and no feedback path.

### J4 — Outreach → reply

```
CRM → select investors → draft (AI-grounded) → approve → send → track → reply
```

**Persists:** `email_messages`, `email_threads`, `email_tracking_events`,
`reply_insights`, pipeline stage → contacted → responded.
**Failure mode today:** zero emails have ever been sent through this path (F2).

### J5 — Reply → meeting → stage advance

```
Reply detected → thread view → schedule meeting → meeting brief → notes → pipeline advance
```

**Persists:** `meetings`, `meeting_briefs`, `meeting_notes`, `crm_tasks`,
`pipeline_stage_history`.
**Failure mode today:** `meetings` table does not exist (F3).

### J6 — Readiness → materials → re-score

```
Readiness (gaps) → fix profile → upload deck → deck analysis → re-run readiness → re-match
```

**Persists:** `readiness_assessments`, `company_documents`, `deck_analyses`, updated
`fit_score`.
**Failure mode today:** upload fails silently (F3).

### J7 — Copilot executes a multi-step task

```
"Find 30 pre-seed fintech investors in Africa, score them, add the top 15, draft outreach"
  → plan → show plan → execute tools → report per-step result → request approval to send
```

**Persists:** `copilot_tool_calls` (every step, with result), `copilot_approvals`.
**Failure mode today:** no tool registry exists, so this is impossible.

### J8 — Portfolio/investor diligence

```
Investor profile → portfolio → co-investors → shared connections → introduction path
```

Deferred to Tier 2/3. Noted so the schema leaves room (see §8).

---

## 6. Module relationships and data flow

```
                    company_profiles  ◄──── single source of truth
                            │
        ┌───────────────────┼────────────────────┐
        ▼                   ▼                    ▼
   readiness_         match engine         outreach drafting
   assessments         (fit_score)          (personalisation)
        │                   │                    │
        └───────────┬───────┘                    │
                    ▼                            │
              investors (shared corpus)           │
                    │                            │
                    ▼                            ▼
             investor_lists ────────────► user_pipeline_entries ◄── CRM
                    │                            │
                    ▼                            ▼
             saved_investors              stage history ──► Reports
                                                 │
                                                 ▼
                                          email_messages ──► threads ──► replies
                                                 │                         │
                                                 ▼                         ▼
                                              meetings ◄────────── reply_insights
                                                 │
                                                 ▼
                                          introductions
```

**Rules enforced by the architecture:**

1. **`investors` is shared and read-only to founders.** Per-user state never writes to it.
   (This holds today in the pipeline API and must continue to hold everywhere.)
2. **`user_pipeline_entries` is the per-user system of record** for "my relationship with
   this investor." `saved_investors` remains the bookmark; the CRM and Pipeline read both.
3. **`company_profiles` is the only place company facts live.** Matching, readiness,
   deck analysis and outreach all read from it — no duplicated company fields.
4. **Derived numbers are never stored twice.** Reports compute from source tables or from
   a read model rebuilt on a schedule; they do not cache a number that can silently rot.
5. **Evidence travels with claims.** Every score, thesis, and "why this match" carries a
   source and a confidence, stored alongside the value.

---

## 7. Database and backend changes

### 7.1 Must-fix before any new page (blocking)

| Item | Action | Why |
|---|---|---|
| `company-documents` bucket | Create, private, RLS-limited to `{user_id}/` prefix | Document upload is broken |
| `meetings` | Create table + migration | Page exists, table does not |
| `investor_notes` | Create table + migration | CRM depends on it |
| `user_pipeline_entries` | Add migration reflecting live schema | Drift; fresh envs break |
| 17 other drifted objects | Reconcile into migrations | F4 |
| `send_audit_trail` | Verify migration 014 applied | Required for send integrity |
| Dashboard route clients | ✅ Done | Were throwing at runtime |

### 7.2 Extend existing tables

```sql
-- investors: fill the structural gaps (data work, then constraints)
ALTER TABLE investors
  ADD COLUMN IF NOT EXISTS lead_preference TEXT,        -- 'lead' | 'follow' | 'either'
  ADD COLUMN IF NOT EXISTS excluded_sectors TEXT[],
  ADD COLUMN IF NOT EXISTS fund_size NUMERIC,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_status TEXT,     -- verified|reported|inferred|unverified
  ADD COLUMN IF NOT EXISTS thesis_source TEXT;

-- user_pipeline_entries: make it a real CRM record
ALTER TABLE user_pipeline_entries
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS expected_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS probability INTEGER,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ;

-- company_profiles: raise parameters that matching needs
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS business_model TEXT,
  ADD COLUMN IF NOT EXISTS target_cheque_min NUMERIC,
  ADD COLUMN IF NOT EXISTS target_cheque_max NUMERIC,
  ADD COLUMN IF NOT EXISTS readiness_score INTEGER;
```

### 7.3 New tables (grouped by module)

| Module | New tables |
|---|---|
| CRM | `investor_notes`, `crm_tasks`, `crm_tags`, `crm_tag_links` |
| Lists | `investor_lists`, `investor_list_items` |
| Pipeline | `pipeline_stage_history` |
| Matching | `fit_feedback` |
| Meetings | `meetings`, `meeting_briefs`, `meeting_notes` |
| Introductions | `introduction_requests`, `introduction_paths` |
| Readiness | `readiness_assessments`, `readiness_items` |
| Documents | `data_room_folders`, `data_room_shares`, `data_room_access_log`, `deck_analyses` |
| Data depth | `investor_portfolio`, `investor_theses`, `investor_contacts` |
| Copilot | `copilot_conversations`, `copilot_messages`, `copilot_tool_calls`, `copilot_approvals`, `company_memory` |
| Intelligence | `market_signals`, `competitor_watch`, `investor_news` |
| Opportunities | `opportunities`, `opportunity_applications` |

### 7.4 RLS policy standard

Every new table follows one template, no exceptions:

```sql
ALTER TABLE <t> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "<t>_owner_all" ON <t>
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

Child tables use an `EXISTS` join to the owning row. `investors` and `investor_firms`
remain **read-only to authenticated users** with writes restricted to the service role,
enforced by an explicit policy rather than by convention.

### 7.5 Backend / API changes

| Area | Change |
|---|---|
| Documents | Replace `getPublicUrl` with `createSignedUrl` (60s); add DELETE and version routes |
| Pipeline | Add stage history writes; validate transitions server-side |
| CRM | Full CRUD over relationships, notes, tasks, tags |
| Matching | Persist breakdown + confidence; add feedback endpoint |
| Readiness | `POST /api/readiness/run` (background job), `GET /api/readiness` |
| Deck analysis | Upload → queue → parse → analyse → store, with status polling |
| Copilot | Tool registry + executor + approval gate (see §11) |
| Reports | Read-model endpoints, no cached scalars |
| Imports | Streaming CSV import with column mapping, preview, dry-run, conflict resolution |

### 7.6 Background processing

Heavy operations move off the request path per blueprint §6. Existing `background_jobs`
and `data_acquisition_jobs` tables are reused rather than adding a queue system:

- Deck analysis, readiness assessment, bulk enrichment, bulk matching, CSV import,
  news ingestion, market research.

All idempotent, retried with exponential backoff, cancellable, and visible in a job
history with per-job status.

---

## 8. Integration requirements

| Integration | Current state | Needed for | Blocking? |
|---|---|---|---|
| Supabase (DB/Auth/Storage) | Working | Everything | — |
| SMTP / Resend | Built, unproven | Outreach | **Yes, for Outreach** |
| Gmail / Microsoft OAuth | Sign-in works; mailbox send not | Real sending, reply polling | No (SMTP first) |
| Google Calendar | Not connected | Meetings sync | No |
| OpenRouter | Working (`src/lib/ai`) | Copilot, drafting, analysis | — |
| Trigger.dev | **Not used** | Background jobs | No — reuse `background_jobs` |
| PostHog / Sentry / Langfuse | Partial | Analytics, errors, AI cost | No |
| Crunchbase / OpenCorporates / SEC EDGAR | EDGAR scraper exists | Data depth | No |
| Paddle / Dodo | Scaffolded | Billing | No |

**Deliberate substitution:** the blueprint specifies Trigger.dev. We already have
`background_jobs` + `data_acquisition_jobs` with an admin job surface and retry logic.
Adding a second queue system would split operational tooling for no product gain. I
recommend reusing what exists and noting the deviation.

---

## 9. Implementation sequence

Ordered by dependency, not by size. Each wave ends in something demonstrable.

### Wave 0 — Unblock (must precede everything)
- Create storage bucket + policies; switch to signed URLs.
- Create `meetings`, `investor_notes`, `pipeline_stage_history` etc. with migrations.
- Reconcile migration drift; verify a fresh DB rebuilds.
- Remove hardcoded zeros/fakes from dashboard routes and pages.

**Exit:** upload works; no page shows a number it cannot prove; fresh env rebuilds.

### Wave 1 — Close the loop on data we already have
- Populate `investor_firms`; link `current_firm_id`.
- Backfill cheque sizes and theses from existing sources (EDGAR, Apollo raw records,
  IAPD rows already in the DB).
- Populate `investor_portfolio`; recompute `portfolio_count`.
- Add `verification_status` / `last_verified_at` and show them in the UI.
- Re-run qualification and publish the honest distribution.

**Exit:** cheque-size and thesis filters return results; the "who clears 90" question has
a real, defensible answer; every displayed field has provenance.

### Wave 2 — MVP workflow
- CRM page + notes/tasks/tags.
- Lists replaces Saved.
- Pipeline stages 11 + expected amounts + history.
- Readiness assessment.
- Documents: data room, versions, signed sharing.
- Overview rebuilt on real queries.

### Wave 3 — Sending proven
- Configure a real sending account; send to a controlled inbox.
- Tracking, reply polling, thread view, suppression.
- Outreach tabs + metrics.
- Sequences on top of proven sending.

### Wave 4 — Intelligence layer
- Deck analysis.
- Matches v2 with feedback loop.
- Introductions (evidence-gated).
- Copilot tool registry + executor + approvals.

### Wave 5 — Breadth
- Meetings (calendar), Reports, Intelligence tabs, Opportunities, Team/collaboration.

### Wave 6 — Admin & infrastructure (Section 7, only after 0–5 verified)
- Job monitoring, AI spend, data quality dashboards, feature flags, health.

### Wave 7 — Re-audit
- Re-run the original audit against every module; classify REAL / PARTIAL / BLOCKED /
  NOT STARTED with evidence; fix; repeat until clean.

---

## 10. Dependencies and technical risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Enrichment for cheque size and thesis is **not** available from EDGAR or free sources at scale | The differentiator stays hollow; 90+ remains unreachable | Treat as a data-acquisition project with its own milestone; batched, capped AI inference **marked as inferred**, never presented as verified; consider a licensed provider |
| R2 | Migration drift (F4) | Fresh deploys silently break | Reconcile in Wave 0 before any new table |
| R3 | Sending reputation | Untested sending could land in spam and burn the domain | Send only to controlled addresses until SPF/DKIM/DMARC verified; hard rate limits; warmup |
| R4 | AI cost per enriched investor | Uncontrolled spend | Per-run caps, budget alarms, cost per record recorded |
| R5 | Copilot tool execution writes real data | Corpus corruption, cross-tenant leak | Tools run with user-scoped client only; approval gate for external/destructive; every call audited |
| R6 | 18,995 → 1M records | Search and facet latency degrade | Already have pgvector + GIN + `search_vector`; add covering indexes and paginate before scaling |
| R7 | Route renames break bookmarks | Lost links | Permanent redirects |
| R8 | 21 pipeline stages overwhelm | Empty wall of columns | 11 curated stages for MVP; user-configurable later |

### Explicit architectural conflicts

1. **`saved_investors` vs `user_pipeline_entries` vs CRM** — two tables model "my
   relationship with this investor." I am **not** merging the tables (destructive);
   the CRM reads and writes both behind one surface. Flagging per execution rule 19.
2. **Trigger.dev vs existing job tables** — recommending reuse of existing tables (§8).
3. **`/dashboard/investors/fit` naming** — "Fit Analysis" obscures the strongest
   differentiator; renaming to "Matches".

---

## 11. Copilot execution architecture

The blueprint's §11 is the highest-risk requirement, so it gets an explicit design.

```
User instruction
   │
   ▼
Planner (LLM, company context injected)
   │  produces an explicit step list
   ▼
[ show plan to user ] ──► approval for risky steps
   │
   ▼
Tool registry ── each tool: name, schema, risk level, scope, handler
   │
   ▼
Executor ── sequential, per-step try/catch, idempotency key,
   │         timeout, retry w/ backoff, cancellation
   ▼
Verifier ── re-read the affected records and confirm the change
   │
   ▼
Report ── per-step succeeded/failed + links to affected records
```

**Tool tiers**

| Tier | Examples | Approval |
|---|---|---|
| Read | search investors, get profile, summarise pipeline | Never |
| Internal low-risk | shortlist, tag, add note, move stage | Never (reversible) |
| Internal write | bulk reassign, delete list item | Confirm in UI |
| External | send email, schedule meeting | Explicit approval, always |
| Destructive | bulk delete, disconnect account | Explicit approval + typed confirmation |

Tool registry lives in `src/lib/copilot/tools/`, each tool declared with a Zod schema.
`copilot_tool_calls` records input, output, duration, and error for every invocation.
**The copilot cannot report success without a verifier read-back** — this is what
prevents the "claimed it did something it didn't" failure the blueprint warns about.

---

## 12. Acceptance criteria

Written so a reviewer can verify them without reading the source.

### Global (applies to every module)

- [ ] No rendered number lacks a backing query. Verified by disabling the data source and
      seeing an honest empty state, not a zero.
- [ ] No demo/seed data is visible to a non-admin user. Verified with a fresh account.
- [ ] Every list/table has empty, loading, error, and partial states.
- [ ] Every button/menu item performs a real operation or is not shown.
- [ ] Two accounts cannot see each other's CRM, pipeline, documents, or outreach.
      Verified by a scripted cross-tenant test.
- [ ] Every new table has an RLS policy and a migration file.

### Per module (summary)

| Module | Acceptance |
|---|---|
| Overview | Every card traceable to a query; new user sees onboarding checklist, not zeros |
| Discover | Cheque-size and thesis filters return real results, or are labelled limited |
| Matches | Every score shows factors, weights, confidence, and a plain-English reason |
| CRM | Add → note → task → stage change persists and appears in timeline |
| Pipeline | Drag persists; history row written; counts reconcile with CRM |
| Outreach | A real email arrives in a real inbox; reply is detected and moves stage |
| Documents | PDF and PPTX upload succeed; download works; share link expires; access logged |
| Readiness | Score derived from actual profile fields; gaps link to the field to fix |
| Copilot | Multi-step task completes, each step verifiable in the DB, failures reported |
| Reports | Figures recompute from source tables; no cached scalar |

---

## 13. What I propose we do NOT build yet, and why

Per the blueprint's own §12 ("things we should deliberately avoid") and the mandate to
deliver a working MVP rather than breadth:

| Deferred | Reason |
|---|---|
| Warm introduction mapping | Requires a relationship graph we have no evidence source for. A module that says "no known path" for every investor fails the blueprint's own honesty rule. Build after we have a contacts/evidence source. |
| Portfolio, competitor, market, news intelligence | Four modules of ingestion and provenance work. They multiply an existing loop; they cannot substitute for it. Revisit after Wave 3. |
| Grants & accelerators | Real value, but a separate discovery/curation problem with its own data source. Not part of "raise a round." |
| Team collaboration | RLS-level change with broad blast radius. Single-founder first. |
| 1M-record scale | Premature. Optimise at 100k with measurements, not before |
| Trigger.dev | Duplicates an existing job system |
| 21 pipeline stages | Overwhelms a founder with 12 investors |
| White-label, enterprise API | No validated demand yet |

**Explicit non-goal:** we will not build UI for any of the above just to have it present.

---

## 14. Decisions I need from you

1. **Nav consolidation** — approve removing `Onboarding`, `Edit Profile`, `Fit Analysis`,
   and `Data Health` from founder navigation? (§3.2)
2. **`/dashboard/crm`** — new page, or fold into an existing surface?
3. **Pipeline stages** — 11 curated for MVP, or all 21 from the blueprint?
4. **Trigger.dev** — accept reusing `background_jobs`, or is it a hard requirement?
5. **Enrichment strategy for cheque size / thesis** — capped AI inference marked
   "inferred", licensed data provider, or manual enrichment from your CSV round-trip?
   This is the single biggest determinant of whether 90+ matches are achievable.
6. **Route renames** — proceed with redirects, or keep current paths?

---

## 15. Immediate next step on approval

**Wave 0**, in this order, each independently verifiable:

1. `company-documents` bucket + RLS + signed URLs → upload works.
2. `meetings`, `investor_notes`, `pipeline_stage_history` migrations.
3. Migration reconciliation so a fresh environment rebuilds.
4. Strip hardcoded/fake dashboard values; wire the two repaired routes through.
5. Cross-tenant verification script covering the new surfaces.

Wave 0 has no product decisions in it — it is all repair — so it can start immediately
once you confirm the six decisions above.

---

## 16. Wave 0 execution log

Started after plan approval. Status per item.

| Item | Status | Evidence |
|---|---|---|
| `company-documents` bucket created | **DONE** | Created via Storage admin API: private, 25 MiB limit, MIME allowlist. Verified upload → sign → fetch `200 application/pdf` → delete round-trip. |
| Per-user storage isolation | **DONE** (design) | Bucket is private with **no** `storage.objects` policies = deny-by-default for anon/authenticated. Verified: anon upload returns `403 new row violates row-level security policy`. Uploads go through the server with the object key forced to the caller's `{user_id}/` prefix; reads are 60-second signed URLs minted after an ownership check on the `company_documents` row. |
| Signed URLs instead of public URLs | **DONE** | `getDocumentDownloadUrl()`; `getPublicUrl` removed from the upload path and from `deck/generate`. |
| Upload failures surfaced, not swallowed | **DONE** | `uploadCompanyDocument` now returns `{ok:false,error}` with the real reason. Documents page and onboarding render it. Onboarding previously discarded the result into `console.error`. |
| Delete + replace a document | **DONE** | `deleteCompanyDocument` removes row then object, and clears `has_pitch_deck` when the last deck goes. |
| Orphan rows identified | **DONE** | 6 `company_documents` rows have `file_url IS NULL` — created while the bucket did not exist. They render as "file missing, re-upload" and are deletable. |
| `meetings` tenant leak closed | **DONE** | `/api/dashboard/meetings` previously returned arbitrary rows from the shared `investors` corpus keyed only on `outreach_readiness` — no user scoping. Now scoped to `user_id`, with real CRUD. |
| `meetings` table created | **CODE DONE / APPLY BLOCKED** | `supabase/migrations/020_wave0_meetings_and_document_storage.sql`. |
| Migration drift reconciled | **CODE DONE / APPLY BLOCKED** | `supabase/migrations/015_live_schema_reconciliation.sql`, generated from the live PostgREST OpenAPI spec: 14 tables existed only in production. |
| Fabricated dashboard values removed | **DONE** | Cockpit and analytics no longer return hardcoded `0`s. Real: firms, high-fit, ready, saved-this-week, avg fit, meetings, credits, per-user distributions. Unknown values return `null` and render `—`. |
| Bug: `credit_ledger.delta` | **FIXED** | Column is `amount`. The original query silently matched nothing. |
| Bug: `saved_investors.fit_score` | **FIXED** | Column does not exist; analytics now joins `investors`. The old query errored into a `catch` and displayed 0%. |
| `investor_notes` table | **NOT NEEDED** | Audit claim did not hold: notes are stored in `data_change_log`. No code references `investor_notes`. |

### Blocker on the two migrations

`SUPABASE_DB_PASSWORD` in `.env.local` fails authentication for project
`tvekoojdilkjptjzpvqo` at `aws-1-eu-west-1.pooler.supabase.com`, while the REST API
and service-role key for the same project work. The password is stale.

To apply once reset (Supabase → Project Settings → Database → Reset database password):

```bash
node scripts/apply-migration.cjs supabase/migrations/015_live_schema_reconciliation.sql
node scripts/apply-migration.cjs supabase/migrations/020_wave0_meetings_and_document_storage.sql
```

`apply-migration.cjs` now names this exact failure instead of reporting a generic
connection error.

### Checks run

- `npx tsc --noEmit` — **0 errors**.
- `npx vitest run` — **100 passed**, 61 skipped (the skipped suites need a live server).
- Storage round-trip — upload/sign/fetch/delete all succeeded.
- Anon write to the private bucket — correctly denied.
- `npx eslint` on changed files — reports the same `react-hooks/set-state-in-effect`
  pattern that already affects untouched pages repo-wide (baseline: 439 errors).
  Not introduced here, not fixed here.
