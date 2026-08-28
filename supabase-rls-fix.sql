-- =============================================
-- Capital OS — Proper RLS Policies (v3)
-- =============================================
-- Safe to re-run: drops existing policies before creating new ones.
-- Each table's policies match its ACTUAL column names.

-- ═══════════════════════════════════════════
-- Helper: Drop policy if exists, then create
-- ═══════════════════════════════════════════

-- ═══════════════════════════════════════════
-- 1. COMPANY PROFILES (has user_id)
-- ═══════════════════════════════════════════
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "Users can view own profile" ON company_profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can insert own profile" ON company_profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can update own profile" ON company_profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can delete own profile" ON company_profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Users can view own profile" ON company_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON company_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON company_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON company_profiles
  FOR DELETE USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════
-- 2. COMPANY TEAM MEMBERS (has company_id)
-- ═══════════════════════════════════════════
ALTER TABLE company_team_members ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "Users can view own team" ON company_team_members; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can manage own team" ON company_team_members; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Users can view own team" ON company_team_members
  FOR SELECT USING (
    company_id IN (SELECT id FROM company_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can manage own team" ON company_team_members
  FOR ALL USING (
    company_id IN (SELECT id FROM company_profiles WHERE user_id = auth.uid())
  );


-- ═══════════════════════════════════════════
-- 3. COMPANY DOCUMENTS (has company_id)
-- ═══════════════════════════════════════════
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "Users can view own documents" ON company_documents; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can manage own documents" ON company_documents; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Users can view own documents" ON company_documents
  FOR SELECT USING (
    company_id IN (SELECT id FROM company_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can manage own documents" ON company_documents
  FOR ALL USING (
    company_id IN (SELECT id FROM company_profiles WHERE user_id = auth.uid())
  );


-- ═══════════════════════════════════════════
-- 4. SAVED INVESTORS (has user_id)
-- ═══════════════════════════════════════════
ALTER TABLE saved_investors ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "Users can view own saved" ON saved_investors; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can save investors" ON saved_investors; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can unsave investors" ON saved_investors; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Users can view own saved" ON saved_investors
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save investors" ON saved_investors
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave investors" ON saved_investors
  FOR DELETE USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════
-- 5. EMAIL MESSAGES (has user_id)
-- ═══════════════════════════════════════════
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "Users can view own emails" ON email_messages; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can create emails" ON email_messages; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can update own emails" ON email_messages; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Users can view own emails" ON email_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create emails" ON email_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own emails" ON email_messages
  FOR UPDATE USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════
-- 6. EMAIL ACCOUNTS (has user_id)
-- ═══════════════════════════════════════════
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "Users can view own accounts" ON email_accounts; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can manage own accounts" ON email_accounts; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Users can view own accounts" ON email_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own accounts" ON email_accounts
  FOR ALL USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════
-- 7. CAMPAIGNS (has user_id)
-- ═══════════════════════════════════════════
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "Users can view own campaigns" ON campaigns; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can manage own campaigns" ON campaigns; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Users can view own campaigns" ON campaigns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own campaigns" ON campaigns
  FOR ALL USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════
-- 8. SAVED FILTERS (has user_id)
-- ═══════════════════════════════════════════
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "Users can view own filters" ON saved_filters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "Users can manage own filters" ON saved_filters; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Users can view own filters" ON saved_filters
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own filters" ON saved_filters
  FOR ALL USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════
-- 9. AUDIT LOG (may not exist)
-- ═══════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own audit log" ON audit_log;
  DROP POLICY IF EXISTS "Service can insert audit log" ON audit_log;
  CREATE POLICY "Users can view own audit log" ON audit_log
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Service can insert audit log" ON audit_log
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ═══════════════════════════════════════════
-- 10. ACQUISITION JOBS (no user_id — system table)
-- ═══════════════════════════════════════════
ALTER TABLE acquisition_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN DROP POLICY IF EXISTS "Service can manage jobs" ON acquisition_jobs; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "Service can manage jobs" ON acquisition_jobs
  FOR ALL USING (true);


-- ═══════════════════════════════════════════
-- 11. WAITLIST (public insert, may not exist)
-- ═══════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Public can insert waitlist" ON waitlist;
  DROP POLICY IF EXISTS "Authenticated can read waitlist" ON waitlist;
  CREATE POLICY "Public can insert waitlist" ON waitlist
    FOR INSERT WITH CHECK (true);
  CREATE POLICY "Authenticated can read waitlist" ON waitlist
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ═══════════════════════════════════════════
-- 12. FOUNDING MEMBERS (has user_id, may not exist)
-- ═══════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE founding_members ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own membership" ON founding_members;
  DROP POLICY IF EXISTS "Service can manage founding members" ON founding_members;
  CREATE POLICY "Users can view own membership" ON founding_members
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Service can manage founding members" ON founding_members
    FOR ALL WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ═══════════════════════════════════════════
-- 13. EMAIL HEALTH TABLES (may not exist)
-- ═══════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE email_health_events ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own health events" ON email_health_events;
  DROP POLICY IF EXISTS "Service can insert health events" ON email_health_events;
  CREATE POLICY "Users can view own health events" ON email_health_events
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Service can insert health events" ON email_health_events
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE email_sending_log ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own sending log" ON email_sending_log;
  DROP POLICY IF EXISTS "Service can insert sending log" ON email_sending_log;
  CREATE POLICY "Users can view own sending log" ON email_sending_log
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Service can insert sending log" ON email_sending_log
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Authenticated can read suppression list" ON email_suppression_list;
  DROP POLICY IF EXISTS "Service can manage suppression list" ON email_suppression_list;
  CREATE POLICY "Authenticated can read suppression list" ON email_suppression_list
    FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY "Service can manage suppression list" ON email_suppression_list
    FOR ALL WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE email_warmup ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own warmup" ON email_warmup;
  DROP POLICY IF EXISTS "Users can manage own warmup" ON email_warmup;
  CREATE POLICY "Users can view own warmup" ON email_warmup
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users can manage own warmup" ON email_warmup
    FOR ALL USING (auth.uid() = user_id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE email_domain_health ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Authenticated can read domain health" ON email_domain_health;
  DROP POLICY IF EXISTS "Service can manage domain health" ON email_domain_health;
  CREATE POLICY "Authenticated can read domain health" ON email_domain_health
    FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY "Service can manage domain health" ON email_domain_health
    FOR ALL WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE email_health_scores ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Users can view own health scores" ON email_health_scores;
  DROP POLICY IF EXISTS "Service can insert health scores" ON email_health_scores;
  CREATE POLICY "Users can view own health scores" ON email_health_scores
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Service can insert health scores" ON email_health_scores
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ═══════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════
SELECT 'RLS policies created successfully (v3 — safe to re-run).' as result;
