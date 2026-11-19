# 35 — Master blueprint: current state, gap matrix, execution plan

Status: proposed 2026-11-19. Supersedes the sequencing in `docs/15-development-roadmap.md`
and `docs/33-mvp-completion-plan-and-scale.md`; their content remains valid history.

**One-page summary:** the app already has 73 pages and 94 API routes; what it lacks is
evidence behind them (0 portfolio companies, 14 cheque-size records, no match
calibration, no cross-tenant test suite). Work is ordered so each phase ends with a
demoable slice and a verification gate, starting with the money path (Phase 0), then
isolation and schema (Phase 1), then the qualification engine (Phase 2).

This document answers one question: **given the full product blueprint, what already
exists, what does not, and in what order do we build the rest without faking it?**

---

## 0. Status legend

| Status | Meaning |
|---|---|
| **Verified** | Exercised in the running app by an agent in the last 7 days, with the result recorded. |
| **Built (unverified)** | Code, route, table or service exists; nobody has proven the user flow end to end. |
| **Partial** | Works for one path, breaks or lies on another (defect id given). |
| **Broken** | Reachable but returns wrong data or fails (defect id from `AGENT-COORDINATION.md` §4b). |
| **Missing** | No implementation. |

A module is only **Verified** if the founder-facing loop works *and* the data behind it
is real. A page that renders is not a feature.

---

## 1. What the blueprint actually asks for

Stripped of repetitions, it is six systems plus three cross-cutting obligations:

1. **Identity & fit input** — a structured, honest founder/company/fundraising profile
   (onboarding → normalisation → readiness).
2. **Investor intelligence foundation** — organisations, people, funds, portfolio,
   provenance, freshness, confidence (not a flat list).
3. **Explainable qualification engine** — hard eligibility → weighted dimensions →
   separate confidence → evidence → versioned configuration → feedback and calibration.
4. **Execution layer** — CRM, pipeline, relationships, outreach, meetings, tasks.
5. **Intelligence layer** — copilot with a permissioned tool registry, research,
   readiness, deck intelligence, data room.
6. **Commercial & admin layer** — plans, credits, usage, admin data management,
   ingestion, AI operations.

Cross-cutting: **truth** (verified vs inferred vs unknown), **isolation** (company-scoped
RLS), **measured quality** (calibration, completeness, freshness, latency).

---

## 2. Current state, measured

| Measure | Value | Source |
|---|---|---|
| App pages | 73 `page.tsx` | repo scan 2026-11-19 |
| API routes | 94 `route.ts` | repo scan 2026-11-19 |
| Migrations | 40 SQL files | `supabase/migrations` |
| Dashboard modules | 26 directories | `src/app/dashboard` |
| Admin modules | 10 directories | `src/app/admin` |
| Service domains | 12 | `src/lib/services` |
| Investor corpus | 24,379 active records (18,995 firms + 5,461 Form D funds) | `docs/23`, `docs/30` |
| Records with email | 4,933, **none verified** | `docs/23` |
| Named people | 12,102 rows / 4,205 distinct | `docs/23` |
| Cheque-size data | 14 records | `docs/23` |
| Thesis text | 26 records | `docs/23` |
| Portfolio companies | 0 | `docs/23` |
| Matching engine | `src/lib/services/investor/fit-scoring.ts` — 6 weighted factors + confidence | code read 2026-11-19 |
| Semantic search | NVIDIA `nemotron-3-embed-1b`, 2048-dim vectors | `investor/embeddings.ts` |
| AI gateway | NVIDIA direct (`integrate.api.nvidia.com`) | `src/lib/ai/keys.ts` |
| Payments | Stripe SDK present, keys absent → checkout 503 | B-10 |
| Background jobs | Vercel cron + `/api/jobs` (no Trigger.dev) | `package.json`, `src/app/api` |
| Observability | Sentry + PostHog wired; no Langfuse | `package.json` |

**Conclusion:** the product *surface* is 80% present; the *evidence* behind it is the
gap. That is why the plan is depth-first per module, not breadth-first.

### 2.1 What "surface ≠ substance" looks like in practice

Two observations from 2026-11-19, both from a single session:

- **The good path works.** A founder completed all 7 onboarding steps, launched the
  workspace, and the profile persisted correctly (72% readiness, MRR, customers,
  round size). The dashboard then rendered real data derived from that profile.
- **The dangerous path also works.** The outreach generator returned a polished,
  send-ready email containing *"10 bootstrapped founders onboarded in 90 days."*
  Nothing in the system had ever recorded 10 founders or 90 days. The prompt only
  received company name, one-liner and round type, so the model filled the gap with
  a plausible number — the exact failure mode blueprint §12 and §31 forbid.

Nothing on screen distinguished the second output from the first. Every number here
is either measured or unknown; the plan exists to make that boundary structural
rather than a matter of care.

---

## 3. Decisions the blueprint forces (need sign-off)

The blueprint says "OpenRouter", "Trigger.dev", "Paddle or Dodo", "pgvector HNSW",
"500k–1M records". The repo says otherwise in each case. Each is a real fork:

| # | Decision | Options | Recommendation | Why |
|---|---|---|---|---|
| D1 | AI gateway | Keep NVIDIA direct · migrate to OpenRouter | **Keep NVIDIA, add provider fallback inside `src/lib/ai/client.ts`** | The gateway abstraction already exists; migrating adds cost and risk with no user-visible gain. Fallback solves the real problem (single-provider outage). |
| D2 | Background jobs | Trigger.dev · Vercel cron + `/api/jobs` | **Stay on cron/jobs until a job exceeds the platform limit** | No measured job currently exceeds it. Revisit when ingestion or match recalculation proves otherwise. |
| D3 | Payments | Stripe (integrated) · Paddle/Dodo (merchant of record) | **Stripe now; revisit only if MoR/tax handling becomes a requirement** | Stripe code exists; Paddle is a tax/ops decision, not an engineering one. |
| D4 | Vector index | 2048-dim exact/IVFFlat · halfvec + HNSW | **halfvec(2048) + HNSW** | pgvector cannot HNSW-index `vector(2048)` (>2000 dims). Half-vector keeps recall, restores index. |
| D5 | Corpus target | 500k–1M records · quality-first subset | **Quality-first; publish measured coverage per segment, not a count target** | `AGENTS.md` forbids claims unsupported by measurement, and 500k cannot be reached by scraping. |
| D6 | Investor-facing product | Founder-first · marketplace | **Founder-first only** | Blueprint §31 says the same. |
| D7 | Warm-intro graph | Build · park | **Parked** (already agreed) | No relationship data source; building it would be fabricated. |
| D8 | Demo vs production | Demo first · hardening first | **Demo path stays green every day; hardening runs in parallel lanes** | The money path is the only thing that proves the product. |

---

## 4. Gap matrix

Ordered by dependency, not by page order.

### 4.1 Identity & fit input

| Capability | Status | Evidence / gap |
|---|---|---|
| Signup / login / reset | Verified | Signed-in loop proven; login ~5s latency |
| Google OAuth | Built (unverified) | Provider configured; not exercised |
| 7-step onboarding | Verified | Completed 2026-11-19; profile persisted at 72% readiness |
| Onboarding launch | Partial | Stalls when the cockpit prefetch hangs; navigation worked on retry |
| Company profile edit | Verified | Values round-trip |
| Fundraising configuration (cheque range, instrument, runway, use of funds) | Partial | Round type/amount/geography captured; cheque range + instrument + runway absent from onboarding |
| Progressive verification states (verified / founder-submitted / unavailable / confidential) | Missing | No per-field provenance on founder data |
| Readiness module | Built (unverified) | `services/readiness` + page exist; scoring formula not validated against outcomes |

### 4.2 Investor intelligence foundation

| Capability | Status | Evidence / gap |
|---|---|---|
| Organisation records | Verified | 18,995 firms; searchable |
| Person records | Verified | 12,102 rows / 4,205 people from Form D |
| Funds | Partial | 5,461 Form D venture funds; no organisation→fund relationship |
| Portfolio companies | Missing | 0 records — profile "portfolio" section is empty by construction |
| Investment events | Partial | SEC 13F/Form D filings, not normalised to investment events |
| Contact provenance | Partial | `contact_source` exists; verification status is "unverified" for all 4,933 emails |
| Freshness / last-verified | Built (unverified) | Columns exist; no scheduled re-verification |
| Confidence scoring per record | Partial | `confidence` on fit results, not per data point |
| Deduplication | Built (unverified) | `scheduled-dedup.ts`; no measured duplicate rate |
| Admin investor CRUD + merge | Partial | Admin screens exist; merge/verify workflow unproven |

### 4.3 Qualification engine

| Capability | Status | Gap vs blueprint |
|---|---|---|
| Weighted scoring | Verified (code) | 6 factors: sector .30, stage .25, geography .15, activity .15, cheque .15, completeness .10 (normalised). Blueprint wants 7: industry .20, stage .15, geo .15, cheque .15, **business model .10**, **portfolio/thesis .15**, activity .10 |
| Hard eligibility filters | Partial | Stage/geo checks exist inside scoring; no explicit disqualifier pipeline distinct from missing data |
| Separate confidence score | Partial | `confidence` + `dataQuality` exist; not surfaced as a distinct badge everywhere |
| Evidence references | Missing | Factors explain in prose; no source/row references stored |
| Versioned configuration | Missing | Weights hard-coded |
| Match persistence | Partial | Matches computed and returned; no `match_runs` / dimension-score history |
| Feedback loop | Missing | No relevant/irrelevant/dismiss feedback captured |
| Calibration | Missing | No labelled evaluation set, no precision@10, no score-vs-outcome data |

### 4.4 Execution layer

| Capability | Status | Evidence / gap |
|---|---|---|
| Saved investors | Verified | Save → list round-trip |
| Pipeline (Kanban + table) | Verified (rendering) | Real rows; automation/reminders unproven |
| Pipeline customisation | Partial | Stages defined in code; founder-editable stages unproven |
| CRM custom fields / tags / notes | Partial | UI exists; persistence unverified |
| Outreach drafting | Partial | Works, but invented metrics (fixed in flight) and only founder identity was grounded |
| Approve → queue | Verified | `queued_dev`, nothing sent — correct while no mailbox |
| Provider send + reply sync | Built (unverified) | Gmail/Outlook routes exist; no connected mailbox in test |
| Sequences / campaigns | Partial | Editor + API exist; no proven execution path |
| Meetings | Built (unverified) | Page + API being actively edited by backend agent |
| Introductions | Missing | Parked (D7) |
| Tasks / notifications | Missing | No notification service; reminders unimplemented |

### 4.5 Intelligence layer

| Capability | Status | Gap |
|---|---|---|
| Copilot UI | Built (unverified) | Chat surface exists |
| Tool registry + permissions | Partial | `api/copilot/tools/[id]` exists; propose→confirm→execute and server-side permission checks unproven |
| Investor research reports | Built (unverified) | No citation requirement enforced |
| Natural-language discovery | Missing | Filters are structured; no NL→filter translation grounded in records |
| Deck generation | Built (unverified) | `pptxgenjs` + `pdf-lib`; layout validation not enforced |
| Deck analysis | Missing | No upload→feedback pipeline verified |
| Data room | Partial | Upload/list exists; sharing, expiry, access logs unproven |
| AI observability / cost | Partial | Usage tables + `keys.ts`; no per-feature cost dashboard |

### 4.6 Commercial & admin

| Capability | Status | Gap |
|---|---|---|
| Plans / subscriptions | Broken | B-1 PostgREST alias syntax → subscription never resolves |
| Checkout | Broken (config) | B-10 Stripe keys absent |
| Credits | Broken | B-9 402 before queueing; ledger exists |
| Signup → paid | Not demoable | Blocked by the three above |
| Admin dashboard | Built (unverified) | 10 sections; authorization checks need a test suite |
| Ingestion pipeline | Partial | EDGAR/Form D scrapers; cadence and error handling unproven |
| Feature flags | Missing | Needed for staged rollout |

---

## 5. Execution plan

Rules for every phase:

- Each phase ends with a **demoable slice**, not a status report.
- No module is marked done until its flow is exercised in the browser **and** covered by a test.
- Every number shown to a user is either measured or labelled unknown.
- `tsc`, `next build`, `eslint src/components/ui` stay green; add `vitest` + Playwright gates in P0.
- Landing claims move in the same commit as the data they describe (`AGENTS.md`).

### Phase 0 — Make the money path real (2–3 working days)

Why first: "founders sign up and pay" is the only claim the demo must survive.

1. Fix B-1 subscription select (backend).
2. Fix B-9 credit gate: exempt `queued_dev` (nothing leaves the app) or grant signup credits (backend).
3. Load Stripe test keys + seed `billing_plans` + `NEXT_PUBLIC_APP_URL` (ops/backend).
4. Fix B-11 facet rollup `DELETE` without `WHERE` (backend).
5. Reconcile corpus counts B-6 across discover/landing/dashboard (frontend + one source of truth endpoint).
6. Finish outreach grounding: real traction in the prompt context + numeric validation + retry, then verify a draft contains no invented figures.
7. Onboarding launch: timeout the cockpit prefetch; never block navigation on it.
8. Write `docs/36-demo-script.md`: signup → onboarding → discover → save → draft → approve → queue → upgrade → receipt, with the exact clicks.

**Exit criteria:** a fresh account completes the script in one pass; billing shows an active plan; the subscription badge resolves; no 402 on queueing; zero invented figures in the draft; `tsc`/`build` green.

### Phase 1 — Evidence and isolation (week 1–2)

1. Consolidate the four audits into the 17 deliverables the blueprint §32 asks for (`docs/37-current-state-report.md`), one row per page: status, backend, DB, API, AI, UX, test, completion criteria.
2. Cross-tenant RLS test suite: two users, two companies; assert every dashboard/API route returns 404/empty, never another tenant's rows.
3. `supabase/migrations` reproducibility: fresh DB from zero; PII audit on seeded/e2e data.
4. Schema review against blueprint §22: organisation → fund → person → portfolio → investment; match tables; audit logs. Produce the target schema diff.
5. Observability baseline: error rate, p95 latency per route, AI cost per feature.

**Exit criteria:** RLS suite green in CI; fresh migration run produces the app; target schema signed off; latency table published.

### Phase 2 — Qualification engine v2 (weeks 2–4)

The heart of the product; do it before adding more pages.

1. Split **eligibility** (hard filters with verified-exclusion vs missing-data semantics) from **scoring**.
2. Implement the 7 blueprint dimensions + normalisation; persist `match_runs`, dimension scores, evidence refs, algorithm version.
3. Separate confidence (completeness × source quality × freshness × consistency) from fit; show both in UI.
4. Build the calibration set: ≥30 founder profiles × ≥300 investors, human-labelled relevance; measure precision@10/@20, rank correlation, score distribution.
5. Feedback capture (relevant / irrelevant / dismiss / wrong data) stored, not auto-learning.
6. Recalculation job when profile or investor data changes.

**Exit criteria:** published calibration report; "90+" is defined by measured precision; every match card expands to evidence; weights changeable only by versioned config.

### Phase 3 — Discovery at depth (weeks 4–5)

1. Facets from a correct rollup (B-11) + server-side pagination at 24k+ rows.
2. Hybrid retrieval: structured filter → FTS → vector (halfvec + HNSW, D4) → eligibility → rank.
3. Natural-language search: LLM emits **filters only**, never records; show the interpreted filters for correction.
4. Saved searches, search history, comparison view.
5. Latency budget: p95 < 800 ms for filtered page 1.

**Exit criteria:** NL query round-trips to the same result set as the equivalent filters; p95 within budget; empty/error states authored.

### Phase 4 — Execution loop (weeks 5–8)

1. Pipeline stages per blueprint, founder-editable, with stage history.
2. Follow-up automation (overdue, no-response, meeting upcoming) + tasks + notifications.
3. Outreach: provider connect → send → reply sync → thread association; sequences.
4. Meetings: notes → structured CRM update with confirmation.
5. Deliverability guardrails (limits, opt-out, suppression).

**Exit criteria:** one real investor email sent and its reply threaded back; a follow-up fires on schedule; a meeting note updates the pipeline.

### Phase 5 — Copilot as an execution surface (weeks 8–10)

1. Tool registry with server-side authorization per tool, per user, per company.
2. Propose → confirm → execute for every write/outward action; execution log.
3. Streaming, cancellation, retry, cost accounting.
4. Workflow: "find 50, qualify, research 15, draft outreach" with progress and approval.

**Exit criteria:** an unapproved tool call is impossible from the client; a multi-step job completes and logs every step.

### Phase 6 — Readiness, deck, data room (weeks 10–13)

1. Readiness rubric with per-category evidence and improvement tasks.
2. Deck upload → analysis with citation; generation with layout validation before export.
3. Data room: permissions, expiry, access logs, revocation.

**Exit criteria:** readiness score explains every point; deck export never overflows; a revoked link fails.

### Phase 7 — Admin, ingestion, data quality (weeks 13–16)

1. Investor admin: create/edit/merge/verify, provenance review, bulk import with validation.
2. Ingestion orchestration: source → extract → normalise → validate → dedup → enrich → verify → publish, with human review.
3. Freshness scheduler + completeness dashboards.
4. Feature flags.

**Exit criteria:** a new source can be ingested and published without touching code paths; duplicate rate measured and falling; every published field traceable to a source.

### Phase 8 — Commercial completion (weeks 16–17)

Plans, credits, usage limits, invoices, failed-payment handling; billing admin; pricing page parity with enforced limits.

### Phase 9 — Scale & hardening (continuous, gate at 17+)

Load tests at 10× corpus; query plans for every list endpoint; security audit (files, links, prompts, webhooks); Sentry/PostHog dashboards; DR runbook.

---

## 6. Reality corrections (do not negotiate these)

1. **Corpus size is not a roadmap.** 500k–1M is a multi-year acquisition programme (licensing, partnerships, regulatory feeds). Until then, every surface states the measured count.
2. **No fabricated investor facts.** Missing cheque size, portfolio, thesis, or contact shows as unknown, never as a plausible value. Portfolio is currently *absent*, so profile sections must say so.
3. **No "verified" language for unverified emails.** 4,933 emails exist; zero verified.
4. **No investor marketplace** in this plan (D6).
5. **No warm-intro graph** until a lawful relationship source exists (D7).
6. **Demo data lives only in a labelled demo environment**, never in a founder's workspace.

---

## 7. Effort shape

With one frontend/UX agent and one backend agent working in parallel, and counting
verification (not just authoring):

| Scope | Calendar |
|---|---|
| Phase 0 (money path) | 2–3 days |
| Core product loop (Phases 1–4) | 8 weeks |
| Credible beta (Phases 1–6) | 13 weeks |
| Full blueprint (Phases 0–9) | 17–20 weeks, data acquisition excluded |
| Corpus to 100k quality records | separate programme, 6+ months |

These are engineering estimates, not commitments; each phase re-estimates after its
first slice because unknowns live in data quality, not in UI.

---

## 8. Verification gates (apply to every phase)

| Gate | Definition |
|---|---|
| G1 Build | `tsc --noEmit`, `next build`, eslint clean |
| G2 Loop | Playwright signed-in loop passes against a seeded account |
| G3 Isolation | Cross-tenant suite green; no route leaks rows |
| G4 Truth | No invented figures in generated content; claims parity between landing and measured data |
| G5 Quality | Module-specific: calibration report, latency budget, or data-quality report |
| G6 Ops | Error rate and p95 latency recorded before/after |

---

## 9. Next five working days

1. Finish Phase 0 items 6–7 (outreach grounding, onboarding launch) — in progress now.
2. Hand B-1/B-9/B-10/B-11 to the backend agent with exact repro; verify each fix in the browser.
3. Run the demo script twice; fix everything that fails the second time.
4. Start Phase 1.2 (RLS cross-tenant suite) because it is the highest-risk unknown.
5. Draft the target schema diff (Phase 1.4) for review before any migration is written.

---

## 10. Open questions for the owner

1. **Demo date** — is there a fixed date? It decides whether Phase 0 gets 3 days or 3 weeks.
2. **D1–D5** — confirm the recommendations in §3.
3. **Pricing model** — is Capital Credits part of the offer or is it plan + seats? Phase 8 depends on it.
4. **Data budget** — is there budget for a licensed investor-data provider? It changes the corpus plan more than any engineering decision.
