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

The authorization model is verified against production every night by
`.github/workflows/security-nightly.yml` (03:15 UTC, or manual dispatch):

- **Static scan** — every `/api/admin/*` handler's first statement is
  `requireAdmin` (bootstrap endpoint excepted: `requireAuth` + fails-closed).
- **Live matrix** — every admin route returns 401 unauthenticated and 403
  as a non-admin; an admin session passes (positive control).
- **IDOR regressions** — suppression, warmup, and dashboard/admin stay
  caller-scoped (the three historically vulnerable surfaces).

On failure, two alert channels fire:

1. A deduplicated GitHub issue labeled `security-alert`
   ("security: access-control suite failing against production") that
   updates while failing and auto-closes on the next passing run.
2. A `security_nightly` row in `background_jobs` (via
   `POST /api/cron/security-alert`, gated by `CRON_SECRET`) — failures
   surface in **/admin/intelligence → job_status** recent failures.

To drill the alert path end to end: run the workflow with the
`force_failure` input set to `true` — the DRILL test fails on purpose,
the issue opens, and the next passing run closes it automatically.
Required repo secrets: `TEST_FOUNDER_EMAIL/PASSWORD`,
`TEST_ADMIN_EMAIL/PASSWORD`, `TEST_IDOR_VICTIM_ACCOUNT_ID/USER_ID`,
`CRON_SECRET` (Supabase + Vercel secrets are shared with deploy.yml).

---

*Last updated: September 28, 2026*
