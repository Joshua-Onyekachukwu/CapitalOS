# Investor Data Qualification Runbook

How the Capital OS investor dataset is cleaned, enriched, qualified, and
kept evidence-backed. Repeatable end-to-end; the core pass is fully
deterministic (no AI), so results are reproducible and auditable.

## Current state (2026-09-28 run)

- Source: SEC EDGAR 13F-HR filers (`source = edgar_restore_2026_09`,
  `source_id` = SEC CIK, 10-digit zero-padded).
- 12,203 records; 12,202 SEC-verified (`verification_status = 'verified'`,
  `is_verified = true`), 1 archived (merged duplicate).
- Evidence captured per record: business city/state, last 13F-HR filing
  date, registrant-normalized name (`name_normalized`),
  `last_verified_at`, `record_status`.
- Activity split (evidence-based): 8,654 filed a 13F-HR in the last 12
  months; ~1,504 last filed pre-2020 (likely dormant, scored 25 on
  activity, never deleted).
- SIC industry present for only ~264 rows (SEC blanks it for most 13F
  filers) — those columns stay honestly null rather than being inferred.
- Qualification: deterministic multi-factor scorer; activity factor now
  consumes `edgar_last_filing_date` (100 for <120d, 80 for <420d, 55 for
  <730d, 25 likely-dormant beyond). Dataset avg fit 59 → 64 after
  enrichment. 0 investors marked "ready for outreach" — correct, because
  the dataset contains no contact data; the scorer will not fake readiness.

## Repeatable procedure

```bash
# 0. Snapshot before touching anything (gzip JSONL + SHA-256, read-only)
node scripts/snapshot-investors.cjs

# 1. Clean + enrich against the SEC submissions API (rate-limited ~9 req/s,
#    resumable — the unprocessed set is `last_verified_at IS NULL`, so an
#    interrupted run resumes exactly where it stopped)
node scripts/enrich-edgar.cjs --limit 1000        # repeat until Summary rows=0
node scripts/enrich-edgar.cjs --limit 1000 --force # re-verify known rows

# 2. Re-qualify (production UI as an authenticated founder, 13 pages)
#    Dashboard → Fit Analysis → Run Fit Analysis (loops automatically)

# 3. Duplicates (admin): /admin/intelligence → Scan Duplicates → review queue
#    merges are confirmed + audited (audit_log), never automatic

# 4. Verify: /admin/intelligence (storage meter, provenance counts, dup queue)
```

## Rules embedded in the pipeline

- **Unknown stays unknown.** Fields SEC doesn't answer (SIC, sectors,
  check sizes, emails) remain null — no fabrication, no AI guessing.
- **Quarantine, never delete.** Invalid CIKs / dead registrants get
  `record_status = 'needs_review'`; garbage data is flagged, not destroyed.
- **Evidence or it didn't happen.** Every enriched row carries
  `verification_status`, `last_verified_at`, and structured EDGAR fields
  traceable to `https://data.sec.gov/submissions/CIK##########.json`.
- **Location ≠ investment geography.** EDGAR address is HQ location;
  `investment_geographies` is a separate claim requiring separate evidence.
- **Merges are reversible.** The losing duplicate is deactivated
  (`is_active = false`), never deleted; references are re-pointed to the
  keeper; every merge writes to `audit_log`.

## Next pass (when a source with contact data is added)

The two missing columns that block outreach are `email` (0/12,203) and
sector thesis. Priority sources: Apollo/Greyhill (emails, sectors, AUM),
firm websites (thesis pages). Any enrichment must follow the same
contract: per-field evidence, verification classes, dedup keys
(`name_normalized`), rate limiting, and a fresh snapshot first.
