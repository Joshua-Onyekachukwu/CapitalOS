// =============================================
// POST /api/webhooks/stripe
// =============================================
// The only place a payment becomes an entitlement. The signature is verified
// against the raw request body — never the parsed JSON, which reserialises
// differently and would let an unsigned payload through — and an unsigned or
// mis-signed request is rejected before any database write.
//
// Handled events:
//   checkout.session.completed      → create/claim the local subscription
//   customer.subscription.*         → status and period changes (renew, cancel)
//   invoice.payment_failed          → past_due, without dropping access
//
// Writes go through the Supabase client, not lib/db's query(): that helper only
// parses a subset of SQL and silently cannot express these updates.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { getStripe, STRIPE_UNCONFIGURED } from "@/lib/services/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocalStatus = "active" | "past_due" | "cancelled" | "trialing";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function mapStatus(status: Stripe.Subscription.Status): LocalStatus {
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
    case "incomplete_expired":
      return "cancelled";
    default:
      // incomplete / paused: keep access as-is rather than guessing.
      return "past_due";
  }
}

function periodBounds(subscription: Stripe.Subscription): { start: Date | null; end: Date | null } {
  // Stripe moved period fields onto subscription items in recent API versions;
  // read the item first and fall back to the legacy top-level fields.
  const item = subscription.items?.data?.[0] as unknown as
    { current_period_start?: number; current_period_end?: number } | undefined;
  const legacy = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const startSec = item?.current_period_start ?? legacy.current_period_start;
  const endSec = item?.current_period_end ?? legacy.current_period_end;
  return {
    start: startSec ? new Date(startSec * 1000) : null,
    end: endSec ? new Date(endSec * 1000) : null,
  };
}

async function upsertLocalSubscription(params: {
  userId: string;
  planId: string | null;
  status: LocalStatus;
  customerId: string | null;
  subscriptionId: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  cancelAt: Date | null;
}): Promise<void> {
  const sp = getSp();

  const { data: existing, error: findError } = await sp
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (findError) throw new Error(findError.message);

  const full = {
    user_id: params.userId,
    plan_id: params.planId,
    status: params.status,
    stripe_customer_id: params.customerId,
    stripe_subscription_id: params.subscriptionId,
    current_period_start: params.periodStart?.toISOString() ?? null,
    current_period_end: params.periodEnd?.toISOString() ?? null,
    cancel_at: params.cancelAt?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing && existing.length > 0) {
    // Only overwrite fields this event actually carries, so a subscription
    // update cannot blank the plan or the Stripe customer recorded earlier.
    const patch: Record<string, unknown> = {
      status: full.status,
      updated_at: full.updated_at,
      cancel_at: full.cancel_at,
    };
    for (const key of [
      "plan_id",
      "stripe_customer_id",
      "stripe_subscription_id",
      "current_period_start",
      "current_period_end",
    ] as const) {
      if (full[key] !== null) patch[key] = full[key];
    }
    const { error } = await sp.from("user_subscriptions").update(patch).eq("id", existing[0].id);
    if (error) throw new Error(error.message);
    return;
  }

  if (!params.planId) {
    throw new Error("Cannot create a subscription row without a plan");
  }

  const { error } = await sp.from("user_subscriptions").insert({
    ...full,
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

async function syncFromSubscription(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.user_id || null;
  const planId = subscription.metadata?.plan_id || null;
  if (!userId) {
    console.warn("[stripe webhook] subscription without user_id metadata:", subscription.id);
    return;
  }

  const { start, end } = periodBounds(subscription);
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : (subscription.customer?.id ?? null);

  await upsertLocalSubscription({
    userId,
    planId,
    status: mapStatus(subscription.status),
    customerId,
    subscriptionId: subscription.id,
    periodStart: start,
    periodEnd: end,
    cancelAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : null,
  });
}

async function syncFromCheckout(session: Stripe.Checkout.Session, stripe: Stripe): Promise<void> {
  const userId = session.metadata?.user_id || session.client_reference_id || null;
  const planId = session.metadata?.plan_id || null;
  if (!userId) {
    console.warn("[stripe webhook] checkout session without user metadata:", session.id);
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);

  // A subscription id on the session is the authoritative link; retrieve it so
  // status and periods come from Stripe rather than being assumed "active".
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const merged: Stripe.Subscription = {
      ...subscription,
      metadata: {
        ...subscription.metadata,
        user_id: userId,
        ...(planId ? { plan_id: planId } : {}),
      },
    };
    await syncFromSubscription(merged);
    return;
  }

  // One-time Sprint purchase: access runs for the plan's window from now. The
  // window rides on the session metadata, with the plan row as a fallback.
  let windowMonths = Number(session.metadata?.sprint_months || 0);
  if (!windowMonths && planId) {
    const { data } = await getSp()
      .from("billing_plans")
      .select("window_months")
      .eq("id", planId)
      .limit(1);
    windowMonths = Number(data?.[0]?.window_months ?? 0);
  }

  const start = windowMonths > 0 ? new Date() : null;
  const end = start ? new Date(start) : null;
  if (end) end.setMonth(end.getMonth() + windowMonths);

  await upsertLocalSubscription({
    userId,
    planId,
    status: "active",
    customerId,
    subscriptionId: null,
    periodStart: start,
    periodEnd: end,
    cancelAt: null,
  });
}

async function markPastDueByCustomer(customerId: string): Promise<void> {
  const { error } = await getSp()
    .from("user_subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("stripe_customer_id", customerId)
    .in("status", ["active", "trialing"]);
  if (error) throw new Error(error.message);
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json(STRIPE_UNCONFIGURED, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error(
      "[stripe webhook] signature verification failed:",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await syncFromCheckout(event.data.object as Stripe.Checkout.Session, stripe);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncFromSubscription(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : (invoice.customer?.id ?? null);
        if (customerId) await markPastDueByCustomer(customerId);
        break;
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        break;
    }
  } catch (err) {
    // A 500 tells Stripe to retry, which is what we want for a transient DB
    // failure. The event id is logged so a replay can be traced.
    console.error(
      `[stripe webhook] ${event.type} (${event.id}) failed:`,
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ error: "Webhook handling failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true, type: event.type });
}
