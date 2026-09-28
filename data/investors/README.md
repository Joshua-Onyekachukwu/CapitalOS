# Investor Data Archive (durable layer outside Supabase)

Supabase holds the **compact, application-facing dataset** (12k+ investor
rows ≈ 65 MB heap). This directory is the **durable archive** contract for
larger raw/normalized material that must survive independent of Supabase.

## Layout contract

```
data/investors/
  raw/          # source payloads as collected (JSONL, one source per file)
  normalized/   # canonical investor records derived from raw/
  qualified/    # qualification decisions + evidence references
  sources/      # source registry: URL, hash, last-crawled, record counts
  snapshots/    # dated full-dataset exports (JSONL) for point-in-time recovery
```

## Conventions

- **Format**: JSONL (newline-delimited JSON) everywhere. One JSON object per
  line — append-friendly, diff-friendly, stream-friendly.
- **Naming**: `<source>-<yyyymmdd>.jsonl` for raw; `investors-<yyyymmdd>.jsonl`
  for snapshots. Files are immutable once written; corrections are new files.
- **Git**: files up to a few MB may be committed. Anything larger goes to
  release assets or object storage — never commit bulk datasets into Git
  history. This directory documents the contract and holds small seeds only.
- **Deduplication**: every record carries `name_normalized` (output of the
  `normalize_investor_name()` SQL function) plus `source`, `source_id`, and
  `content_hash` (sha256 of the normalized source payload).

## Record shape (normalized)

```json
{
  "name_normalized": "acme ventures",
  "full_name": "Acme Ventures, LLC",
  "investor_type": "venture_capital",
  "investment_stages": ["seed", "series_a"],
  "investment_sectors": ["fintech"],
  "investment_geographies": ["United States"],
  "country": "United States",
  "website_url": "https://acme.vc",
  "source": "acme-website",
  "source_id": "acme-ventures-llc",
  "verification_status": "verified",
  "last_verified_at": "2026-09-28T00:00:00Z",
  "content_hash": "sha256:..."
}
```

`verification_status` is the facts-vs-inference boundary: `verified` =
directly supported by a source; `derived` = computed from verified fields;
`ai_classified` = model interpretation (always with evidence reference);
`unknown` = nothing verified.

## Reconstruction procedure (Supabase loss recovery)

1. Take the newest `snapshots/investors-<date>.jsonl`.
2. Regenerate the schema with the repo's `supabase-migration-*.sql` files
   (in date order) on a fresh Supabase project.
3. Stream the snapshot through the bulk loader (any JSONL reader →
   Supabase insert in 500-row chunks). `id` values are preserved so
   foreign keys (`saved_investors`, `duplicate_candidates`, pipeline
   entries) can be re-attached from later snapshots or rebuilt.
4. Recompute derived fields rather than restoring them where cheaper:
   `fit_score` via the batch scorer, `name_normalized` via
   `select normalize_investor_name(full_name)`.
5. Verify: row count matches the snapshot line count; spot-check
   `verification_status`/`source` distributions against the
   `/admin/intelligence` overview.

## Export path

The admin intelligence dashboard (`/admin/intelligence` → Export JSONL)
streams the current compact dataset as a dated snapshot file matching this
contract. Scheduled snapshots are a post-MVP cron addition; until then,
run an export before any large ingestion.
