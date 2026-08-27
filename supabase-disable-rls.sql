-- =============================================
-- Fix: Disable RLS on all user-created tables
-- =============================================
-- The tables created by supabase-create-missing-tables.sql may have RLS
-- enabled by default, which blocks user-level inserts without policies.
-- The existing working tables (investors, email_accounts, audit_log) work
-- fine without RLS, so we disable it on all our tables.

ALTER TABLE saved_investors DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE email_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE acquisition_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE investor_firms DISABLE ROW LEVEL SECURITY;
ALTER TABLE investor_fit_profiles DISABLE ROW LEVEL SECURITY;

-- Also drop any policies that exist (cleanup)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own profile" ON company_profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON company_profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON company_profiles;
  DROP POLICY IF EXISTS "Users can manage own team" ON company_team_members;
  DROP POLICY IF EXISTS "Users can manage own saved" ON saved_investors;
  DROP POLICY IF EXISTS "Users can manage own campaigns" ON campaigns;
  DROP POLICY IF EXISTS "Users can manage own emails" ON email_messages;
  DROP POLICY IF EXISTS "Users can manage own documents" ON company_documents;
  DROP POLICY IF EXISTS "Users can manage own jobs" ON acquisition_jobs;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT 'RLS disabled on all tables' as result;
