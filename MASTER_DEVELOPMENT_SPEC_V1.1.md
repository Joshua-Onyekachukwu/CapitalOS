# CAPITAL OS — Master Product & Engineering Specification

**Version:** 2.0 (replaces the v1.1 stub)
**Date:** September 26, 2026
**Status:** Authoritative. Where older documents disagree with this one or with
the code, this document wins. Where this document disagrees with reality, fix
the code or fix this document — never ship the discrepancy.

**Product:** AI-powered fundraising operating system for startup founders.
**Primary user:** a founder raising a pre-seed → Series A round.
**Core principle:** AI researches, qualifies, prepares, and tracks; the founder
approves every consequential external action and stays in control of the raise.

---

## 1. Product definition

### 1.1 The founder's job-to-be-done

Raise a round without spreadsheets: find investors who actually fit, understand
*why* they fit, contact them with credible personalization, track every
conversation, and always know what to do next.

### 1.2 Product pillars

| Pillar | Commitment | Where it lives |
|---|---|---|
| Investor discovery | Filterable search over an EDGAR/Apollo-sourced investor database | `/api/investors`, `/dashboard/investors` |
| Investor intelligence | Per-investor thesis, stages, sectors, checks, activity, AI research | investor detail page, `investor-research` actions |
| Matching | Deterministic 7-factor fit score **with per-factor written explanations** | `src/lib/services/investor/qualification.ts` |
| Pipeline | 11 stages, Discovery → Passed, per founder | `src/lib/services/pipeline/stages.ts`, `/dashboard/pipeline` |
| Outreach | AI drafts from real investor + company context; founder reviews/edits/approves | `/api/outreach/*`, `email/` services |
| Analytics | Fundraise state: readiness, activity, funnel | `/dashboard/analytics`, outreach metrics |
| Control | Founder approval gates on every send; clear status labels; no fake UI | product-wide rule (see §6) |

### 1.3 Explicit non-goals

- Not a generic CRM; every object exists to serve a fundraising process step.
- No autonomous external sends without explicit founder authorization.
- No scraping that violates platform terms; EDGAR/Apollo/user CSVs only.

---

## 2. System architecture (verified current state)

```
Founder → Next.js 16 (Vercel) → server actions / API routes
       → Supabase (auth, PostgreSQL + RLS, storage)   [permanent data]
       → Convex (jobs, metrics, notifications)        [real-time state]
       → NVIDIA NIM (LLM) via src/lib/ai              [completions]
       → Gmail / Graph / SMTP senders                 [external effects]
       → EDGAR / Apollo / CSV pipelines               [data acquisition]
```

Authoritative details: `ARCHITECTURE.md` (design), `SYSTEM.md` (operations).
The legacy SQL→Postgrest shim (`src/lib/db.ts`) preserves the historical
`query()/queryAs()` API; its documented failure modes are pinned by tests and
scheduled for replacement (§5, Phase 2).

---

## 3. Data model summary

Permanent data in Supabase `public` (RLS where tenant-scoped):

- **Shared:** `investors` (canonical 83K+), `investor_firms`,
  `investor_sectors`, `investor_employment_history`, `raw_records`,
  `duplicate_candidates`, `data_change_log`, `firm_aliases`,
  `billing_plans`, `credit_costs`.
- **Tenant (RLS via `auth.uid()`):** `profiles`, `company_profiles`,
  `company_documents`, `company_team_members`, `saved_investors`,
  `email_accounts`, `email_messages`, `email_threads`,
  `email_tracking_events`, `campaign_sequences` (+ steps, enrollments, emails),
  `user_subscriptions`, `credit_ledger`, `billing_events`, `admin_audit_log`,
  `investor_search_history`, `background_jobs`, `pipeline_events`.
- **Planned (Phase 2):** `user_pipeline_entries` (per-user investor stage,
  notes) replacing shared-table pipeline state.

Migrations: `supabase/migrations/001–008` + root-level SQL. Apply order,
verification queries, and destructive-file warnings:
`docs/DATABASE-SETUP-RUNBOOK.md` (authoritative).

---

## 4. AI architecture (current → target)

### 4.1 Current

Single provider (NVIDIA NIM) behind `src/lib/ai/`: task→model mapping, key
rotation, retries, `AI_MOCK_MODE`. Feature call sites: copilot, investor
research, email drafting, fit analysis, deck generation, sequence copy,
document/website intelligence.

### 4.2 Target (Phases 3–5 of the roadmap)

```
Capital OS feature → AI gateway (src/lib/ai) → provider/model → tools → result
```

Requirements:

1. **Provider abstraction** — OpenRouter, Google Gemini, NVIDIA, OpenAI-compatible
   endpoints behind one interface; per-task model routing (cheap/fast vs
   long-context); config-driven, no per-feature vendor code.
2. **Structured outputs** — JSON-schema-constrained generation with validation
   and repair loops for all downstream machine-readable results.
3. **Tool calling** — the gateway exposes audited tools (§7); the model never
   touches the database or network directly.
4. **Ops** — timeouts, retries with backoff, fallback chains, usage/cost
   accounting per request (model, tokens, task, user), streaming where the UI
   benefits.
5. **Separation of concerns** — founder-facing product AI and internal dev AI
   share the gateway but never identities, credentials, or tool permissions (§8).

---

## 5. Engineering roadmap (ownership plan)

Status legend: ✅ done · 🔨 in progress · 📋 planned

### Phase 1 — Audit & stabilize ✅ (Sept 26, 2026)
Git initialized + pushed; secrets redacted; 45 type errors → 0; build green;
hanging test suite fixed; 17→44 offline unit tests; attachments silently
dropped → actually sent; Convex schema/code mismatches fixed; dead `.catch()`
fallbacks fixed; production incident diagnosed (deleted/paused Supabase); docs
rewritten to match reality.

### Phase 2 — Core founder workflows 🔨
1. Backend re-provisioning per runbook (RLS fix applied; onboarding persists —
   verify E2E on the redeployed app).
2. **Pipeline multi-tenancy:** `user_pipeline_entries` + events; migrate API;
   backfill from `outreach_readiness`/`pipeline_stage`; drop shared-table writes.
3. Golden-path E2E: signup → onboarding → discover → save → pipeline → draft →
   approved sandbox send → tracking.
4. Kill the shim's silent-failure mode; migrate hot paths to the typed client.
5. Shell pages (meetings, ai-activity): make real or remove — no fake UI.

### Phase 3 — Centralized AI/model layer 📋
Gateway interface, structured outputs, usage/cost ledger, timeouts/retries/
fallbacks; migrate all feature call sites off direct NIM usage.

### Phase 4 — Multi-provider models 📋
OpenRouter + Google Gemini adapters; per-task routing config; cost-aware model
selection; offline eval harness with `AI_MOCK_MODE`.

### Phase 5 — Tool/agent framework 📋
Typed, permissioned tools (investor search/lookup/research, portfolio analysis,
company context, matching, pipeline ops, email draft/send-gated, analytics,
web research); agent loop with budgets and audit trail; founder-facing agent
UI (executes work, returns artifacts, requests approval where required).

### Phase 6 — Connected dev infrastructure 📋
Supabase MCP with dev/production separation; GitHub integration (branches,
PRs, CI-aware fixes); migrations as versioned, reviewable artifacts.

### Phase 7 — Development agent + persistent jobs 📋
Internal agent (different identity/permissions from product AI) executing
scoped engineering tasks: inspect → branch → implement → test → build → PR;
long-running work as persistent jobs with objective/status/plan/artifacts.

### Phase 8 — Permissions & approvals 📋
Configurable permission matrix (auto vs approval-required); approvals for
production data writes, destructive ops, sends, deploys, spend.

### Phase 9 — Browser E2E & self-correction 📋
Browser-driven verification of real user flows (login→onboarding→search→
pipeline→outreach), CI gates, failure reproduction loop before escalation.

### Phase 10 — Production readiness 📋
Load/limits review, monitoring/observability (AI usage, DB, email health),
incident runbooks, security review, docs regenerated from code.

At every phase: keep the existing app working; no rewrites without cause.

---

## 6. Engineering rules (binding)

1. **No fake functionality.** Any UI claim must map to a real operation. Status
   vocabulary: Planned / In progress / Awaiting approval / Executed / Verified /
   Failed / Blocked.
2. **Founder control.** External sends require explicit approval. Automation
   only where the founder opted in, and auditable.
3. **Explainability.** Fit scores carry per-factor explanations; AI drafts
   carry their personalization rationale.
4. **Honest states.** Distinguish working / partial / mocked / broken. Docs
   match code; both are updated in the same change.
5. **Route-file purity.** Next.js route modules export handlers only; shared
   definitions live in `src/lib/`.
6. **Tests pin contracts.** Behavior fixes come with regression tests; the db
   shim's failure modes are pinned until it is retired.
7. **Secrets.** Never in the repo, never in chat. `.env.local` + Vercel only;
   historical leaks are redacted and noted in the audit.
8. **Data safety.** Destructive SQL requires explicit approval and never runs
   against restored data (`supabase-production-fixes.sql`).

---

## 7. Tool inventory (agent framework, Phase 5 target)

| Tool | Scope | Permission |
|---|---|---|
| investor.search / .lookup / .research | read investor DB | auto (product AI) |
| company.getContext | founder's own profile | auto |
| pipeline.move / .note | own pipeline rows | auto + audit |
| email.draft | drafts only | auto |
| email.send | external effect | **approval required** |
| analytics.query | own aggregates | auto |
| web.research | public pages | auto, rate-limited |
| db.* (dev AI) | schema-aware queries | dev env auto; prod read auto; **prod write approval** |
| repo.* (dev AI) | branch/commit/PR/CI | branch+PR auto; **merge approval** |
| deploy.* (dev AI) | Vercel | **approval required** |

---

## 8. Identity separation (hard rule)

Product AI (founder-facing) and development AI are separate principals with
separate credentials, contexts, and tool allowlists. Product AI never receives
dev credentials (repo push, prod DB writes, deploys). Dev AI never touches
founder data beyond aggregate/schema inspection. Shared: gateway, tool
framework, usage accounting.

---

## 9. Acceptance criteria for "ready for founders"

1. Golden path E2E green on production (signup → onboarding → discover →
   pipeline → drafted outreach → approved send → tracking visible).
2. Zero silent failures: unparseable SQL, dropped attachments, dead fallback
   classes of bug covered by tests.
3. RLS verified on every tenant table (runbook Phase C query).
4. Typecheck 0 errors; build green; offline test suite green in CI.
5. No shell pages presenting fake data.
6. Docs authoritative: README/ARCHITECTURE/SYSTEM/runbook/spec match code.
