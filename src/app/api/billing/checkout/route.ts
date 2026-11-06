// =============================================
// POST /api/billing/checkout
// =============================================
// Creates a Stripe Checkout session in subscription mode for one plan.
// With no key configured it answers 503 with an explicit reason rather than
// pretending to start a payment — the UI can show that message verbatim.
//
// Customer reuse: the id is stored on user_subscriptions by the webhook, so a
// second checkout for the same user reuses their customer instead of creating
// a new one each time.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { getActivePlans } from "@/lib/billing/plans";
import { query } from "@/lib/db";
import {
  getStripe,
  priceDataFor,
  configuredPriceId,
  STRIPE_UNCONFIGURED,
} from "@/lib/services/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appOrigin(request: NextRequest): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  if (configured) return configured.replace(/\/$/, "");
  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(STRIPE_UNCONFIGURED, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const planSlug = String(body.planSlug || "").trim();
  const interval: "month" | "year" = body.interval === "year" ? "year" : "month";

  if (!planSlug) {
    return NextResponse.json({ error: "planSlug is required" }, { status: 400 });
  }

  const plans = await getActivePlans();
  const plan = plans.find((p) => p.slug === planSlug);
  if (!plan) {
    return NextResponse.json({ error: `Unknown plan: ${planSlug}` }, { status: 400 });
  }

  const priceId = configuredPriceId(plan);
  const priceData = priceId ? null : priceDataFor(plan, interval);
  if (!priceId && !priceData) {
    return NextResponse.json(
      { error: `Plan ${plan.slug} has no price configured` },
      { status: 400 }
    );
  }

  // Reuse the customer if a previous subscription stored one.
  let customerId: string | null = null;
  try {
    const rows = await query<{ stripe_customer_id: string | null }>(
      `select stripe_customer_id from user_subscriptions where user_id = $1 limit 1`,
      [user.id]
    );
    customerId = rows[0]?.stripe_customer_id ?? null;
  } catch (err) {
    console.error("[billing/checkout] customer lookup failed:", err);
  }

  const origin = appOrigin(request);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(customerId
        ? { customer: customerId }
        : { customer_email: (user as { email?: string }).email || undefined }),
      line_items: [
        priceId
          ? { price: priceId, quantity: 1 }
          : { price_data: priceData!, quantity: 1 },
      ],
      client_reference_id: user.id,
      metadata: { user_id: user.id, plan_id: plan.id, plan_slug: plan.slug },
      subscription_data: {
        metadata: { user_id: user.id, plan_id: plan.id, plan_slug: plan.slug },
      },
      allow_promotion_codes: true,
      success_url: `${origin}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard/billing?checkout=cancelled`,
    });

    return NextResponse.json({ id: session.id, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    console.error("[billing/checkout] Stripe error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
