-- =============================================
-- Capital OS — Performance Indexes
-- =============================================
-- Run this in Supabase SQL Editor to add indexes for faster queries.
-- These indexes target the most frequently queried columns.

-- ── Investors Table ──
-- Core queries: filter by type, score, email, outreach readiness
CREATE INDEX IF NOT EXISTS idx_investors_fit_score ON investors(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_investor_type ON investors(investor_type);
CREATE INDEX IF NOT EXISTS idx_investors_outreach_readiness ON investors(outreach_readiness);
CREATE INDEX IF NOT EXISTS idx_investors_has_email ON investors(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investors_country ON investors(country);
CREATE INDEX IF NOT EXISTS idx_investors_source ON investors(source);
CREATE INDEX IF NOT EXISTS idx_investors_data_quality ON investors(data_quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_created_at ON investors(created_at DESC);

-- Composite index for the most common query: investors with email, ordered by fit score
CREATE INDEX IF NOT EXISTS idx_investors_email_score ON investors(fit_score DESC) WHERE email IS NOT NULL;

-- Full text search on investor names
CREATE INDEX IF NOT EXISTS idx_investors_name_search ON investors USING gin(to_tsvector('english', coalesce(full_name, '')));

-- ── Investor Fit Profiles ──
CREATE INDEX IF NOT EXISTS idx_fit_profiles_investor ON investor_fit_profiles(investor_id);
CREATE INDEX IF NOT EXISTS idx_fit_profiles_score ON investor_fit_profiles(fit_score DESC);

-- ── Saved Investors ──
CREATE INDEX IF NOT EXISTS idx_saved_investors_user ON saved_investors(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_investors_user_investor ON saved_investors(user_id, investor_id);

-- ── Email Messages ──
CREATE INDEX IF NOT EXISTS idx_email_messages_user ON email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_investor ON email_messages(investor_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON email_messages(sent_at DESC);

-- ── Email Accounts ──
CREATE INDEX IF NOT EXISTS idx_email_accounts_user ON email_accounts(user_id);

-- ── Campaigns ──
CREATE INDEX IF NOT EXISTS idx_campaigns_user ON campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- ── Company Profiles ──
CREATE INDEX IF NOT EXISTS idx_company_profiles_user ON company_profiles(user_id);

-- ── Audit Log ──
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

-- ── Investor Firms ──
CREATE INDEX IF NOT EXISTS idx_firms_type ON investor_firms(firm_type);
CREATE INDEX IF NOT EXISTS idx_firms_country ON investor_firms(country);

-- ── Acquisition Jobs ──
CREATE INDEX IF NOT EXISTS idx_jobs_status ON acquisition_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON acquisition_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_created ON acquisition_jobs(created_at DESC);
