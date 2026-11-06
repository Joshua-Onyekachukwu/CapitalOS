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

import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { query } from "@/lib/db";
import { getStripe, STRIPE_UNCONFIGURED } from "@/lib/services/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LocalStatus = "active" | "past_due" | "cancelled" | "trialing";

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
    | { current_period_start?: number; current_period_end?: number }
    | undefined;
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
  const existing = await query<{ id: string }>(
    `select id from user_subscriptions where user_id = $1 order by created_at desc limit 1`,
    [params.userId]
  );

  if (existing.length > 0) {
    await query(
      `update user_subscriptions set
         plan_id = coalesce($2, plan_id),
         status = $3,
         stripe_customer_id = coalesce($4, stripe_customer_id),
         stripe_subscription_id = coalesce($5, stripe_subscription_id),
         current_period_start = coalesce($6, current_period_start),
         current_period_end = coalesce($7, current_period_end),
         cancel_at = $8,
         updated_at = now()
       where id = $1`,
      [
        existing[0].id,
        params.planId,
        params.status,
        params.customerId,
        params.subscriptionId,
        params.periodStart,
        params.periodEnd,
        params.cancelAt,
      ]
    );
    return;
  }

  if (!params.planId) {
    throw new Error("Cannot create a subscription row without a plan");
  }

  await query(
    `insert into user_subscriptions (
       user_id, plan_id, status, stripe_customer_id, stripe_subscription_id,
       current_period_start, current_period_end, cancel_at, created_at, updated_at
     ) values ($1,$2,$3,$4,$5,$6,$7,$8, now(), now())`,
    [
      params.userId,
      params.planId,
      params.status,
      params.customerId,
      params.subscriptionId,
      params.periodStart,
      params.periodEnd,
      params.cancelAt,
    ]
  );
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
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null;

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

async function syncFromCheckout(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> {
  const userId = session.metadata?.user_id || session.client_reference_id || null;
  const planId = session.metadata?.plan_id || null;
  if (!userId) {
    console.warn("[stripe webhook] checkout session without user metadata:", session.id);
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

  // A subscription id on the session is the authoritative link; retrieve it so
  // periods and status come from Stripe rather than being assumed "active".
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    // metadata on subscription_data may lag; the session's plan is authoritative.
    const merged: Stripe.Subscription = {
      ...subscription,
      metadata: { ...subscription.metadata, user_id: userId, ...(planId ? { plan_id: planId } : {}) },
    };
    await syncFromSubscription(merged);
    return;
  }

  const { start, end } = { start: null as Date | null, end: null as Date | null };
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
  await query(
    `update user_subscriptions set status = 'past_due', updated_at = now()
     where stripe_customer_id = $1 and status in ('active','trialing')`,
    [customerId]
  );
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
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
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
