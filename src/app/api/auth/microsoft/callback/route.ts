// =============================================
// Microsoft OAuth — Callback Route
// =============================================
// Exchanges authorization code for tokens and stores them encrypted.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { encryptToken } from "@/lib/services/email/crypto";

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "";
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET || "";
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/microsoft/callback`;

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
    const tokenResponse = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          client_secret: MICROSOFT_CLIENT_SECRET,
          code,
          grant_type: "authorization_code",
          redirect_uri: MICROSOFT_REDIRECT_URI,
          scope: "Mail.Send Mail.Read offline_access openid profile email",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return NextResponse.redirect(
        `${dashboardUrl}?email_error=${encodeURIComponent(`Token exchange failed: ${errText}`)}`
      );
    }

    const tokens = await tokenResponse.json();

    // Get user info from Microsoft Graph
    const userInfoResponse = await fetch(
      "https://graph.microsoft.com/v1.0/me",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );

    let email = "";
    let displayName = "";

    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      email = userInfo.mail || userInfo.userPrincipalName || "";
      displayName = userInfo.displayName || "";
    }

    // Get authenticated user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const cookieHeader = request.headers.get("cookie") || "";
    let userId = "";

    const cookies = cookieHeader.split(";").reduce((acc, c) => {
      const [key, ...val] = c.trim().split("=");
      acc[key] = val.join("=");
      return acc;
    }, {} as Record<string, string>);

    for (const [key, val] of Object.entries(cookies)) {
      if (key.includes("auth") || key.includes("supabase")) {
        const { data: { user } } = await supabase.auth.getUser(val);
        if (user) {
          userId = user.id;
          break;
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
          provider: "microsoft",
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
      `${dashboardUrl}?email_connected=microsoft`
    );
  } catch (err) {
    return NextResponse.redirect(
      `${dashboardUrl}?email_error=${encodeURIComponent(`Microsoft OAuth failed: ${String(err)}`)}`
    );
  }
}
