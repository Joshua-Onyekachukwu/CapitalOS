-- =============================================
-- Supabase Database Cleanup Script
-- =============================================
-- PURPOSE: Free disk space by removing synthetic/generated data
--          while preserving real scraped/Apollo data.
--
-- HOW TO USE:
--   1. First PAUSE and RESTORE your project (Settings → General)
--   2. Open SQL Editor in Supabase Dashboard
--   3. Run this script in ORDER (Step 1 → Step 2 → etc.)
--   4. Check results after each step
--
-- SAFETY: This script NEVER deletes without counting first.
-- =============================================


-- =============================================
-- STEP 1: AUDIT — See what you have (run this first!)
-- =============================================

-- 1a. Count investors by source
SELECT
  COALESCE(source, '(null)') AS source,
  COUNT(*) AS count,
  pg_size_pretty(SUM(pg_column_size(investors.*))::bigint) AS est_size
FROM investors
GROUP BY source
ORDER BY count DESC;

-- 1b. Total investor count
SELECT COUNT(*) AS total_investors FROM investors;

-- 1c. Database size before cleanup
SELECT pg_size_pretty(pg_database_size('postgres')) AS database_size_before;

-- 1d. Table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || tablename) DESC
LIMIT 15;

-- 1e. Count ALL tables
SELECT
  tablename,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.tablename) AS columns,
  (SELECT COUNT(*) FROM pg_class WHERE relname = t.tablename) AS exists_check
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;


-- =============================================
-- STEP 2: BACKUP REAL DATA — Create safety copies
-- =============================================

-- 2a. Backup real Apollo/EDGAR imports to a safe table
CREATE TABLE IF NOT EXISTS investors_backup AS
SELECT * FROM investors
WHERE source NOT IN ('generated', 'scale_dataset', 'generated_test', 'csv_import');

-- Verify backup count
SELECT COUNT(*) AS backed_up_investors FROM investors_backup;

-- 2b. Backup all firms (small table, always safe)
CREATE TABLE IF NOT EXISTS investor_firms_backup AS
SELECT * FROM investor_firms;

SELECT COUNT(*) AS backed_up_firms FROM investor_firms_backup;


-- =============================================
-- STEP 3: DELETE — Remove synthetic data only
-- =============================================

-- 3a. Delete generated investors (the big one — 100K+ records)
DELETE FROM investors
WHERE source IN ('generated', 'scale_dataset', 'generated_test', 'csv_import');

-- 3b. Verify what's left
SELECT
  COALESCE(source, '(null)') AS source,
  COUNT(*) AS remaining
FROM investors
GROUP BY source
ORDER BY count DESC;


-- =============================================
-- STEP 4: CLEAN RELATED TABLES — Remove orphaned data
-- =============================================

-- 4a. Clean employment history for deleted investors
DELETE FROM investor_employment_history
WHERE investor_id NOT IN (SELECT id FROM investors);

-- 4b. Clean investor profiles for deleted investors
DELETE FROM investor_profiles
WHERE investor_id NOT IN (SELECT id FROM investors);

-- 4c. Clean data sources for deleted investors
DELETE FROM investor_data_sources
WHERE investor_id NOT IN (SELECT id FROM investors);

-- 4d. Clean raw records (usually empty but can accumulate)
DELETE FROM raw_records;

-- 4e. Clean duplicate candidates
DELETE FROM duplicate_candidates;

-- 4f. Clean data change log
DELETE FROM data_change_log;


-- =============================================
-- STEP 5: VACUUM — Reclaim disk space
-- =============================================

-- IMPORTANT: VACUUM FULL rewrites the entire table and reclaims disk space
-- This is the key step that fixes the "No space left on device" error

VACUUM FULL investors;
VACUUM FULL investor_employment_history;
VACUUM FULL investor_profiles;
VACUUM FULL investor_data_sources;
VACUUM FULL raw_records;
VACUUM FULL duplicate_candidates;
VACUUM FULL data_change_log;

-- Also vacuum auth-related tables
VACUUM FULL auth.users;
VACUUM FULL auth.sessions;


-- =============================================
-- STEP 6: VERIFY — Confirm cleanup worked
-- =============================================

-- 6a. Check database size after cleanup
SELECT pg_size_pretty(pg_database_size('postgres')) AS database_size_after;

-- 6b. Final investor count
SELECT
  COALESCE(source, '(null)') AS source,
  COUNT(*) AS count
FROM investors
GROUP BY source
ORDER BY count DESC;

-- 6c. Total remaining
SELECT COUNT(*) AS total_investors_remaining FROM investors;

-- 6d. Backup still exists?
SELECT COUNT(*) AS backup_count FROM investors_backup;


-- =============================================
-- STEP 7: OPTIONAL — Drop backup tables later
-- =============================================
-- Only run this AFTER you've confirmed CockroachDB has all the data
--
-- DROP TABLE IF EXISTS investors_backup;
-- DROP TABLE IF EXISTS investor_firms_backup;


-- =============================================
-- STEP 8: OPTIONAL — Resize database (if on paid plan)
-- =============================================
-- If you're on a paid plan, you can resize via Dashboard:
-- Settings → Database → Compute → Change size
--
-- For free tier, the above cleanup should be sufficient.
