# Capital OS — Final Architecture

## The Rule

> **One source of truth per data type. No duplication. No guessing.**

---

## What Goes Where

### 🟦 SUPABASE — Permanent Data (The Brain)

**Everything that must survive a restart, a crash, or a deploy.**

```
┌─────────────────────────────────────────────────┐
│  AUTH                                            │
│  ├── Users (login, sessions, passwords)          │
│  ├── Organizations                               │
│  ├── Roles & Permissions                         │
│  └── API Keys                                    │
├─────────────────────────────────────────────────┤
│  INVESTOR DATABASE (1M+ records)                 │
│  ├── Investors (identity, contact, capacity)     │
│  ├── Investor Firms (funds, AUM, partners)       │
│  ├── Contacts (individual people)                │
│  ├── Portfolio Companies                         │
│  ├── Investment History                          │
│  ├── Intelligence (scores, signals, activity)    │
│  └── Source & Verification                       │
├─────────────────────────────────────────────────┤
│  OUTREACH                                        │
│  ├── Campaigns                                   │
│  ├── Email Sequences                             │
│  ├── Email Events (sent, opened, replied)        │
│  └── Meeting Notes                               │
├─────────────────────────────────────────────────┤
│  AUDIT                                           │
│  ├── Activity Logs                               │
│  ├── Data Changes                                │
│  └── Security Events                             │
└─────────────────────────────────────────────────┘

Storage: PostgreSQL (8GB on Pro, scales to 60TB)
Speed: Indexed queries < 50ms for 1M+ rows
Cost: $25/month (Pro)
```

**Why Supabase for this:**
- PostgreSQL handles 1M+ rows with proper indexes
- Relational queries (joins, aggregations) are fast
- RLS policies for multi-tenant security
- SQL is portable — no vendor lock-in
- Pro plan scales to 60TB

---

### 🟩 CONVEX — Live State (The Nervous System)

**Everything that must update in real-time without polling.**

```
┌─────────────────────────────────────────────────┐
│  JOBS (Real-time progress)                       │
│  ├── Research Jobs (scraping investors)          │
│  ├── Enrichment Jobs (filling missing data)      │
│  ├── Scoring Jobs (AI analysis)                  │
│  └── Import Jobs (CSV/API ingestion)             │
├─────────────────────────────────────────────────┤
│  DASHBOARD (Live metrics)                        │
│  ├── Total Investors (count)                     │
│  ├── Emails Sent Today                           │
│  ├── Active Campaigns                            │
│  └── Pipeline Status                             │
├─────────────────────────────────────────────────┤
│  NOTIFICATIONS (Instant alerts)                  │
│  ├── Job Complete                                │
│  ├── Job Failed                                  │
│  ├── New Investor Found                          │
│  └── Campaign Update                             │
├─────────────────────────────────────────────────┤
│  CAMPAIGN STATE (Live tracking)                  │
│  ├── Emails Queued                               │
│  ├── Emails Sent                                 │
│  ├── Opens & Replies                             │
│  └── Bounces                                     │
├─────────────────────────────────────────────────┤
│  WORKFLOW STATE (Temporary)                      │
│  ├── Processing Status                           │
│  ├── Step Progress                               │
│  └── Error Logs                                  │
└─────────────────────────────────────────────────┘

Storage: ~500MB-1GB (well within 3GB limit)
Speed: Reactive queries update instantly
Cost: Free tier is enough
```

**Why Convex for this:**
- Queries automatically subscribe to changes
- No polling, no WebSocket management
- Dashboard updates instantly when data changes
- Perfect for temporary/ephemeral state
- 3GB is plenty for job state

---

### 🟥 PYTHON WORKERS — Heavy Compute (The Muscles)

**Everything that requires CPU, GPU, or external APIs.**

```
┌─────────────────────────────────────────────────┐
│  SCRAPING                                        │
│  ├── EDGAR (SEC filings — free)                  │
│  ├── Apollo (investor data — API)                │
│  ├── LinkedIn (profiles — careful)               │
│  └── Websites (company info)                     │
├─────────────────────────────────────────────────┤
│  ENRICHMENT                                      │
│  ├── Email verification                          │
│  ├── LinkedIn profile lookup                     │
│  ├── Company data enrichment                     │
│  └── Investment thesis analysis                  │
├─────────────────────────────────────────────────┤
│  ML / AI                                         │
│  ├── Investor scoring (fit analysis)             │
│  ├── Entity resolution (dedup)                   │
│  ├── Classification (investor type)              │
│  └── NLP (thesis extraction)                     │
├─────────────────────────────────────────────────┤
│  BATCH PROCESSING                                │
│  ├── CSV import/export                           │
│  ├── Data normalization                          │
│  ├── Quality scoring                             │
│  └── Bulk updates                                │
└─────────────────────────────────────────────────┘

Runs on: Railway, Vercel Serverless, or dedicated server
Speed: Parallel workers, queue-based processing
Cost: Pay per use
```

**Why Python for this:**
- Rich ecosystem (pandas, scikit-learn, BeautifulSoup)
- Easy API integration
- Can run anywhere (Docker, serverless, dedicated)
- Scales horizontally (add more workers)

---

### 🟨 OBJECT STORAGE — Raw Files (The Filing Cabinet)

**Everything that's a file, not structured data.**

```
┌─────────────────────────────────────────────────┐
│  DOCUMENTS                                       │
│  ├── Pitch decks (PDFs)                          │
│  ├── Reports (PDFs)                              │
│  ├── Exports (CSV, JSON)                         │
│  └── Backups (database dumps)                    │
├─────────────────────────────────────────────────┤
│  SCRAPED CONTENT                                 │
│  ├── HTML snapshots                              │
│  ├── Web pages                                   │
│  ├── SEC filing documents                        │
│  └── LinkedIn profiles (cached)                  │
├─────────────────────────────────────────────────┤
│  GENERATED CONTENT                               │
│  ├── Email drafts                                │
│  ├── AI analysis results                         │
│  └── Score reports                               │
└─────────────────────────────────────────────────┘

Storage: Supabase Storage (100GB on Pro) or Cloudflare R2
Speed: CDN-backed, fast retrieval
Cost: pennies per GB
```

---

## Data Flow Examples

### 1. Scraping New Investors

```
User: "Import 5,000 investors from EDGAR"
    │
    ▼
Next.js → Convex Mutation (create scraping job)
    │
    ▼
Convex → Python Worker (trigger EDGAR scraper)
    │
    ▼
Python Worker:
    ├── Fetch SEC filings (API)
    ├── Parse & normalize (CPU)
    ├── Deduplicate (ML)
    └── Write to Supabase (DB)
    │
    ▼
Supabase ← 5,000 new investors stored
    │
    ▼
Convex ← Update job status (real-time)
    │
    ▼
Dashboard ← Shows progress instantly
    │
    ▼
User sees: "5,000 investors imported ✅"
```

### 2. Researching an Investor

```
User: "Research Andreessen Horowitz"
    │
    ▼
Next.js → Convex Mutation (create research job)
    │
    ▼
Convex → Python Worker (trigger enrichment)
    │
    ▼
Python Worker:
    ├── Scrape website (HTTP)
    ├── Analyze investment thesis (AI)
    ├── Find portfolio companies (API)
    ├── Verify contacts (email check)
    └── Score investor (ML)
    │
    ▼
Supabase ← Updated investor record
    │
    ▼
Convex ← Step-by-step progress
    │
    ▼
Dashboard shows:
    ├── ✓ Website scraped
    ├── ✓ Thesis analyzed
    ├── ✓ Portfolio found
    ├── ✓ Contacts verified
    └── 🔄 Scoring... (82%)
```

### 3. Sending Outreach Campaign

```
User: "Send campaign to 100 investors"
    │
    ▼
Next.js → Supabase (create campaign)
    │
    ▼
Python Worker:
    ├── Generate personalized emails (AI)
    ├── Verify email addresses
    ├── Send via SMTP
    └── Track opens/replies
    │
    ▼
Supabase ← Campaign status + email events
    │
    ▼
Convex ← Live campaign metrics
    │
    ▼
Dashboard shows:
    ├── Sent: 85/100
    ├── Opened: 42
    ├── Replied: 8
    └── Bounced: 3
```

---

## Speed Requirements

| Operation | Target | How |
|-----------|--------|-----|
| Dashboard load | < 200ms | Convex reactive queries |
| Investor search | < 100ms | PostgreSQL indexes |
| Investor detail | < 50ms | Primary key lookup |
| Campaign metrics | < 100ms | Convex real-time |
| Job progress | Instant | Convex subscriptions |
| Scrape 1K investors | < 5 min | Python parallel workers |
| Enrich 1 investor | < 30s | Python + AI APIs |

---

## Scalability Path

### Phase 1: Launch (Now)

```
Supabase Free: 500MB (32K investors)
Convex Free: 3GB (app state)
Python: 1 worker (Railway free tier)
Cost: $0/month
```

### Phase 2: Growth (1M investors)

```
Supabase Pro: 8GB (1M+ investors)
Convex Free: 3GB (still enough)
Python: 2-3 workers ($20/month)
Cost: ~$45/month
```

### Phase 3: Scale (10M investors)

```
Supabase Team: 60TB (10M+ investors)
Convex Pro: 50GB (more app state)
Python: 5-10 workers ($100/month)
Cost: ~$200/month
```

### Phase 4: Enterprise (100M+ investors)

```
Supabase Enterprise: Custom
Convex Enterprise: Custom
Python: Kubernetes cluster
Cost: Custom
```

---

## Monitoring & Alerts

### Real-time Monitoring (Convex)

```
Dashboard shows:
├── Database size (Supabase)
├── Query performance (Supabase)
├── Job queue depth (Convex)
├── Worker status (Python)
├── Error rates (all)
└── Response times (all)
```

### Alert System

```
If any of these happen:
├── Query time > 500ms → Alert
├── Job failure rate > 5% → Alert
├── Database size > 80% → Alert
├── Worker down → Alert
├── Error rate > 1% → Alert
└── Response time > 1s → Alert
```

### Auto-healing

```
├── Worker crashes → Auto-restart
├── Database slow → Scale up
├── Job stuck → Auto-retry
├── Memory high → Auto-scale
└── Disk full → Alert + archive
```

---

## Summary

| Layer | Responsibility | Technology | Storage | Speed |
|-------|---------------|------------|---------|-------|
| **Supabase** | Permanent data | PostgreSQL | 8GB → 60TB | Indexed queries |
| **Convex** | Live state | Convex DB | 500MB-1GB | Reactive |
| **Python** | Heavy compute | Workers | N/A | Parallel |
| **Object Storage** | Raw files | S3/R2 | 100GB | CDN |

**One source of truth. No duplication. Real-time visibility.**
