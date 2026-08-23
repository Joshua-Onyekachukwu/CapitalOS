# Capital OS — Investor Data Intelligence System
## Complete Implementation Plan

---

## A. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                           │
│  Dashboard │ Discover │ Pipeline │ Campaigns │ Outreach │ Decks │
├─────────────────────────────────────────────────────────────────┤
│                     INTELLIGENCE LAYER                          │
│  Entity Resolution │ Dedup │ Enrichment │ Verification │ Score  │
├─────────────────────────────────────────────────────────────────┤
│                     AI LAYER (NVIDIA NIM)                       │
│  Thesis Analysis │ Email Drafting │ Research │ Fit Analysis     │
├─────────────────────────────────────────────────────────────────┤
│                     DATA LAYER (Supabase)                       │
│  Investors │ Firms │ Raw Records │ Sources │ Change Log │ Email │
├─────────────────────────────────────────────────────────────────┤
│                     INTEGRATION LAYER                           │
│  CSV Import │ OAuth Email │ NVIDIA API │ Apollo API │ EDGAR     │
├─────────────────────────────────────────────────────────────────┤
│                     BACKGROUND PROCESSING                       │
│  Batch Scoring │ Dedup Detection │ Change Detection │ Imports   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Layer | Responsibility | Runs On |
|-------|---------------|---------|
| **Application** | UI, routing, user interactions | Next.js (client + server) |
| **Intelligence** | Scoring, matching, resolution | Next.js server actions + API routes |
| **AI** | Thesis analysis, email drafting, research | NVIDIA NIM via `src/lib/ai/` |
| **Data** | Storage, queries, RLS, triggers | Supabase PostgreSQL |
| **Integration** | External APIs, OAuth, imports | Next.js server + Supabase Edge Functions |
| **Background** | Batch jobs, large-scale processing | Supabase Edge Functions / background_jobs table |

---

## B. DATABASE SCHEMA

### Tables Already Built

| Table | Purpose | Status |
|-------|---------|--------|
| `investors` | Canonical investor records | ✅ Built |
| `investor_firms` | Organizations/firms | ✅ Built |
| `investor_employment_history` | Person → Firm → Role timeline | ✅ Built |
| `investor_data_sources` | Per-field provenance tracking | ✅ Built (not populated) |
| `investor_profiles` | AI enrichment data per investor | ✅ Built |
| `investor_sectors` | Controlled taxonomy | ✅ Built |
| `raw_records` | Ingestion staging table | ✅ Built |
| `duplicate_candidates` | Review queue for dedup | ✅ Built |
| `data_change_log` | Version history | ✅ Built (not populated) |
| `firm_aliases` | Organization name variants | ✅ Built (not populated) |
| `data_providers` | External data sources config | ✅ Built |
| `data_acquisition_jobs` | Import/campaign jobs | ✅ Built |
| `email_accounts` | OAuth-connected email | ✅ Built |
| `email_messages` | Outreach history | ✅ Built |
| `campaign_investors` | Campaign ↔ Investor junction | ✅ Built |
| `saved_investors` | User bookmarks | ✅ Built |
| `email_threads` | Conversation grouping | ✅ Built |
| `background_jobs` | Queue for heavy processing | ✅ Built |
| `billing_events` | Audit trail for billing | ✅ Built |

### Tables NOT Yet Built

| Table | Purpose | Priority |
|-------|---------|----------|
| `investor_change_requests` | Pending field edits needing approval | Medium |
| `investor_verification_queue` | Emails/data needing human verification | Medium |
| `investor_notes` | User notes per investor | Low |
| `investor_tags` | Custom tags/categories | Low |
| `investor_watchlists` | Saved filtered views | Low |

### Columns Missing on Existing Tables

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| `investors` | `fit_score_breakdown` | JSONB | Detailed scoring factors |
| `investors` | `role_normalized` | TEXT | Cleaned job title |
| `investors` | `search_vector` | tsvector | Full-text search |
| `investor_firms` | `normalized_name` | TEXT | Clean name for matching |
| `email_accounts` | `display_name` | TEXT | User's display name |

---

## C. DATA PIPELINE

### Current Pipeline (Built)

```
CSV Import → parseCsv() → stageRecords() → processRawRecords() → promoteNewRecords()
                                        ↓
                              normalizeInvestor()
                                        ↓
                              findMatchingInvestor()
                                        ↓
                         95%+ → auto-link | 70-95% → duplicate queue | <70% → new record
```

### Full Target Pipeline

```
1. INGEST     → CSV, API, manual, scraping, web research
2. PARSE      → Extract fields, handle different formats
3. NORMALIZE  → Standardize names, stages, sectors, countries, currencies
4. MATCH      → Multi-signal identity resolution (email, LinkedIn, name, firm)
5. DEDUP      → Detect duplicates, calculate confidence, queue for review
6. ENRICH     → Fill missing data (firm details, investment history, bio)
7. VERIFY     → Validate emails, check data freshness, mark confidence
8. QUALIFY    → Score fit against startup profile, determine outreach readiness
9. STORE      → Write to canonical tables with provenance
10. MONITOR   → Detect changes, track freshness, alert on stale data
```

---

## D. ENTITY RESOLUTION STRATEGY

### Current Implementation (Built in `matching.ts`)

**Phase 1 — Exact Matches (Deterministic)**
- Email exact match → confidence 0.30 weight
- LinkedIn URL exact match → confidence 0.25 weight

**Phase 2 — Fuzzy Name Match**
- Last name ILIKE search → Levenshtein distance scoring
- First + last name similarity

**Phase 3 — Email Domain Match**
- Same email domain → likely same firm (excludes gmail, yahoo, etc.)

**Phase 4 — Firm Name Match**
- Normalized firm name fuzzy search → find investors at same firm

**Composite Score** — Weighted average:
| Signal | Weight |
|--------|--------|
| Email | 30% |
| LinkedIn | 25% |
| Full Name | 15% |
| First+Last Name | 10% |
| Firm | 10% |
| Title | 5% |
| Location | 5% |

### Confidence Thresholds

| Range | Action |
|-------|--------|
| ≥ 95% | Auto-merge (same person) |
| 70-94% | Queue for human review |
| 25-69% | Flag as possible duplicate |
| < 25% | Treat as different person |

### What's Missing

1. **Organization resolution** — `firm_aliases` table exists but normalization isn't wired to the matching engine
2. **Historical matching** — employment history not used in identity resolution yet
3. **Batch dedup across entire DB** — `detectDuplicates()` exists but only checks email matches, needs full signal matching
4. **Merge logic** — no code exists to actually merge two investor records
5. **Confidence tuning** — weights are hardcoded, need calibration

---

## E. DATA VERSIONING

### What's Built

- `data_change_log` table — stores field_name, old_value, new_value, source, timestamp
- `log_data_change()` PostgreSQL function
- `investor_data_sources` table — per-field provenance

### What's Missing

1. **Automatic change detection** — No trigger or service that compares new data against existing and logs changes
2. **Source provenance population** — `investor_data_sources` is never written to during ingestion
3. **Conflict resolution** — When two sources disagree, no logic to determine the "best" value
4. **History UI** — No page to view an investor's change history
5. **Freshness tracking** — No "last_verified_at" or "data_age" calculation

---

## F. INTELLIGENCE LAYER

### What Uses Rules/Algorithms (Built)

| Component | Approach | Status |
|-----------|----------|--------|
| Email match | Deterministic exact | ✅ |
| LinkedIn match | Deterministic exact | ✅ |
| Name similarity | Levenshtein distance | ✅ |
| Sector matching | Rule-based grouping | ✅ |
| Stage matching | Ordered distance | ✅ |
| Geography matching | Normalized comparison | ✅ |
| Check size matching | Range overlap | ✅ |
| Data completeness | Field presence count | ✅ |
| Outreach readiness | Multi-signal scoring | ✅ |
| Fit scoring | Weighted composite | ✅ |
| CSV import | Column mapping + parsing | ✅ |
| Dedup detection | Multi-phase matching | ✅ |

### What Uses AI (Built)

| Component | Model | Status |
|-----------|-------|--------|
| Email drafting | NVIDIA Nemotron 49B | ✅ |
| Investor research | NVIDIA Nemotron 49B | ✅ |
| Fit analysis | NVIDIA Nemotron 49B | ✅ |
| Thesis interpretation | NVIDIA Nemotron 49B | ✅ |

### What Needs Building

| Component | Approach | Priority |
|-----------|----------|----------|
| Change detection | SQL trigger + service | High |
| Source conflict resolution | Rules (recency + confidence) | High |
| Merge logic | Deterministic field merge | High |
| Batch dedup (full DB) | Algorithm + rules | High |
| Data freshness scoring | Time-based decay | Medium |
| Role normalization | Title parsing rules | Medium |
| tsvector search | PostgreSQL GIN index | Medium |

---

## G. EMAIL ARCHITECTURE

### What's Built (Complete)

| Component | Status |
|-----------|--------|
| Google OAuth initiation | ✅ `/api/auth/google` |
| Google OAuth callback | ✅ `/api/auth/google/callback` |
| Microsoft OAuth initiation | ✅ `/api/auth/microsoft` |
| Microsoft OAuth callback | ✅ `/api/auth/microsoft/callback` |
| Token encryption | ✅ AES-256-GCM |
| Token refresh | ✅ Auto-refresh on expiry |
| Gmail API sending | ✅ MIME message construction |
| Microsoft Graph sending | ✅ Graph API sendMail |
| Email message logging | ✅ `email_messages` table |
| Email account management | ✅ Settings page UI |
| Reply detection | ✅ In-Reply-To header matching |
| Rate limiting | ✅ Per-endpoint limits |

### What's Missing

1. **Email sync/polling** — No background job to poll for new replies
2. **Inbox connection UI** — Settings shows connected accounts but no "sync inbox" feature
3. **Webhook endpoint** — For real-time reply notifications (Gmail push, Microsoft webhook)
4. **Email open tracking** — Pixel tracking not implemented
5. **Email thread view** — `email_threads` table exists but no UI

---

## H. AI OUTREACH

### What's Built (Complete)

| Component | Status |
|-----------|--------|
| Tone picker (5 options) | ✅ |
| Custom AI instructions | ✅ |
| Individual email generation | ✅ |
| Bulk email generation | ✅ |
| Regenerate with different tone | ✅ |
| Approve → Send workflow | ✅ |
| Email sent logging | ✅ |
| Campaign creation wizard | ✅ |
| Campaign detail with investor list | ✅ |

### What's Missing

1. **Investor context in prompts** — AI doesn't see the investor's full profile, investment history, or recent activity when drafting
2. **Pitch deck attachment** — Can't attach decks to outreach emails
3. **Follow-up sequencing** — No multi-step drip campaigns
4. **A/B testing** — No way to test different email approaches
5. **Email analytics** — Open rates, click rates not tracked

---

## I. SECURITY MODEL

### What's Built

| Component | Status |
|-----------|--------|
| Supabase Auth | ✅ |
| RLS on all tables | ✅ |
| User-isolated email accounts | ✅ |
| User-isolated email messages | ✅ |
| Token encryption (AES-256-GCM) | ✅ |
| OAuth (official provider flows) | ✅ |
| Rate limiting | ✅ |
| Service role isolation | ✅ |

### What's Missing

1. **Audit logging** — `admin_audit_log` table exists but never written to
2. **File access control** — Deck attachments not validated
3. **Data retention policy** — No TTL on old records
4. **Abuse prevention** — No email sending limits per user
5. **CSRF protection** — Not explicitly implemented on OAuth callbacks

---

## J. DEVELOPMENT PHASES

### Phase 1 — Data Foundation (MOSTLY DONE ✅)

| Item | Status |
|------|--------|
| Core database schema | ✅ |
| Investor, Firm, Employment tables | ✅ |
| Data sources, Change log tables | ✅ |
| Raw records staging table | ✅ |
| Duplicate candidates table | ✅ |
| CSV import pipeline | ✅ |
| Column mapping engine | ✅ |
| Normalization (stages, sectors, countries) | ✅ |
| Basic entity resolution | ✅ |
| RLS policies | ✅ |
| Auto-update triggers | ✅ |

**Remaining for Phase 1:**
- [ ] Add `fit_score_breakdown` JSONB column to investors
- [ ] Add `role_normalized` column to investors
- [ ] Add `display_name` column to email_accounts
- [ ] Populate `investor_data_sources` during ingestion
- [ ] Populate `firm_aliases` during firm creation

### Phase 2 — Cleaning & Deduplication (70% DONE)

| Item | Status |
|------|--------|
| Multi-signal matching engine | ✅ |
| Email exact matching | ✅ |
| LinkedIn exact matching | ✅ |
| Name fuzzy matching (Levenshtein) | ✅ |
| Email domain matching | ✅ |
| Firm name matching | ✅ |
| Batch duplicate detection | ✅ (basic) |
| Duplicate candidates queue | ✅ (table only) |

**Remaining for Phase 2:**
- [ ] Build duplicate review UI page (`/dashboard/data/duplicates`)
- [ ] Implement merge logic (combine two investor records)
- [ ] Add employment history to matching signals
- [ ] Improve batch dedup to use full signal matching (not just email)
- [ ] Add organization resolution via `firm_aliases`
- [ ] Add merge undo capability

### Phase 3 — Verification & Change Tracking (30% DONE)

| Item | Status |
|------|--------|
| `data_change_log` table | ✅ |
| `log_data_change()` function | ✅ |
| `investor_data_sources` table | ✅ |
| Reply detection service | ✅ |

**Remaining for Phase 3:**
- [ ] Build automatic change detection (compare new vs existing on update)
- [ ] Populate `investor_data_sources` during all writes
- [ ] Build source conflict resolution (recency + confidence weighting)
- [ ] Build investor history UI (`/dashboard/investors/[id]/history`)
- [ ] Add data freshness scoring (days since last verification)
- [ ] Add `last_verified_at` tracking

### Phase 4 — Investor Intelligence & Qualification (90% DONE)

| Item | Status |
|------|--------|
| Deterministic fit scoring | ✅ |
| 7-factor scoring model | ✅ |
| Batch qualification pipeline | ✅ |
| AI-enhanced fit analysis | ✅ |
| Outreach readiness scoring | ✅ |
| Data quality scoring | ✅ |
| Discover page with Analyze Fit | ✅ |
| Fit analysis API | ✅ |
| 1M+ investors seeded | ✅ |

**Remaining for Phase 4:**
- [ ] Run bulk qualification SQL on all 1M+ investors
- [ ] Add `search_vector` tsvector + GIN index for fast search
- [ ] Wire firm normalization to enrichment pipeline

### Phase 5 — Investor Search & Review (80% DONE)

| Item | Status |
|------|--------|
| Investor database page | ✅ |
| Discover page with filters | ✅ |
| Quick filters (sector, stage, geo) | ✅ |
| Free-text search | ✅ |
| Investor detail page | ✅ |
| Saved investors page | ✅ |
| Fit score display | ✅ |
| Analytics dashboard with charts | ✅ |

**Remaining for Phase 5:**
- [ ] Add tsvector-powered search for better text matching
- [ ] Build duplicate review UI
- [ ] Build investor change history view
- [ ] Build data health dashboard (admin)

### Phase 6 — Email Integration (95% DONE)

| Item | Status |
|------|--------|
| Google OAuth flow | ✅ |
| Microsoft OAuth flow | ✅ |
| Token encryption | ✅ |
| Token auto-refresh | ✅ |
| Gmail API sending | ✅ |
| Microsoft Graph sending | ✅ |
| Email message logging | ✅ |
| Settings page with connect/disconnect | ✅ |
| Rate limiting | ✅ |

**Remaining for Phase 6:**
- [ ] Build email thread view UI
- [ ] Add email sync/polling for replies
- [ ] Add email open tracking (pixel)
- [ ] Add email sending limits per user

### Phase 7 — AI-Assisted Outreach (85% DONE)

| Item | Status |
|--------|--------|
| AI email drafting (5 tones) | ✅ |
| Custom AI instructions | ✅ |
| Bulk email generation | ✅ |
| Approve → Send workflow | ✅ |
| Campaign creation wizard | ✅ |
| Campaign detail page | ✅ |
| Campaign status management | ✅ |
| Investor research API | ✅ |

**Remaining for Phase 7:**
- [ ] Enrich AI prompts with full investor profile + history
- [ ] Add pitch deck attachment to outreach emails
- [ ] Build follow-up sequencing (multi-step drip)
- [ ] Build email thread/conversation view

### Phase 8 — Automation & Optimization (20% DONE)

| Item | Status |
|------|--------|
| Background jobs table | ✅ |
| Credit tracking | ✅ |
| Billing abstraction | ✅ |
| Analytics with Recharts | ✅ |

**Remaining for Phase 8:**
- [ ] Build email sync background worker
- [ ] Build auto-enrichment on import
- [ ] Build scheduled deduplication
- [ ] Build A/B testing for emails
- [ ] Build email analytics (open/click rates)
- [ ] Build investor movement alerts
- [ ] Build warm intro routing

---

## IMMEDIATE NEXT STEPS (What to Build Now)

### Priority 1 — Run Bulk Qualification
Run the `score_investors_bulk()` SQL function on all 1M+ investors so every record has fit scores, outreach readiness, and data quality.

### Priority 2 — Database Enhancements
Add missing columns: `fit_score_breakdown`, `role_normalized`, `search_vector`, `display_name`.

### Priority 3 — Duplicate Review UI
Build `/dashboard/data/duplicates` page where users can approve/reject/merge duplicate candidates.

### Priority 4 — Merge Logic
Build the actual merge function that combines two investor records into one, preserving history.

### Priority 5 — Change Detection
Build automatic change detection that logs modifications when investor data is updated.

### Priority 6 — tsvector Search
Add PostgreSQL full-text search for better investor search performance.

### Priority 7 — Source Provenance
Wire `investor_data_sources` to populate during every data write.

### Priority 8 — Investor History UI
Build `/dashboard/investors/[id]/history` to show the change log and data sources for each investor.
