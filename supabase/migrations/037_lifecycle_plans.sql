-- =============================================
-- Lifecycle plan catalog — docs/07-pricing-billing.md
-- =============================================
-- Migration 004 was rewritten to the 3-pillar model after it had already run,
-- so the live catalog still held Free / Workspace / Workspace Pro and the
-- lifecycle columns did not exist. This brings the database in line with the
-- file: Sprint tiers (one-time payments), Post-Raise Retention, and B2B.
--
-- The sprint price is stored in monthly_price because that is the column every
-- billing read uses; billing_model = 'one_time' is what turns it into a single
-- Stripe payment instead of a subscription.

ALTER TABLE billing_plans
  ADD COLUMN IF NOT EXISTS window_months integer,
  ADD COLUMN IF NOT EXISTS is_post_raise_retention boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS b2b_seat_count integer,
  ADD COLUMN IF NOT EXISTS annual_billing_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_model text NOT NULL DEFAULT 'monthly';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'billing_plans_billing_model_check'
  ) THEN
    ALTER TABLE billing_plans
      ADD CONSTRAINT billing_plans_billing_model_check
      CHECK (billing_model IN ('monthly', 'one_time'));
  END IF;
END $$;

CREATE TEMP TABLE lifecycle_plan_seed (
  name text,
  slug text,
  monthly_price numeric,
  annual_price numeric,
  included_credits integer,
  investor_db_limit integer,
  deep_research_limit integer,
  pitch_deck_limit integer,
  campaign_limit integer,
  email_accounts_limit integer,
  team_seats integer,
  is_active boolean,
  window_months integer,
  is_post_raise_retention boolean,
  b2b_seat_count integer,
  annual_billing_default boolean,
  billing_model text
);

INSERT INTO lifecycle_plan_seed VALUES
  ('3-Month Sprint',       'sprint_3m',   499,  NULL, 2000,  500,   50,   5,   5,  2, 1, true,  3,   false, 1,  false, 'one_time'),
  ('6-Month Pro Sprint',   'sprint_6m',   999,  NULL, 4000,  1000, 100,  10,  10,  3, 1, true,  6,   false, 1,  false, 'one_time'),
  ('Post-Raise Retention', 'retention',   29,   290,  500,   200,   10,   2,   2,  1, 1, true,  NULL, true,  1,  true,  'monthly'),
  ('B2B Starter',          'b2b_starter', 499,  NULL, 10000, 2000, 200,  100, 50, 10, 2, true,  NULL, false, 2,  true,  'monthly'),
  ('B2B Growth',           'b2b_growth',  749,  NULL, 20000, 5000, 500,  200, 100, 25, 5, true, NULL, false, 5,  true,  'monthly'),
  ('B2B Scale',            'b2b_scale',   1000, NULL, 40000, 10000, 1000, 400, 200, 50, 10, true, NULL, false, 10, true, 'monthly');

INSERT INTO billing_plans (
  name, slug, monthly_price, annual_price, included_credits,
  investor_db_limit, deep_research_limit, pitch_deck_limit,
  campaign_limit, email_accounts_limit, team_seats, is_active,
  window_months, is_post_raise_retention, b2b_seat_count,
  annual_billing_default, billing_model
)
SELECT
  s.name, s.slug, s.monthly_price, s.annual_price, s.included_credits,
  s.investor_db_limit, s.deep_research_limit, s.pitch_deck_limit,
  s.campaign_limit, s.email_accounts_limit, s.team_seats, s.is_active,
  s.window_months, s.is_post_raise_retention, s.b2b_seat_count,
  s.annual_billing_default, s.billing_model
FROM lifecycle_plan_seed s
WHERE NOT EXISTS (SELECT 1 FROM billing_plans b WHERE b.slug = s.slug);

-- Also refreshes the rows 004 inserted with a $0 sprint price.
UPDATE billing_plans b SET
  name = s.name,
  monthly_price = s.monthly_price,
  annual_price = s.annual_price,
  included_credits = s.included_credits,
  investor_db_limit = s.investor_db_limit,
  deep_research_limit = s.deep_research_limit,
  pitch_deck_limit = s.pitch_deck_limit,
  campaign_limit = s.campaign_limit,
  email_accounts_limit = s.email_accounts_limit,
  team_seats = s.team_seats,
  is_active = s.is_active,
  window_months = s.window_months,
  is_post_raise_retention = s.is_post_raise_retention,
  b2b_seat_count = s.b2b_seat_count,
  annual_billing_default = s.annual_billing_default,
  billing_model = s.billing_model
FROM lifecycle_plan_seed s
WHERE b.slug = s.slug;

DROP TABLE lifecycle_plan_seed;

-- The sprint-first catalog replaces open-ended monthly plans on the public
-- surface. The rows stay because existing subscriptions reference them.
UPDATE billing_plans SET is_active = false WHERE slug IN ('workspace', 'workspace_pro');
