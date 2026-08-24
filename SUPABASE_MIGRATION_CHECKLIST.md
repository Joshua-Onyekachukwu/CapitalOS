# Supabase Migration Checklist

## Current Project (Broken — Hot Standby)
- **Project Ref:** `keepilpdaphpkofqgcae`
- **Project URL:** `https://keepilpdaphpkofqgcae.supabase.co`
- **Region:** eu-central-1 (Frankfurt)
- **Status:** Hot standby mode — database not accepting connections
- **Root Cause:** 1M+ investor rows filled the 500MB free-tier disk

---

## Step 1: Create New Supabase Project

1. Go to https://supabase.com/dashboard → **New Project**
2. Choose a project name (e.g., `capital-os`)
3. Set a **strong database password** (save it!)
4. Choose region: **eu-central-1** (Frankfurt) — closest to your users
5. Wait for project to be created (~2 minutes)

---

## Step 2: Get New Project Credentials

After creation, go to **Settings → API** and copy:

| Credential | Where to Find | Current Value (old project) |
|---|---|---|
| **Project URL** | Settings → API → Project URL | `https://keepilpdaphpkofqgcae.supabase.co` |
| **Anon Key** | Settings → API → `anon` `public` | `sb_publishable_K8Lu04XVsQWN2cOCLRAUUg_R9ypDY-M` |
| **Service Role Key** | Settings → API → `service_role` `secret` | (in .env.local) |
| **Database Password** | Settings → Database → Password | `+LyJ.n6AeYnNW/C` |
| **Connection String** | Settings → Database → Connection string | `postgresql://postgres.[ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres` |

---

## Step 3: Update .env.local

Replace these lines in `.env.local`:

```bash
# Supabase Auth (new project)
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-NEW-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-NEW-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR-NEW-SERVICE-ROLE-KEY

# Database backup (old project — for migration)
OLD_SUPABASE_URL=https://keepilpdaphpkofqgcae.supabase.co
OLD_SUPABASE_SERVICE_KEY=YOUR-OLD-SERVICE-ROLE-KEY
NEW_SUPABASE_URL=https://YOUR-NEW-PROJECT.supabase.co
NEW_SUPABASE_SERVICE_KEY=YOUR-NEW-SERVICE-ROLE-KEY
```

---

## Step 4: Run Auth Migration

```bash
# Migrate all user accounts from old project to new
node scripts/migrate-supabase-auth.js
```

This transfers:
- ✅ All user accounts (email/password)
- ✅ User metadata (profile info)
- ✅ App metadata (roles, permissions)
- ✅ OAuth connections (if any)

**Note:** This does NOT migrate database data. All data is in CockroachDB.

---

## Step 5: Re-create Database Schema (if needed)

The new project won't have any tables. Run the schema setup:

```bash
# The CockroachDB schema is the primary data store
# Supabase only needs auth — no database tables required
```

If you want Supabase RLS policies for additional security:

```sql
-- Create minimal tables for Supabase (optional)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  company_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
```

---

## Step 6: Test Auth Flow

1. Restart the dev server: `npm run dev`
2. Go to http://localhost:3456/signup
3. Create a test account
4. Verify you can log in
5. Check admin access with `semek@capitalOS.io`

---

## Step 7: Update Admin Allowlist

```bash
# In .env.local
COCKROACH_ADMIN_EMAILS=semek@capitalOS.io
```

---

## Step 8: Deploy to Vercel

Update these environment variables in Vercel dashboard:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | New project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | New anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | New service role key |
| `DATABASE_URL` | CockroachDB connection string (unchanged) |
| `APOLLO_API_KEY` | `3gFzbd0n6kLwB_6hyaedeA` |
| `COCKROACH_ADMIN_EMAILS` | `semek@capitalOS.io` |
| `NEXT_PUBLIC_APP_URL` | `https://capital-os.vercel.app` |

---

## Data Architecture After Migration

```
┌─────────────────────────────────────────────────┐
│  NEW Supabase Project (free tier)               │
│  ├── Auth only (login/signup/sessions)     ✅   │
│  └── No database tables (all data in CRDB)      │
│                                                 │
│  CockroachDB (production)                  ✅   │
│  ├── investors (16,142 synthetic)                │
│  ├── investor_firms (250)                        │
│  ├── company_profiles (100)                      │
│  ├── job_queue, email_accounts, etc.             │
│  └── All data safely stored                      │
│                                                 │
│  Apollo API (new key)                      ✅   │
│  ├── Key: 3gFzbd0n6kLwB_6hyaedeA                │
│  ├── Trial plan (search API not included)        │
│  ├── Can export CSVs from dashboard              │
│  └── Ready for batch scraping on paid plan       │
└─────────────────────────────────────────────────┘
```

---

## What Changed from Old Architecture

| Aspect | Before | After |
|---|---|---|
| **Supabase** | Auth + 1M+ investor data | Auth only |
| **CockroachDB** | Empty/new | All data (investors, firms, companies) |
| **Disk usage** | 500MB free tier (FULL) | ~10MB (auth only) |
| **Database** | Crashed from disk full | Clean, fast, scalable |
| **Build** | Turbopack (broken) | Webpack (working) |
| **Port** | 3000 (conflicts) | 3456 (clean) |
| **Security** | No auth on 27 routes | Auth on all routes |
| **Apollo** | Expired key | New key (trial plan) |

---

## Files That Reference Supabase

These files use Supabase and will automatically work with the new project:

| File | Uses Supabase For |
|---|---|
| `src/lib/supabase/server.ts` | Server-side auth (cookies) |
| `src/lib/supabase/client.ts` | Client-side auth |
| `src/lib/auth.ts` | `getCurrentUser()` helper |
| `src/lib/actions/auth.ts` | Login/signup/logout actions |
| `src/lib/actions/email.ts` | Email account connections |
| `src/middleware.ts` | Session refresh |

**No code changes needed** — just update the 3 env vars.

---

## Apollo API Notes

| Detail | Value |
|---|---|
| **API Key** | `3gFzbd0n6kLwB_6hyaedeA` |
| **Plan** | Professional (Trial) |
| **Search API** | ❌ Not included in Trial |
| **CSV Export** | ✅ Available from Apollo dashboard |
| **People Search** | Requires paid plan upgrade |

### How to Get Investor Data with Trial Plan

1. Log into https://app.apollo.io
2. Use the web interface to search for investors
3. Export results as CSV
4. Save CSV to `test-data/` directory
5. Run: `npx tsx src/scripts/import-apollo-csv.ts`

### When Ready for Full API Access

Upgrade to Apollo Pro ($49/month) for:
- Full API access (people search, enrichment)
- 10,000+ credits/month
- Batch export via API
- Real-time data enrichment
