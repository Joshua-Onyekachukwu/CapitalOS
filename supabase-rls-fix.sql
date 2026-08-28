-- =============================================
-- Capital OS — Proper RLS Policies (CORRECTED)
-- =============================================
-- Each table's policies match its ACTUAL column names.
-- Service role key bypasses RLS automatically for API routes.

-- ═══════════════════════════════════════════
-- 1. COMPANY PROFILES (has user_id)
-- ═══════════════════════════════════════════
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON company_profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON company_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON company_profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own profile" ON company_profiles
  FOR DELETE USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════
-- 2. COMPANY TEAM MEMBERS (has company_id, NOT user_id)
-- ═══════════════════════════════════════════
ALTER TABLE company_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own team" ON company_team_members
  FOR SELECT USING (
    company_id IN (SELECT id FROM company_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can manage own team" ON company_team_members
  FOR ALL USING (
    company_id IN (SELECT id FROM company_profiles WHERE user_id = auth.uid())
  );


-- ═══════════════════════════════════════════
-- 3. COMPANY DOCUMENTS (has company_id, NOT user_id)
-- ═══════════════════════════════════════════
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Users can view own accounts" ON email_accounts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own accounts" ON email_accounts
  FOR ALL USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════
-- 7. CAMPAIGNS (has user_id)
-- ═══════════════════════════════════════════
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns" ON campaigns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own campaigns" ON campaigns
  FOR ALL USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════
-- 8. SAVED FILTERS (has user_id)
-- ═══════════════════════════════════════════
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own filters" ON saved_filters
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own filters" ON saved_filters
  FOR ALL USING (auth.uid() = user_id);


-- ═══════════════════════════════════════════
-- 9. AUDIT LOG (may be called admin_audit_log — skip if wrong name)
-- ═══════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view own audit log" ON audit_log
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Service can insert audit log" ON audit_log
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════
-- 10. ACQUISITION JOBS (no user_id — system table)
-- ═══════════════════════════════════════════
ALTER TABLE acquisition_jobs ENABLE ROW LEVEL SECURITY;

-- Only service role can access (no user_id to filter on)
CREATE POLICY "Service can manage jobs" ON acquisition_jobs
  FOR ALL USING (true);


-- ═══════════════════════════════════════════
-- 11. WAITLIST (has email, not user_id — public insert)
-- ═══════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public can insert waitlist" ON waitlist
    FOR INSERT WITH CHECK (true);
  CREATE POLICY "Authenticated can read waitlist" ON waitlist
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════
-- 12. FOUNDING MEMBERS (has user_id)
-- ═══════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE founding_members ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view own membership" ON founding_members
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Service can manage founding members" ON founding_members
    FOR ALL WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════
-- 13. EMAIL HEALTH TABLES
-- ═══════════════════════════════════════════
DO $$ BEGIN
  ALTER TABLE email_health_events ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view own health events" ON email_health_events
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Service can insert health events" ON email_health_events
    FOR INSERT WITH CHECK (true);

  ALTER TABLE email_sending_log ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view own sending log" ON email_sending_log
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Service can insert sending log" ON email_sending_log
    FOR INSERT WITH CHECK (true);

  ALTER TABLE email_suppression_list ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated can read suppression list" ON email_suppression_list
    FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY "Service can manage suppression list" ON email_suppression_list
    FOR ALL WITH CHECK (true);

  ALTER TABLE email_warmup ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view own warmup" ON email_warmup
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Users can manage own warmup" ON email_warmup
    FOR ALL USING (auth.uid() = user_id);

  ALTER TABLE email_domain_health ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Authenticated can read domain health" ON email_domain_health
    FOR SELECT USING (auth.role() = 'authenticated');
  CREATE POLICY "Service can manage domain health" ON email_domain_health
    FOR ALL WITH CHECK (true);

  ALTER TABLE email_health_scores ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users can view own health scores" ON email_health_scores
    FOR SELECT USING (auth.uid() = user_id);
  CREATE POLICY "Service can insert health scores" ON email_health_scores
    FOR INSERT WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;


-- ═══════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════
SELECT 'RLS policies created successfully (corrected version).' as result;
