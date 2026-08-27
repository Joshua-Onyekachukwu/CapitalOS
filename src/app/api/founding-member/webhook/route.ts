// =============================================
// Founding Member — Stripe Webhook
// =============================================
// Handles Stripe webhook events to mark users as founding members after payment.
// Set this webhook URL in Stripe Dashboard:
//   https://your-domain.com/api/founding-member/webhook
// Events to listen for: checkout.session.completed

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// Server-side price constants — must match checkout route
const EXPECTED_AMOUNT = 999; // $9.99 in cents
const EXPECTED_CURRENCY = "usd";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "");
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// In-memory dedup: track processed event IDs to prevent replay
const processedEvents = new Set<string>();

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: "Stripe webhook not configured" },
        { status: 503 }
      );
    }

    const body = await request.text();
    const sig = request.headers.get("stripe-signature");

    if (!sig) {
      return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
    }

    const stripe = getStripe();

    // Verify webhook signature — this is the critical security check
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Dedup: skip if we already processed this event
    if (processedEvents.has(event.id)) {
      return NextResponse.json({ received: true, dedup: true });
    }
    processedEvents.add(event.id);

    // Clean up old event IDs (keep last 1000)
    if (processedEvents.size > 1000) {
      const iterator = processedEvents.values();
      for (let i = 0; i < 500; i++) {
        processedEvents.delete(iterator.next().value!);
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only process founding member payments
      if (session.metadata?.type !== "founding_member") {
        return NextResponse.json({ received: true });
      }

      // Validate amount and currency — prevent spoofed低价 payments
      if (session.amount_total !== EXPECTED_AMOUNT) {
        console.error(
          `Webhook amount mismatch: expected ${EXPECTED_AMOUNT}, got ${session.amount_total}`
        );
        return NextResponse.json({ error: "Amount mismatch" }, { status: 400 });
      }

      if (session.currency !== EXPECTED_CURRENCY) {
        console.error(
          `Webhook currency mismatch: expected ${EXPECTED_CURRENCY}, got ${session.currency}`
        );
        return NextResponse.json({ error: "Currency mismatch" }, { status: 400 });
      }

      // Only process completed payments
      if (session.payment_status !== "paid") {
        return NextResponse.json({ received: true });
      }

      const sp = getSupabase();
      const email = session.metadata.email || session.customer_email || "";
      const name = session.metadata.name || "";

      if (!email) {
        console.error("Webhook: no email in session metadata");
        return NextResponse.json({ error: "Missing email" }, { status: 400 });
      }

      // Upsert founding member record
      const { error } = await sp.from("founding_members").upsert(
        {
          email: email.toLowerCase(),
          name: name || null,
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent as string,
          stripe_customer_id: session.customer as string,
          payment_status: "paid",
          payment_amount: session.amount_total / 100,
          currency: session.currency,
          metadata: {
            stripeEventId: event.id,
            paymentMethod: session.payment_method_types?.[0] || "card",
          },
        },
        { onConflict: "stripe_session_id" }
      );

      if (error) {
        console.error("Failed to save founding member:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }

      // Try to link to existing user if they have an account
      try {
        const { data: users } = await sp.auth.admin.listUsers();
        const user = users?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        if (user) {
          await sp
            .from("founding_members")
            .update({ user_id: user.id })
            .eq("stripe_session_id", session.id);
        }
      } catch {
        // User may not exist yet — that's fine
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
