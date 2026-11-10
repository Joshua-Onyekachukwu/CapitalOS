-- ============================================
-- 039 — Saved-search alerts, investor updates
-- ============================================
-- Two surfaces, both owner-scoped:
--   * search_alerts: one row per saved filter that found new corpora rows since
--     the filter was last checked. Written by the server only (service role)
--     during an explicit check; the owner reads and marks them.
--   * investor_updates: the post-raise monthly update drafts a founder writes
--     for their investors. Drafts only — sending is a separate, blocked path.

-- ── 1. Saved-search alerts ────────────────────────────────────────────────
-- When a saved filter was last evaluated. NULL means "never checked".
ALTER TABLE public.saved_filters
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.search_alerts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  saved_filter_id      UUID REFERENCES public.saved_filters(id) ON DELETE CASCADE,
  filter_name          TEXT NOT NULL,
  -- Snapshot of the filter at alert time, so the link stays reproducible even
  -- if the saved filter is edited afterwards.
  filters              JSONB NOT NULL DEFAULT '{}'::jsonb,
  matched_count        INTEGER NOT NULL DEFAULT 0,
  sample_investor_ids  UUID[] NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_search_alerts_user
  ON public.search_alerts (user_id, created_at DESC);

ALTER TABLE public.search_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS search_alerts_select_own ON public.search_alerts;
CREATE POLICY search_alerts_select_own ON public.search_alerts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS search_alerts_update_own ON public.search_alerts;
CREATE POLICY search_alerts_update_own ON public.search_alerts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- No client INSERT/DELETE: alerts are produced by the matcher running server
-- side against the whole corpus, and are read-only evidence for the founder.

-- ── 2. Post-raise investor updates ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.investor_updates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_label  TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  -- draft = still being written; ready = reviewed; sent = a copy went out.
  -- 'sent' is only ever set by the sending path (currently blocked).
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'ready', 'sent')),
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investor_updates_user
  ON public.investor_updates (user_id, created_at DESC);

ALTER TABLE public.investor_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS investor_updates_select_own ON public.investor_updates;
CREATE POLICY investor_updates_select_own ON public.investor_updates
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS investor_updates_insert_own ON public.investor_updates;
CREATE POLICY investor_updates_insert_own ON public.investor_updates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS investor_updates_update_own ON public.investor_updates;
CREATE POLICY investor_updates_update_own ON public.investor_updates
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS investor_updates_delete_own ON public.investor_updates;
CREATE POLICY investor_updates_delete_own ON public.investor_updates
  FOR DELETE USING (auth.uid() = user_id);
