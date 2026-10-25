-- Migration 013: analytics_distributions_rpc (applied live 2026-09-30)
-- Exact analytics distributions in one roundtrip. Replaces the client-side
-- "sample of 100 investors" approximation on /dashboard/analytics.

CREATE OR REPLACE FUNCTION public.get_analytics_distributions()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active AS (SELECT * FROM investors WHERE is_active)
  SELECT jsonb_build_object(
    'totals', jsonb_build_object(
      'active',        (SELECT count(*)::int FROM active),
      'withEmail',     (SELECT count(*)::int FROM active WHERE email IS NOT NULL AND email <> ''),
      'withLinkedIn',  (SELECT count(*)::int FROM active WHERE linkedin_url IS NOT NULL AND linkedin_url <> ''),
      'highFit',       (SELECT count(*)::int FROM active WHERE fit_score >= 80),
      'avgFit',        (SELECT coalesce(round(avg(fit_score))::int, 0) FROM active WHERE fit_score > 0)
    ),
    'sectors', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('sector', s, 'count', c) ORDER BY c DESC), '[]'::jsonb)
      FROM (SELECT u.sector AS s, count(*)::int AS c FROM active a, unnest(a.investment_sectors) u(sector)
            GROUP BY u.sector ORDER BY c DESC LIMIT 8) x
    ),
    'countries', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('country', ctry, 'count', c) ORDER BY c DESC), '[]'::jsonb)
      FROM (SELECT a.country AS ctry, count(*)::int AS c FROM active a
            WHERE a.country IS NOT NULL AND a.country <> ''
            GROUP BY a.country ORDER BY c DESC LIMIT 8) x
    ),
    'types', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('type', t, 'count', c) ORDER BY c DESC), '[]'::jsonb)
      FROM (SELECT a.investor_type::text AS t, count(*)::int AS c FROM active a
            GROUP BY a.investor_type ORDER BY c DESC LIMIT 10) x
    ),
    'readiness', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('stage', r, 'count', c) ORDER BY c DESC), '[]'::jsonb)
      FROM (SELECT a.outreach_readiness::text AS r, count(*)::int AS c FROM active a
            GROUP BY a.outreach_readiness ORDER BY c DESC) x
    ),
    'fitBuckets', jsonb_build_array(
      jsonb_build_object('range','0-20',  'count',(SELECT count(*)::int FROM active WHERE fit_score BETWEEN 0 AND 20)),
      jsonb_build_object('range','21-40', 'count',(SELECT count(*)::int FROM active WHERE fit_score BETWEEN 21 AND 40)),
      jsonb_build_object('range','41-60', 'count',(SELECT count(*)::int FROM active WHERE fit_score BETWEEN 41 AND 60)),
      jsonb_build_object('range','61-80', 'count',(SELECT count(*)::int FROM active WHERE fit_score BETWEEN 61 AND 80)),
      jsonb_build_object('range','81-100','count',(SELECT count(*)::int FROM active WHERE fit_score BETWEEN 81 AND 100))
    ),
    'weekly', (
      SELECT coalesce(jsonb_agg(jsonb_build_object('week', w, 'count', c) ORDER BY w), '[]'::jsonb)
      FROM (
        SELECT to_char(date_trunc('week', min(created_at)), 'MM-DD') AS w, count(*)::int AS c
        FROM active
        WHERE created_at >= date_trunc('week', now()) - interval '7 weeks'
        GROUP BY date_trunc('week', created_at)
      ) x
    )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.get_analytics_distributions() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_distributions() TO authenticated, service_role;
