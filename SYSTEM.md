# Capital OS — Complete System Documentation

## Architecture Overview

Capital OS uses a **hybrid architecture** with three layers, each handling what it does best:

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
│              Next.js / React / Vercel               │
│              Port: 3456 (dev)                       │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │                         │
     SUPABASE                   CONVEX
   THE BRAIN                  THE NERVES
   500MB Free                 3GB Free
          │                         │
   Auth ✅                   Jobs ✅
   Investors (32K+)         Metrics ✅
   Contacts ✅               Notifications ✅
   Campaigns ✅              Campaign state ✅
   Audit logs ✅             Workflow state ✅
          │
          ▼
    PYTHON WORKERS
    THE MUSCLES
    (EDGAR scraping,
     enrichment,
     ML scoring)
```

---

## Layer 1: Supabase — Permanent Data Store

### What It Holds
- **Authentication** — User login, sessions, OAuth (Google)
- **Investor Database** — 32,787+ records with all details
- **Campaigns** — Email outreach records
- **Audit Logs** — Security and activity tracking

### Project Details
| Detail | Value |
|--------|-------|
| **Project** | capitalos |
| **URL** | `https://wdvhraurmpvncrgnmmbf.supabase.co` |
| **Plan** | Free (500MB database) |
| **Investors** | 32,837 records |
| **Storage Used** | ~46MB of 500MB |

### Investors Table Schema (Supabase)
```sql
investors (
  id UUID PRIMARY KEY,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  job_title TEXT,
  investor_type TEXT,          -- angel_investor, venture_capital, private_equity, etc.
  company_name TEXT,
  company_website TEXT,
  linkedin_url TEXT,
  personal_website TEXT,
  country TEXT,
  city TEXT,
  location TEXT,
  email TEXT,
  phone TEXT,
  min_check_size NUMERIC,
  max_check_size NUMERIC,
  fund_size NUMERIC,
  aum NUMERIC,
  investment_stages TEXT[],    -- pre_seed, seed, series_a, etc.
  investment_sectors TEXT[],   -- fintech, saas, healthtech, etc.
  investment_geographies TEXT[],
  investment_thesis TEXT,
  number_of_investments INTEGER,
  number_of_exits INTEGER,
  last_investment_date DATE,
  fit_score INTEGER,
  data_quality_score INTEGER,
  outreach_readiness TEXT,
  is_verified BOOLEAN,
  source TEXT,                 -- edgar_13f_hr, edgar_form_d, edgar_ncen, generated, apollo_csv
  source_id TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

### Data Sources in Supabase
| Source | Count | Quality | Description |
|--------|-------|---------|-------------|
| EDGAR 13F-HR | 5,880 | 70/100 | Institutional investors (hedge funds, mutual funds) |
| EDGAR Form D | 8,645 | 55/100 | Private placement funds (VC, PE, angels) |
| EDGAR N-CEN | 2,035 | 65/100 | SEC-registered investment funds |
| Generated | 16,127 | varies | Test data with synthetic profiles |
| Apollo CSV | 100 | 85/100 | Test import from Apollo |
| **Total** | **32,787** | | |

### Physical Backups (on disk)
| File | Records | Location |
|------|---------|----------|
| 13F-HR investors | 5,880 | `backups/edgar/13f-hr-investors-2026-08-24.csv` |
| Form D investors | 5,304 | `backups/edgar/form-d-investors-2026-08-24.csv` |
| N-CEN funds | 2,035 | `backups/edgar/ncen-funds-2026-08-24.csv` |

### How to Query Supabase
```bash
# Count all investors
curl "https://wdvhraurmpvncrgnmmbf.supabase.co/rest/v1/investors?select=id" \
  -H "apikey: YOUR_ANON_KEY" -H "Prefer: count=exact"

# Search by type
curl "https://wdvhraurmpvncrgnmmbf.supabase.co/rest/v1/investors?investor_type=eq.venture_capital&limit=10" \
  -H "apikey: YOUR_ANON_KEY"
```

---

## Layer 2: Convex — Real-time Application Engine

### What It Holds
- **Research Job Progress** — Real-time scraping status
- **Dashboard Metrics** — Live counts (no polling)
- **Notifications** — Instant alerts
- **Scraping Job Status** — Background job tracking
- **Campaign State** — Live email tracking

### Project Details
| Detail | Value |
|--------|-------|
| **Project** | CapitalOS (exciting-bat-92) |
| **URL** | `https://exciting-bat-92.convex.cloud` |
| **Dashboard** | https://dashboard.convex.dev/t/CapitalOS/capitalos/exciting-bat-92 |
| **Plan** | Free (3GB database) |
| **Region** | US East (N. Virginia) |

### Convex Tables
| Table | Purpose | Max Size |
|-------|---------|----------|
| `investors` | Full investor archive (for 1M+ scale) | ~1.5GB |
| `researchJobs` | Real-time job progress | ~10MB |
| `dashboardMetrics` | Live dashboard stats | ~1MB |
| `notifications` | User notifications | ~50MB |
| `scrapingJobs` | EDGAR/Apollo job tracking | ~10MB |

### Convex Functions
| Function | Type | Purpose |
|----------|------|---------|
| `investors:search` | Query | Search investors with filters |
| `investors:count` | Query | Get total count |
| `investors:stats` | Query | Get stats by source/type |
| `researchJobs:create` | Mutation | Create a new research job |
| `researchJobs:updateProgress` | Mutation | Update job progress |
| `dashboard:setMetric` | Mutation | Update dashboard metric |
| `dashboard:getMetric` | Query | Get a metric value |
| `notifications:create` | Mutation | Send a notification |
| `scrapingJobs:create` | Mutation | Start a scraping job |

### How to Query Convex
```bash
# Count investors
curl -X POST https://exciting-bat-92.convex.cloud/api/query \
  -H "Content-Type: application/json" \
  -d '{"path":"investors:count","args":{}}'

# Get dashboard metric
curl -X POST https://exciting-bat-92.convex.cloud/api/query \
  -H "Content-Type: application/json" \
  -d '{"path":"dashboard:getMetric","args":{"key":"total_investors"}}'
```

---

## Layer 3: Python Workers — Compute Engine

### What It Does
- **EDGAR Scraping** — SEC Form D, 13F-HR, N-CEN filings (free, no API key)
- **Data Enrichment** — Fill missing fields from multiple sources
- **ML Scoring** — Investor fit analysis and lead scoring
- **Deduplication** — Entity resolution across sources

### Scraping Scripts
| Script | Purpose | Command |
|--------|---------|---------|
| `scripts/edgar-bulk-fast.js` | EDGAR bulk scraper | `node scripts/edgar-bulk-fast.js` |
| `scripts/qualify-investors.ts` | Score all investors | `npx tsx src/scripts/qualify-investors.ts` |
| `scripts/migrate-to-supabase.js` | CockroachDB → Supabase | `node scripts/migrate-to-supabase.js` |
| `scripts/check-cols.js` | Check DB columns | `node scripts/check-cols.js` |

### EDGAR Scraper Options
```bash
# All sources, 10 years
node scripts/edgar-bulk-fast.js

# Just 13F-HR
node scripts/edgar-bulk-fast.js --13f

# Just Form D
node scripts/edgar-bulk-fast.js --form-d

# Last year only
node scripts/edgar-bulk-fast.js --days 365

# Check database stats
node scripts/edgar-bulk-fast.js --stats
```

---

## Environment Variables

### Required for Supabase (Auth + Data)
```bash
NEXT_PUBLIC_SUPABASE_URL=https://wdvhraurmpvncrgnmmbf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...           # Public anon key
SUPABASE_SERVICE_ROLE_KEY=eyJ...               # Secret service role key
SUPABASE_DB_PASSWORD=+LyJ.n6AeYnNW/C          # Database password
```

### Required for Convex (Real-time)
```bash
NEXT_PUBLIC_CONVEX_URL=https://exciting-bat-92.convex.cloud
CONVEX_DEPLOY_KEY=dev:exciting-bat-92|eyJ...   # Deploy key
```

### Required for CockroachDB (Legacy Source)
```bash
DATABASE_URL=postgresql://...@...:26257/defaultdb?sslmode=verify-full
```

### Required for AI/NVIDIA
```bash
NVIDIA_API_KEY_1=...
NVIDIA_API_KEY_2=...
AI_MOCK_MODE=true                            # Set false when keys are ready
```

### Admin Access
```bash
COCKROACH_ADMIN_EMAILS=semek@capitalOS.io
```

### Email (Gmail SMTP)
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
EMAIL_FROM=your-email@gmail.com
```

---

## Login Credentials

| Account | Email | Password |
|---------|-------|----------|
| **Admin** | semek@capitalOS.io | CapitalOS2024! |

### Google OAuth
- Configured in Supabase Authentication → Providers → Google
- Requires Google Cloud project with OAuth credentials
- See `docs/GOOGLE_SETUP.md` for setup instructions

---

## How Data Flows

### Flow 1: Scraping New Investors
```
EDGAR API (free)
    ↓
edgar-bulk-fast.js (Node.js worker)
    ↓
Parse & normalize
    ↓
Supabase REST API (POST /rest/v1/investors)
    ↓
Physical backup (CSV + JSON)
    ↓
Convex mutation (update dashboard metrics)
    ↓
Dashboard shows real-time progress
```

### Flow 2: User Searches Investors
```
User types search query
    ↓
Next.js API route (/api/investors)
    ↓
Supabase REST API (with filters)
    ↓
Results returned (< 100ms)
    ↓
Dashboard displays results
```

### Flow 3: Sending Outreach
```
User clicks "Send Email"
    ↓
Convex mutation (create job)
    ↓
Python worker (generate personalized email)
    ↓
SMTP (Gmail)
    ↓
Supabase (log email event)
    ↓
Convex (update campaign metrics)
    ↓
Dashboard shows real-time status
```

---

## Speed & Performance

| Operation | Target | How |
|-----------|--------|-----|
| Dashboard load | < 200ms | Convex reactive queries |
| Investor search | < 100ms | PostgreSQL indexes |
| Investor detail | < 50ms | Primary key lookup |
| Campaign metrics | < 100ms | Convex real-time |
| Job progress | Instant | Convex subscriptions |
| Scrape 1K investors | < 5 min | Node.js parallel |
| Enrich 1 investor | < 30s | AI + external APIs |

---

## Scaling Path

### Phase 1: Now (Free Tiers)
```
Supabase Free: 500MB → 32K investors (9% used)
Convex Free: 3GB → app state only
Cost: $0/month
```

### Phase 2: Growth (100K investors)
```
Still fits in Supabase Free (143MB of 500MB)
Convex: still free
Cost: $0/month
```

### Phase 3: Scale (1M+ investors)
```
Supabase Pro: $25/month → 8GB (scales to 60TB)
Convex Free: still enough for app state
Cost: ~$25/month
```

### Phase 4: Enterprise
```
Supabase Team: custom
Convex Pro: $25/month → 50GB
Dedicated Python workers
Cost: ~$100-200/month
```

---

## Backup Strategy

### Automatic Backups
1. **EDGAR Scraper** saves CSV + JSON to `backups/edgar/` after every run
2. **Git** tracks all code changes
3. **Supabase** has daily backups on Pro plan

### Manual Backup Commands
```bash
# Backup Supabase data
node scripts/migrate-to-supabase.js --stats

# Export to CSV
curl "https://wdvhraurmpvncrgnmmbf.supabase.co/rest/v1/investors?select=*" \
  -H "apikey: YOUR_KEY" > backup.csv

# Backup Convex data
npx convex export
```

### Restore Process
```bash
# Restore from CSV
node scripts/migrate-to-supabase.js --fresh  # Drops and recreates table
# Then re-run EDGAR scraper to refill data
node scripts/edgar-bulk-fast.js
```

---

## Monitoring

### Real-time Dashboard (Convex)
- Total investors count
- Active jobs
- Emails sent today
- Campaign progress
- Error alerts

### Supabase Dashboard
- Database size: https://supabase.com/dashboard
- Query performance
- Auth activity
- Storage usage

### Convex Dashboard
- Function calls
- Database I/O
- Error rates
- Deployment history

---

## Troubleshooting

### "Could not find column" Error
The Supabase table schema doesn't match the data being inserted.
**Fix:** Run `supabase-schema.sql` in Supabase SQL Editor, then re-run migration.

### Supabase "Hot Standover" Error
Database is overwhelmed by disk I/O.
**Fix:** Restart project from Supabase Dashboard → Settings → General → Restart.

### Migration Fails
Check that `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`.
Run with `--stats` first to verify CockroachDB connection.

### Convex Not Updating
Check that `NEXT_PUBLIC_CONVEX_URL` is set in `.env.local`.
Run `npx convex dev` to verify deployment.

### Server Won't Start
```bash
# Clean and restart
rm -rf .next
npm run dev
```

---

## File Structure

```
Capital OS/
├── src/
│   ├── app/                    # Next.js pages
│   │   ├── (auth)/            # Login, signup
│   │   ├── dashboard/         # User dashboard
│   │   ├── api/               # API routes
│   │   └── layout.tsx         # Root layout (ConvexProvider)
│   ├── components/
│   │   ├── ConvexProvider.tsx  # Convex connection
│   │   ├── Landing/           # Marketing pages
│   │   └── RealtimeDashboard.tsx  # Convex-powered dashboard
│   └── lib/
│       ├── db.ts              # CockroachDB connection
│       └── supabase/          # Supabase client
├── convex/
│   ├── schema.ts              # Convex database schema
│   ├── investors.ts           # Investor queries/mutations
│   ├── researchJobs.ts        # Job tracking
│   ├── dashboard.ts           # Live metrics
│   ├── notifications.ts       # Real-time alerts
│   ├── scrapingJobs.ts        # Scraping progress
│   └── actions.ts             # External API calls
├── scripts/
│   ├── edgar-bulk-fast.js     # EDGAR scraper
│   ├── migrate-to-supabase.js # Migration tool
│   ├── qualify-investors.ts   # Scoring system
│   └── check-cols.js          # Schema checker
├── backups/
│   └── edgar/                 # Physical data backups
├── supabase-schema.sql        # Supabase table schema
├── ARCHITECTURE.md            # Architecture overview
├── ARCHITECTURE_FINAL.md      # Detailed architecture
└── SYSTEM.md                  # This file
```

---

## Key Commands

```bash
# Start dev server
npm run dev                    # Runs on port 3456

# Check Supabase data
node scripts/migrate-to-supabase.js --stats

# Scrape more investors
node scripts/edgar-bulk-fast.js

# Score all investors
npx tsx src/scripts/qualify-investors.ts

# Run security tests
npm test -- src/__tests__/security.test.ts

# Deploy Convex changes
npx convex dev

# Check environment
node -e "require('dotenv').config({path:'.env.local'}); console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```
