// =============================================
// Billing Provider Abstraction
// =============================================
// Provider-agnostic billing interface.
// When Stripe is added, only the adapter needs implementation.
// Uses CockroachDB for data.

import { query } from "@/lib/db";

// =============================================
// Types
// =============================================

export interface BillingProvider {
  name: string;
  isConfigured: boolean;
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  reactivateSubscription(subscriptionId: string): Promise<boolean>;
  changePlan(subscriptionId: string, newPlanId: string): Promise<PlanChangeResult>;
  purchaseCreditPack(input: CreditPackInput): Promise<CheckoutResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
  handleWebhook(event: WebhookEvent): Promise<WebhookResult>;
}

export interface CheckoutInput {
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutResult {
  sessionId?: string;
  url?: string;
  success: boolean;
  error?: string;
}

export interface PlanChangeResult {
  success: boolean;
  effectiveDate: string;
  proration?: number;
  error?: string;
}

export interface CreditPackInput {
  userId: string;
  packId: string;
  successUrl: string;
  cancelUrl: string;
}

export interface WebhookEvent {
  type: string;
  data: Record<string, unknown>;
}

export interface WebhookResult {
  handled: boolean;
  error?: string;
}

// =============================================
// Local Provider (No Stripe — uses internal billing)
// =============================================

class LocalBillingProvider implements BillingProvider {
  name = "local";
  isConfigured = true;

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    const plans = await query<{ id: string }>(
      `SELECT id FROM billing_plans WHERE id = $1`,
      [input.planId]
    );

    if (!plans.length) {
      return { success: false, error: "Plan not found" };
    }

    await query(
      `INSERT INTO billing_events (user_id, event_type, event_data)
       VALUES ($1, 'checkout_completed_local', $2::jsonb)`,
      [input.userId, JSON.stringify({ planId: input.planId })]
    );

    return { success: true };
  }

  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    const subs = await query<{ current_period_end: string }>(
      `SELECT current_period_end FROM user_subscriptions WHERE id = $1`,
      [subscriptionId]
    );

    if (!subs.length) return false;

    await query(
      `UPDATE user_subscriptions SET cancel_at = $1, status = 'active' WHERE id = $2`,
      [subs[0].current_period_end, subscriptionId]
    );

    await query(
      `INSERT INTO billing_events (user_id, event_type, event_data)
       VALUES ('', 'subscription_cancel_requested', $1::jsonb)`,
      [JSON.stringify({ subscriptionId, effectiveAt: subs[0].current_period_end })]
    );

    return true;
  }

  async reactivateSubscription(subscriptionId: string): Promise<boolean> {
    await query(
      `UPDATE user_subscriptions SET cancel_at = NULL, status = 'active' WHERE id = $1`,
      [subscriptionId]
    );
    return true;
  }

  async changePlan(subscriptionId: string, newPlanId: string): Promise<PlanChangeResult> {
    const newPlans = await query<any>(
      `SELECT * FROM billing_plans WHERE id = $1`,
      [newPlanId]
    );

    if (!newPlans.length) {
      return { success: false, effectiveDate: "", error: "Plan not found" };
    }

    const newPlan = newPlans[0];

    const currentSubs = await query<any>(
      `SELECT * FROM user_subscriptions WHERE id = $1`,
      [subscriptionId]
    );

    if (!currentSubs.length) {
      return { success: false, effectiveDate: "", error: "Subscription not found" };
    }

    const currentSub = currentSubs[0];

    // Check if upgrading from free
    const freePlans = await query<{ id: string }>(
      `SELECT id FROM billing_plans WHERE slug = 'free'`
    );
    const isUpgrade = newPlan.monthly_price > 0 && currentSub.plan_id === freePlans[0]?.id;

    if (isUpgrade) {
      await query(
        `UPDATE user_subscriptions SET previous_plan_id = plan_id, plan_id = $1, credits_remaining = $2, credits_used_this_period = 0, plan_changed_at = NOW() WHERE id = $3`,
        [newPlanId, newPlan.included_credits, subscriptionId]
      );

      await query(
        `INSERT INTO billing_events (user_id, event_type, event_data)
         VALUES ($1, 'plan_upgraded', $2::jsonb)`,
        [currentSub.user_id, JSON.stringify({ from: currentSub.plan_id, to: newPlanId, creditsAdded: newPlan.included_credits })]
      );

      return { success: true, effectiveDate: new Date().toISOString() };
    } else {
      // Downgrade: schedule for period end
      await query(
        `UPDATE user_subscriptions SET pending_plan_id = $1, downgrade_at = $2, status = 'downgrading' WHERE id = $3`,
        [newPlanId, currentSub.current_period_end, subscriptionId]
      );

      await query(
        `INSERT INTO billing_events (user_id, event_type, event_data)
         VALUES ($1, 'plan_downgrade_scheduled', $2::jsonb)`,
        [currentSub.user_id, JSON.stringify({ from: currentSub.plan_id, to: newPlanId, effectiveAt: currentSub.current_period_end })]
      );

      return { success: true, effectiveDate: currentSub.current_period_end };
    }
  }

  async purchaseCreditPack(input: CreditPackInput): Promise<CheckoutResult> {
    const packCredits = input.packId === "pack_500" ? 500 : 100;

    const subs = await query<{ id: string; credits_remaining: number }>(
      `SELECT id, credits_remaining FROM user_subscriptions WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [input.userId]
    );

    if (!subs.length) {
      return { success: false, error: "No active subscription" };
    }

    const sub = subs[0];
    const newBalance = sub.credits_remaining + packCredits;

    await query(
      `UPDATE user_subscriptions SET credits_remaining = $1 WHERE id = $2`,
      [newBalance, sub.id]
    );

    await query(
      `INSERT INTO credit_ledger (user_id, amount, balance_after, operation, operation_detail)
       VALUES ($1, $2, $3, 'credit_pack_purchase', $4::jsonb)`,
      [input.userId, packCredits, newBalance, JSON.stringify({ packId: input.packId, credits: packCredits })]
    );

    await query(
      `INSERT INTO billing_events (user_id, event_type, event_data)
       VALUES ($1, 'credit_pack_purchased', $2::jsonb)`,
      [input.userId, JSON.stringify({ packId: input.packId, credits: packCredits })]
    );

    return { success: true };
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return true;
  }

  async handleWebhook(_event: WebhookEvent): Promise<WebhookResult> {
    return { handled: false, error: "Webhook handling not supported in local mode" };
  }
}

// =============================================
// Stripe Provider (Future — placeholder)
// =============================================

class StripeBillingProvider implements BillingProvider {
  name = "stripe";
  isConfigured = false;

  constructor() {
    this.isConfigured = !!process.env.STRIPE_SECRET_KEY;
  }

  async createCheckoutSession(_input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.isConfigured) return { success: false, error: "Stripe not configured" };
    return { success: false, error: "Stripe checkout not yet implemented" };
  }

  async cancelSubscription(_subscriptionId: string): Promise<boolean> {
    return false;
  }

  async reactivateSubscription(_subscriptionId: string): Promise<boolean> {
    return false;
  }

  async changePlan(_subscriptionId: string, _newPlanId: string): Promise<PlanChangeResult> {
    return { success: false, effectiveDate: "", error: "Stripe not configured" };
  }

  async purchaseCreditPack(_input: CreditPackInput): Promise<CheckoutResult> {
    return { success: false, error: "Stripe not configured" };
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    return false;
  }

  async handleWebhook(_event: WebhookEvent): Promise<WebhookResult> {
    return { handled: false, error: "Stripe not configured" };
  }
}

// =============================================
// Factory
// =============================================

let _provider: BillingProvider | null = null;

export function getBillingProvider(): BillingProvider {
  if (_provider) return _provider;
  if (process.env.STRIPE_SECRET_KEY) {
    _provider = new StripeBillingProvider();
  } else {
    _provider = new LocalBillingProvider();
  }
  return _provider;
}

// =============================================
// Grace Period Handler
// =============================================

export async function handleGracePeriod(userId: string): Promise<{
  inGracePeriod: boolean;
  gracePeriodEnd: string | null;
  daysRemaining: number;
  action: "none" | "downgrade" | "suspend";
}> {
  const subs = await query<any>(
    `SELECT * FROM user_subscriptions WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  if (!subs.length) {
    return { inGracePeriod: false, gracePeriodEnd: null, daysRemaining: 0, action: "none" };
  }

  const sub = subs[0];

  // Check for scheduled downgrade
  if (sub.status === "downgrading" && sub.downgrade_at) {
    const downgradeDate = new Date(sub.downgrade_at);
    const now = new Date();

    if (now >= downgradeDate && sub.pending_plan_id) {
      await query(
        `UPDATE user_subscriptions SET plan_id = $1, pending_plan_id = NULL, downgrade_at = NULL, status = 'active', plan_changed_at = NOW() WHERE id = $2`,
        [sub.pending_plan_id, sub.id]
      );

      const newPlans = await query<{ included_credits: number }>(
        `SELECT included_credits FROM billing_plans WHERE id = $1`,
        [sub.pending_plan_id]
      );

      if (newPlans.length) {
        await query(
          `UPDATE user_subscriptions SET credits_remaining = $1 WHERE id = $2`,
          [newPlans[0].included_credits, sub.id]
        );
      }

      await query(
        `INSERT INTO billing_events (user_id, event_type, event_data) VALUES ($1, 'plan_downgrade_executed', $2::jsonb)`,
        [userId, JSON.stringify({ toPlanId: sub.pending_plan_id })]
      );

      return { inGracePeriod: false, gracePeriodEnd: null, daysRemaining: 0, action: "downgrade" };
    }

    const daysRemaining = Math.max(0, Math.ceil((downgradeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return { inGracePeriod: true, gracePeriodEnd: sub.downgrade_at, daysRemaining, action: "none" };
  }

  // Check for grace period after payment failure
  if (sub.status === "past_due" || sub.status === "grace_period") {
    if (sub.grace_period_end) {
      const graceEnd = new Date(sub.grace_period_end);
      const now = new Date();
      const daysRemaining = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      if (now >= graceEnd) {
        const freePlans = await query<{ id: string }>(
          `SELECT id FROM billing_plans WHERE slug = 'free'`
        );

        if (freePlans.length) {
          await query(
            `UPDATE user_subscriptions SET plan_id = $1, status = 'active', grace_period_end = NULL, credits_remaining = 50 WHERE id = $2`,
            [freePlans[0].id, sub.id]
          );

          await query(
            `INSERT INTO billing_events (user_id, event_type, event_data) VALUES ($1, 'grace_period_expired_downgrade', $2::jsonb)`,
            [userId, JSON.stringify({ fromPlanId: sub.plan_id })]
          );
        }

        return { inGracePeriod: false, gracePeriodEnd: null, daysRemaining: 0, action: "suspend" };
      }

      return { inGracePeriod: true, gracePeriodEnd: sub.grace_period_end, daysRemaining, action: "none" };
    }
  }

  return { inGracePeriod: false, gracePeriodEnd: null, daysRemaining: 0, action: "none" };
}

// =============================================
// Subscription State Machine
// =============================================

export type SubscriptionState =
  | "active"
  | "past_due"
  | "grace_period"
  | "cancelled"
  | "downgrading"
  | "trialing"
  | "pending_change";

export async function getEffectiveSubscriptionState(userId: string): Promise<{
  state: SubscriptionState;
  planSlug: string;
  creditsRemaining: number;
  canUseFeature: (feature: string) => boolean;
}> {
  const rows = await query<any>(
    `SELECT us.*, bp.slug AS plan_slug, bp.name AS plan_name,
            bp.included_credits, bp.investor_db_limit, bp.deep_research_limit,
            bp.pitch_deck_limit, bp.campaign_limit, bp.email_accounts_limit, bp.team_seats
     FROM user_subscriptions us
     JOIN billing_plans bp ON us.plan_id = bp.id
     WHERE us.user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (!rows.length) {
    return {
      state: "active",
      planSlug: "free",
      creditsRemaining: 0,
      canUseFeature: () => false,
    };
  }

  const sub = rows[0];

  const graceInfo = await handleGracePeriod(userId);

  let effectiveState: SubscriptionState = sub.status;
  if (graceInfo.inGracePeriod) effectiveState = "grace_period";

  const canUseFeature = (feature: string): boolean => {
    if (effectiveState === "cancelled") return false;
    if (effectiveState === "grace_period") {
      return ["view_investors", "view_profile", "view_dashboard"].includes(feature);
    }
    return true;
  };

  return {
    state: effectiveState,
    planSlug: sub.plan_slug,
    creditsRemaining: sub.credits_remaining,
    canUseFeature,
  };
}
