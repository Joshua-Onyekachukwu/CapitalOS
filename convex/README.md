# Convex Data Layer

This directory contains the Convex schema and configuration for the raw investor staging layer.

## Purpose

Convex stores **raw, unqualified scraped investors** before they are promoted to Supabase. This keeps the Supabase free tier from being overwhelmed by:

- Incomplete/duplicate records
- Low-quality scraped data
- Records that haven't been validated yet

## Schema

### `raw_investors`
Raw scraped investor records with processing status tracking.

### `pipeline_runs`
Tracks qualification pipeline runs (dedup, normalize, enrich, score, qualify, sync).

### `sync_log`
Tracks which records have been synced to Supabase.

### `scrape_jobs`
Tracks scraping runs and their results.

## Setup

```bash
# Install Convex CLI
npm install -g convex

# Initialize Convex project
npx convex init

# Push schema
npx convex push

# Run dev server
npx convex dev
```

## Data Flow

```
Scraper → Convex (raw_investors) → Pipeline → Supabase (investors)
                                                    ↓
                                            Production Data
```

1. **Scrape**: Data is scraped and stored in Convex as raw_investors
2. **Deduplicate**: Remove duplicates within Convex
3. **Normalize**: Clean and standardize fields
4. **Enrich**: Add missing data (emails, titles, etc.)
5. **Score**: Calculate data quality and fit scores
6. **Qualify**: Apply qualification rules
7. **Sync**: Promote qualified records to Supabase

## Environment Variables

```
CONVEX_DEPLOY_KEY=<your-convex-deploy-key>
NEXT_PUBLIC_CONVEX_URL=<your-convex-url>
```
