// =============================================
// Billing Plans Service
// =============================================
// Manages plan definitions, lookups, and entitlement checks.

import { createClient } from "@supabase/supabase-js";

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

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =============================================
// Get All Active Plans
// =============================================

export async function getActivePlans(): Promise<BillingPlan[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("billing_plans")
    .select("*")
    .eq("is_active", true)
    .order("monthly_price", { ascending: true });

  if (error || !data) return [];

  return data.map((p) => ({
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
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("v_user_billing")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.plan_id,
    userId: data.user_id,
    planId: data.plan_id,
    planName: data.plan_name,
    planSlug: data.plan_slug,
    status: data.subscription_status,
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
  const supabase = getSupabase();

  const { data } = await supabase
    .from("credit_costs")
    .select("credit_cost")
    .eq("operation", operation)
    .single();

  return data?.credit_cost ?? null;
}

// =============================================
// Get All Credit Costs
// =============================================

export async function getAllCreditCosts(): Promise<
  Array<{ operation: string; creditCost: number; description: string }>
> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from("credit_costs")
    .select("operation, credit_cost, description")
    .order("credit_cost", { ascending: true });

  return (data || []).map((c) => ({
    operation: c.operation,
    creditCost: c.credit_cost,
    description: c.description || "",
  }));
}
