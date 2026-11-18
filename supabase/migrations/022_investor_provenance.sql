-- ============================================================================
-- 022 — Investor evidence grading (corrected)
--
-- WHY
--   An audit of the live corpus found attributes that were bulk-filled by the
--   import and are indistinguishable from observations:
--
--     * 12,067 investors carry exactly investment_stages = '{seed,series_a}'.
--       Every one is EDGAR-derived, a constant across the whole import.
--     * 12,202 investors carry is_verified = true while email_verified = false
--       on ALL 18,995 rows. Nothing was verified; the import set the flag.
--     * min_check_size / max_check_size / investment_thesis: zero records. The
--       keys exist in raw_records.raw_data but were never filled, so this is
--       absent data, not a mapping failure.
--
--   The schema already had a verification vocabulary —
--   verification_status IN ('verified','derived','ai_classified','unknown')
--   and a provenance JSONB column — so this migration uses that vocabulary
--   rather than introducing a parallel one.
--
-- NOTE ON HISTORY
--   A first attempt at this migration assumed those columns did not exist and
--   used `WHERE verification_status IS NULL` guards. Since the column is
--   NOT NULL with default 'unknown', those clauses matched zero rows: the file
--   reported success while changing nothing. The ledger entry was removed and
--   the file rewritten. Guards below test the real values, not NULL.
--
-- Idempotent.
-- ============================================================================

SET statement_timeout = 0;

-- The last_verified_at backfill joins raw_records by matched_investor_id.
CREATE INDEX IF NOT EXISTS idx_raw_records_matched_investor
  ON public.raw_records(matched_investor_id);

-- ── 1. last_verified_at from the source record ─────────────────────────────
UPDATE public.investors i
SET last_verified_at = (rr.raw_data->>'last_verified_at')::timestamptz
FROM public.raw_records rr
WHERE rr.matched_investor_id = i.id
  AND rr.raw_data->>'last_verified_at' IS NOT NULL
  AND i.last_verified_at IS NULL;

-- ── 2. Record why the bulk stage default is not a stated preference ───────
UPDATE public.investors
SET provenance = provenance || jsonb_build_object(
      'investment_stages',
      jsonb_build_object(
        'status', 'derived',
        'source', 'edgar_import',
        'reason', 'Constant written across the entire EDGAR import; identical on every record, so it is not a stated stage preference.',
        'default_value', to_jsonb(ARRAY['seed','series_a'])
      )
    )
WHERE investment_stages::text = '{seed,series_a}'
  AND provenance->'investment_stages' IS NULL;

-- ── 3. is_verified with no verification evidence is downgraded ────────────
-- 12,202 rows had is_verified = true purely because the import set it.
-- Anything without an independent attestation is 'unknown', and the flag is
-- cleared so scoring and badges stop treating it as evidence.
UPDATE public.investors
SET is_verified = false,
    verification_status = 'unknown',
    provenance = provenance || jsonb_build_object(
      'is_verified',
      jsonb_build_object(
        'status', 'derived',
        'reason', 'Bulk-set by the import; no per-record attestation exists in the data.',
        'was', true
      )
    )
WHERE is_verified = true
  AND email_verified IS NOT TRUE
  AND provenance->'is_verified' IS NULL;

-- ── 4. IAPD type classification is inferred, not observed ─────────────────
UPDATE public.investors
SET provenance = provenance || jsonb_build_object(
      'investor_type',
      jsonb_build_object(
        'status', 'ai_classified',
        'source', 'iapd_filing_category',
        'reason', 'IAPD registrant; type assigned from filing category rather than stated investment activity.'
      )
    )
WHERE source_provider = 'iapd'
  AND provenance->'investor_type' IS NULL;

-- ── 5. Absent attributes recorded as absent, not left ambiguous ───────────
UPDATE public.investors
SET provenance = provenance || jsonb_build_object(
      'check_size',
      jsonb_build_object(
        'status', 'absent',
        'reason', 'No cheque size exists for any record in the corpus; the source never supplied it.'
      )
    )
WHERE min_check_size IS NULL
  AND max_check_size IS NULL
  AND provenance->'check_size' IS NULL;

UPDATE public.investors
SET provenance = provenance || jsonb_build_object(
      'investment_thesis',
      jsonb_build_object(
        'status', 'absent',
        'reason', 'No investment thesis exists for any record in the corpus; the source never supplied it.'
      )
    )
WHERE investment_thesis IS NULL
  AND provenance->'investment_thesis' IS NULL;

CREATE INDEX IF NOT EXISTS idx_investors_verification_status
  ON public.investors(verification_status);

-- Apply-time report, so the effect is auditable rather than assumed.
DO $$
DECLARE
  v_verified INTEGER; v_derived INTEGER; v_ai INTEGER; v_unknown INTEGER;
  v_isv INTEGER; v_check INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_verified FROM public.investors WHERE verification_status = 'verified';
  SELECT COUNT(*) INTO v_derived  FROM public.investors WHERE verification_status = 'derived';
  SELECT COUNT(*) INTO v_ai       FROM public.investors WHERE verification_status = 'ai_classified';
  SELECT COUNT(*) INTO v_unknown  FROM public.investors WHERE verification_status = 'unknown';
  SELECT COUNT(*) INTO v_isv      FROM public.investors WHERE is_verified;
  SELECT COUNT(*) INTO v_check    FROM public.investors
    WHERE min_check_size IS NULL AND max_check_size IS NULL;

  RAISE NOTICE 'verification_status: % verified, % derived, % ai_classified, % unknown',
    v_verified, v_derived, v_ai, v_unknown;
  RAISE NOTICE 'is_verified=true after downgrade: %', v_isv;
  RAISE NOTICE 'records with no cheque size (absent upstream): %', v_check;
END $$;
