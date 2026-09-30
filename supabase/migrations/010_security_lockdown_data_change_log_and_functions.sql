-- Security lockdown: cross-tenant data isolation hardening (test-user readiness pass)
--
-- F1: data_change_log had a SELECT policy USING (true) for all authenticated
--     users, exposing every user's private investor notes (field_name='note',
--     attributed via detected_by = user uuid as text). Notes are now
--     owner-scoped; system provenance rows (field_name <> 'note', written by
--     ingestion/dedup pipelines and containing no user-authored content)
--     remain visible so investor history/timeline UIs keep working.
--
-- F2: SECURITY DEFINER functions set_investor_embeddings(jsonb) and
--     link_investor_iapd(...) were executable by any anon/authenticated
--     caller and mutate the shared investors dataset. They are only invoked
--     by server-side service-role scripts, so EXECUTE is revoked from
--     anon/authenticated.
--
-- F3: INSERT policies on service-intended tables (audit_log,
--     email_health_events, email_health_scores) had WITH CHECK (true) TO
--     public, letting any JWT write telemetry rows. All writers are
--     service-role clients (which bypass RLS anyway); policies are now
--     explicitly TO service_role.

-- ── F1: data_change_log ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view change log" ON public.data_change_log;

CREATE POLICY "Users can view own notes" ON public.data_change_log
  FOR SELECT TO authenticated
  USING (field_name = 'note' AND detected_by = auth.uid()::text);

CREATE POLICY "Users can view system data provenance" ON public.data_change_log
  FOR SELECT TO authenticated
  USING (field_name <> 'note');

-- ── F2: pipeline SECURITY DEFINER functions ──────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.set_investor_embeddings(jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_investor_iapd(uuid, uuid, text, jsonb, text, text) FROM anon, authenticated;

-- ── F3: service-intended INSERT policies ─────────────────────────────────────
DROP POLICY IF EXISTS "Service can insert audit log" ON public.audit_log;
CREATE POLICY "Service role can insert audit log" ON public.audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can insert health events" ON public.email_health_events;
CREATE POLICY "Service role can insert health events" ON public.email_health_events
  FOR INSERT TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service can insert health scores" ON public.email_health_scores;
CREATE POLICY "Service role can insert health scores" ON public.email_health_scores
  FOR INSERT TO service_role
  WITH CHECK (true);
