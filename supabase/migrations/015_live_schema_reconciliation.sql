-- ============================================================================
-- 015 — Live schema reconciliation
--
-- PURPOSE
--   The live project contains 54 exposed objects. Before this migration the
--   committed migrations created only 35 tables, so a fresh environment could
--   not be rebuilt from the repository: 14 tables and 0 views existed only in
--   production.
--
--   This migration is GENERATED from the live PostgREST OpenAPI definitions
--   (types, defaults, PK markers, FK markers), then reviewed by hand. It is
--   additive and idempotent: CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT
--   EXISTS. It never drops or alters an existing object, so applying it to the
--   live database is a no-op for objects that already exist.
--
-- CAVEATS (must be verified against a real rebuild, not assumed)
--   * CHECK constraints, triggers, extended statistics and exact column ORDER
--     are not exposed by OpenAPI and are therefore NOT reproduced here.
--   * NOT NULL is taken from the spec's "required" list.
--   * RLS policies for these tables live in the migrations that own the feature;
--     see the per-table notes. Tables created here get RLS enabled + owner-only
--     policy where they are user-scoped.
-- ============================================================================

-- audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_email TEXT
);

-- campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  investor_ids UUID[],
  total_investors INTEGER DEFAULT 0,
  emails_sent INTEGER DEFAULT 0,
  emails_generated INTEGER DEFAULT 0,
  response_rate NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- copilot_conversations
CREATE TABLE IF NOT EXISTS public.copilot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  messages JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- email_domain_health
CREATE TABLE IF NOT EXISTS public.email_domain_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  spf_valid BOOLEAN DEFAULT false,
  spf_record TEXT,
  dkim_valid BOOLEAN DEFAULT false,
  dkim_record TEXT,
  dmarc_valid BOOLEAN DEFAULT false,
  dmarc_record TEXT,
  mx_valid BOOLEAN DEFAULT false,
  mx_records JSONB,
  overall_status TEXT DEFAULT 'unchecked',
  last_checked_at TIMESTAMPTZ,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- email_health_events
CREATE TABLE IF NOT EXISTS public.email_health_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  details JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  email_address TEXT,
  bounce_type TEXT
);

-- email_health_scores
CREATE TABLE IF NOT EXISTS public.email_health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  health_score INTEGER NOT NULL,
  health_status TEXT NOT NULL,
  authentication_score INTEGER DEFAULT 0,
  bounce_score INTEGER DEFAULT 0,
  engagement_score INTEGER DEFAULT 0,
  consistency_score INTEGER DEFAULT 0,
  warmup_score INTEGER DEFAULT 0,
  domain_score INTEGER DEFAULT 0,
  factors JSONB,
  recommendations JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- email_sending_log
CREATE TABLE IF NOT EXISTS public.email_sending_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID,
  campaign_id UUID,
  investor_id UUID,
  email_message_id UUID,
  provider TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  error TEXT,
  tracking_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  bounce_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- email_suppression_list
CREATE TABLE IF NOT EXISTS public.email_suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email_address TEXT NOT NULL,
  reason TEXT NOT NULL,
  bounce_type TEXT,
  source TEXT DEFAULT 'system',
  campaign_id UUID,
  suppressed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- email_warmup
CREATE TABLE IF NOT EXISTS public.email_warmup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  account_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_stage INTEGER DEFAULT 1,
  daily_target INTEGER DEFAULT 5,
  daily_sent INTEGER DEFAULT 0,
  day_number INTEGER DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  health_at_start INTEGER DEFAULT 0,
  health_current INTEGER DEFAULT 0,
  auto_escalate BOOLEAN DEFAULT true,
  schedule JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  daily_log JSONB,
  sending_paused BOOLEAN DEFAULT false,
  pause_reason TEXT
);

-- founding_members
CREATE TABLE IF NOT EXISTS public.founding_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  email TEXT NOT NULL,
  name TEXT,
  founding_credit NUMERIC DEFAULT 9.99,
  payment_amount NUMERIC DEFAULT 9.99,
  currency TEXT DEFAULT 'usd',
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  stripe_customer_id TEXT,
  payment_status TEXT DEFAULT 'pending',
  refund_status TEXT DEFAULT 'none',
  credit_applied BOOLEAN DEFAULT false,
  credit_applied_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  stripe_event_id TEXT,
  payment_method TEXT
);

-- pipeline_events
CREATE TABLE IF NOT EXISTS public.pipeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  investor_id UUID NOT NULL,
  entry_id UUID,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- saved_filters
CREATE TABLE IF NOT EXISTS public.saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  filter_key TEXT NOT NULL,
  filters JSONB,
  sort_by TEXT DEFAULT 'created_at',
  page_name TEXT DEFAULT 'investors',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- user_pipeline_entries
CREATE TABLE IF NOT EXISTS public.user_pipeline_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  investor_id UUID NOT NULL,
  stage TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  owner_id UUID,
  expected_amount NUMERIC,
  probability INTEGER,
  lost_reason TEXT,
  next_action_at TIMESTAMPTZ
);

-- waitlist
CREATE TABLE IF NOT EXISTS public.waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  source TEXT DEFAULT 'landing_page',
  status TEXT DEFAULT 'pending',
  founding_member BOOLEAN DEFAULT false,
  founding_credit NUMERIC DEFAULT 0,
  referral_code TEXT,
  referred_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  notified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  metadata JSONB
);


-- ============================================================================
-- Foreign keys (emitted after all tables exist so ordering is irrelevant).
--
-- Rules are explicit, not a blanket default. The determining fact is whether
-- the column is NOT NULL: ON DELETE SET NULL against a NOT NULL column does
-- not degrade gracefully, it raises at delete time. History rows whose parent
-- is removed must be removed with it, so those cascade.
--
--   user_pipeline_entries.investor_id  NOT NULL  -> CASCADE (entry dies with
--                                                  the investor it points at)
--   pipeline_events.investor_id        NOT NULL  -> CASCADE
--   pipeline_events.entry_id           nullable  -> CASCADE (an event about a
--                                                  deleted stage entry is
--                                                  meaningless, not orphaned)
--   user_pipeline_entries.owner_id     nullable  -> SET NULL (unassign, keep)
-- ============================================================================

ALTER TABLE public.pipeline_events DROP CONSTRAINT IF EXISTS pipeline_events_investor_id_fkey;
ALTER TABLE public.pipeline_events ADD CONSTRAINT pipeline_events_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.investors(id) ON DELETE CASCADE;

ALTER TABLE public.pipeline_events DROP CONSTRAINT IF EXISTS pipeline_events_entry_id_fkey;
ALTER TABLE public.pipeline_events ADD CONSTRAINT pipeline_events_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.user_pipeline_entries(id) ON DELETE CASCADE;

ALTER TABLE public.user_pipeline_entries DROP CONSTRAINT IF EXISTS user_pipeline_entries_investor_id_fkey;
ALTER TABLE public.user_pipeline_entries ADD CONSTRAINT user_pipeline_entries_investor_id_fkey FOREIGN KEY (investor_id) REFERENCES public.investors(id) ON DELETE CASCADE;

-- ============================================================================
-- RLS for user-scoped tables created above.
-- ============================================================================

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_owner_all" ON public.audit_log;
CREATE POLICY "audit_log_owner_all" ON public.audit_log
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaigns_owner_all" ON public.campaigns;
CREATE POLICY "campaigns_owner_all" ON public.campaigns
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.copilot_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "copilot_conversations_owner_all" ON public.copilot_conversations;
CREATE POLICY "copilot_conversations_owner_all" ON public.copilot_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.email_domain_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_domain_health_owner_all" ON public.email_domain_health;
CREATE POLICY "email_domain_health_owner_all" ON public.email_domain_health
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.email_health_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_health_events_owner_all" ON public.email_health_events;
CREATE POLICY "email_health_events_owner_all" ON public.email_health_events
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.email_health_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_health_scores_owner_all" ON public.email_health_scores;
CREATE POLICY "email_health_scores_owner_all" ON public.email_health_scores
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.email_sending_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_sending_log_owner_all" ON public.email_sending_log;
CREATE POLICY "email_sending_log_owner_all" ON public.email_sending_log
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.email_suppression_list ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_suppression_list_owner_all" ON public.email_suppression_list;
CREATE POLICY "email_suppression_list_owner_all" ON public.email_suppression_list
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.email_warmup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_warmup_owner_all" ON public.email_warmup;
CREATE POLICY "email_warmup_owner_all" ON public.email_warmup
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.founding_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "founding_members_owner_all" ON public.founding_members;
CREATE POLICY "founding_members_owner_all" ON public.founding_members
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pipeline_events_owner_all" ON public.pipeline_events;
CREATE POLICY "pipeline_events_owner_all" ON public.pipeline_events
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.saved_filters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "saved_filters_owner_all" ON public.saved_filters;
CREATE POLICY "saved_filters_owner_all" ON public.saved_filters
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.user_pipeline_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_pipeline_entries_owner_all" ON public.user_pipeline_entries;
CREATE POLICY "user_pipeline_entries_owner_all" ON public.user_pipeline_entries
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Objects created by this migration: 14 tables, 0 views.
-- Views are (none) and are defined by their feature migrations.
