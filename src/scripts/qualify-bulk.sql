-- =============================================
-- Capital OS — Pure SQL Bulk Scoring (FAST)
-- =============================================
-- Scores ALL unscored investors in ONE UPDATE statement.
-- No cursors, no loops — just pure set-based SQL.
-- Run in Supabase SQL Editor.
-- =============================================

UPDATE public.investors
SET 
  -- Data quality score (0-100 based on field completeness)
  data_quality_score = LEAST(100, (
    (CASE WHEN email IS NOT NULL THEN 12 ELSE 0 END) +
    (CASE WHEN linkedin_url IS NOT NULL THEN 12 ELSE 0 END) +
    (CASE WHEN job_title IS NOT NULL THEN 12 ELSE 0 END) +
    (CASE WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 12 ELSE 0 END) +
    (CASE WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 12 ELSE 0 END) +
    (CASE WHEN bio IS NOT NULL AND length(bio) > 0 THEN 13 ELSE 0 END) +
    (CASE WHEN country IS NOT NULL THEN 13 ELSE 0 END) +
    (CASE WHEN city IS NOT NULL THEN 13 ELSE 0 END)
  )),

  -- Outreach readiness
  outreach_readiness = CASE
    WHEN do_not_contact = true THEN 'do_not_contact'::outreach_readiness
    WHEN (
      (CASE WHEN email IS NOT NULL THEN 30 ELSE 0 END) +
      (CASE WHEN linkedin_url IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN is_verified = true THEN 15 ELSE 0 END) +
      (CASE WHEN bio IS NOT NULL AND length(bio) > 50 THEN 10 ELSE 0 END)
    ) >= 70 THEN 'ready'::outreach_readiness
    WHEN (
      (CASE WHEN email IS NOT NULL THEN 30 ELSE 0 END) +
      (CASE WHEN linkedin_url IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN is_verified = true THEN 15 ELSE 0 END) +
      (CASE WHEN bio IS NOT NULL AND length(bio) > 50 THEN 10 ELSE 0 END)
    ) >= 40 THEN 'needs_verification'::outreach_readiness
    ELSE 'not_ready'::outreach_readiness
  END,

  -- Fit score (weighted combination)
  fit_score = ROUND(
    -- Sector match (25%) — simplified: check array overlap
    (CASE 
      WHEN investment_sectors @> ARRAY['saas'] OR investment_sectors @> ARRAY['enterprise'] OR investment_sectors @> ARRAY['b2b'] THEN 100
      WHEN investment_sectors && ARRAY['ai','ml','datascience'] THEN 85
      WHEN investment_sectors && ARRAY['fintech','payments','banking'] THEN 85
      WHEN investment_sectors && ARRAY['saas','enterprise','b2b','software','cloud','devtools'] THEN 85
      WHEN investment_sectors && ARRAY['healthtech','healthcare','biotech'] THEN 85
      WHEN investment_sectors && ARRAY['consumer','b2c','marketplace','ecommerce'] THEN 85
      WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 50
      ELSE 30
    END * 0.25) +

    -- Stage match (20%) — check if includes seed
    (CASE
      WHEN investment_stages @> ARRAY['seed']::investment_stage[] THEN 100
      WHEN investment_stages && ARRAY['pre_seed']::investment_stage[] THEN 75
      WHEN investment_stages && ARRAY['series_a']::investment_stage[] THEN 75
      WHEN investment_stages && ARRAY['series_b']::investment_stage[] THEN 40
      WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 50
      ELSE 40
    END * 0.20) +

    -- Geography match (15%) — US default
    (CASE
      WHEN lower(country) = 'united states' THEN 100
      WHEN investment_geographies && ARRAY['United States'] THEN 100
      WHEN investment_geographies && ARRAY['Global'] THEN 90
      WHEN country IS NOT NULL THEN 30
      ELSE 40
    END * 0.15) +

    -- Check size (10%)
    (CASE WHEN min_check_size IS NOT NULL OR max_check_size IS NOT NULL THEN 70 ELSE 50 END * 0.10) +

    -- Data completeness (10%)
    (LEAST(100, (
      (CASE WHEN email IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN linkedin_url IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN job_title IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 12 ELSE 0 END) +
      (CASE WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 12 ELSE 0 END) +
      (CASE WHEN bio IS NOT NULL AND length(bio) > 0 THEN 13 ELSE 0 END) +
      (CASE WHEN country IS NOT NULL THEN 13 ELSE 0 END) +
      (CASE WHEN city IS NOT NULL THEN 13 ELSE 0 END)
    )) * 0.10) +

    -- Contactability (10%)
    (LEAST(100, (
      (CASE WHEN email IS NOT NULL THEN 30 ELSE 0 END) +
      (CASE WHEN linkedin_url IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN is_verified = true THEN 15 ELSE 0 END) +
      (CASE WHEN bio IS NOT NULL AND length(bio) > 50 THEN 10 ELSE 0 END)
    )) * 0.10) +

    -- Activity (5%) — default 50
    (50 * 0.05) +

    -- Profile depth (5%)
    (CASE 
      WHEN bio IS NOT NULL AND length(bio) > 50 THEN 80
      WHEN bio IS NOT NULL THEN 40
      ELSE 20
    END * 0.05)
  ),

  -- Fit score breakdown (JSONB)
  fit_score_breakdown = jsonb_build_object(
    'factors', jsonb_build_array(
      jsonb_build_object('factor', 'Sector Match', 'weight', 0.25),
      jsonb_build_object('factor', 'Stage Match', 'weight', 0.20),
      jsonb_build_object('factor', 'Geography Match', 'weight', 0.15),
      jsonb_build_object('factor', 'Check Size Fit', 'weight', 0.10),
      jsonb_build_object('factor', 'Data Completeness', 'weight', 0.10),
      jsonb_build_object('factor', 'Contactability', 'weight', 0.10),
      jsonb_build_object('factor', 'Recent Activity', 'weight', 0.05),
      jsonb_build_object('factor', 'Profile Depth', 'weight', 0.05)
    ),
    'confidence', LEAST(100, (
      (CASE WHEN email IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN linkedin_url IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN job_title IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 12 ELSE 0 END) +
      (CASE WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 12 ELSE 0 END) +
      (CASE WHEN bio IS NOT NULL AND length(bio) > 0 THEN 13 ELSE 0 END) +
      (CASE WHEN country IS NOT NULL THEN 13 ELSE 0 END) +
      (CASE WHEN city IS NOT NULL THEN 13 ELSE 0 END)
    )),
    'dataQuality', LEAST(100, (
      (CASE WHEN email IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN linkedin_url IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN job_title IS NOT NULL THEN 12 ELSE 0 END) +
      (CASE WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 12 ELSE 0 END) +
      (CASE WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 12 ELSE 0 END) +
      (CASE WHEN bio IS NOT NULL AND length(bio) > 0 THEN 13 ELSE 0 END) +
      (CASE WHEN country IS NOT NULL THEN 13 ELSE 0 END) +
      (CASE WHEN city IS NOT NULL THEN 13 ELSE 0 END)
    ))
  )

WHERE fit_score = 0 OR fit_score IS NULL;

-- Verify results
SELECT 
  outreach_readiness,
  COUNT(*) as count,
  ROUND(AVG(fit_score), 1) as avg_fit
FROM public.investors
WHERE fit_score > 0
GROUP BY outreach_readiness
ORDER BY count DESC;
