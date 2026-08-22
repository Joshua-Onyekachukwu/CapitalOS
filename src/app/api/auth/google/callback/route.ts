// =============================================
// Google OAuth — Callback Route
// =============================================
// Exchanges authorization code for tokens and stores them encrypted.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptToken } from "@/lib/services/email/crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings`;

  if (error) {
    return NextResponse.redirect(
      `${dashboardUrl}?email_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${dashboardUrl}?email_error=${encodeURIComponent("No authorization code received")}`
    );
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: GOOGLE_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return NextResponse.redirect(
        `${dashboardUrl}?email_error=${encodeURIComponent(`Token exchange failed: ${errText}`)}`
      );
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    let email = "";
    let displayName = "";

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      email = userInfo.email || "";
      displayName = userInfo.name || "";
    }

    // Get authenticated user from Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Extract user ID from the session cookie
    const cookieHeader = request.headers.get("cookie") || "";
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Try to get the user from the auth cookie
    const authCookie = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("sb-"));

    let userId = "";

    if (authCookie) {
      const tokenValue = authCookie.split("=")[1];
      const { data: { user } } = await supabaseAnon.auth.getUser(tokenValue);
      userId = user?.id || "";
    }

    // Fallback: try getting user from service role
    if (!userId) {
      // Parse cookies to find auth token
      const cookies = cookieHeader.split(";").reduce((acc, c) => {
        const [key, ...val] = c.trim().split("=");
        acc[key] = val.join("=");
        return acc;
      }, {} as Record<string, string>);

      // Try all possible cookie keys
      for (const [key, val] of Object.entries(cookies)) {
        if (key.includes("auth") || key.includes("supabase")) {
          const { data: { user } } = await supabase.auth.getUser(val);
          if (user) {
            userId = user.id;
            break;
          }
        }
      }
    }

    if (!userId) {
      return NextResponse.redirect(
        `${dashboardUrl}?email_error=${encodeURIComponent("Could not identify user. Please sign in first.")}`
      );
    }

    // Encrypt tokens
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token || "");

    // Store or update email account
    const { error: upsertError } = await supabase
      .from("email_accounts")
      .upsert(
        {
          user_id: userId,
          provider: "google",
          email_address: email,
          display_name: displayName,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
          scopes: tokens.scope?.split(" ") || [],
          is_active: true,
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      return NextResponse.redirect(
        `${dashboardUrl}?email_error=${encodeURIComponent(`Failed to save email account: ${upsertError.message}`)}`
      );
    }

    return NextResponse.redirect(
      `${dashboardUrl}?email_connected=google`
    );
  } catch (err) {
    return NextResponse.redirect(
      `${dashboardUrl}?email_error=${encodeURIComponent(`Google OAuth failed: ${String(err)}`)}`
    );
  }
}
