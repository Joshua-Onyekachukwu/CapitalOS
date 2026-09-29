# Capital OS — Security Architecture

## Overview

Security is built into the architecture from the beginning. Every table has Row Level Security (RLS), OAuth tokens are encrypted at rest, and API keys are never exposed to the client bundle.

## Authentication

### Supabase Auth

- Email/password authentication
- Session management via HTTP-only cookies
- Middleware refreshes sessions on every request
- Auth pages: `/login`, `/signup`, `/forgot-password`, `/reset-password`

### Session Flow

```
Browser → Middleware (refreshSession) → Next.js Route → Server Action
     ↓
Supabase Auth validates session
     ↓
User ID available via supabase.auth.getUser()
```

## Row Level Security (RLS)

Every table in Supabase has RLS enabled. Policies control who can read/write each row.

### Policy Patterns

| Pattern | Who | Access |
|---------|-----|--------|
| User owns resource | `auth.uid() = user_id` | Full CRUD on own data |
| Via company ownership | `EXISTS (SELECT FROM company_profiles WHERE id = ... AND user_id = auth.uid())` | CRUD via parent ownership |
| Authenticated read | `auth.role() = 'authenticated'` | Read-only for all users |
| Service role only | `auth.role() = 'service_role'` | Admin/system operations |

### Table-Level RLS Summary

| Table | Read | Write | Notes |
|-------|------|-------|-------|
| `profiles` | Own only | Own only | |
| `company_profiles` | Own only | Own only | One per user |
| `company_team_members` | Via company | Via company | |
| `company_documents` | Via company | Via company | |
| `investors` | All authenticated | Service role | Shared intelligence DB |
| `investor_firms` | All authenticated | Service role | |
| `investor_sectors` | All authenticated | Service role | Read-only taxonomy |
| `email_accounts` | Own only | Own only | |
| `email_messages` | Own only | Own only | |
| `saved_investors` | Own only | Own only | |
| `billing_plans` | All authenticated | Service role | |
| `user_subscriptions` | Own only | Service role | |
| `credit_ledger` | Own only | Service role | |
| `raw_records` | Service role | Service role | |
| `duplicate_candidates` | All authenticated | All authenticated | For review |
| `data_change_log` | Service role | Service role | |
| `admin_audit_log` | Service role | Service role | |

## OAuth Token Security

### Encryption

- Algorithm: AES-256-GCM
- Key: `EMAIL_TOKEN_ENCRYPTION_KEY` environment variable
- Implementation: `src/lib/services/email/crypto.ts`
- Tokens encrypted before storage, decrypted only when sending

### Storage

- Tokens stored in `email_accounts` table
- Never exposed to client bundle
- Server-side only access via service role

### Scope

- Google: `send` + `read` only
- Microsoft: `send` + `read` only
- No access to contacts, calendar, or other user data

## API Key Security

### NVIDIA NIM Keys

- Stored in environment variables (`NVIDIA_API_KEY_1` through `NVIDIA_API_KEY_5`)
- Never exposed to client bundle
- Server-side only via `src/lib/ai/keys.ts`
- Round-robin rotation prevents single-key rate limiting

### Apollo API Key

- Stored in `APOLLO_API_KEY` environment variable
- Server-side only
- Used only for data import operations

## File Access Control

- Supabase Storage with RLS
- Users can only access their own files
- File types validated before upload
- File size limits enforced

## Audit Logging

All admin operations logged to `admin_audit_log`:
- User ID
- Action performed
- Entity type and ID
- Details (JSONB)
- IP address
- Timestamp

## Rate Limiting

- API routes have server-side rate limiting
- Email sending rate-limited per account (provider limits)
- AI operations rate-limited by credit balance
- CSV import rate-limited by batch size (500 records)

## Data Isolation

- Each user's company data is isolated via RLS
- Investor database is shared (read-only for all authenticated users)
- Admin operations use service role only
- Email accounts and messages are user-owned

## Environment Variables

| Variable | Sensitivity | Location |
|----------|------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Server only |
| `NVIDIA_API_KEY_*` | **Secret** | Server only |
| `APOLLO_API_KEY` | **Secret** | Server only |
| `GOOGLE_CLIENT_ID` | **Secret** | Server only |
| `GOOGLE_CLIENT_SECRET` | **Secret** | Server only |
| `MICROSOFT_CLIENT_ID` | **Secret** | Server only |
| `MICROSOFT_CLIENT_SECRET` | **Secret** | Server only |
| `EMAIL_TOKEN_ENCRYPTION_KEY` | **Secret** | Server only |

## RLS Coverage Matrix

All 48 public relations have RLS enabled. **Grants mirror the policy
surface**: a client role only holds a privilege on a table where a
user-facing RLS policy exists, and every row-level operation remains
gated by the policy (owner scoping via `auth.uid()`, admin via
`is_admin()`, dataset reads via `authenticated`).

Grant notation `A|U`, privileges `R`=SELECT `I`=INSERT `U`=UPDATE
`D`=DELETE (anon = first column):

| Table | Grants | Policy scope |
|---|---|---|
| `investors` | anon:R, auth:R | public read (deliberate shared dataset) |
| `investor_firms/sectors/data_sources/employment_history/profiles` | auth:R | authenticated read |
| `data_change_log`, `email_messages` (read) | auth:R | authenticated read (timeline UI); writes service-only |
| `duplicate_candidates`, `v_pending_duplicates` | auth:R | admin-only read (`is_admin()`); writes service-only |
| `v_data_health`, `v_investors_with_firms` | auth:R | definer read-windows over service aggregates |
| `profiles` | auth:R,U | own row (`auth.uid() = id`) |
| `company_profiles` | auth:R,I,U | own rows |
| `company_documents`, `company_team_members` | auth:R,I,U,D | via own company_profile |
| `campaigns` + 4 sequence tables, `campaign_investors` (read) | auth:R,(I,U,D) | own rows (`auth.uid() = user_id`) |
| `saved_investors`, `saved_filters`, `copilot_conversations`, `pipeline_events`, `user_pipeline_entries`, `investor_search_history` | auth:R,I,U,D | own rows |
| `email_accounts` | auth:R,I,U,D | own rows |
| `email_threads`, `email_warmup`, `email_tracking_events` | auth:R,I,U,D | own rows |
| `email_suppression_list`, `email_sending_log`, `email_health_events/scores` | auth:R | own rows; writes service-only |
| `credit_ledger`, `billing_events`, `user_subscriptions`, `background_jobs`, `audit_log` (own), `founding_members` | auth:R | own rows; writes service-only |
| `billing_plans`, `credit_costs` | auth:R | authenticated read |
| `firm_aliases`, `waitlist` | auth:R | waitlist admin-only; firm_aliases authenticated |
| `admin_audit_log`, `audit_log` (admin view), `data_providers`, `raw_records`, `email_domain_health` | none | service-role only |
| `v_provider_usage`, `v_user_billing` | none | definer-owned aggregates |

**Hardening history:** TRUNCATE/REFERENCES/TRIGGER were revoked from
client roles on all tables (2026-09-28); blanket GRANT ALL row grants
were replaced with the policy-mirroring matrix above the same day —
51 tables × 4 row-DML grants reduced to SELECT-only on 12 shared/read
surfaces plus owner-scoped writes on the user-owned tables.
TRUNCATE is not RLS-gated, so it must never be granted to client roles.

## Nightly Access-Control Monitoring

The authorization model and the auth user journey are verified against
production every night by `.github/workflows/security-nightly.yml`
(03:15 UTC, or manual dispatch):

- **Access-control suite** — static scan (every `/api/admin/*` handler's
  first statement is `requireAdmin`; bootstrap endpoint excepted with
  `requireAuth` + fails-closed), live 401/403 matrix over every admin
  route, admin positive control, and IDOR regressions on the three
  historically vulnerable surfaces (suppression, warmup, dashboard/admin).
- **Authflow suite** — signup creates a confirmed account, duplicate
  email is refused, password grant issues a session, password-reset
  responses are generic (no account enumeration), fabricated session
  cookies are rejected, and `sb-*` session cookies carry
  HttpOnly/Secure/SameSite in production.

On failure, up to four alert channels fire:

1. A deduplicated GitHub issue labeled `security-alert`
   ("security: nightly suite failing against production") that updates
   while failing and auto-closes on the next fully passing run.
2. A `security_nightly` row in `background_jobs` (via
   `POST /api/cron/security-alert`, gated by `CRON_SECRET`) — failures
   surface in **/admin/intelligence → job_status** recent failures.
3. **Slack** — `SLACK_WEBHOOK_URL` secret posts a :rotating_light:
   message with the failing suite(s) and run link (skipped when unset).
4. **Email** — `RESEND_API_KEY` + `ALERT_EMAIL_TO` secrets send a
   Resend alert (skipped when unset).

To drill the alert path end to end: run the workflow with the
`force_failure` input set to `true` — the DRILL test fails on purpose,
the issue opens, and the next passing run closes it automatically.
Required repo secrets: `TEST_FOUNDER_EMAIL/PASSWORD`,
`TEST_ADMIN_EMAIL/PASSWORD`, `TEST_IDOR_VICTIM_ACCOUNT_ID/USER_ID`,
`CRON_SECRET`; optional: `SLACK_WEBHOOK_URL`, `RESEND_API_KEY`,
`ALERT_EMAIL_TO` (Supabase + Vercel secrets are shared with deploy.yml).
The Slack and email steps are built and self-skip until those secrets
are added — no code changes are needed to activate them.

Suite coverage notes:

- The authflow suite pins CSRF on the auth boundary: a cross-origin
  signup POST (attacker Origin) must get 403, same-origin must pass,
  and signup bursts must trip 429 with limiter headers
  (`X-RateLimit-Backend` proves which limiter handled it). Origin
  validation is host-aware — Origin is compared against the serving
  `x-forwarded-host` — so it holds on every deployment URL without a
  static allowlist.
- The access-control suite IDOR-probes the notes endpoint
  (attribution must be the caller, never another user id) and the
  role-change endpoint (non-admin 403; self-demotion refused 409).
- Run history is visible in-app: **/admin/system → Nightly Security
  Suites** (passing streak, failures/30d, per-run detail + GitHub run
  links) sourced from the `security_nightly` rows in `background_jobs
  via the requireAdmin `/api/admin/system-security` route.

For an on-demand version of the same journey (no vitest, plain Node,
human-readable pass/fail summary):

```
node scripts/smoke-prod.cjs --base-url https://capital-os-nine.vercel.app
```

17 assertions: preflight, signup (unique `buffy.qa+smoke-*` address,
duplicate → 409), session cookie mints and authenticates, founder
journey (cockpit / investors / outreach metrics / suppression
round-trip / send+draft validation gates), admin-route 401/403 role
guards, admin positive control (users + audit-logs filters), and IDOR
spot-checks on a foreign `accountId` (404). Requires the Supabase
anon/public env and `TEST_ADMIN_EMAIL/PASSWORD`; optional
`TEST_IDOR_VICTIM_ACCOUNT_ID`. Re-run sparingly: signup is rate-limited
10/min per IP.

## Credential-Grant Health (Nightly Probe)

Every nightly `GET /api/cron/daily` run ends with
`runCredentialHealthProbe()` (`src/lib/services/email/credential-health.ts`):

- For every `email_accounts` row with `provider='google'` and
  `is_active=true`, it decrypts the stored refresh token and POSTs a real
  `grant_type=refresh_token` request to Google's token endpoint.
- Verdicts: `healthy` (access token minted), `revoked` (Google answers
  `invalid_grant`/`unauthorized_client` — user revoked access, changed
  the password, or removed the app), `unverified` (no stored grant),
  `error` (network/unknown — not attributed to the grant).
- Persisted to `email_accounts.health_status`
  (`healthy` | `reconnect_required` | `unverified`) +
  `health_last_checked_at`. The settings card renders a red
  "Grant revoked by Google — reconnect required" state with the
  reconnect button when `reconnect_required`.
- Observability: a `credential_health` row lands in `background_jobs`
  (status `failed` if any grant was revoked) → visible under
  /admin/intelligence → recent failures.

Requires `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in the Vercel env
(they are already needed for OAuth; without them accounts are reported
`unverified`/`error`, never falsely `healthy`).

## Distributed Rate Limiting (Upstash Redis)

`src/lib/middleware/rate-limit.ts` implements a fixed-window counter
with a pluggable backend. When `UPSTASH_REDIS_REST_URL` +
`UPSTASH_REDIS_REST_TOKEN` are set, the counter is an atomic
`INCR` + `EXPIRE NX` pipeline against Upstash REST — shared across all
serverless instances. Without them (or on Redis error) each instance
counts in its own process memory, which under-multiplies limits across
instances. Every 429 carries `X-RateLimit-Backend: redis|memory`
(via `applyRateLimit`, or `rateLimitHeaders` on routes that build
their own 429, e.g. signup).

**Live verification** (burst past the signup limit of 10/min/IP):

```
for i in $(seq 1 12); do curl -s -o /dev/null -D - \
  -X POST https://capital-os-nine.vercel.app/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"fullName":"RL Probe","email":"buffy.qa+rlprobe-'$i'-'$RANDOM'@gmail.com","password":"RateLimit!2026x"}' \
  | grep -i -E 'HTTP/|x-ratelimit-backend'; done
```

Expect: first 10 attempts `200`/`400`, then `429` with
`X-RateLimit-Backend: memory` (pre-Redis) or `: redis` (post-provision).

**Provisioning Upstash (manual, ~5 minutes):**

1. Sign in at console.upstash.com → **Create Database** → name
   `capital-os-ratelimit`, pick the AWS region matching the Vercel
   function region (e.g. `us-east-1`), REST is enabled by default. The
   free tier's daily command allowance is ample for this traffic.
2. From the database dashboard copy **UPSTASH_REDIS_REST_URL** and
   **UPSTASH_REDIS_REST_TOKEN**.
3. Add both to Vercel for the `production` and `preview`
   environments:

   ```
   vercel env add UPSTASH_REDIS_REST_URL production
   vercel env add UPSTASH_REDIS_REST_URL preview
   vercel env add UPSTASH_REDIS_REST_TOKEN production
   vercel env add UPSTASH_REDIS_REST_TOKEN preview
   ```

   (or Vercel dashboard → Project → Settings → Environment Variables).
4. **Redeploy** (`vercel --prod` or push an empty commit) — env vars
   only bind to functions at deploy time.
5. Re-run the burst probe above and confirm `x-ratelimit-backend:
   redis`; the Upstash dashboard Metrics view should show the `INCR`
   commands streaming in.

---

*Last updated: September 28, 2026*
