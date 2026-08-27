// =============================================
// Founding Member — Stripe Checkout
// =============================================
// Creates a Stripe Checkout Session for the $9.99 founding member payment.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "");
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe is not configured. Set STRIPE_SECRET_KEY in environment." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { email, name } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email.toLowerCase().trim(),
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Capital OS — Founding Member",
              description:
                "Reserve early access. Your $9.99 becomes platform credit when we launch.",
            },
            unit_amount: 999, // $9.99 in cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "founding_member",
        email: email.toLowerCase().trim(),
        name: name || "",
      },
      success_url: `${APP_URL}/founding-member?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/#waitlist`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
