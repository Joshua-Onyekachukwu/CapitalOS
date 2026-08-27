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

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "");
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.type !== "founding_member") {
        return NextResponse.json({ received: true });
      }

      const sp = getSupabase();
      const email = session.metadata.email || session.customer_email || "";
      const name = session.metadata.name || "";

      // Upsert founding member record
      const { error } = await sp.from("founding_members").upsert(
        {
          email: email.toLowerCase(),
          name: name || null,
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent as string,
          stripe_customer_id: session.customer as string,
          payment_status: "paid",
          payment_amount: (session.amount_total || 999) / 100,
          currency: session.currency || "usd",
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
