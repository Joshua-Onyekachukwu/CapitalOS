# Executive Summary — Capital OS Audit

**October 24, 2026.** Full codebase + live-production evidence review. Nine documents under `docs/audit/` — start here.

## What have we built so far?

A real, large, substantially working platform: Next.js 16 (53 pages, ~70 API routes, ~52K LOC) on Vercel; Supabase (36 tables, RLS on all tenant tables, pgvector search columns); NVIDIA NIM AI client; complete Gmail/Graph/SMTP sender stack with tracking and compliance; an 11-stage pipeline; campaigns/sequences; billing architecture; 12-page admin suite; deterministic explainable fit scoring; ingestion pipelines (EDGAR 13F/Form-D/N-CEN, IAPD, CSV/Apollo).

## What actually works (verified, not assumed)

- **Gates:** typecheck 0 errors; 87/87 offline tests green; production build compiles (126 pages); all stretches independently re-run 2026-10-24.
- **Live production:** landing/auth serve; protected routes gate correctly; API 401s; cron secret-gated; signups occurring today; 314 profiles / 3 company profiles / pipeline entries + events DB-verified; pipeline endpoints return consistent live data; admin/security infrastructure runs on nightly suites that have already caught two real bugs and fixed them.
- **Security:** cross-tenant harness 44/44; policy-mirroring grant matrix on 48 relations; Nightly authflow/access-control against production with Slack/Resend/issue alerting; credential-health probing weekly for email grants.

## What remains unfinished / broken

1. **The product's main promise is data-starved.** 18,995 investors, **zero contact emails/linkedins, no fit scores ≥ 80.** Outreach, campaigns, sequences, tracking, health systems exist and are tested, and **no email has ever been sent.** Fix = Apollo contacts pipeline (written, uncommitted) + verification + re-score.
2. **22 uncommitted files** containing in-flight features (reply-understanding, migrations 012/013, auth-SMTP watchdog, ingestion fix). Shipping them + applying their migrations is the next single most leveraged action.
3. **Stale docs as misdirection:** README/ARCHITECTURE still describe Convex (gone — zero references) and "83K+ investors" (wrong: 19K, and with zero email coverage). The Aug 2026-era docs (`14-feature-status`, `PRODUCTION-READINESS-REPORT`, `17-open-issues`) are superseded; treat only the runbook/security/audit docs as authoritative.
4. Direct-Postgres access is broken (stale `SUPABASE_DB_PASSWORD`, deprecated DNS pattern) — blocks restore/backups tooling.
5. OAuth sign-in round trip unverified this audit (code complete; one click-test needed once custom SMTP lands).

## Biggest risks (ranked)

1. **Supabase free-tier fragility** — the Sept 2026 auto-pause outage killed a whole project's env chain; recurrence is the most likely failure mode (mitigations in `INFRASTRUCTURE_AND_SCALABILITY.md` §E: heartbeat, off-site user-data backup, Pro plan when paying).
2. **Data-supply dependence** — everything downstream of G-contact data (fit, outreach, campaigns) is currently theoretical on live data.
3. **Willingness-to-pay unknown** — $9.99 founding-member has never been purchased; no evidence either direction.
4. **Email deliverability during first campaign** — warmup discipline unproven.
5. **Nothing user-visible breaks honestly** — the biggest product risk is not technical debt; it's that the qualitatively big differentiator ("fit explanations on verified data at Nigeria/Africa granularity") is currently un-proven because the data foundation is thin.

## How big is the realistically reachable initial market?

- Nigeria-first: **173 investors** participated in Nigerian startup rounds in 2024 (Partech); network-side reach: Lagos Angel Network ~110–120 self-reported, and ~150 accelerators/incubators; africa-side: 5,000+ angels / 110+ networks / 614 active VC investors.
- Founders raising is a far wider funnel (55,000 US ventures got angel checks in 2024 — CVR estimate) but converting it requires reach; **the realistic first 12 months at $9.99–$99 price tiers ≈ 100–400 paying founder accounts** in Nigeria/Africa + diaspora and remote first-world micro-founders via organic content — labeled estimates, no invented precision.
- The investor-organization TAM across US/UK/EU/AF anchoring frameworks sums to ~10–11.5k organizations and 30–60k online-participating investors — a market frame, not our buyer.

## Which customer segment should we target first?

**Nigerian + diaspora-founders raising pre-seed/seed** — reachable without budget (accelerator communities, LAN, founder networks), the DB weakness is exactly their gap (local data under-indexed by OpenVC/Foundersuite), pricing fits $9.99 founding wedge. Serve founders only; revisit investor-side CRMs later (Affinity-tier selling price, different buyer).

## Which infrastructure changes are genuinely necessary?

Now: Sentry + PostHog (free tiers), Upstash env verify, anti-pause heartbeat, off-site user-data export, migrations 012/013 applied, Stripe live-test E2E. Later (usage-triggered): Vercel Pro + Supabase Pro at ~1k users, a persistent worker for ingestion/campaign execution at ~10k users. Do not add: new search vendors, queues, CRMs, or Convex revival.

## First ten tasks, in order

1. Commit the 22-file in-flight workset (reply-understanding, RPC migration 013, ingestion fix, watchdog, contacts pipeline, templates).
2. Apply migrations 012/013 to prod; re-run the 44/44 cross-tenant harness.
3. Custom SMTP for Supabase Auth; verify a real reset email.
4. Rewrite README/ARCHITECTURE to match code; archive stale docs; purge Convex claims.
5. Rotated DB password + pooler hostnames for restore/backup scripts.
6. Anti-pause heartbeat + deploy-time Supabase-ref guard in CI.
7. Run Apollo contacts pipeline on your CSV → ZeroBounce budget-capped verification → stage → promote → re-score fit distribution.
8. Stripe live-or-test founding-member E2E (webhook → ledger → admin finance).
9. Sentry + PostHog installed; funnel events live.
10. Start warmup and the 25–50-send first campaign; measure bounces, opens, replies.

## What it takes to reach a production-ready pilot

~12–18 focused engineering days over 4–6 calendar weeks (warmup + recruitment drive the calendar): commit/apply in-flight work → contact data in the DB at quality → one real tracked outreach cycle with a reply → one verified Stripe purchase → monitoring live and one week clean → 20 founding pilots at $9.99 → publish the founder-public landing truth pass. The kill/discontinue criteria are in `IMPLEMENTATION_PLAN.md` Phase 5.

## Pressure-test my audit (questions you should ask before acting)

1. The "zero contact data in the live DB" finding depends on my service-role REST probe — the Apollo contacts CSV on disk may already contain contacts that were never staged this quarter; does running the pipeline's `--dry-run` against your real export reconcile with my numbers before building the go-live plan around them?
2. I rated the founding-member Stripe flow "complete (code) / unverified (live)" from code and zero `billing_events` — do you have a prior successful test purchase older than this `background_jobs` retention window that would change that?
3. My customer-segment recommendation bets the wedge on *founders* in Nigeria/diaspora and sets aside investor-side CRM — does the Partech "173 investors" anchor being so small change whether you'd rather sell to the ~110+ African angel networks as organizations instead?
