// =============================================
// Billing Plans Service
// =============================================
// Manages plan definitions, lookups, and entitlement checks.
// Uses CockroachDB for data.

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
  }));
}

// =============================================
// Get User Subscription
// =============================================

export async function getUserSubscription(
  userId: string
): Promise<UserSubscription | null> {
  // Use a JOIN query since we don't have the view in CockroachDB
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
// Get Credit Cost for an Operation
// =============================================

export async function getCreditCost(
  operation: string
): Promise<number | null> {
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
