# Capital OS — Architecture

## System Overview

```
                     NEXT.JS / VERCEL
                            │
                            ▼
                       CONVEX
                Application / Realtime Layer
                            │
             ┌──────────────┴──────────────┐
             │                             │
             ▼                             ▼
         SUPABASE                      PYTHON
       Data Platform                   Workers
             │                             │
     ┌───────┼───────────┐         ┌───────┼───────┐
     │       │           │         │       │       │
   Auth   PostgreSQL   Storage   Scraping  ML   AI/NVIDIA
     │       │           │         │       │       │
     ▼       ▼           ▼         ▼       ▼       ▼
  Users  Investors    PDFs/HTML  EDGAR  Scoring  Enrichment
  Login  Companies    Documents  Apollo Dedup    Analysis
  RLS    Contacts     Pitch Decks
         Campaigns    Exports
```

## What Each Layer Does

### 🟦 Supabase — THE SOURCE OF TRUTH

**Permanent, relational data. PostgreSQL.**

| Data | Why |
|------|-----|
| Users & Auth | Login, sessions, RLS |
| Investors (1M+) | Core business data, relational queries |
| Investor Firms | Fund data, partners, AUM |
| Contacts | Individual investor contacts |
| Companies | Portfolio companies |
| Investment History | Portfolio, exits, check sizes |
| Intelligence | Scores, signals, activity |
| Outreach | Campaigns, emails, replies |
| Audit Logs | Security, compliance |

**Limits:**
- Free: 500MB database, 1GB storage
- Pro ($25/month): 8GB database (scales to 60TB), 100GB storage
- **You need Pro for 1M+ investors**

### 🟩 Convex — THE LIVE APPLICATION ENGINE

**Real-time state, jobs, notifications. NOT the primary database.**

| Data | Why |
|------|-----|
| Research Jobs | Real-time progress tracking |
| Dashboard Metrics | Live stats (no polling) |
| Notifications | Real-time alerts |
| Scraping Jobs | Background job progress |
| Campaign State | Live email tracking |
| Workflow State | Temporary processing state |

**Limits:**
- Free: 3GB database, 6GB storage
- Pro: 50GB database, 100GB storage
- **Perfect for app state (~500MB-1GB)**

### 🟨 Object Storage — THE RAW DATA LAYER

**Large files, documents, scraped content.**

| Data | Why |
|------|-----|
| PDFs | Pitch decks, reports |
| HTML Snapshots | Scraped web pages |
| Documents | Raw files |
| Datasets | CSV/JSON exports |
| Exports | Generated files |

**Use Supabase Storage (100GB on Pro) or Cloudflare R2.**

### 🟥 Python Workers — THE COMPUTE ENGINE

**Heavy processing, ML, scraping, enrichment.**

| Task | Why |
|------|-----|
| EDGAR Scraping | SEC filings (free) |
| Apollo Scraping | Investor data (API) |
| Deduplication | Entity resolution |
| ML Scoring | Investment fit analysis |
| AI Enrichment | Thesis analysis, scoring |
| Batch Processing | Large-scale operations |

**Run on: Vercel Serverless, Railway, or dedicated server.**

## Data Flow

### 1. Scraping Pipeline

```
Python Worker
    ↓
EDGAR/Apollo API
    ↓
Raw Data Processing
    ↓
Deduplication & Normalization
    ↓
Supabase PostgreSQL
    ↓
Convex (job status update)
    ↓
Dashboard (real-time progress)
```

### 2. Investor Research

```
User clicks "Research Investor"
    ↓
Convex Mutation (create job)
    ↓
Convex Action (trigger worker)
    ↓
Python Worker
    ↓
Website/LinkedIn Scraping
    ↓
AI Analysis
    ↓
Supabase (update investor record)
    ↓
Convex (update job status)
    ↓
Dashboard (real-time progress)
```

### 3. Outreach Campaign

```
User creates campaign
    ↓
Supabase (store campaign)
    ↓
Python Worker (send emails)
    ↓
Supabase (update status)
    ↓
Convex (live campaign state)
    ↓
Dashboard (real-time metrics)
```

## Why This Architecture

### Supabase for Data

- **PostgreSQL**: Full SQL, joins, indexes, RLS
- **Relational**: Investors → Firms → Contacts → Portfolio
- **Scalable**: 8GB → 60TB on Pro/Team
- **Portable**: Standard PostgreSQL, no vendor lock-in
- **Proven**: Battle-tested for production workloads

### Convex for Realtime

- **Reactive queries**: No polling needed
- **Live updates**: Dashboard changes instantly
- **Job tracking**: Real-time progress bars
- **Notifications**: Instant alerts
- **Simple**: No WebSocket management

### Python for Compute

- **Heavy scraping**: EDGAR, Apollo, LinkedIn
- **ML/AI**: Scoring, classification, enrichment
- **Batch processing**: Large-scale operations
- **Flexible**: Any library, any API

## Scaling Path

### Current (Free Tier)

```
Supabase Free: 500MB (32K investors)
Convex Free: 3GB (app state)
```

### Growth (Pro Tier — $25/month)

```
Supabase Pro: 8GB (1M+ investors)
Convex Pro: 50GB (app state)
```

### Scale (Team/Enterprise)

```
Supabase Team: 60TB (10M+ investors)
Convex Enterprise: Custom limits
Dedicated compute: Python workers on AWS/GCP
```

## Environment Variables

### Supabase (Auth + Data)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
```

### Convex (App State + Realtime)

```bash
NEXT_PUBLIC_CONVEX_URL=https://YOUR_DEPLOYMENT.convex.cloud
CONVEX_DEPLOY_KEY=dev:YOUR_DEPLOYMENT|YOUR_KEY
```

### Database (CockroachDB — Legacy)

```bash
DATABASE_URL=postgresql://USER:PASS@HOST:26257/defaultdb
```

## Key Decisions

1. **Supabase owns all permanent data** — investors, contacts, campaigns
2. **Convex owns all live state** — jobs, metrics, notifications
3. **No data duplication** — Convex references Supabase IDs, doesn't copy data
4. **Python handles all heavy compute** — scraping, ML, enrichment
5. **Object storage for raw files** — PDFs, HTML, documents
