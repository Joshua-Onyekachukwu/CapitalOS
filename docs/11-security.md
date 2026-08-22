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

---

*Last updated: August 22, 2026*
