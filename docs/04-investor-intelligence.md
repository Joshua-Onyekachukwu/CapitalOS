# Capital OS — Investor Intelligence System

## Overview

The Investor Intelligence System is the core data infrastructure of Capital OS. It transforms raw investor data from multiple sources into a **trusted, verified, scored, and searchable intelligence database**.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                               │
│                                                               │
│  CSV Upload · Apollo API · SEC EDGAR · Manual Entry           │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    INGESTION                                  │
│                                                               │
│  parseCsv() → csvRowToProviderResult() → normalizeInvestor() │
│                                                               │
│  Column auto-detection (20+ variants)                         │
│  Flexible CSV parsing (quotes, multi-delimiter)               │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    NORMALIZATION                              │
│                                                               │
│  Stage normalization: "series a" → "series_a"                │
│  Type normalization: "vc" → "venture_capital"                │
│  Sector normalization: "machine learning" → "ml"             │
│  Country normalization: "usa" → "United States"              │
│  Currency normalization: "$" → "USD"                          │
│                                                               │
│  File: src/lib/services/investor/normalization.ts             │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    ENTITY RESOLUTION                          │
│                                                               │
│  Multi-signal matching:                                       │
│    Email (exact) → Highest confidence                         │
│    LinkedIn URL (normalized) → High confidence                │
│    Name + Firm (fuzzy) → Medium confidence                    │
│    Source ID (provider-specific) → Exact match                │
│                                                               │
│  File: src/lib/services/investor/matching.ts                  │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    DEDUPLICATION                              │
│                                                               │
│  Confidence scoring:                                          │
│    ≥ 0.95 → Auto-merge                                       │
│    0.70-0.94 → Review queue                                  │
│    < 0.70 → Treat as new record                               │
│                                                               │
│  Intra-batch dedup (prevents duplicates within same import)   │
│  Cross-batch dedup (checks against existing DB records)       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    QUALIFICATION                              │
│                                                               │
│  Deterministic fit scoring (4 factors):                       │
│    Stage fit · Sector fit · Geography fit · Check size fit    │
│                                                               │
│  File: src/lib/services/investor/qualification.ts             │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│               CANONICAL INVESTOR RECORDS                      │
│                                                               │
│  Scored · Qualified · Searchable · Verified                   │
│  Source-provenanced · Change-tracked                          │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION                                │
│                                                               │
│  Search · Filters · Profiles · Outreach · Campaigns           │
└─────────────────────────────────────────────────────────────┘
```

## Data Sources

| Source | Volume | Access | Status |
|--------|--------|--------|--------|
| **CSV Upload** | Unlimited | Web UI + API | ✅ Built |
| **Apollo API** | 50K+ contacts | API key required | ✅ Built |
| **SEC EDGAR** | ~2,500/year Form D | Free public API | ✅ Built |
| **OpenVC** | 16K+ profiles | Behind Cloudflare | ❌ Blocked |

## Key Services

### `src/lib/services/investor/csv-import.ts`
- Parses CSV with flexible column detection
- Maps 20+ column name variants per field
- Deduplicates against existing DB
- Batch inserts 500 records at a time

### `src/lib/services/investor/normalization.ts`
- `normalizeInvestor()` — full normalization pipeline
- `normalizeStage()`, `normalizeInvestorType()`, `normalizeSector()`, `normalizeCountry()`
- `generateDeduplicationKeys()` — creates dedup keys from email, LinkedIn, source ID

### `src/lib/services/investor/matching.ts`
- `findMatchingInvestor()` — multi-signal entity resolution
- Compares email, LinkedIn, name+firm, source ID
- Returns confidence score (0-1) and match signals

### `src/lib/services/investor/qualification.ts`
- `qualifyInvestor()` — deterministic 4-factor scoring
- `batchQualify()` — process multiple investors
- Score breakdown: stage fit, sector fit, geography fit, check size fit

### `src/lib/services/investor/ingestion.ts`
- `runFullPipeline()` — CSV → raw_records → normalize → match → promote
- `stageRecords()` — insert into raw_records
- `processRawRecords()` — normalize + match pending records
- `promoteNewRecords()` — create canonical investor records

### `src/lib/services/scrapers/edgar.ts`
- Fetches Form D filings from SEC EDGAR
- Parses XML responses for fund names, locations, types
- Feeds into normalization pipeline

## Entity Resolution Strategy

### Same Person Detection

| Signal | Weight | Method |
|--------|--------|--------|
| Email (exact match) | Very High | Deterministic |
| LinkedIn URL (normalized) | High | Deterministic |
| Name + Firm combination | Medium | Fuzzy matching |
| Source ID (provider-specific) | Exact | Deterministic |
| Location overlap | Low |辅助 signal |

### Organization Matching

Firm names are normalized via `normalize_firm_name()` (PostgreSQL function):
- Lowercase
- Remove legal suffixes (LLC, Ltd, Inc, etc.)
- Collapse whitespace
- `firm_aliases` table tracks known aliases

### Confidence Thresholds

| Score | Action |
|-------|--------|
| ≥ 0.95 | Auto-merge (high confidence same person) |
| 0.70 - 0.94 | Queue for human review |
| < 0.70 | Treat as new record |

## Source Provenance

Every investor field can have a source record in `investor_data_sources`:

```
Field: email
Source: company website
Collected: 2026-08-22
Verified: 2026-08-22
Confidence: 0.95
```

When multiple sources provide conflicting information, the system evaluates:
- Source reliability
- Recency
- Agreement between sources
- Verification status

## Change Detection

All field changes are logged to `data_change_log`:
- Previous value
- New value
- Timestamp
- Source
- Confidence
- Change type (create/update/merge/delete/revert)
- Detection method

## Human Review System

Review queues exist for:
- **Duplicate candidates** (`/admin/review/duplicates`)
- **Low-confidence matches** (queued automatically)
- **Data conflicts** (multiple sources disagree)

Actions: Approve · Reject · Merge · Keep Separate · Edit

## Admin Interface

| Page | Purpose |
|------|---------|
| `/admin/data-sources/import` | CSV upload with drag & drop |
| `/admin/data-sources/scrape` | SEC EDGAR scraper + qualification trigger |
| `/admin/data-sources/apollo` | Apollo bulk import |
| `/admin/review/duplicates` | Duplicate review queue |
| `/admin/investors` | Investor management |
| `/admin/investor-firms` | Firm management |

---

*Last updated: August 22, 2026*
