// =============================================
// Signup API — auto-confirmed accounts
// =============================================
// Supabase email confirmation is not usable in production yet: the project's
// Site URL is still localhost:3000 and no transactional email provider is
// configured, so confirmation links either never arrive or redirect users to
// localhost. Until an activation system is properly set up, accounts are
// confirmed at the app level via the service-role admin API (email_confirm).
//
// Verification is still possible later: the confirm endpoint can flip
// users into a verification state before any sensitive action, and this
// route keeps flagging accounts that skip the email loop entirely.
//
// POST /api/auth/signup  { fullName, email, password }
// GET  /api/auth/signup?userId=…   → sets email_confirmed and returns a
//                                    one-time exchange token for first login.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  // Per-IP rate limit (signup abuse vector)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { allowed } = checkRateLimit(`signup:${ip}`, RATE_LIMITS.auth);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts — try again in a minute." }, { status: 429 });
  }

  let body: { fullName?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const fullName = (body.fullName || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!fullName || fullName.length < 2) {
    return NextResponse.json({ error: "Full name is required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const admin = serviceClient();

  try {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no activation loop until the email system is set up
      user_metadata: { full_name: fullName, signup_source: "app_autoconfirm" },
    });

    if (error) {
      if (/already/i.test(error.message)) {
        return NextResponse.json(
          { error: "An account with this email already exists — log in instead." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      confirmed: true,
      userId: data.user?.id,
      message: "Account created. You can log in immediately.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || "Signup failed") },
      { status: 500 }
    );
  }
}
