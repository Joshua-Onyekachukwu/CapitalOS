// =============================================
// Founding Member — Stripe Checkout
// =============================================
// Creates a Stripe Checkout Session for the $9.99 founding member payment.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";

// Simple in-memory rate limit: max 3 checkout attempts per email per hour
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(email);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY || "");
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Server-side price constants — never trust client input for pricing
const FOUNDING_MEMBER_AMOUNT = 999; // $9.99 in cents
const FOUNDING_MEMBER_CURRENCY = "usd";

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

    // Validate email format strictly
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Block disposable email domains
    const domain = normalizedEmail.split("@")[1];
    const disposableDomains = new Set([
      "mailinator.com", "yopmail.com", "tempmail.com", "guerrillamail.com",
      "trashmail.com", "maildrop.cc", "10minutemail.com", "throwaway.email",
    ]);
    if (disposableDomains.has(domain)) {
      return NextResponse.json({ error: "Please use a permanent email address" }, { status: 400 });
    }

    // Rate limit check
    if (!checkRateLimit(normalizedEmail)) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    // Check if already a founding member (prevent duplicate payments)
    const sp = getSupabase();
    const { data: existing } = await sp
      .from("founding_members")
      .select("id, payment_status")
      .eq("email", normalizedEmail)
      .eq("payment_status", "paid")
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "You are already a founding member!" },
        { status: 409 }
      );
    }

    // Sanitize name — strip anything that isn't letters, spaces, hyphens, or apostrophes
    const sanitizedName = name && typeof name === "string"
      ? name.replace(/[^a-zA-Z\s\-'.]/g, "").trim().slice(0, 100)
      : "";

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: normalizedEmail,
      line_items: [
        {
          price_data: {
            currency: FOUNDING_MEMBER_CURRENCY,
            product_data: {
              name: "Capital OS — Founding Member",
              description:
                "Reserve early access. Your $9.99 becomes platform credit when we launch.",
            },
            unit_amount: FOUNDING_MEMBER_AMOUNT,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "founding_member",
        email: normalizedEmail,
        name: sanitizedName,
        amount_cents: String(FOUNDING_MEMBER_AMOUNT),
        currency: FOUNDING_MEMBER_CURRENCY,
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
