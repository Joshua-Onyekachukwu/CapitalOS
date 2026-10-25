# Capital OS — Feature Gap Analysis

**Date:** October 24, 2026. Companion to `SYSTEM_AUDIT.md` — this compares what exists against what a **launch-credible** product requires, and names the single biggest gaps first.

## The headline gap in one sentence

**Every mechanical piece of the outreach engine works and is tested, but the database contains zero contactable investors (0 of 18,918 active records have an email or linkedin), so the product cannot yet deliver its core outcome: a founder sending a tracked outreach to a qualified investor.**

Everything else in this analysis is secondary to closing that data gap and shipping the in-flight uncommitted work.

## Tier 1 — Launch blockers (must exist for a paying pilot)

| # | Gap | Why it blocks launch | Evidence today | Effort |
|---|---|---|---|---|
| G1 | **Contact-data acquisition** (Apollo contacts pipeline + email verification) | Users judge the product by the number and quality of reachable investors they find. 0 emails = product gives nothing OpenVC/G spreadsheets don't. | `scripts/apollo-contacts-pipeline.js` written but **uncommitted**; GO-LIVE-PLAN written around it; live DB: 0 emails | 2–4 days incl. verification budget (~$4 per 500 verifications) |
| G2 | **Commit + apply migrations 012/013** (reply understanding, analytics distributions RPC) and the in-flight services (reply-understanding, auth-SMTP watchdog, ingestion jsonb fix) | Deployed code (analytics page) will call an RPC that doesn't exist in prod → 500/empty; reply classification unavailable | Working tree has 22 uncommitted files; RPC absent from data plane as evidenced by zero RPC extraction during audit | 0.5–1 day |
| G3 | **Supabase Auth custom SMTP** (signup/reset emails) | With ~200+ accounts and confirmation required, an unverified-email account is a dead account. The nightly `auth-smtp-watchdog` workflow is uncommitted and unverified. | `scripts/auth-smtp-values.js`, `docs/AUTH-SMTP-SETUP.md`, `supabase/templates/*` all uncommitted | 0.5 day (config + one verify run) |
| G4 | **First real end-to-end send** (draft → approve → send → track → reply → suppress) on a production account | Everything is tested, nothing is used. Zero `email_messages` in prod. Integration confidence requires one true campaign of 25–50 sends after warmup. | Prod: `email_messages`=0, tracking=0, enrollments=0 | 3–5 days calendar (warmup ramp) |
| G5 | **Fit scores on real data** — batch qualification producing distributions ≥ thresholds; currently avg 62, nothing ≥ 80 and no contactability credit | "High fit" is the product's qualitative edge; empty distribution makes the fit page look broken | Live counts: highFit=0, `withEmail`=0 (fit's contactability factor always 0) | 1 day after G1 |

## Tier 2 — Important before charging money

| # | Gap | Notes |
|---|---|---|
| G6 | **Stripe live keys + one founding-member purchase E2E** | Code + webhook signature verification complete; zero `billing_events`. Verify Checkout → webhook → `founding_members` row → subscription created → credit grant ledgered. |
| G7 | **Landing-page truth pass** | Testimonials credibility (Unverified in this audit), "83K+ investors" claim everywhere must become the true number after G1 lands; pricing copy must match eventual plans. |
| G8 | **Email deliverability operations** | Warmup engine exists; needs the discipline loop from GO-LIVE-PLAN (bounce>3% → stop), daily health monitoring (already surfaces green/red cards). |
| G9 | **Support + incident paths** | SYSTEM.md documents restore runbooks; still missing: a support email/in-app contact point for pilot users, SLA-free but discoverable. |
| G10 | **Migration/backup tooling repair** | Direct-Postgres access broken (DNS + stale `SUPABASE_DB_PASSWORD`) — blocks the restore/dedup scripts; rotate password and repoint scripts to the pooler. |

## Tier 3 — Post-launch (do not block the pilot)

| # | Gap | Notes |
|---|---|---|
| G11 | Google/Microsoft OAuth sign-in verification on prod | Manual 5-min test after G3. |
| G12 | Documents upload → Supabase Storage backed (UI exists, upload wired for docs) | `company_documents` rows exist (4), scope to pilot needs. |
| G13 | Calendar integration for meetings | API generates scheduling links only. |
| G14 | Team/multi-seat | Reserved in schema (`team_seats`) but no org model; founder-of-one only. |
| G15 | Public API / integrations (Zapier, etc.) | Not needed for pilot. |
| G16 | Mobile app / PWA | Responsive web sufficient for pilot. |
| G17 | Convex removal from docs/env | Cleanup (B3). |
| G18 | `middleware-to-proxy` codemod | Next-16 housekeeping. |

## What is NOT a gap (worth restating so it is not rebuilt)

- RLS/tenancy: cross-tenant harness 44/44; policy-mirroring grant matrix on 48 relations; nightly 401/403 matrices.
- Auth flows, password-reset enumeration protection, cookie hardening: covered by nightly authflow suite.
- Email sender stack (Gmail MIME attachments, Graph fileAttachment, SMTP), tracking injection, suppression, CAN-SPAM, credential-health probe: unit-tested + nightly-probed.
- Onboarding persistence, pipeline entries/events, saved filters/notes: production-verified.
- Billing architecture: plans/credits/ledger + webhook signature checking implemented.

## Launch-ready when…

1. G1–G5 complete; 2. one purchased founding-member flow verified (G6); 3. a 3-week warmup→campaign cycle produces ≥ 25 sends with ≥ 2 replies on real investor contacts; 4. nightly suites green for 7 consecutive days; 5. support contact + docs pages current. That is the smallest credible paid-pilot definition, and everything in Tier 3 can be deferred without affecting it.
