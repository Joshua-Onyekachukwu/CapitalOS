// =============================================
// Signup API — auto-confirm now, real email activation behind a flag
// =============================================
// Default (SIGNUP_AUTO_CONFIRM unset/true): accounts are created confirmed
// via the service-role admin API and the user signs in immediately — no
// dead-end confirmation loop while Supabase has no SMTP provider and its
// Site URL is still localhost (see docs/supabase-url-configuration.md).
//
// Once the dashboard-side setup is done (Auth → SMTP provider + Site URL +
// redirect allowlist per the doc), set SIGNUP_AUTO_CONFIRM=false and signup
// switches to supabase.auth.signUp, which sends the confirmation email via
// the configured provider; the user activates through /auth/callback.
//
// POST /api/auth/signup  { fullName, email, password }

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
  const autoConfirm = process.env.SIGNUP_AUTO_CONFIRM !== "false"; // default on

  try {
    if (autoConfirm) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
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
        requiresActivation: false,
        userId: data.user?.id,
        message: "Account created. You can log in immediately.",
      });
    }

    // Real email activation: create the user unconfirmed through the public
    // API so Supabase sends the confirmation email via its configured SMTP
    // provider. The link lands on /auth/callback (allowlisted domain).
    const { createClient: createSsrClient } = await import("@/lib/supabase/server");
    const publicClient = await createSsrClient();
    const { error } = await publicClient.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, signup_source: "email_activation" },
        emailRedirectTo: `${request.nextUrl.origin}/auth/callback`,
      },
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
      confirmed: false,
      requiresActivation: true,
      message: "Check your email to activate your account.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err?.message || "Signup failed") },
      { status: 500 }
    );
  }
}
