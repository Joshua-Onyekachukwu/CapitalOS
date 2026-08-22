// =============================================
// Microsoft OAuth — Initiation Route
// =============================================
// Redirects user to Microsoft's consent screen for Outlook/Mail access.

import { NextResponse } from "next/server";

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID || "";
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/microsoft/callback`;

export async function GET() {
  if (!MICROSOFT_CLIENT_ID) {
    return NextResponse.json(
      { error: "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID in environment." },
      { status: 503 }
    );
  }

  const scopes = [
    "Mail.Send",
    "Mail.Read",
    "offline_access",
    "openid",
    "profile",
    "email",
  ];

  const params = new URLSearchParams({
    client_id: MICROSOFT_CLIENT_ID,
    redirect_uri: MICROSOFT_REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(" "),
  });

  return NextResponse.redirect(
    `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  );
}
