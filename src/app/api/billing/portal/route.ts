// =============================================
// POST /api/billing/portal
// =============================================
// Opens the Stripe-hosted billing portal, which is where a paying user cancels,
// changes card details and downloads invoices. It requires a Stripe customer,
// which only exists after a first checkout — so a 400 here is a real answer,
// not a bug.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { query } from "@/lib/db";
import { getStripe, STRIPE_UNCONFIGURED } from "@/lib/services/billing/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appOrigin(request: NextRequest): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "";
  return configured ? configured.replace(/\/$/, "") : request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const stripe = getStripe();
  if (!stripe) return NextResponse.json(STRIPE_UNCONFIGURED, { status: 503 });

  let customerId: string | null = null;
  try {
    const rows = await query<{ stripe_customer_id: string | null }>(
      `select stripe_customer_id from user_subscriptions where user_id = $1 limit 1`,
      [user.id]
    );
    customerId = rows[0]?.stripe_customer_id ?? null;
  } catch (err) {
    console.error("[billing/portal] customer lookup failed:", err);
  }

  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account yet. Complete a checkout first.", code: "no_customer" },
      { status: 400 }
    );
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appOrigin(request)}/dashboard/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Portal session failed";
    console.error("[billing/portal] Stripe error:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
