-- Capital OS — Investors Table for Supabase
-- Run this in Supabase SQL Editor before migrating data

CREATE TABLE IF NOT EXISTS investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identity
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  job_title TEXT,
  investor_type TEXT NOT NULL DEFAULT 'angel_investor',
  
  -- Company
  company_name TEXT,
  company_website TEXT,
  linkedin_url TEXT,
  personal_website TEXT,
  
  -- Location
  country TEXT,
  city TEXT,
  location TEXT,
  
  -- Contact
  email TEXT,
  phone TEXT,
  
  -- Investment
  min_check_size NUMERIC,
  max_check_size NUMERIC,
  fund_size NUMERIC,
  aum NUMERIC,
  currency TEXT DEFAULT 'USD',
  
  -- Focus
  investment_stages TEXT[] DEFAULT '{}',
  investment_sectors TEXT[] DEFAULT '{}',
  investment_geographies TEXT[] DEFAULT '{}',
  investment_thesis TEXT,
  
  -- History
  number_of_investments INTEGER DEFAULT 0,
  number_of_exits INTEGER DEFAULT 0,
  last_investment_date DATE,
  
  -- Scores
  fit_score INTEGER DEFAULT 0,
  data_quality_score INTEGER DEFAULT 0,
  
  -- Status
  outreach_readiness TEXT DEFAULT 'needs_verification',
  is_verified BOOLEAN DEFAULT false,
  
  -- Source
  source TEXT NOT NULL,
  source_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_investors_type ON investors(investor_type);
CREATE INDEX IF NOT EXISTS idx_investors_country ON investors(country);
CREATE INDEX IF NOT EXISTS idx_investors_source ON investors(source);
CREATE INDEX IF NOT EXISTS idx_investors_score ON investors(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_investors_email ON investors(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_investors_outreach ON investors(outreach_readiness);

-- Enable Row Level Security
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow authenticated read" ON investors
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role full access (for migrations)
CREATE POLICY "Allow service role full access" ON investors
  FOR ALL USING (auth.role() = 'service_role');
