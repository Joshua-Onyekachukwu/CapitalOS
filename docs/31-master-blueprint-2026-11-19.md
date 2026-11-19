# Capital OS — master blueprint register and build plan

**Captured:** 2026-11-19 · **Source:** owner's master product blueprint (33 sections)
**Status vocabulary:** COMPLETE (verified) · PARTIAL · BLOCKED (external dependency) ·
MISSING · NOT STARTED. Nothing is COMPLETE here without a cited command or live check.

This file is the operative register: requirement IDs are stable and should be cited in
commits, PRs and `docs/30-completion-tracker.md`. Section numbers in brackets refer to the
source blueprint.

---

## 1. Non-negotiable boundaries [31]

| ID | Boundary | Status |
|---|---|---|
| B-1 | Founder-first. No investor-facing marketplace or investor CRM in this product. | Honoured |
| B-2 | Investor DB is the intelligence foundation, not the product. Value = data + qualification + matching + relationships + outreach + execution. | Honoured in design |
| B-3 | Never invent cheque sizes, portfolios, preferences, deals, contacts, activity or relationships. Unavailable data is shown as unavailable. | Policy: enforced in copy; audit needed on AI research prompts |
| B-4 | Built vs planned must be distinguishable everywhere. No fake functionality, no placeholder metrics presented as real. | PARTIAL — some pages still thin; keep auditing |
| B-5 | Preserve working architecture; do not rebuild without a reason. | Honoured |

---

## 2. Current state, measured 2026-11-19

| Surface | Measured | Note |
|---|---:|---|
| App pages | 73 | public, auth, founder dashboard, admin |
| API routes | 94 | broad coverage, uneven depth |
| Migrations on disk | 40 | ledger reconciled through `042` (`npm run db:status`) |
| Active investor records | 24,379 | 18,995 firms + 5,461 Form D vehicles (US only) |
| Investor emails | 4,933 | **none email-verified** |
| Person rows / distinct people | 12,102 / 4,205 | Form D related persons, not contact-verified |
| Portfolio company rows | 0 | blocks portfolio/thesis/competitor intelligence |
| Cheque-size coverage | 14 records | blocks cheque-fit scoring |
| Thesis text coverage | 26 records | blocks thesis fit |
| Manager mapping | 18 managers / 179 vehicles (3.28%) | review-gated; range 3,398–4,327 still unproven |
| Emails ever sent | 0 | outreach/sequences/tracking idle by data starvation |
| Org / team model | absent | every table single-owner |
| RLS on app path | bypassed | service-role client used for user requests (audit H2) |
| Background jobs | in-process `setInterval` | `job_queue` exists; not serverless-safe, no Trigger.dev |
| AI gateway | NVIDIA NIM + OpenRouter (pipeline only) | spec asks for one gateway |
| Observability | Sentry present; PostHog wired (no key); no Langfuse | |

**Consequence:** the blueprint's matching engine cannot produce trustworthy scores today.
Industry/stage/geography can be scored; cheque fit (14 records), portfolio fit (0 rows) and
contactability (0 verified emails) cannot. Data acquisition is the critical path, not UI.

---

## 3. Requirement register

### 3.1 Identity, onboarding, company profile [4]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| FND-1 | Signup, login, reset, email verification, Google auth | COMPLETE | — |
| FND-2 | Progressive onboarding collecting startup, fundraising, traction fields | PARTIAL | Many blueprint fields absent (countries of operation, instrument, runway, customer segments, milestones) |
| FND-3 | Data state per field: verified / founder-submitted / unavailable / confidential | MISSING | No provenance-state column on company profile |
| FND-4 | Editable structured company profile usable by AI, with external-use controls | PARTIAL | Profile edits exist; per-field disclosure controls absent |
| FND-5 | Multi-founder / team membership | MISSING | No org model (blocks collaboration, shared pipeline) |

### 3.2 Founder dashboard [5]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| DASH-1 | Fundraising overview (target, committed, received, remaining, deadline) | PARTIAL | `fundraising_rounds`/targets exist; cockpit reads real data |
| DASH-2 | Investor + pipeline statistics from real rows | PARTIAL | Counts exist; some cards still empty without data |
| DASH-3 | AI next-action recommendations | MISSING | No next-action engine |
| DASH-4 | Recent activity + task management | PARTIAL | Task model real; activity feed partial |

### 3.3 Global investor intelligence database [6]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| INV-1 | Org schema separate from people, funds, portfolio, investments, sources | PARTIAL | `investors` still a wide table; `investor_managers` added; no funds/portfolio/investment tables |
| INV-2 | 13 investor categories incl. angels, syndicates, family offices, CVC, accelerators | PARTIAL | Type field exists; corpus is SEC firms/vehicles, not the full category mix |
| INV-3 | Stage, industry, business-model, geography, thesis preferences | PARTIAL | Sparse (thesis 26, cheque 14) |
| INV-4 | Cheque min/typical/max + currency, never confused with fund size | PARTIAL | 14 records; no evidence column |
| INV-5 | Investment activity: frequency, recency, lead/follow, co-investors, exits | MISSING | No investment events table |
| INV-6 | Portfolio intelligence + competitor/conflict detection | MISSING | 0 portfolio rows |
| INV-7 | People: roles, bios, LinkedIn, public email, verification status, last verified | PARTIAL | 4,205 person rows, no titles/contacts |
| INV-8 | Provenance per data point: source, type, dates, confidence, method, evidence | PARTIAL | `investor_data_points`/provenance from `022`, coverage thin |
| INV-9 | Five-tier classification; AI-inferred never shown as verified | PARTIAL | Types exist; UI enforcement unverified |
| INV-10 | Freshness system: last checked, next review, stale flags | PARTIAL | Columns/partial; no scheduler |
| INV-11 | 500k–1,000,000 records over time, quality over count | NOT STARTED | 24,379 records, US-only |

### 3.4 Discovery [7]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| DISC-1 | Faceted filters: geography, stage, cheque, industry, type, activity, lead, business model, fit, contact availability, confidence, freshness | PARTIAL | Most filters real; contact/confidence/freshness filters missing |
| DISC-2 | Natural-language query → structured filters, grounded in DB | PARTIAL | Parser exists; must never let the model invent investors |
| DISC-3 | Result cards with match score, confidence, freshness, relevance reason | PARTIAL | Cards exist; confidence/freshness absent |
| DISC-4 | Pagination, sorting, saved searches, history | COMPLETE | Saved filters + alerts (039) |
| DISC-5 | Server-side search at 500k scale | NOT STARTED | Needs keyset pagination + measured latency |

### 3.5 Investor profiles [8]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| PROF-1 | Overview, thesis, history, team, portfolio sections | PARTIAL | Overview/history real; portfolio empty |
| PROF-2 | Cheque intelligence with evidence + confidence + last verified | PARTIAL | Estimates exist; evidence weak |
| PROF-3 | Founder-specific assessment: per-dimension fit, reasons, cautions, next action | PARTIAL | Fit analysis endpoint exists; explainability shallow |
| PROF-4 | Traceable AI research report with sources | PARTIAL | Research exists; source citation discipline unverified |

### 3.6 Matching engine [9]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| MATCH-1 | Company normalization into taxonomy | PARTIAL | Fit service normalizes; no shared taxonomy table |
| MATCH-2 | Investor normalization for matching | PARTIAL | Derived at query time |
| MATCH-3 | Hard eligibility filters, missing ≠ disqualified | PARTIAL | Some hard filters; missing-data handling inconsistent |
| MATCH-4 | Weighted scoring 20/15/15/15/10/15/10 | PARTIAL | 7-factor engine exists; weights not versioned/configurable in DB |
| MATCH-5 | Separate confidence score from match score | PARTIAL | Confidence not persisted separately |
| MATCH-6 | Classifications (Excellent → Poor), explicitly not probabilities | PARTIAL | Labels exist; copy must stay non-probabilistic |
| MATCH-7 | Explanations: evidence, uncertainty, mismatches, next action | PARTIAL | Text generated; evidence links not persisted |
| MATCH-8 | Persist match ID, dimensions, evidence, version, recalc dates | MISSING | No `match_runs`/`investor_matches`/`match_evidence` tables |
| MATCH-9 | Feedback → evaluation, never silent weight changes | PARTIAL | `fit_feedback` (023) exists, loop not wired |
| MATCH-10 | Hybrid: SQL filter + FTS + pgvector + deterministic score + AI explanation | PARTIAL | FTS/pgvector present; orchestration partial |
| MATCH-11 | Precision@10/20 measured on a labelled set | NOT STARTED | No evaluation dataset |

### 3.7 CRM, relationships, outreach, pipeline, meetings [10–13, 18]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| CRM-1 | Save/tag/group/compare/archive investors, custom fields, dedupe | PARTIAL | Lists, comparison, notes, timeline real; custom fields + org-level dedupe missing |
| CRM-2 | Interaction timeline across research, email, calls, meetings, docs | PARTIAL | Merged timeline exists; calls/docs partial |
| REL-1 | Relationship graph owner ↔ people ↔ orgs ↔ portfolio ↔ advisors | MISSING | `introductions` records outcomes; no graph/edges |
| REL-2 | Explain path + source; never imply consent | MISSING | No relationship data source |
| OUT-1 | Personalized generation grounded in investor + company evidence | PARTIAL | Drafting real; guardrails need audit |
| OUT-2 | Send via Gmail/Graph/SMTP with approval, threads, replies, limits | BLOCKED | Code complete, 0 sends; needs mailbox + warmup + verified contacts |
| OUT-3 | Sequences/follow-ups with stop conditions | PARTIAL | Engine real, unused |
| PIPE-1 | Visual pipeline, 16 stages, custom stages, table/kanban | PARTIAL | 21 stages, DnD, lost reasons; custom stages absent |
| PIPE-2 | Automation/reminders on stalls, overdue, meetings, DD | PARTIAL | Reminders exist; no rule engine |
| MEET-1 | Schedule, calendar sync, briefing, outcomes → CRM | PARTIAL | Tables + scoped CRUD; no calendar sync or AI briefs |

### 3.8 AI copilot and agent layer [14, 26]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| AI-1 | Context-aware copilot over company, DB, matches, CRM, outreach, pipeline | PARTIAL | Context assembly real |
| AI-2 | Controlled tool registry + server-side permission checks | PARTIAL | Tool approvals table (032) + `/api/copilot/tools/[id]`; registry incomplete |
| AI-3 | Confirmation for consequential/external actions | PARTIAL | Approval scaffolding; enforcement unverified |
| AI-4 | Execution logs, retries, streaming, cost/usage tracking | PARTIAL | Usage/credits exist; no Langfuse/AI execution audit |
| AI-5 | Eleven logical agents sharing one gateway/tool registry | MISSING | Ad-hoc prompts per feature |
| AI-6 | Prompt-injection defence for research/web content | PARTIAL | Needs explicit untrusted-content boundary + tests |

### 3.9 Readiness, deck, data room [15–17]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| READY-1 | 15-category readiness score with gaps and tasks | COMPLETE | Live-verified |
| DECK-1 | Deck analysis: missing slides, unsupported claims, narrative | PARTIAL | Generation real; uploaded-deck analysis unverified |
| DECK-2 | Deck generation, slide editing/reorder, PDF/PPTX export, layout validation | PARTIAL | Generation + export exist; layout validation missing |
| ROOM-1 | Folders, versioning, permissions, share links, expiry, access logs | PARTIAL | Share token route + audit tables (029/033); investor-scoped permissions/versioning to verify |
| ROOM-2 | AI summaries + missing-document recommendations | MISSING | — |
| ROOM-3 | `storage.objects` RLS policies | PARTIAL | Bucket exists; policy work outstanding |

### 3.10 Analytics, notifications, admin [19–22]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| REP-1 | Funnel, response, conversion, time-in-stage, distributions | PARTIAL | Real queries; empty until sends exist |
| REP-2 | Weekly/monthly/investor/outreach reports; PDF + CSV | PARTIAL | CSV + print view; no PDF |
| NOTIF-1 | In-app + email notifications, preferences, read state, reminders | PARTIAL | Bell, search alerts, data-room notifications; no preference centre |
| ADM-1 | Separate admin environment, users, system, audit | COMPLETE | 12 pages, `requireAdmin`, nightly 401/403 matrix |
| ADM-2 | Investor CMS: CRUD, bulk, merge, verify, evidence review, freshness | PARTIAL | CRUD/merge/import exist; evidence review thin |
| ADM-3 | Ingestion pipeline with human review before publishing | PARTIAL | Import/staging/review exist; publish gate partial |
| ADM-4 | Matching admin: weights, taxonomies, versions, A/B, false pos/neg | MISSING | — |
| ADM-5 | AI admin: providers, routing, prompts, cost, latency, safety | PARTIAL | Stats only |
| ADM-6 | Billing admin: plans, subs, refunds, failed payments | PARTIAL | Plans/subscriptions; no live payments |
| ADM-7 | Feature flags | MISSING | No table/evaluation |

### 3.11 Platform: data model, architecture, scale, security [22–25, 27, 29]

| ID | Requirement | Status | Gap |
|---|---|---|---|
| DB-1 | Entity set: orgs, people, funds, theses, stages, industries, geographies, cheque ranges, portfolio, investments, contacts, sources, data points, verification history | PARTIAL | Needs the split-out schema; today mostly one wide `investors` table |
| DB-2 | Matching, fundraising, relationship, outreach, meeting, document, AI, admin tables as specified | PARTIAL | Many exist under different names; gaps listed above |
| DB-3 | FKs, indexes, constraints, timestamps, soft delete, tenant isolation | PARTIAL | Indexes/scale work done (027); soft delete inconsistent |
| ARCH-1 | Next.js/React/TS frontend | COMPLETE | Next 16.3, React 19 |
| ARCH-2 | Supabase Postgres/Auth/Storage/RLS/FTS/pgvector + migrations | COMPLETE | 40 migrations, ledger green |
| ARCH-3 | Single AI gateway (OpenRouter), providers, structured output, fallback, embeddings, tools | PARTIAL | NIM + OpenRouter split; no gateway abstraction |
| ARCH-4 | Trigger.dev for long/scheduled work | MISSING | In-process runner only |
| ARCH-5 | PostHog, Sentry, Langfuse | PARTIAL | Sentry live; PostHog unwired; no Langfuse |
| ARCH-6 | Resend/Gmail, Google Calendar, GitHub, payments | PARTIAL | Email real; Calendar missing; Stripe instead of Paddle/Dodo |
| ARCH-7 | Vercel + Supabase deployment | COMPLETE | — |
| SCALE-1 | Indexed pagination, no full-table loads, background heavy work, caching, rate limits | PARTIAL | Rate limits + indexes exist; discovery pagination and caching incomplete |
| SEC-1 | RLS + company isolation on the app path | FAILING | Service-role client used for user requests (H2) — DB RLS does not protect app traffic |
| SEC-2 | Validation, rate limits, secret management, audit logs, retention, deletion | PARTIAL | Strong pieces; retention/deletion partial |
| SEC-3 | Prompt injection + malicious upload defence; server-side tool permissions | PARTIAL | Needs explicit tests |
| DATA-1 | Acquisition across US/UK/EU/Africa/Asia/ME/Canada/LatAm, legally sourced | NOT STARTED | US SEC only |
| DATA-2 | Ingest → extract → normalize → validate → dedupe → enrich → verify → score → publish, traceable | PARTIAL | US pipeline only |
| DATA-3 | Quality metrics: completeness, accuracy, duplicate rate, verification, freshness, contacts, portfolio, cheque, stage | NOT STARTED | No published scorecard |
| QA-1 | Frontend/backend/investor-data/matching/security/performance testing | PARTIAL | 100+ unit tests, nightly prod suites; no matching evaluation set |
| UX-1 | Professional financial-intelligence design system; no generic AI-dashboard look | PARTIAL | Design system exists (`PRODUCT.md`, `DESIGN.md`); consistency audit pending |

---

## 4. Build plan

Ordering rule: **data → qualification → execution → scale**. UI is built only against real
reads. Each phase ships with its own migration, tests and a tracker row.

### Phase 0 — Close the audit and settle architecture (3–5 days)

- Produce the 17 required deliverables [32] as one matrix: reuse `docs/audit/SYSTEM_AUDIT.md`,
  `docs/20`, `docs/21`, `docs/23`, `docs/30`, and this register; add the missing page-by-page
  matrix (status / backend / DB / API / AI / UX / deps / done-when).
- Decisions needed before code: RLS enforcement strategy (fix `queryAs` vs user-scoped client
  on every route), org/team model (single-owner vs `companies`+`company_members`), AI gateway
  (OpenRouter), background runner (Trigger.dev), payments (keep Stripe vs Paddle/Dodo),
  data-acquisition budget and licensed sources.
- Fix defects already known: `email_domain_health` unique `(user_id, domain)` (upsert is dead
  code), H2 service-role app path, Copilot tool-permission enforcement.
- Exit: decisions recorded, tracker rows opened, `tsc` + tests + build green.

### Phase 1 — Foundation and founder experience (2–3 weeks)

Company profile completion + per-field provenance state; dashboard next-action engine reading
real rows; notifications preference centre; admin foundation for the investor CMS.
Exit: a founder's "what do I do next" is computed from data, with tests.

### Phase 2 — Investor intelligence foundation (4–6 weeks; critical path)

Split the wide table into orgs / people / funds / portfolio companies / investments / contacts
/ sources / data points / verification history (DB-1). Build the ingestion pipeline stages with
provenance, confidence and freshness (INV-8/9/10, DATA-2), dedupe + merge, human review gate,
and the admin investor CMS. Continue manager identity: Form ADV/CRD join to move beyond the
18 mapped managers (3.28%) toward the measured 3,398–4,327 range, still review-gated.
Exit: a record can be traced to source, dated, confidence-scored, reviewed and republished;
quality scorecard published (DATA-3).

### Phase 3 — Discovery at scale (3–4 weeks)

Full facet set incl. contact availability/confidence/freshness, grounded NL search, keyset
pagination, sort, saved searches; server-side only. Exit: measured p95 query latency at
100k+ rows; no full-table loads.

### Phase 4 — Matching engine v2 (4–5 weeks)

Normalization + taxonomies, eligibility with missing-data semantics, weighted scoring stored
per run, separate confidence, evidence links, versioned weights, recalculation on profile/data
change, feedback capture. Build the labelled evaluation set and publish precision@10/20
(MATCH-11). Exit: 90+ means measured relevance, not an arbitrary number.

### Phase 5 — Fundraising execution (4–6 weeks)

CRM custom fields + org-level dedupe, relationship graph and intro workflow (with consent
semantics), outreach with verified contacts and mailboxes, sequences, pipeline automation,
meetings with calendar sync and AI briefs. Exit: one real end-to-end send → reply → meeting →
stage change, verified live.

### Phase 6 — AI intelligence layer (4–6 weeks)

Single gateway, tool registry with server-side permissions, approval gates, execution logs,
cost caps, Langfuse traces, the eleven logical agents, prompt-injection tests. Exit: a
multi-step "find → qualify → research → draft" workflow runs with progress, cancel, retry and
approval, fully logged.

### Phase 7 — Readiness, deck, data room (3–4 weeks)

Uploaded-deck analysis + layout validation, data-room versioning/permissions/expiry/AI
summaries, storage RLS. Exit: share link scoped to one investor expires and is audited.

### Phase 8 — Analytics and commercialization (2–3 weeks)

Full funnel/conversion/time-in-stage, PDF reports, notification preferences, plans/credits/
usage limits and a live payment path. Exit: a real payment and an enforced credit limit.

### Phase 9 — Scale and hardening (ongoing)

Global data expansion toward 500k with quality gates, search/matching perf, background
scaling, security audits, load tests, monitoring. Exit: published quality + performance
scorecards each cycle.

**Critical path:** Phase 2 → 3 → 4. Everything else can run in parallel with it, but matching
quality and outreach volume are capped until portfolio, cheque and contact data exist.

---

## 5. Risks and owner decisions

1. **Data starvation is the top risk.** 0 portfolio rows, 14 cheque records, 0 verified emails.
   Matching cannot be validated and outreach cannot run until this changes.
2. **RLS is not protecting app traffic** (service role). Every new table inherits the same
   weakness until Phase 0 decides the strategy.
3. **Org/team model** is absent; it blocks collaboration, shared pipelines and company-level
   isolation. Retrofitting it later is expensive — decide in Phase 0.
4. **Target of 500k–1M records** needs licensed sources and a budget; SEC alone is US-only.
   Quality gates must precede volume.
5. **AI gateway split** (NIM + OpenRouter) doubles prompt/cost/observability work.
6. **Background jobs are in-process**; long research/ingestion will not survive serverless.
7. **Scope:** 22 modules is multi-quarter work. Sequenced above so each phase is shippable.
8. **Billing provider** decision (Stripe already coded vs Paddle/Dodo in the spec).
9. **Evaluation set** requires hand-labelling ~50 founder/investor pairs before MATCH-11 can
   be claimed.
10. **Landing copy** must keep matching measured corpus values (`AGENTS.md`); manager counts
    are not yet a public claim.

---

## 6. Definition of done (applies to every phase)

- Feature reads/writes real rows for the signed-in company; tenant isolation proven by a
  two-account probe.
- Migration committed and applied; `npm run db:status` green.
- Unit tests for new logic + one live HTTP/DB check for the changed path.
- `npx tsc --noEmit` and `npm run build` clean.
- Tracker row updated with the evidence command, not an assertion.
- No fabricated metric, contact, portfolio or relationship anywhere in UI or AI output.
