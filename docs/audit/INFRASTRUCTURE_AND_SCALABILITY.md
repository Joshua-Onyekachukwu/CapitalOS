# Infrastructure & Scalability Review — Capital OS

**Date:** October 24, 2026. Every "verified" item below was checked in code/config or live-probed during this audit; estimates are labeled.

## A. Verified current inventory

| Component | Provider / ref | Verified state | Purpose | Constraints |
|---|---|---|---|---|
| Web app | **Vercel** (`capital-os-nine.vercel.app`) | ✅ live, all routes gated correctly (probe 2026-10-24); hobby plan (serverless 30s, edge limits) | Next.js 16 RSC + ~70 API routes | Middleware deprecated → proxy codemod pending; hobby-plan serverless limits on long jobs |
| Database + Auth | **Supabase** `tvekoojdilkjptjzpvqo` | ✅ ACTIVE (live counts 2026-10-24). Region appears to be `aws-1-eu-west-1` (pooler tenant resolves there; direct DB DNS `db.<ref>.supabase.co` no longer resolves) | Postgres 17/RLS/auth/storage | Direct-Postgres access broken with stored password (B5) — scripts only reach via REST. Free tier auto-pause took prod down once (Sept 2026 incident). |
| Storage | Supabase Storage (`company_documents`, decks) | Tables populated (4 rows); bucket-level policies **Unverified** (no dashboard access) | Documents/decks | — |
| AI | **NVIDIA NIM** + OpenRouter (qualification) | Keys rotate; `AI_MOCK_MODE` offline; ~100s/email drafting latency documented previously | Investor research, drafts, copilot, deck gen | Single vendor for product AI; no structured-output abstraction |
| Email sending | Gmail API / MS Graph / SMTP (email_accounts=3 in prod) | OAuth tokens AES-256-GCM; nightly credential-health probe live-verified (`background_jobs` 208 rows) | Outreach | Gmail ~500/day cap will bite at campaign scale; custom SMTP needs the CHECK fix (landed Sept 30) |
| Email reception | IMAP (imapflow/mailparser) | Reply poller + in-flight reply-understanding service | Reply detection | IMAP needs app-passwords; Gmail grant refresh has revocation path |
| Payments | **Stripe** | Code complete (Checkout + webhooks w/ raw-body verification); 0 `billing_events` — live keys/content **Unverified** | Founding member $9.99 | Needs live-key E2E |
| Email delivery (transactional) | **Resend** (alert channel) | Implemented, self-skips until `RESEND_API_KEY` set; Supabase Auth SMTP watchdog in-flight | Auth emails + alerts | — |
| Rate limiting | **Upstash Redis** (config in `11-security.md`) | Code + docs done; backend header observable; whether prod env vars are set **Unverified** (would need 429 burst probe) | Distributed limits | Memory fallback under-multiplies if unset |
| CI/monitoring | GitHub Actions `security-nightly.yml` (+ uncommitted `auth-smtp-watchdog.yml`) | Code complete; run history in `background_jobs` | Nightly prod suites + multi-channel alerting | No error monitoring (no Sentry), no analytics (no product analytics) |
| Real-time | **None** | Convex gone (README stale); dashboards poll server routes | — | Fine at current scale |
| Backups | `backups/`, `data-backups/` CSV/JSON restore scripts | Runbook restore verified once (2026-09-27); Supabase-side PITR not confirmed for free tier | Disaster recovery | Regenerateable from EDGAR; user data not backed up off-Supabase |

## B. Supabase assessment (honest)

**Data volume:** total rows in probe ≈ 37K (most in `investors` and `raw_records`). This is tiny — the free tier (500MB DB, ~500 concurrent?) is nowhere near a constraint. The real historical bottleneck incidents have all been **operational** (project auto-pause) or **RLS/per-tenant correctness**, never load.

**Workload drivers expected as usage grows** (estimates):
- `investors` search: tsvector+pgvector columns exist; the API caps at 2000/page and runs service-role parallel counts — fine at 100K rows, should move to RPC/exact-count skip past ~500K.
- Sequence execution + reply polling: per-user bursts of provider API calls — bounded by warmup caps, fine on serverless if kept funded-by-per-user OAuth (they are).
- Backfill ingestion (Apollo/EDGAR): currently scripts, not serverless — correct separation; don't move into Vercel functions.

**Growth-linked risks (ordered):**
1. **Auto-pause recurrence** (P0) — cheapest insurance: T-drive the project on a cron (existing `auth-smtp-watchdog.yml` does its own thing; add a heartbeat) or upgrade to Pro ($25/mo) when revenue exists. **Est. cost labeled:** free tier $0; Pro $25/mo.
2. **No off-Supabase backup of user data** (P1) — investor data regenerates; user/company/email data does not. Cron a nightly `pg_dump`/REST export to R2/S3 when it matters.
3. **Storage bucket policies unverified** (P1) — one manual review.
4. **RLS policy performance** — policies are simple `auth.uid()` predicates; indexed user_id columns exist on tenant tables. No evidence of slowness at this scale; revisit after 100K rows.

## C. Service candidates — adopt only when triggered

| Need | Candidate | Already solved by existing stack? | Verdict now | Trigger to adopt | Est. cost (public pricing, est.) |
|---|---|---|---|---|---|
| Background jobs (long ingestion, campaign execution) | Trigger.dev / Inngest / plain cron on Vercel | Scripts + Vercel cron (`/api/cron/daily`, `security-alert`) work | **Defer** | When a campaign must execute steps 5+ minutes serverless can't hold | $0–20/mo |
| Distributed rate limits | Upstash Redis (already coded) | Memory fallback exists | **Finish wiring** (env vars set?) | Now (already built, $0-ish) | Free tier |
| Error monitoring | Sentry | None | **Adopt before pilot** — nightly suites tell you about curated scenarios only, not user-visible errors | Now | Free tier covers ~5k events |
| Product analytics | PostHog | None | **Adopt with pilot** (activation metric needs it) | Now | Free ≤1M events/mo |
| Email deliverability | Warmup (built) + ZeroBounce (in-flight) | Verification pay-per-email | Ship in-flight plan | Now for G1 | ~$0.008/verify |
| Webhook delivery to third parties | n/a | No external webhooks offered yet | Defer | When public API exists | — |
| Billing | Stripe | Implemented; needs live-key E2E | Complete config, not new vendor | Now | % of payments |
| Search at scale | pgvector/tsvector already present | Solved for ≤500k rows | Defer external (typesense etc.) | >500k investors or latency SLOs | — |
| Backups | Supabase PITR / external dumps | On-disk restore path + regenerable investor data | Add simple nightly export when paid users exist | First paying customer | $0–5/mo |

**Explicitly rejected for now:** Convex (dead in code — remove claims), Kafka/queue infra, dedicated search vendor, multi-region (low latency users irrelevant at this stage).

## D. Scalability scenarios (assumptions: ~5% paying, 20% WAU of signups typical for early SaaS; investor DB growth 1–5× from ingestion; all cost figures estimates from public pricing)

| Scenario | Shape | Primary bottlenecks | Infra adjustments | Est. cost/mo |
|---|---|---|---|---|
| **Pilot — 100 users** (≈20 WAU, ≈5 paying) | 25 sends/day after warmup; nightly suites; 19k investors | Email deliverability hygiene; auth emails | Increase Supabase auth SMTP; add Sentry + PostHog free; finish Upstash | **$0–9** (Vercel Hobby free, Supabase free, Upstash free) |
| **Early adoption — 1,000 users** (≈200 WAU, ≈40 paying) | 500–1,000 sends/day across accounts; 50–100K investor rows | Vercel Hobby limits (banner: serverless execution/duration, image/edge); DB connection bursts; `raw_records` churn; Apollo/ZeroBounce budget | Vercel Pro ($20) + Supabase Pro ($25, removes pause risk + PITR); cron-driven batch mapping for ingestion; nightly off-site dump | **$45–90** |
| **Growing — 10,000 users** (≈2,000 WAU, ≈250 paying) | 5–10K sends/day distributed across user mailboxes; ~250K investor rows; sequence engine concurrency | Rate-limit fairness across tenants; DB compute on search; webhook fan-out; enforcement of per-seat billing | Vercel Pro; Supabase Pro→Scale as measured (compute add-on only when CPU/RAM saturates — measure, don't assume); move ingestion to a persistent worker (Trigger.dev or small VM + pooler); email domain warmup playbook per domain | **$150–400** |
| **Larger — 100,000 users** (≈10–20K WAU) — **out of scope for current architecture without migrations** | FB-out boundaries: Postgres connection pooling (move transaction mode)； Redis-backed queues; per-tenant sharding not yet needed | pgvector index size; email OAuth token refresh storms | Dedicated DB cluster or institutional Supabase; queue-backed sending with per-account schedulers; self-serve domain verification; SOC2-style audit logging (product estate: admin_audit_log exists; needs account-level rollback). | **$1–3K** |

Not modeled: realtime workloads (none exist), external API product (none), enterprise buyers (different contract terms).

## E. What to automate now (cheap, prevents the next outage)

1. **Anti-pause heartbeat** hitting a prod endpoint daily from CI (Supabase free project pauses ~1 week idle — this caused the Sept 2026 outage).
2. **Off-site backup export** (cron: users + company_profiles + email_messages + attachments list → R2/S3 CSV) — restore runbook exists; make the input current data.
3. **Deploy is env-drifted-safe:** Vercel bundling of `NEXT_PUBLIC_*` at build time (the Sept 2026 incident was env vars pointing at a destroyed project) — add a deploy-time check that the bundled Supabase ref resolves (`nslookup` in CI before promotion).
4. **Sentry** — this is the difference between "nightly suite says green" and knowing a user just hit a 500.
