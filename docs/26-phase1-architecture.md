# Capital OS — Phase 1: Product Architecture, Page Structure and Implementation Plan

Date: 2026-11-04
Status: **proposal — awaiting approval. No implementation starts from this document.**

This supersedes `docs/21` §3 (navigation), §4 (page specs), §9 (sequence) and §13
(deferred list) where they conflict. It builds on `docs/20` (MVP audit),
`docs/23` (Wave 1 findings), `docs/24` (tier-A research) and `docs/25` (P1 board).
Nothing already delivered is re-proposed as new work.

---

## 1. Ground truth this architecture has to respect

Measured on the live database, this session. These six facts decide the order of
work more than any preference about navigation.

| # | Fact | Measured |
|---|---|---|
| 1 | The corpus is not a startup-investor database | 11,943 SEC 13F filers (public-equity institutions), 6,792 IAPD adviser registrants, 260 Form D. `fund_of_funds` 11,357 (60%), `angel_investor` 6,731 (35%, mislabelled firms), `venture_capital` **140 (0.7%)** |
| 2 | The attributes matching depends on are absent | cheque range **14 / 18,995**, thesis **26 / 18,995**, sector 1.9%, `outreach_readiness = 'ready'` **0** |
| 3 | Contactability is unverified | email **4,921 (25.9%)**, but `email_verified` true on none; LinkedIn 796 (4.2%) |
| 4 | The score ceiling is arithmetic, not effort | ~**87** for this corpus with every learnable factor perfect (`docs/23` §1). 90 is unreachable without new data |
| 5 | The outreach stack has never run | `email_messages` = **0 rows** |
| 6 | The parts that do work are real | 20/20 migrations applied, storage round-trip, cross-tenant harness, send audit trail, per-user pipeline (fixed this week), 27 tier-A firms researched with sourced cheque ranges |

**Consequence.** Modules 5 (Intelligence), 6 (Matching), 7 (CRM) and 3 (Dashboard)
would be *structurally complete and functionally hollow* if built against fact 1
and fact 2 today. They would rank 19,000 institutions for a startup founder and
present 40/100 "check size unknown" as a match score. That is the failure mode the
brief forbids, and it cannot be fixed in the UI layer.

So this plan keeps the brief's full module list, but puts **data foundation**
before **matching surface**, and says plainly which modules are blocked on a
source decision rather than on engineering.

---

## 2. Complete sitemap

Eight groups, 21 founder destinations, plus admin outside the founder nav.
`Extend` = exists and grows; `New` = does not exist; `Rename` = exists under another
path, with a permanent redirect.

| Group | Item | Route | Status |
|---|---|---|---|
| **Workspace** | Overview | `/dashboard` | Extend (real aggregates) |
| | Copilot | `/dashboard/copilot` | Extend (tool registry + execution) |
| | Reports | `/dashboard/reports` | Rename from `/analytics`; extend |
| **Investors** | Discover | `/dashboard/investors/discover` | Extend (facets, save, bulk) |
| | Matches | `/dashboard/investors/matches` | Rename from `/investors/fit`; rebuild on real inputs |
| | Database | `/dashboard/investors` | Keep |
| | Investor profile | `/dashboard/investors/[id]` | Rebuild as intelligence profile |
| | Lists | `/dashboard/lists` | New (absorbs `/investors/saved`) |
| | Compare | modal over Discover | New (no nav item) |
| **Relationships** | CRM | `/dashboard/crm` | New |
| | Pipeline | `/dashboard/pipeline` | Extend to 21 stages + history + expected amounts |
| | Meetings | `/dashboard/meetings` | Extend (table exists; briefs, notes, calendar) |
| | Introductions | `/dashboard/introductions` | New (evidence-gated) |
| **Outreach** | Outreach | `/dashboard/outreach` | Extend (threads, replies, approvals) |
| | Sequences | `/dashboard/sequences` | Rename from `/campaigns`; extend |
| | Deliverability | `/dashboard/deliverability` | Merge `email-health` ×4 into tabs |
| **Company** | Profile | `/dashboard/company` | Rename from `/startup`; extend |
| | Readiness | `/dashboard/readiness` | New |
| | Deck | `/dashboard/deck` | Rename from `/decks`; add analysis + creation |
| | Data Room | `/dashboard/data-room` | New (absorbs `/documents`) |
| **Intelligence** | Intelligence | `/dashboard/intelligence` | New — tabs: News · Portfolio · Competitors · Market |
| | Opportunities | `/dashboard/opportunities` | New — grants, accelerators, fellowships |
| **Settings** | Settings | `/dashboard/settings` | Extend — tabs: Profile · Company · Billing · Email · Team · Data |

**Removed from founder navigation** (all with redirects or absorbed):
`/onboarding` (flow, not destination), `/startup/edit` (button on Profile),
`/investors/fit` → Matches, `/investors/saved` → Lists, `/outreach/metrics` (tab),
`/dashboard/data-health*` and `/dashboard/email-health/*` → Deliverability /
`/admin`, `/campaigns*` → Sequences, `/analytics` → Reports, `/documents` → Data Room,
`/ai-activity` (tab under Settings → Usage), `/decks*` → Deck.

**Admin** (not in founder nav): `/admin` — users, companies, subscriptions,
investor database, enrichment, jobs, waitlist, email monitor, system status, audit log.

**Why not one nav item per brief module.** Four of the brief's 20 modules are
*views of the same object* (Discovery/Intelligence/Matching/Database are all "an
investor"), and three are *tabs of one activity* (News/Portfolio/Competitors/Market
are all "external context"). Mapping them 1:1 to navigation would reproduce the
exact problem the audit found: `Discover`, `Investor Database`, `Saved` and `Fit` as
four nav items describing one job.

---

## 3. Page-by-page specification

Legend for required entities: `inv` investors · `firm` investor_firms ·
`port` investor_portfolio · `crm_*` CRM tables · `pl` user_pipeline_entries ·
`msg` email_messages · `doc` company_documents · `room` data room tables ·
`mtg` meetings · `cop_*` copilot tables · `intel` market/news tables.

### Tier 1 — the loop a founder runs (build first, in this order)

| Page | Purpose | Core content | Actions | AI | Entities | Backend / integrations | States |
|---|---|---|---|---|---|---|---|
| **Overview** | Answer "where does my round stand and what next" | Raise target vs committed, stage, readiness score, matches count, saved, live conversations, reply rate, upcoming meetings, overdue follow-ups, pipeline by stage, deck/data-room readiness, 3 next actions | Jump to any record; mark task done; open Copilot with a prefilled prompt | Rank next actions from real state; explain a changed metric | `inv`, `pl`, `msg`, `mtg`, `crm_tasks`, `doc` | Aggregation RPC per panel (not 15 round-trips); nulls render `—`, never `0` | loading skeleton per panel; empty state per panel with the action that fills it; error shows which panel failed, not a blank page |
| **Discover** | Find investors worth pursuing | Result list/table, facets, saved searches, bulk bar, compare tray | Search, facet, sort, save search, select, bulk save/export/compare, open profile | Natural-language query → filters ("pre-seed fintech in Lagos"); explains why a result ranked | `inv`, `firm`, `port` | Server-side filtered pagination; `search_vector` + GIN already exist; facets via `get_analytics_distributions` pattern | loading rows; no-results with facet-removal suggestions; facet error isolated; permission: read-only users see no bulk actions |
| **Investor profile** | Decide: pursue, skip, or route an intro | Identity, firm, preferences, cheque range **with basis**, thesis, portfolio, activity, relationship history, provenance per field | Save, add to pipeline, draft outreach, log note, request intro, copy briefing | Summarise fit against *this* founder; list gaps in the data; suggest an intro path | `inv`, `firm`, `port`, `crm_*`, `msg` | One composed read; provenance rendered from `provenance` jsonb | unknown field shows "not published" + source link, never a guess; missing firm shows a merge suggestion; error per section |
| **Matches** | Rank who fits and explain why | Score + per-dimension breakdown (sector, stage, cheque, geo, type, activity, contactability, completeness), evidence, incompatibilities | Filter band, save, bulk pipeline, give feedback | Narrative of the match; what would raise it; recommended outreach angle | `inv`, `firm`, company profile | `computeFitScore` (canonical) over **in-scope** records only; feedback table | score always expandable; "no score" is a state, not a zero; cold-start prompt when company profile is thin |
| **Lists** | Curated sets per thesis/round | List grid, list detail, membership, notes | Create/rename/delete, add/remove, share (team), export | Auto-suggest list from a match band; dedupe | `investor_lists`, `investor_list_items` | Absorbs `saved_investors` (migrate, keep IDs) | empty list → "add from Discover"; duplicate add is a no-op with a toast |
| **CRM** | Durable relationship state | Contact/company records, relationship owner, strength, tags, notes, tasks, timeline, custom views | Create/edit, tag, assign owner, log activity, set reminders, import/export | Summarise last 90 days; draft follow-up; flag stale relationships | `crm_tasks`, `crm_tags`, `crm_tag_links`, `data_change_log`, `investor_contacts` | Timeline is a union view over notes/msg/mtg/pl — one query | orphan contact (no firm) allowed but flagged; permission: only owner/team-admin can reassign |
| **Pipeline** | How the round is progressing | Kanban + list, 21 stages, expected amount, probability, days-in-stage, next action, loss reason | Drag/move, edit amount, set next action, view history | "Which stage is stalling and why"; forecast from probability × amount | `pl`, `pipeline_stage_history`, `pipeline_events` | Counts are **the user's entries only** (done, `docs/25`); batch status shown separately | empty board explains how an investor enters; stage move is optimistic then reconciled; conflict on stale move shows a toast, never silent overwrite |
| **Outreach** | Write, approve, send, read replies | Threads, compose, drafts, approval queue, reply classification, suppression | Draft, edit, approve, send, stop sequence on reply, suppress | Draft from profile + thesis; suggested follow-up; classify reply into interest/objection/not-now | `msg`, `reply_insights`, `email_suppression` | Gmail/Graph OAuth (exists) + SMTP fallback; tracking; pre-send credit gate (exists) | no account connected → setup card, not a disabled button; send with 0 credits → 402 with the exact shortfall; nothing is sent without an approved draft |
| **Sequences** | Multi-step follow-up | Sequence builder, steps, delays, enrollment, per-step status | Create, enroll, pause, stop on reply | Draft step bodies in the founder's voice | `campaign_sequences`, `_steps`, `_enrollments`, `msg` | Runs on existing sequence executor; server-side per-send limits | warmup gate visibly blocks enrollment until day 14; reply auto-pauses |
| **Deliverability** | Keep mail landing | Health score, domain auth (SPF/DKIM/DMARC), warmup curve, bounces, complaints | Run checks, pause sending, fix guidance | Diagnose a bounce spike against recent sends | `sending_log`, `email_health_*` | Existing health suite; DNS lookups | red state blocks sends everywhere (one rule, not four pages) |
| **Readiness** | What is missing before raising | Score + category breakdown, missing items, evidence required, priority tasks | Run assessment, tick items, attach evidence, re-run | Assess against real documents; explain score movement | `readiness_assessments`, `readiness_items`, `doc` | Deterministic rules + AI narrative; no invented benchmarks | unscored = "not assessed", never 0%; each item says what evidence closes it |
| **Deck** | Upload, analyse, improve, generate | Deck list, versions, slide viewer, per-slide findings, export | Upload pdf/pptx, analyse, edit generated slides, export | Parse, critique, flag missing/inconsistent claims, generate deck from company profile | `deck_analyses`, `company_documents`, `company_profiles` | PDF/PPTX parsing server-side; export gated by plan | unsupported file → explicit reason; generation refuses to invent traction (asks instead) |
| **Data Room** | Package diligence material | Folder tree by category, versions, share links, viewer activity, missing-document checklist | Upload, version, share with expiry, revoke, request | Classify uploads into categories; list missing diligence items | `data_room_folders`, `_shares`, `_access_log`, `company_documents` | Private bucket + signed URLs (exists); no public URLs | expired share shows "link expired"; upload failure surfaces the real error |
| **Copilot** | Execute work across the system | Conversation, plan, step-by-step progress, approvals, results with links | Ask, approve/reject a step, cancel, retry, view history | Planner → tool calls → verification → report | `cop_*`, `company_memory` | Tool registry, permission classes, audit log, idempotency keys | every step shows running/succeeded/failed; a failed step is named, never summarised as success |

### Tier 2 — build after the loop closes

| Page | Purpose | Essential shape | Blocking dependency |
|---|---|---|---|
| **Meetings** | Prepare, hold, harvest | Meeting record, brief generated from investor profile + thread, notes, action items, calendar sync | Calendar OAuth (Google/Microsoft already used for mail) |
| **Introductions** | Route a warm path | Candidate connectors with **evidence** (shared employer, co-investment, public statement), request tracking | A relationship evidence source — see §6 |
| **Intelligence · News** | What changed at my target firms | Followed firms/sectors, item list with source + date, relevance filter | News provider — see §6 |
| **Intelligence · Portfolio** | Who an investor actually backs | Portfolio companies, stage, dates, co-investors, overlap with founder's space | Portfolio data (`investor_portfolio` empty today) |
| **Intelligence · Competitors** | Who I am up against | Competitor profiles, funding, positioning, comparison | Curated + provider data |
| **Intelligence · Market** | Size and shape of the market | Segments, trends, sourced figures with dates | Provider; **no unsourced TAM numbers, ever** |
| **Opportunities** | Non-dilutive funding | Grants/accelerators, eligibility, deadlines, application tracker | Curated source or provider |
| **Reports** | Prove the round's numbers | Discovery/matching/outreach/pipeline conversion, exports | Nothing new — reads existing tables |
| **Settings · Team** | Multiple seats | Invites, roles, permissions, ownership | RLS change; see risk R4 |
| **Company Profile** | The facts everything reads | Sector, model, geo, stage, cheque target, traction | Extend `company_profiles` with the columns matching needs |

### Cross-cutting states, mandatory on every page

- **Loading** — skeleton that matches final layout, never a spinner over a blank page.
- **Empty** — explains what the page does and gives the one action that fills it.
- **Error** — names the operation that failed and offers retry; partial failure renders the parts that worked.
- **Permission** — hides actions rather than showing disabled buttons with no reason.
- **Unknown data** — `—` with a source link, or "not published". Never `0`, never an estimate presented as fact.

---

## 4. User journeys

Each journey names the modules it crosses and the records it writes. If a journey
cannot state what it writes, it is not a journey — it is a screen.

| # | Journey | Crosses | Writes |
|---|---|---|---|
| J1 | **Register → onboard** | auth → onboarding (5 steps) → Overview | `profiles`, `company_profiles` |
| J2 | **Company profile** | Profile → Readiness | `company_profiles` (+ sector, stage, cheque target) |
| J3 | **Fundraising requirements** | Profile → Matches | `company_profiles.target_cheque_*`, raise target |
| J4 | **Readiness assessment** | Readiness → Deck / Data Room | `readiness_assessments`, `readiness_items` |
| J5 | **Discover** | Discover → profile | search history, saved search |
| J6 | **Read intelligence** | profile → provenance fields | `data_change_log` (view only) |
| J7 | **Review matches** | Matches → profile | `fit_feedback` |
| J8 | **Save → CRM** | Lists / CRM | `investor_lists`, `user_pipeline_entries` (seeded at `qualified`) |
| J9 | **Find an intro** | Introductions → profile | `introduction_requests` |
| J10 | **Outreach** | Outreach → sender → `email_messages` | draft → approve → send; credit ledger |
| J11 | **Track conversation** | Outreach → reply poller → `reply_insights` | classified reply, auto-pause |
| J12 | **Advance pipeline** | Pipeline → history | `user_pipeline_entries`, `pipeline_stage_history` |
| J13 | **Deck** | Deck → analysis → export | `company_documents`, `deck_analyses` |
| J14 | **Data room** | Data Room → shares → access log | `data_room_*` |
| J15 | **Meetings** | Meetings → brief → notes → tasks | `meetings`, `crm_tasks` |
| J16 | **Copilot executes** | Copilot → any tool → audit | `cop_*` + whatever the tools write |
| J17 | **Investor news** | Intelligence · News | `follows`, `intel_items` |
| J18 | **Performance** | Reports ← everything | none (read-only) |
| J19 | **Collaboration** | Team → every surface | `team_members`, `activities` |
| J20 | **Reports & documents** | Reports / Data Room | exports |

### The spine

```
Company profile ──► Matches ──► Lists/CRM ──► Outreach ──► Replies
      │                 │            │                       │
      │                 └──► Introductions ──► Meetings ◄─────┘
      │                                          │
      └──► Readiness ──► Deck ──► Data room       │
                                   │              │
                                   ▼              ▼
                              Pipeline ◄── stage history
                                   │
                                   ▼
                                Reports ──► Overview
```

**Synchronisation rules** (the brief's rule 9, made concrete):

1. One investor record. `saved_investors`, `user_pipeline_entries` and CRM reference
   `investors.id`; nothing copies investor data into a second table.
2. Stage is owned by `user_pipeline_entries`. `investors.outreach_readiness` is batch
   state and stays read-only in the UI (already enforced, `docs/25`).
3. A reply updates the thread **and** suggests a stage change; it never silently moves it.
4. A meeting references the investors it concerns and the thread that produced it.
5. Deck/data-room state feeds Readiness and Overview by query, not by denormalised copies.
6. Every write that a founder can make from two places (save, stage, note) goes through one
   service function, so both surfaces cannot diverge.

---

## 5. Data model

### 5.1 Blocking decisions

| Item | Decision needed | Why it blocks |
|---|---|---|
| **Entity split** | `investor_firms` = organisations; `investors` = people at them | Every row today is a firm with `first_name`/`last_name`/`job_title` filled as if a person. Partner-level contactability, intros and "investment team" all depend on this. `docs/23` §5 deliberately did not fake it |
| **In-scope flag** | `investors.is_startup_investor` (or `scope` enum) | Without it, Matches ranks 13F filers. With it, the product can be honest about what it holds |

### 5.2 New tables (grouped, all with RLS per §7.4 template)

| Module | Tables |
|---|---|
| Lists | `investor_lists`, `investor_list_items` |
| CRM | `crm_tasks`, `crm_tags`, `crm_tag_links`, `investor_contacts` |
| Pipeline | `pipeline_stage_history` |
| Matching | `fit_feedback` |
| Meetings | `meetings` (exists), `meeting_briefs`, `meeting_notes` |
| Introductions | `introduction_requests`, `introduction_paths` |
| Readiness | `readiness_assessments`, `readiness_items` |
| Data room | `data_room_folders`, `data_room_shares`, `data_room_access_log`, `deck_analyses` |
| Data depth | `investor_portfolio`, `investor_theses` |
| Copilot | `copilot_conversations` (exists), `copilot_messages`, `copilot_tool_calls`, `copilot_approvals`, `company_memory` |
| Intelligence | `market_signals`, `competitor_watch`, `investor_news`, `follows` |
| Opportunities | `opportunities`, `opportunity_applications` |
| Team | `team_members`, `team_invites`, `activities` |

### 5.3 Extensions to existing tables

```sql
-- investors: the columns matching and the UI actually need
ALTER TABLE investors
  ADD COLUMN IF NOT EXISTS lead_preference TEXT,          -- lead | follow | either
  ADD COLUMN IF NOT EXISTS excluded_sectors TEXT[],
  ADD COLUMN IF NOT EXISTS fund_size NUMERIC,
  ADD COLUMN IF NOT EXISTS thesis_source TEXT,            -- URL the thesis came from
  ADD COLUMN IF NOT EXISTS scope TEXT;                    -- startup_investor | institution

-- company_profiles: what matching must read
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS business_model TEXT,
  ADD COLUMN IF NOT EXISTS target_cheque_min NUMERIC,
  ADD COLUMN IF NOT EXISTS target_cheque_max NUMERIC,
  ADD COLUMN IF NOT EXISTS readiness_score INTEGER;

-- user_pipeline_entries: real CRM record
ALTER TABLE user_pipeline_entries
  ADD COLUMN IF NOT EXISTS expected_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS probability INTEGER,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS owner_id UUID;
```

### 5.4 Pipeline stages

The brief specifies 21 stages. Adopt them, mapped from the current 11 so no data is
lost (`discovered→discovered`, `qualified→shortlisted`, `researching→researching`,
`outreach→outreach_drafted`, `contacted→contacted`, `meeting→meeting_scheduled`,
`follow_up→follow_up`, `due_diligence→due_diligence`, `term_sheet→term_sheet`,
`closed→closed_won`, `passed→not_a_fit`). New: `introduction_requested`,
`introduction_received`, `responded`, `first_meeting_completed`, `partner_meeting`,
`verbal_commitment`, `negotiation`, `committed`, `closed_lost`, `on_hold`.
Migration is additive with a CHECK on the new enum plus a mapping table — reversible.

---

## 6. Integrations

| Capability | Today | Needed | Blocker |
|---|---|---|---|
| Email send/receive | Gmail + Microsoft OAuth, SMTP fallback **coded, never run** | Live mailbox, SPF/DKIM/DMARC, 2-week warmup | Founder's mailbox; warmup is calendar time |
| Contact data | Apollo pipeline script, no key | `APOLLO_API_KEY` | Key |
| Email verification | ZeroBounce code path, no key | `ZEROBOUNCE_API_KEY` | Key |
| Billing | Stripe integration, no key | `STRIPE_SECRET_KEY`, webhook secret | Key |
| LLM | Working (OpenAI-compatible) | Model allowlist, per-user caps, cost per action | none |
| Calendar | Google/Microsoft OAuth already used for mail | Calendar scope + sync route | OAuth scope grant |
| Deck parsing | none | PDF/PPTX text + image extraction | library choice (server-side) |
| **News / market / portfolio / competitor** | none | Paid provider (Crunchbase-class, PitchBook, or news API) **or** manual curation | **Decision + budget** |
| **Grants / accelerators** | none | Curated dataset or provider | **Decision** |
| **Relationship evidence (intros)** | none | Connected mail/calendar graph, or manual evidence entry | **Decision** |

Four modules in this brief — News, Portfolio, Competitor, Market — plus Introductions
and Opportunities have **no data source in the system today**. Engineering them
without one produces exactly the "looks finished, does nothing" outcome rule 6 and
rule 20 forbid. They need a source decision before they need code.

---

## 7. Implementation sequence

### Why this deviates from the brief's phase order

The brief orders: Dashboard → Discovery → Intelligence → Matching → CRM → Outreach
→ Introductions → Pipeline → Copilot → Readiness → Deck → Data Room → News →
Portfolio → Competitors → Market → Grants → Reports → Collaboration.

Building Dashboard and Matching first would produce two surfaces whose numbers are
drawn from fact 1 and fact 2 in §1 — a dashboard reporting on 19,000 institutions and
a match score limited to 87 by absent cheque data. The brief's own rules 4, 6 and 13
argue against that. Proposed order keeps every module, and moves the two data
decisions in front of the surfaces that depend on them.

### Waves

| Wave | Content | Exit test | Depends on |
|---|---|---|---|
| **W0 — Foundations** ✅ | `investors.scope`; `investor_people` keyed to the existing org rows; `fit_feedback`; `investor_lists` + items. No firm copy, no stage DDL, no duplicate history table — `docs/27` | Existing pages still pass; nothing reads a dropped column | Decision D1 |
| **W1 — Population** | Classify all 18,995 (startup investor / institution / unknown) with evidence; re-ingest or curate real VCs; tier-A research pattern extended | ≥ 80% classified; Matches shows only in-scope | Decision D2 |
| **W2 — Truthful matching** | Recompute fit over in-scope records; per-dimension evidence; feedback loop; honest unknown states | Every score expandable; no band above the data's ceiling | W1 |
| **W3 — Loop surfaces** | Overview (real aggregates), Lists, CRM basics, Pipeline 21 stages + history ✅ stages shipped (`docs/28`), Reports v1 | J1–J12 pass end to end on a seeded account | W0–W2 |
| **W4 — Sending proven** | Live mailbox, warmup, one approved send → reply → classified insight → suggested stage change | One real send and one real reply observed; bounce < 3% | Keys + 2 weeks |
| **W5 — Materials** | Readiness ✅ shipped (`docs/29`), Deck (analysis + generation), Data Room | J4, J13, J14 pass; unsourced claims refused | W3 |
| **W6 — Copilot execution** | Tool registry over every W3–W5 action, planner, approvals, audit, idempotency, memory | A 5-step instruction completes with per-step evidence; a forced failure is reported as failure | W0–W5 |
| **W7 — Intelligence** | News, Portfolio, Competitors, Market, Opportunities, Introductions | Each item shows source + date; none rendered without one | Source decisions |
| **W8 — Team** | Roles, shared lists/CRM, assignments, activity feed | Two-account isolation suite still green; roles enforced server-side | W3 |
| **W9 — Re-audit** | `docs/20` audit re-run module by module with COMPLETE / PARTIAL / BLOCKED / NOT STARTED + evidence | No module marked above its evidence | all |

**Effort bands** (engineering days, excluding calendar-gated warmup and provider
procurement): W0 3–5, W1 8–12, W2 4–6, W3 10–14, W4 3–5 + 14 calendar, W5 10–14,
W6 12–18, W7 8–14 per module depending on source, W8 5–8, W9 5–8.

---

## 8. Dependencies and risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Population is wrong (fact 1) | Matching, dashboard, CRM all report on the wrong entities | W1 before W2/W3; visible `scope` label |
| R2 | Cheque/thesis absent at scale (fact 2) | 90+ unreachable; "check size unknown" everywhere | Fix population first; enrich per **firm**, not per person; third-party figures labelled `derived`, never `verified` |
| R3 | No source for 6 modules | They become placeholder UI — the exact failure the brief forbids | Decide D3 before building; build them last; hide, don't fake |
| R4 | Team/collaboration touches every RLS policy | Cross-tenant leak | W8 last; two-account harness is a release gate |
| R5 | Copilot writes real data | Corpus corruption, cross-tenant write | User-scoped client only; approval classes; idempotency keys; every call audited |
| R6 | Sending reputation | Domain burned before the pilot | Warmup gates enforced in code, not documentation; controlled recipients until DKIM verified |
| R7 | Scope breadth vs one working loop | Everything 60% done | Waves are exit-tested; a wave does not start before the previous one's test passes |
| R8 | 21 stages overwhelm a founder with 12 investors | Usability regression | Default board shows 6 active stages, rest behind "show all" |

---

## 9. Acceptance criteria

A module is **COMPLETE** only when all of its rows pass. Anything else is PARTIAL
with the failing row named.

| Module | Acceptance |
|---|---|
| Overview | Every tile resolves from a query; a tile with no data renders `—`; a founder can complete one action (mark task / open draft) without leaving the page |
| Discover | Facet counts equal ground-truth queries; pagination has no duplicates or gaps; bulk action writes exactly the selected rows |
| Profile | Every field shows provenance or "not published"; no field is invented; a correction survives reload |
| Matches | Score expands to per-dimension evidence; unknown inputs are named; no score above the corpus ceiling; feedback changes the next score |
| Lists / CRM | Add/remove is idempotent; a timeline item traces to its source row; two users cannot see each other's records |
| Pipeline | Counts equal the user's entries exactly (verified by query); a move writes an entry + history row; a failed move leaves state unchanged |
| Outreach | Send requires an approved draft; 0 credits → 402; failure refunds; reply classifies and pauses the sequence |
| Readiness / Deck / Data room | Score reproducible from stored items; deck findings cite a slide; a share link expires and logs its viewer |
| Copilot | Each step shows running/succeeded/failed; a failed step is never reported as success; every write is auditable by id |
| Intelligence / Opportunities | Every item carries source + date; stale items flagged; nothing rendered without a source |
| Team | Role changes take effect server-side; two-account suite green |

**Global gates for every wave:** `tsc --noEmit` 0 · offline suite green · two-account
isolation suite green · no new `as any` on database rows · no hardcoded statistic in a
route.

---

## 10. Decisions I need before Wave 0

1. **D1 — Entity split.** Approve `investor_firms` = organisations / `investors` = people,
   with a compatibility view so nothing breaks mid-migration? Without it, partner
   contacts, investment teams and introductions have nowhere to live.
2. **D2 — Population.** Approve classifying all 18,995 records as
   `startup_investor` / `institution` / `unknown`, scoring only the first group? The
   alternative is keeping 60% funds-of-funds as prospects, which makes every
   downstream module's numbers misleading.
3. **D3 — Sources for Intelligence, Opportunities and Introductions.** Paid provider,
   curated datasets, or connected mail/calendar for relationship evidence? Without a
   choice these six modules can only be hidden, not built.
4. **D4 — Copilot default autonomy.** Proposed default: reads and reversible internal
   actions run automatically; anything external (send, share, delete) requires approval;
   irreversible operations are never automatic. Confirm or adjust.
5. **D5 — Sequence.** Approve the data-first order in §7, or hold the brief's order and
   accept that Dashboard and Matches will be built on the current corpus and corrected
   in W1/W2 afterwards.

I have not started implementation. On approval of D1–D5 I begin at W0, whose exit test
is that every existing page still works against the compatibility view.
