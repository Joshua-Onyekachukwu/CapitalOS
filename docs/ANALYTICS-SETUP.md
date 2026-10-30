# Analytics & Error Monitoring — Setup (Phase 3)

Both stacks are **fully wired in code** and are deliberate no-ops until the
keys below are configured. Nothing throws, nothing networked, zero latency
cost without keys. This is the same graceful-degradation pattern the app uses
for migration 014.

## PostHog

**Env vars (add in Vercel project settings + local `.env.local`):**

| Variable | Scope | Meaning |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | browser | Client events + pageviews. From PostHog → Settings → Project API key (`phc_…`). |
| `NEXT_PUBLIC_POSTHOG_HOST` | browser | Optional; defaults to `https://us.i.posthog.com`. |
| `POSTHOG_API_KEY` | server | `email_sent`, `reply_received`, `upgraded` fire from the server (cron/webhook paths where no browser exists). Same project API key works. |
| `POSTHOG_HOST` | server | Optional; defaults to `https://us.i.posthog.com`. |

**Event schema (fired today):**

| Event | Where | Properties |
|---|---|---|
| `signup_started` | signup page mount | `page` |
| `signup_completed` | signup API success | `activation` (auto/email) |
| `onboarding_step_n` | onboarding step navigation | `step` (1–7) |
| `investors_searched` | discover API success | `query`, `query_shape` (parsed filters JSON), `used_semantic`, `result_count` |
| `investor_saved` | saved-investors POST (new save only) | `investor_id` |
| `draft_generated` | AI draft API success | `investor_name`, `tone` |
| `draft_approved` | send carries `approvedDraftId` | `draft_id`, `investor_id` |
| `email_sent` | outreach send success | `investor_id`, `campaign_id`, `via_approved_draft` |
| `reply_received` | reply-understanding persist | `interest_level`, `confidence`, `engine` |
| `upgraded` | founding-member webhook after paid session | `amount`, `currency`, `plan` |

**Funnel:** signup_started → signup_completed → onboarding_step_n (4) →
investors_searched → investor_saved → draft_generated → draft_approved →
email_sent → reply_received → upgraded.

**Implementation notes**
- Client: `src/lib/analytics/posthog.ts` (event constants + lazy-loaded
  `captureEvent`), provider `src/components/Providers/PosthogProvider.tsx`
  (pageview per client route change, `autocapture: false` — product events only).
- Server: `src/lib/analytics/server.ts` (`captureServerEvent` via
  posthog-node, flush-per-event, catch-all so analytics never breaks a request).

## Sentry

**Env vars:**

| Variable | Scope | Meaning |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | both | The client + server DSN from Sentry → Settings → Keys (`https://…o….ingest.sentry.io/…`). |
| `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `SENTRY_URL` | build | Optional; only needed for source-map upload on build. The `next.config.ts` wrapper activates automatically when `NEXT_PUBLIC_SENTRY_DSN` is set. |

**Runtime wiring:** `src/instrumentation.ts` (server, `onRequestError`
hook) and `src/instrumentation-client.ts` (browser). Both skip init without
a DSN; console output still captures errors in dev.

**Verification once keys are added:** `throw new Error("sentry-test")` inside
an admin API → error appears in Sentry issues ≤ 60s; `$pageview`/
`investors_searched` appear in PostHog → Events ≤ 30s; PostHog funnel
consumes the events table above.
