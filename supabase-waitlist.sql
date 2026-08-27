-- Waitlist table
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  source TEXT DEFAULT 'landing_page',
  status TEXT DEFAULT 'pending',
  founding_member BOOLEAN DEFAULT false,
  founding_credit NUMERIC DEFAULT 0,
  referral_code TEXT UNIQUE,
  referred_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist(created_at DESC);

-- RLS: only service role can access (admin operations)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public signup)
CREATE POLICY "Allow public inserts" ON waitlist
  FOR INSERT
  WITH CHECK (true);

-- Allow authenticated reads (for checking if already signed up)
CREATE POLICY "Allow authenticated reads" ON waitlist
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Count view for admin
CREATE OR REPLACE VIEW waitlist_stats AS
SELECT
  COUNT(*) AS total_signups,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending,
  COUNT(*) FILTER (WHERE status = 'notified') AS notified,
  COUNT(*) FILTER (WHERE status = 'converted') AS converted,
  COUNT(*) FILTER (WHERE founding_member = true) AS founding_members,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') AS last_24h,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last_7d
FROM waitlist;
