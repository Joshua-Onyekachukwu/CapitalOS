// =============================================
// Stripe service
// =============================================
// One place that decides whether billing is live, so every route answers the
// same way when it is not. Keys are read from the environment only; nothing
// here touches the DB or the network at import time.

import Stripe from "stripe";
import type { BillingPlan } from "@/lib/billing/plans";

/** Test keys are sk_test_…, live keys sk_live_…. Anything else is ignored. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^sk_(test|live)_/.test(key)) return null;
  return new Stripe(key, { maxNetworkRetries: 1, timeout: 20_000 });
}

export function isStripeConfigured(): boolean {
  return getStripe() !== null;
}

export function stripeMode(): "test" | "live" | "unconfigured" {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return "unconfigured";
}

export interface StripePriceData {
  currency: string;
  unit_amount: number;
  recurring: { interval: "month" | "year" };
  product_data: { name: string; metadata: Record<string, string> };
}

/**
 * Build an inline price for a plan. Inline `price_data` means checkout works
 * without pre-created Stripe products/prices, which is what a test-mode demo
 * needs — but every session creates a new price object, so once the real price
 * IDs exist they should be used instead (`STRIPE_PRICE_<SLUG>`).
 */
export function priceDataFor(
  plan: BillingPlan,
  interval: "month" | "year"
): StripePriceData | null {
  const override =
    process.env[`STRIPE_PRICE_${plan.slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`];
  if (override) {
    // A real price id cannot be expressed as price_data; the caller checks this
    // env first and passes the id directly.
    return null;
  }

  const useAnnual =
    interval === "year" && typeof plan.annualPrice === "number" && plan.annualPrice > 0;
  const amount = useAnnual ? (plan.annualPrice as number) : plan.monthlyPrice;
  if (!amount || amount <= 0) return null;

  // Billing plan amounts are stored in whole dollars (docs/07-pricing-billing).
  return {
    currency: "usd",
    unit_amount: Math.round(amount * 100),
    recurring: { interval: useAnnual ? "year" : "month" },
    product_data: {
      name: `${plan.name} — ${useAnnual ? "annual" : "monthly"}`,
      metadata: { plan_slug: plan.slug, plan_id: plan.id },
    },
  };
}

export interface StripeOneTimePriceData {
  currency: string;
  unit_amount: number;
  product_data: { name: string; metadata: Record<string, string> };
}

/**
 * Inline price for a Sprint: one payment, no recurring interval. `payment` mode
 * sessions reject a price that carries `recurring`, so this is built separately
 * rather than reusing priceDataFor.
 */
export function oneTimePriceDataFor(plan: BillingPlan): StripeOneTimePriceData | null {
  if (configuredPriceId(plan)) return null;
  if (!plan.monthlyPrice || plan.monthlyPrice <= 0) return null;

  const months = plan.windowMonths ?? 3;
  return {
    currency: "usd",
    unit_amount: Math.round(plan.monthlyPrice * 100),
    product_data: {
      name: `${plan.name} — ${months}-month sprint`,
      metadata: { plan_slug: plan.slug, plan_id: plan.id },
    },
  };
}

/** Price id from env, when the project has real Stripe prices configured. */
export function configuredPriceId(plan: BillingPlan): string | null {
  return process.env[`STRIPE_PRICE_${plan.slug.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`] ?? null;
}

export const STRIPE_UNCONFIGURED = {
  error:
    "Billing is not configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (test mode) to enable checkout.",
  code: "stripe_unconfigured",
} as const;
