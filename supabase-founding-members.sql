-- =============================================
-- Founding Members Table
-- Run in Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS founding_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  founding_credit NUMERIC DEFAULT 9.99,
  payment_amount NUMERIC DEFAULT 9.99,
  currency TEXT DEFAULT 'usd',
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent TEXT,
  stripe_customer_id TEXT,
  payment_status TEXT DEFAULT 'pending',
  refund_status TEXT DEFAULT 'none',
  credit_applied BOOLEAN DEFAULT false,
  credit_applied_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_founding_members_user ON founding_members(user_id);
CREATE INDEX IF NOT EXISTS idx_founding_members_email ON founding_members(email);
CREATE INDEX IF NOT EXISTS idx_founding_members_stripe_session ON founding_members(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_founding_members_status ON founding_members(payment_status);

-- RLS
ALTER TABLE founding_members ENABLE ROW LEVEL SECURITY;

-- Users can read their own founding member status
CREATE POLICY "Users can read own founding status" ON founding_members
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for webhooks and admin)
CREATE POLICY "Service role full access" ON founding_members
  FOR ALL
  USING (auth.role() = 'service_role');
