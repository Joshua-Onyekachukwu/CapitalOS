-- =============================================
-- Billing Plans
-- =============================================
-- Seeded to match the 3-pillar "Fundraising Lifecycle" model documented in
-- docs/07-pricing-billing.md and the business-model brief in docs/07a-business-model-brief.md.
--
-- Pillar 1 — Upfront Sprints (paid upfront, time-boxed raise engagements)
-- Pillar 2 — Post-Raise Retention (lightweight $29/mo investor-relationship tier)
-- Pillar 3 — B2B Multi-Client (accelerators, studios, fractional CFOs)
--
-- The internal credit/entitlement engine stays in place. Public pricing is pillar-based.

INSERT INTO billing_plans (
  id, name, slug, monthly_price, annual_price, included_credits,
  investor_db_limit, deep_research_limit, pitch_deck_limit,
  campaign_limit, email_accounts_limit, team_seats, is_active,
  window_months, is_post_raise_retention, b2b_seat_count, annual_billing_default
) VALUES
  -- Pillar 1: Upfront Sprints
  (
    gen_random_uuid(), '3-Month Sprint', 'sprint_3m', 0, 499,
    2000, 500, 50, 5, 5, 2, 1, true, 3, false, 1, false
  ),
  (
    gen_random_uuid(), '6-Month Pro Sprint', 'sprint_6m', 0, 999,
    4000, 1000, 100, 10, 10, 3, 1, true, 6, false, 1, false
  ),
  -- Pillar 2: Post-Raise Retention
  (
    gen_random_uuid(), 'Post-Raise Retention', 'retention', 29, 290,
    500, 200, 10, 2, 2, 1, 1, true, NULL, true, 1, true
  ),
  -- Pillar 3: B2B Multi-Client
  (
    gen_random_uuid(), 'B2B Starter', 'b2b_starter', 499, NULL,
    10000, 2000, 200, 100, 50, 10, 2, true, NULL, false, 2, true
  ),
  (
    gen_random_uuid(), 'B2B Growth', 'b2b_growth', 749, NULL,
    20000, 5000, 500, 200, 100, 25, 5, true, NULL, false, 5, true
  ),
  (
    gen_random_uuid(), 'B2B Scale', 'b2b_scale', 1000, NULL,
    40000, 10000, 1000, 400, 200, 50, 10, true, NULL, false, 10, true
  )
ON CONFLICT DO NOTHING;
