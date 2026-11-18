-- 042_investor_managers.sql
-- Fund vehicles (investors rows from SEC Form D) point at a manager. The
-- mapping is conservative: clusters that look like SPV platforms or filing
-- administrators are left NULL rather than merged. No vehicle row is deleted
-- or deactivated.

CREATE TABLE IF NOT EXISTS public.investor_managers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  normalized_key TEXT NOT NULL UNIQUE,
  key_source    TEXT NOT NULL DEFAULT 'normalized_name'
                CHECK (key_source IN ('normalized_name', 'manual')),
  confidence    TEXT NOT NULL DEFAULT 'medium'
                CHECK (confidence IN ('high', 'medium', 'low')),
  review_status TEXT NOT NULL DEFAULT 'auto'
                CHECK (review_status IN ('auto', 'reviewed', 'rejected')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS manager_id UUID
  REFERENCES public.investor_managers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS investors_manager_id_idx
  ON public.investors (manager_id);
