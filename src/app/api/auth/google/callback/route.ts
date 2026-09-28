// =============================================
// Google OAuth — Callback Route
// =============================================
// Exchanges authorization code for tokens and stores them encrypted.
//
// User identification uses the @supabase/ssr server client (supabase.auth.
// getUser()), which reads the real sb-*-auth-token cookie. The previous
// implementation hand-parsed the cookie string, which cannot decode
// @supabase/ssr's base64-JSON (and possibly chunked) cookie — consent
// completed but the account was never saved ("Could not identify user").
//
// Errors are surfaced to the settings page with actionable text: a
// redirect_uri_mismatch names the exact URI to register in Google Cloud
// Console (the URI must match the initiating origin verbatim).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { encryptToken } from "@/lib/services/email/crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

function settingsUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";
  return `${base}/dashboard/settings`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${settingsUrl()}?email_error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(
      `${settingsUrl()}?email_error=${encodeURIComponent("No authorization code received")}`
    );
  }

  try {
    // Must match the redirect_uri used to obtain the code verbatim — the
    // initiation route derives it from the request origin the same way.
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      let hint = errText.slice(0, 200);
      if (errText.includes("redirect_uri_mismatch")) {
        hint = `Google rejected this redirect URI: ${redirectUri}. Add it under APIs & Credentials → your OAuth client → Authorized redirect URIs in Google Cloud Console.`;
      }
      return NextResponse.redirect(`${settingsUrl()}?email_error=${encodeURIComponent(`Token exchange failed: ${hint}`)}`);
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

    // Identify the signed-in user via the SSR client (reads the real session
    // cookie) — never by parsing the cookie header manually.
    const userSupabase = await createServerSupabase();
    const { data: userData, error: userError } = await userSupabase.auth.getUser();
    const userId = userData?.user?.id || "";

    if (userError || !userId) {
      return NextResponse.redirect(
        `${settingsUrl()}?email_error=${encodeURIComponent("Could not identify user — sign in to Capital OS, then connect Gmail again.")}`
      );
    }

    // Encrypt tokens
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token || "");

    // Store or update email account
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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
        `${settingsUrl()}?email_error=${encodeURIComponent(`Failed to save email account: ${upsertError.message}`)}`
      );
    }

    return NextResponse.redirect(`${settingsUrl()}?email_connected=google`);
  } catch (err) {
    return NextResponse.redirect(
      `${settingsUrl()}?email_error=${encodeURIComponent(`Google OAuth failed: ${String(err)}`)}`
    );
  }
}
