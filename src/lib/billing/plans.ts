// =============================================
// Billing Plans Service
// =============================================
// Manages plan definitions, lookups, and entitlement checks.
// Uses CockroachDB for data.
// Plan rows are seeded by migration 004_company_profiles_billing.sql
// and the 3-pillar fundraising-lifecycle model docs (docs/07-pricing-billing.md).

import { query } from "@/lib/db";

export interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  annualPrice: number | null;
  includedCredits: number;
  investorDbLimit: number;
  deepResearchLimit: number;
  pitchDeckLimit: number;
  campaignLimit: number;
  emailAccountsLimit: number;
  teamSeats: number;
  isActive: boolean;
  // 3-pillar extensions
  windowMonths?: number;
  isPostRaiseRetention?: boolean;
  b2bSeatCount?: number;
  annualBillingDefault?: boolean;
  // 'one_time' plans (the Sprints) are a single Stripe payment, not a
  // subscription. monthlyPrice holds the upfront amount for those rows.
  billingModel: "monthly" | "one_time";
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  planName: string;
  planSlug: string;
  status: "active" | "past_due" | "cancelled" | "trialing";
  creditsRemaining: number;
  creditsUsedThisPeriod: number;
  includedCredits: number;
  investorDbLimit: number;
  deepResearchLimit: number;
  pitchDeckLimit: number;
  campaignLimit: number;
  emailAccountsLimit: number;
  teamSeats: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

// =============================================
// Get All Active Plans
// =============================================

export async function getActivePlans(): Promise<BillingPlan[]> {
  const rows = await query<any>(
    `SELECT * FROM billing_plans WHERE is_active = true ORDER BY monthly_price ASC`
  );

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    monthlyPrice: p.monthly_price,
    annualPrice: p.annual_price,
    includedCredits: p.included_credits,
    investorDbLimit: p.investor_db_limit,
    deepResearchLimit: p.deep_research_limit,
    pitchDeckLimit: p.pitch_deck_limit,
    campaignLimit: p.campaign_limit,
    emailAccountsLimit: p.email_accounts_limit,
    teamSeats: p.team_seats,
    isActive: p.is_active,
    windowMonths: p.window_months ?? undefined,
    isPostRaiseRetention: p.is_post_raise_retention ?? undefined,
    b2bSeatCount: p.b2b_seat_count ?? undefined,
    annualBillingDefault: p.annual_billing_default ?? undefined,
    billingModel: (p.billing_model ?? "monthly") as "monthly" | "one_time",
  }));
}

// =============================================
// Get User Subscription
// =============================================

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const rows = await query<any>(
    `SELECT us.*, bp.name AS plan_name, bp.slug AS plan_slug,
            bp.monthly_price, bp.included_credits, bp.investor_db_limit,
            bp.deep_research_limit, bp.pitch_deck_limit, bp.campaign_limit,
            bp.email_accounts_limit, bp.team_seats
     FROM user_subscriptions us
     JOIN billing_plans bp ON us.plan_id = bp.id
     WHERE us.user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (!rows.length) return null;

  const data = rows[0];
  return {
    id: data.plan_id,
    userId: data.user_id,
    planId: data.plan_id,
    planName: data.plan_name,
    planSlug: data.plan_slug,
    status: data.status,
    creditsRemaining: data.credits_remaining,
    creditsUsedThisPeriod: data.credits_used_this_period,
    includedCredits: data.included_credits,
    investorDbLimit: data.investor_db_limit,
    deepResearchLimit: data.deep_research_limit,
    pitchDeckLimit: data.pitch_deck_limit,
    campaignLimit: data.campaign_limit,
    emailAccountsLimit: data.email_accounts_limit,
    teamSeats: data.team_seats,
    currentPeriodStart: data.current_period_start,
    currentPeriodEnd: data.current_period_end,
  };
}

// =============================================
// Sprint window
// =============================================
// A Sprint is a one-time purchase with an end date, so the dashboard can offer
// the Retention tier when it runs out instead of silently leaving the founder
// on an expired plan.

export interface SprintStatus {
  planSlug: string;
  planName: string;
  endsAt: string | null;
  daysRemaining: number | null;
  ended: boolean;
  endingSoon: boolean;
}

export async function getSprintStatus(userId: string): Promise<SprintStatus | null> {
  const rows = await query<any>(
    `SELECT us.current_period_end, bp.slug AS plan_slug, bp.name AS plan_name
     FROM user_subscriptions us
     JOIN billing_plans bp ON us.plan_id = bp.id
     WHERE us.user_id = $1 AND bp.billing_model = 'one_time'
     LIMIT 1`,
    [userId]
  );
  if (!rows.length) return null;

  const row = rows[0];
  const end = row.current_period_end ? new Date(row.current_period_end) : null;
  const daysRemaining = end
    ? Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    planSlug: row.plan_slug,
    planName: row.plan_name,
    endsAt: end ? end.toISOString() : null,
    daysRemaining,
    ended: daysRemaining !== null && daysRemaining <= 0,
    endingSoon: daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 14,
  };
}

// =============================================
// Get Credit Cost for an Operation
// =============================================

export async function getCreditCost(operation: string): Promise<number | null> {
  const rows = await query<{ credit_cost: number }>(
    `SELECT credit_cost FROM credit_costs WHERE operation = $1`,
    [operation]
  );

  return rows[0]?.credit_cost ?? null;
}

// =============================================
// Get All Credit Costs
// =============================================

export async function getAllCreditCosts(): Promise<
  Array<{ operation: string; creditCost: number; description: string }>
> {
  const rows = await query<any>(
    `SELECT operation, credit_cost, description FROM credit_costs ORDER BY credit_cost ASC`
  );

  return rows.map((c) => ({
    operation: c.operation,
    creditCost: c.credit_cost,
    description: c.description || "",
  }));
}
