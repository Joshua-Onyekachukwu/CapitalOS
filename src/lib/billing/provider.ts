// =============================================
// Billing Provider Abstraction
// =============================================
// Provider-agnostic billing interface.
// When Stripe is added, only the adapter needs implementation.

import { createClient } from "@supabase/supabase-js";

// =============================================
// Types
// =============================================

export interface BillingProvider {
  name: string;
  isConfigured: boolean;

  // Subscription management
  createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult>;
  cancelSubscription(subscriptionId: string): Promise<boolean>;
  reactivateSubscription(subscriptionId: string): Promise<boolean>;

  // Plan changes
  changePlan(subscriptionId: string, newPlanId: string): Promise<PlanChangeResult>;

  // Credit purchases
  purchaseCreditPack(input: CreditPackInput): Promise<CheckoutResult>;

  // Webhooks
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
  packId: string; // 'pack_100' or 'pack_500'
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

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

class LocalBillingProvider implements BillingProvider {
  name = "local";
  isConfigured = true; // Always available

  async createCheckoutSession(input: CheckoutInput): Promise<CheckoutResult> {
    // When Stripe is not configured, directly activate the plan
    const supabase = getSupabase();

    const { data: plan } = await supabase
      .from("billing_plans")
      .select("id")
      .eq("id", input.planId)
      .single();

    if (!plan) {
      return { success: false, error: "Plan not found" };
    }

    // Log the billing event
    await supabase.from("billing_events").insert({
      user_id: input.userId,
      event_type: "checkout_completed_local",
      event_data: { planId: input.planId },
    });

    return { success: true };
  }

  async cancelSubscription(_subscriptionId: string): Promise<boolean> {
    const supabase = getSupabase();

    // Set cancel_at to end of current period (don't immediately revoke)
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("current_period_end")
      .eq("id", _subscriptionId)
      .single();

    if (!sub) return false;

    await supabase
      .from("user_subscriptions")
      .update({
        cancel_at: sub.current_period_end,
        status: "active", // Still active until period end
      })
      .eq("id", _subscriptionId);

    await supabase.from("billing_events").insert({
      user_id: "", // Will be filled by the subscription lookup
      event_type: "subscription_cancel_requested",
      event_data: { subscriptionId: _subscriptionId, effectiveAt: sub.current_period_end },
    });

    return true;
  }

  async reactivateSubscription(subscriptionId: string): Promise<boolean> {
    const supabase = getSupabase();

    await supabase
      .from("user_subscriptions")
      .update({
        cancel_at: null,
        status: "active",
      })
      .eq("id", subscriptionId);

    return true;
  }

  async changePlan(subscriptionId: string, newPlanId: string): Promise<PlanChangeResult> {
    const supabase = getSupabase();

    // Get new plan details
    const { data: newPlan } = await supabase
      .from("billing_plans")
      .select("*")
      .eq("id", newPlanId)
      .single();

    if (!newPlan) {
      return { success: false, effectiveDate: "", error: "Plan not found" };
    }

    // Get current subscription
    const { data: currentSub } = await supabase
      .from("user_subscriptions")
      .select("*")
      .eq("id", subscriptionId)
      .single();

    if (!currentSub) {
      return { success: false, effectiveDate: "", error: "Subscription not found" };
    }

    // Upgrade: immediate. Downgrade: at period end.
    const isUpgrade = newPlan.monthly_price > 0 && (
      currentSub.plan_id === (await supabase.from("billing_plans").select("id").eq("slug", "free").single()).data?.id
    );

    if (isUpgrade) {
      // Immediate upgrade
      await supabase
        .from("user_subscriptions")
        .update({
          previous_plan_id: currentSub.plan_id,
          plan_id: newPlanId,
          credits_remaining: newPlan.included_credits,
          credits_used_this_period: 0,
          plan_changed_at: new Date().toISOString(),
        })
        .eq("id", subscriptionId);

      // Log event
      await supabase.from("billing_events").insert({
        user_id: currentSub.user_id,
        event_type: "plan_upgraded",
        event_data: {
          from: currentSub.plan_id,
          to: newPlanId,
          creditsAdded: newPlan.included_credits,
        },
      });

      return { success: true, effectiveDate: new Date().toISOString() };
    } else {
      // Downgrade: schedule for period end
      await supabase
        .from("user_subscriptions")
        .update({
          pending_plan_id: newPlanId,
          downgrade_at: currentSub.current_period_end,
          status: "downgrading",
        })
        .eq("id", subscriptionId);

      await supabase.from("billing_events").insert({
        user_id: currentSub.user_id,
        event_type: "plan_downgrade_scheduled",
        event_data: {
          from: currentSub.plan_id,
          to: newPlanId,
          effectiveAt: currentSub.current_period_end,
        },
      });

      return { success: true, effectiveDate: currentSub.current_period_end };
    }
  }

  async purchaseCreditPack(input: CreditPackInput): Promise<CheckoutResult> {
    const supabase = getSupabase();

    const packCredits = input.packId === "pack_500" ? 500 : 100;

    // Directly add credits (no Stripe)
    const { data: sub } = await supabase
      .from("user_subscriptions")
      .select("id, credits_remaining")
      .eq("user_id", input.userId)
      .eq("status", "active")
      .single();

    if (!sub) {
      return { success: false, error: "No active subscription" };
    }

    const newBalance = sub.credits_remaining + packCredits;

    await supabase
      .from("user_subscriptions")
      .update({ credits_remaining: newBalance })
      .eq("id", sub.id);

    await supabase.from("credit_ledger").insert({
      user_id: input.userId,
      amount: packCredits,
      balance_after: newBalance,
      operation: "credit_pack_purchase",
      operation_detail: { packId: input.packId, credits: packCredits },
    });

    await supabase.from("billing_events").insert({
      user_id: input.userId,
      event_type: "credit_pack_purchased",
      event_data: { packId: input.packId, credits: packCredits },
    });

    return { success: true };
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    // Local provider doesn't verify webhooks
    return true;
  }

  async handleWebhook(event: WebhookEvent): Promise<WebhookResult> {
    // Local provider handles events directly, no webhook processing needed
    return { handled: false, error: "Webhook handling not supported in local mode" };
  }
}

// =============================================
// Stripe Provider (Future — placeholder)
// =============================================

class StripeBillingProvider implements BillingProvider {
  name = "stripe";
  isConfigured = false; // Will be true when Stripe keys are provided

  constructor() {
    // Check if Stripe is configured
    this.isConfigured = !!process.env.STRIPE_SECRET_KEY;
  }

  async createCheckoutSession(_input: CheckoutInput): Promise<CheckoutResult> {
    if (!this.isConfigured) {
      return { success: false, error: "Stripe not configured" };
    }
    // TODO: Implement Stripe checkout session creation
    return { success: false, error: "Stripe checkout not yet implemented" };
  }

  async cancelSubscription(_subscriptionId: string): Promise<boolean> {
    if (!this.isConfigured) return false;
    // TODO: Implement Stripe subscription cancellation
    return false;
  }

  async reactivateSubscription(_subscriptionId: string): Promise<boolean> {
    if (!this.isConfigured) return false;
    // TODO: Implement Stripe subscription reactivation
    return false;
  }

  async changePlan(_subscriptionId: string, _newPlanId: string): Promise<PlanChangeResult> {
    if (!this.isConfigured) {
      return { success: false, effectiveDate: "", error: "Stripe not configured" };
    }
    // TODO: Implement Stripe plan change with proration
    return { success: false, effectiveDate: "", error: "Stripe plan change not yet implemented" };
  }

  async purchaseCreditPack(_input: CreditPackInput): Promise<CheckoutResult> {
    if (!this.isConfigured) {
      return { success: false, error: "Stripe not configured" };
    }
    // TODO: Implement Stripe credit pack checkout
    return { success: false, error: "Stripe credit pack purchase not yet implemented" };
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    if (!this.isConfigured) return false;
    // TODO: Implement Stripe webhook signature verification
    return false;
  }

  async handleWebhook(_event: WebhookEvent): Promise<WebhookResult> {
    if (!this.isConfigured) {
      return { handled: false, error: "Stripe not configured" };
    }
    // TODO: Handle Stripe webhook events (invoice.paid, customer.subscription.updated, etc.)
    return { handled: false, error: "Stripe webhook handling not yet implemented" };
  }
}

// =============================================
// Factory — Returns the appropriate provider
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

/**
 * Check if a subscription is in grace period and handle transitions.
 * Called on every billing check to ensure state consistency.
 */
export async function handleGracePeriod(userId: string): Promise<{
  inGracePeriod: boolean;
  gracePeriodEnd: string | null;
  daysRemaining: number;
  action: "none" | "downgrade" | "suspend";
}> {
  const supabase = getSupabase();

  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!sub) {
    return { inGracePeriod: false, gracePeriodEnd: null, daysRemaining: 0, action: "none" };
  }

  // Check for scheduled downgrade
  if (sub.status === "downgrading" && sub.downgrade_at) {
    const downgradeDate = new Date(sub.downgrade_at);
    const now = new Date();

    if (now >= downgradeDate && sub.pending_plan_id) {
      // Execute the downgrade
      await supabase
        .from("user_subscriptions")
        .update({
          plan_id: sub.pending_plan_id,
          pending_plan_id: null,
          downgrade_at: null,
          status: "active",
          plan_changed_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      // Get new plan credits
      const { data: newPlan } = await supabase
        .from("billing_plans")
        .select("included_credits")
        .eq("id", sub.pending_plan_id)
        .single();

      if (newPlan) {
        await supabase
          .from("user_subscriptions")
          .update({ credits_remaining: newPlan.included_credits })
          .eq("id", sub.id);
      }

      await supabase.from("billing_events").insert({
        user_id: userId,
        event_type: "plan_downgrade_executed",
        event_data: { toPlanId: sub.pending_plan_id },
      });

      return { inGracePeriod: false, gracePeriodEnd: null, daysRemaining: 0, action: "downgrade" };
    }

    const daysRemaining = Math.max(0, Math.ceil((downgradeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return { inGracePeriod: true, gracePeriodEnd: sub.downgrade_at, daysRemaining, action: "none" };
  }

  // Check for grace period after payment failure
  if (sub.status === "past_due" || sub.status === "grace_period") {
    const graceEnd = sub.grace_period_end ? new Date(sub.grace_period_end) : null;

    if (graceEnd) {
      const now = new Date();
      const daysRemaining = Math.max(0, Math.ceil((graceEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      if (now >= graceEnd) {
        // Grace period expired — downgrade to free
        const { data: freePlan } = await supabase
          .from("billing_plans")
          .select("id")
          .eq("slug", "free")
          .single();

        if (freePlan) {
          await supabase
            .from("user_subscriptions")
            .update({
              plan_id: freePlan.id,
              status: "active",
              grace_period_end: null,
              credits_remaining: 50,
            })
            .eq("id", sub.id);

          await supabase.from("billing_events").insert({
            user_id: userId,
            event_type: "grace_period_expired_downgrade",
            event_data: { fromPlanId: sub.plan_id },
          });
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

/**
 * Get the current effective subscription state for a user,
 * accounting for grace periods, scheduled downgrades, etc.
 */
export async function getEffectiveSubscriptionState(userId: string): Promise<{
  state: SubscriptionState;
  planSlug: string;
  creditsRemaining: number;
  canUseFeature: (feature: string) => boolean;
}> {
  const supabase = getSupabase();

  const { data: sub } = await supabase
    .from("v_user_billing")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!sub) {
    return {
      state: "active",
      planSlug: "free",
      creditsRemaining: 0,
      canUseFeature: () => false,
    };
  }

  const graceInfo = await handleGracePeriod(userId);

  let effectiveState: SubscriptionState = sub.subscription_status;
  if (graceInfo.inGracePeriod) effectiveState = "grace_period";

  // Feature access based on state
  const canUseFeature = (feature: string): boolean => {
    if (effectiveState === "cancelled") return false;
    if (effectiveState === "grace_period") {
      // Grace period allows read-only access
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
