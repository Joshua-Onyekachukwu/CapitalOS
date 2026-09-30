// =============================================
// Waitlist API Route
// =============================================
// Public endpoint for collecting waitlist emails.
// No auth required — anonymous users can sign up.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  rateLimitHeaders,
  RATE_LIMITS,
  type RateLimitConfig,
} from "@/lib/middleware/rate-limit";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST — Join the waitlist
export async function POST(request: NextRequest) {
  // Per-IP rate limit: the waitlist is a public write-and-count endpoint.
  // Shares the auth limiter's 10/min window; cast for RATE_LIMITS' narrow
  // inferred keyPrefix type.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed, resetAt, backend } = await checkRateLimit(
    `waitlist:${ip}`,
    RATE_LIMITS.auth as RateLimitConfig
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts — try again in a minute." },
      { status: 429, headers: rateLimitHeaders(RATE_LIMITS.auth as RateLimitConfig, resetAt, backend) }
    );
  }

  try {
    const body = await request.json();
    const { email, name, referralCode } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const sp = getSupabase();

    // Check if already signed up
    const { data: existing } = await sp
      .from("waitlist")
      .select("id, status")
      .eq("email", normalizedEmail)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: true, message: "You're already on the list!", alreadySignedUp: true }
      );
    }

    // Generate a referral code from the email
    const referral = normalizedEmail.split("@")[0] + "-" + Math.random().toString(36).substring(2, 8);

    // Insert into waitlist
    const { error } = await sp.from("waitlist").insert({
      email: normalizedEmail,
      name: name || null,
      source: "landing_page",
      referral_code: referral,
      referred_by: referralCode || null,
      metadata: {
        userAgent: request.headers.get("user-agent") || "",
        timestamp: new Date().toISOString(),
      },
    });

    if (error) {
      console.error("Waitlist insert error:", error);
      return NextResponse.json(
        { error: "Failed to join waitlist. Please try again." },
        { status: 500 }
      );
    }

    // Get position in line
    const { count: position } = await sp
      .from("waitlist")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({
      success: true,
      message: "You're on the list!",
      position: position || 1,
      referralCode: referral,
    });
  } catch (err) {
    console.error("Waitlist API error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

// GET — Get waitlist stats (public, for social proof)
export async function GET() {
  try {
    const sp = getSupabase();

    const { count: total } = await sp
      .from("waitlist")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({
      totalSignups: total || 0,
    });
  } catch {
    return NextResponse.json({ totalSignups: 0 });
  }
}
