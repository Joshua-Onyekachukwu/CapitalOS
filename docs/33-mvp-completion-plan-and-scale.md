# Capital OS — MVP completion plan, integrations and scale

**Date:** 6 November 2026
**Status:** plan. Every row is labelled with what exists today, so this document
cannot be mistaken for a claim that the work is done.
**Related:** `docs/20` (audit), `docs/21` (architecture), `docs/30` (completion
tracker), `docs/31`–`32` (Vercel migration).

Status labels used here, same as `docs/20`: **DONE** · **PARTIAL** · **BLOCKED**
(external input required) · **NOT STARTED**.

---

## 0. The two facts that order everything

1. **The corpus is being replaced with 500,000+ investor records.** Every
   "the data is too thin" verdict in `docs/20` is superseded rather than fixed.
   Re-measure before quoting any number, and update `AGENTS.md` and the landing
   page in the same commit as the new counts.
2. **The demo is the deadline.** Work is ordered by what a founder can see
   working end to end, not by module completeness. A page that renders a real
   number beats a module that renders three empty tabs.

---

## 1. Track A — the MVP loop (in progress)

The loop: profile → readiness → find → understand why → shortlist → draft →
send → reply → pipeline.

| Page | Status | Remaining work | Acceptance |
|---|---|---|---|
| `/dashboard` Overview | **PARTIAL** | Round money tiles and a deterministic next-action engine shipped. Still to do: fold pipeline-only investors into the investor stats (currently saved-investor based), and per-card error boundaries. | Every number traces to a query; a card with no data says why; actions name their trigger. |
| `/dashboard/readiness` | **DONE** | — | Score withholds a total below the evidence floor; gaps list the missing field. |
| `/dashboard/pipeline` | **PARTIAL** | Targets, expected cheque, probability, committed/weighted/projected and stage conversion shipped. Still: drag-and-drop, bulk move, lost-reason capture, stage history view. | Money never appears without its basis; a lost deal requires a reason. |
| `/dashboard/startup` | **DONE** | Round parameters now editable from the pipeline and stored on the profile. | One source of truth for raise, valuation, instrument, cheque range. |
| `/dashboard/investors/matches` | **DONE (v1)** | Ranked list, factor breakdown, evidence-based confidence, accept/reject feedback stored in `fit_feedback`. Still: reranking from feedback and pgvector semantic search in the match path. | No score without a breakdown; missing evidence is named. `/fit` redirects here. |
| `/dashboard/investors/discover` | **PARTIAL** | Cheque-size, thesis, firm and lead/follow filters; saved-search alerts; compare ≤4; bulk shortlist. | A filter with no backing data is visibly "limited data", not silently empty. |
| `/dashboard/investors` + `[id]` | **PARTIAL** | Firm column stays empty until `investor_firms` is populated by the import; profile fields (thesis, cheque, portfolio) fill from the new corpus. | No rendered field without a value or an explicit "not recorded". |
| `/dashboard/documents` | **PARTIAL** | Storage RLS policies, signed URLs, Data Room tab, share links with expiry, access log, deck analysis. | No public URL for a confidential document; every share is revocable and logged. |
| `/dashboard/outreach` | **PARTIAL** | Setup gate instead of a disabled send button; provider-agnostic sender (see §3); prove one real send. | A failed send shows the provider error verbatim. |
| `/dashboard/copilot` | **PARTIAL** | Tool layer and persisted conversations (see §6). | No "done" claim without a read-back that proves it. |

**Push gate:** `tsc --noEmit` 0 · tests green · deploy READY · the changed
route answers 200 for a signed-in user.

---

## 2. Track B — workflow breadth

| Page | Status | Work | Depends on |
|---|---|---|---|
| `/dashboard/crm` | **NOT STARTED** | Relationship record: owner, tags, tasks/reminders, merged timeline (email + meeting + note), bulk update, CSV in/out. | Nothing external |
| `/dashboard/lists` | **NOT STARTED** | Named collections, sharing, absorb `/investors/saved`. | Discover |
| `/dashboard/deliverability` | **NOT STARTED** | Merge four `email-health` pages into tabs: domain, warmup, bounces, suppression. | A sending account (deferred) |
| `/dashboard/reports` | **NOT STARTED** | Funnel read-model over pipeline + outreach; CSV and PDF export. | Pipeline + outreach |
| `/dashboard/meetings` | **PARTIAL** | Briefs, notes, outcome capture; calendar link. | CRM |
| `/dashboard/intelligence` | **NOT STARTED / BLOCKED** | See §5. | A named source per tab |
| `/dashboard/opportunities` | **NOT STARTED / BLOCKED** | Grants, accelerators, fellowships. | A curation source |
| `/dashboard/introductions` | **NOT STARTED / BLOCKED** | Warm-intro graph. | Contact/relationship data |
| `/dashboard/sequences` | **PARTIAL** | Rename from `/campaigns`, add redirects; requires proven sending. | Outreach |
| `/admin/*` | **PARTIAL** | Move Data Health / Email Monitor / Waitlist under `/admin`; AI model config; feature flags. | — |

**Redirects required with every rename:** `/investors/fit`→`/investors/matches`
(done), `/campaigns`→`/sequences`, `/analytics`→`/reports`, `/saved`→`/lists`.

---

## 3. Integrations — build now, plug credentials later

The rule for all three: the product must be fully usable with **no** key, and
must switch to live behaviour by setting an environment variable, with no code
change and no schema change.

### 3.1 Email / outreach — bypass mailbox and warmup

**Current:** transport, templates, sequences and suppression exist; nothing has
ever been sent (`email_messages` = 0).

**Build without a mailbox:**
- `email_accounts` is the single source of sending identity. Zero verified
  accounts → the Outreach page renders a **setup gate** (what is needed, why,
  and a connect button), not a disabled send button.
- Sending goes through one interface — `sendMessage(message)` — with two
  implementations: `smtp` (existing) and `outbox` (dev/demo). `outbox` records
  the message in `email_messages` with `status = 'queued_dev'` and a banner
  "not delivered — dev outbox" everywhere it appears. It must never be labelled
  sent.
- Warmup remains a scheduled job that starts only once a real mailbox exists; it
  is not simulated.
- Everything downstream — reply ingestion, thread assembly, pipeline moves,
  reply insights — is built and unit-tested against the outbox, so when details
  arrive the only change is the account row.

**Plug-and-play:** `EMAIL_PROVIDER=smtp|outbox`, plus `SMTP_*` or OAuth
credentials. No code path changes.

### 3.2 Stripe — test mode now

- Billing reads plans from `src/lib/billing/plans.ts` and events from
  `billing_events`; no key means the page states billing is not configured.
- Build against **test mode keys** (`STRIPE_SECRET_KEY=sk_test_…`,
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`) and a fixed test price table:
  checkout session, customer portal, webhook handler with signature
  verification, and idempotent event storage.
- Webhook must be the only writer of subscription state; the UI never trusts a
  redirect back from Stripe.
- Test-mode checkout is labelled `TEST` in the UI so a demo cannot be mistaken
  for a live charge.

**Plug-and-play:** replace with `sk_live_…` and the live price IDs; the webhook
endpoint secret changes too. Nothing else.

### 3.3 PostHog — build now, key later

- Client initialises only when `NEXT_PUBLIC_POSTHOG_KEY` is present; without it
  every call is a typed no-op (already true).
- Build the event contract now: `signup_completed`, `profile_completed`,
  `readiness_run`, `match_viewed`, `match_rated`, `investor_shortlisted`,
  `pipeline_stage_changed`, `outreach_drafted`, `outreach_sent`,
  `reply_received`, `meeting_booked`.
- Server-side events fire from the API route that performs the change, not from
  the component that displays it.

**Plug-and-play:** set `NEXT_PUBLIC_POSTHOG_KEY` and `POSTHOG_HOST`.

---

## 4. Provider contract (all three)

| Concern | Rule |
|---|---|
| Missing credential | Feature shows a setup state naming what is missing; it never throws and never fakes success. |
| Health check | Each integration exposes `/api/integrations/status` returning `{configured, reachable, checkedAt}` so the demo has one honest answer. |
| Secrets | Server-only env vars; nothing in `NEXT_PUBLIC_*` except the PostHog key and Stripe publishable key. |
| Failure | The provider's error is surfaced verbatim; no retry loop that hides it. |
| Test vs live | Environment is shown in the UI wherever money or messages are involved. |

---

## 5. Intelligence modules ×5 — decision required

These cannot be "completed" with code alone. Building a surface before its
source exists is exactly the failure `docs/20` identified.

| Module | Proposed source | Status |
|---|---|---|
| Investor news | SEC 13F/Form D delta feed + firm press pages (RSS where present) | **BLOCKED** — confirm the source |
| Portfolio intelligence | Form D + 13F holdings → portfolio companies per firm | **BLOCKED** — depends on the 500k import's firm linkage |
| Competitor intelligence | Crunchbase is licence-gated; alternative is manual tracking + founder-curated list | **BLOCKED** — needs a decision |
| Market intelligence | Sector aggregate computed from the corpus itself (no external feed) | **BUILDABLE NOW** — derived, not scraped |
| Grants & accelerators | Curated static dataset, versioned in the repo with a source URL per record | **BUILDABLE NOW** if a curation list is supplied |

**Rule:** a module ships only when each rendered claim carries `source` and
`basis`. Where no source exists, the page states that instead of showing a
placeholder chart.

---

## 6. Copilot — state loading and tools

**Current:** chat works; conversations are not persisted; there is no tool
layer, so it cannot act.

1. **State loading (first):** build one `CompanyContext` assembled server-side
   in a single pass — profile, round targets, pipeline summary, top matches,
   readiness gaps, last 10 messages. Cache per user for 60s. The model receives
   a compact snapshot plus record IDs, not a dump.
2. **Persistence:** `copilot_conversations` + `copilot_messages`, written on
   every turn, so a reload restores the thread.
3. **Tool layer:** a registry where each tool declares name, argument schema,
   required scope, and whether it needs approval. First five:
   `search_investors`, `add_to_pipeline`, `set_expected_cheque`,
   `draft_outreach`, `run_readiness`.
4. **Approval:** external or destructive tools require an explicit approve step
   (`copilot_approvals`); nothing sends email or changes money without it.
5. **Truthfulness:** a tool result is only reported as done after a read-back
   confirms the row changed. Failures are shown as failures.
6. **Streaming:** token streaming plus per-tool progress states (pending,
   running, succeeded, failed) so the UI never appears frozen.

---

## 7. Scale: 500k investors, 50k users

Measurement targets, not current measurements. Each is asserted by a load test
before the import lands, and re-run after.

| Surface | Target | How |
|---|---|---|
| Investor list first page | p95 < 400 ms | Keyset pagination on `(fit_score desc, id)`, covering index, projection limited to rendered columns |
| Facet counts | p95 < 600 ms | Precomputed `investor_facets` rollup refreshed by job; never `count(*)` per filter |
| Text search | p95 < 500 ms | `tsvector` + GIN on name/firm/thesis; pgvector only for semantic mode |
| Match list | p95 < 500 ms | Materialised per-band counts + index on `fit_score` |
| Dashboard cockpit | p95 < 300 ms | One round-trip per user, cached 60s, invalidated on pipeline write |
| Any write route | p95 < 250 ms | Single statement + async event log |

**Structural work:**
1. **Indexes:** matching composite indexes for every filterable column pair;
   partial indexes for `is_active = true`.
2. **Pagination:** replace offset pagination with keyset everywhere a list can
   exceed one page. Offset at 500k rows degrades linearly.
3. **Counts:** stop issuing `count: "exact"` on list requests; read the rollup.
4. **Caching:** per-user cache for cockpit/round; per-filter cache for facets;
   in-process LRU plus a shared cache, invalidated on write.
5. **RLS:** keep tenant predicates on indexed columns; verify plans with
   `EXPLAIN (ANALYZE)` at 500k before sign-off.
6. **Imports:** batched upserts (5k rows), `background_jobs` with progress,
   resumable, capped per run.
7. **50k users:** connection pooling in front of Postgres, no per-request
   table scans, background jobs isolated from request traffic, and rate limits
   per user on expensive routes.
8. **Frontend:** virtualise long lists, avoid fetching 2,000 rows into memory
   (the current fit page does this and is being replaced), skeleton states, and
   abort in-flight requests on navigation.

---

## 8. Sequencing and push gates

1. **A-pass:** Overview, Matches, Discover filters, Documents/Data Room,
   Outreach setup gate → push.
2. **B-pass:** CRM, Lists, Deliverability merge, Reports → push.
3. **Integrations pass:** email interface + outbox, Stripe test mode, PostHog
   event contract, `/api/integrations/status` → push.
4. **Scale pass:** indexes, keyset pagination, facet rollup, load test → push.
5. **Copilot pass:** context, persistence, tools, approvals → push.
6. **Intelligence pass:** market (derived) and opportunities (curated) first;
   news/portfolio/competitor only once sources are confirmed → push.

Each pass ends with: `tsc` 0, tests green, migration applied, deploy READY,
signed-in route verified.

---

## 9. Deliberately not built

Warm-introduction graph, data room OCR, competitor scraping, team collaboration
and custom stages stay out of the MVP. They are listed in `docs/20` §4 as
deferred for the same reason: they add surface without closing the loop.
