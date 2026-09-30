// =============================================
// Email Unsubscribe — Suppression Endpoint
// =============================================
// Unauthenticated by design: it is reached from one-click unsubscribe links
// embedded in outbound emails (cannot carry an app session). Every write is
// additive-only (suppress more, never less) and keyed off the email address,
// so there is no user data exposed and no IDOR surface: an attacker can only
// suppress an address they already know, which is the point of the link.
//
// Suppression rows are written per sending-owner (user_id = the Capital OS
// user who emailed the address, derived from email_messages) because
// isSuppressed() checks the caller's own user_id — a "global" row alone
// would never block a send. The global row is kept as a record-keeping
// fallback for senders with no message history.
//
// POST /api/unsubscribe  { email }   — JSON API (programmatic/pre-suppression)
// GET  /api/unsubscribe?email=...    — link target; suppresses + redirects

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type SupabaseClient = ReturnType<typeof getSp>;

async function suppressEverywhere(
  sp: SupabaseClient,
  normalized: string
): Promise<{ error: string | null }> {
  // 1. Record-keeping global row (future-proofing; see header note)
  const globalUpsert = await sp.from("email_suppression_list").upsert(
    {
      user_id: "global",
      email_address: normalized,
      reason: "unsubscribed",
      source: "unsubscribe_link",
      suppressed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,email_address" }
  );

  // 2. Effective suppression: one row per sending-owner. isSuppressed()
  //    matches on (user_id, email_address), so a global row alone has no
  //    effect on the send guard.
  const { data: owners } = await sp
    .from("email_messages")
    .select("user_id")
    .eq("to_address", normalized);

  const ownerIds = Array.from(new Set((owners || []).map((o) => o.user_id))).filter(
    (id): id is string => typeof id === "string" && id.length > 0 && id !== "global"
  );

  const rows = ownerIds.map((userId) => ({
    user_id: userId,
    email_address: normalized,
    reason: "unsubscribed" as const,
    source: "unsubscribe_link",
    suppressed_at: new Date().toISOString(),
  }));

  let ownerUpsertError = globalUpsert.error;
  if (rows.length > 0) {
    const { error } = await sp
      .from("email_suppression_list")
      .upsert(rows, { onConflict: "user_id,email_address" });
    ownerUpsertError = ownerUpsertError || error;
  }

  if (ownerUpsertError) return { error: ownerUpsertError.message };

  // 3. Mark the historical outbound messages as unsubscribed (non-critical)
  await sp
    .from("email_messages")
    .update({ unsubscribed: true })
    .eq("to_address", normalized);

  return { error: null };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// GET /api/unsubscribe?email=... — suppress and redirect to confirmation page
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";

  if (email) {
    const normalized = email.toLowerCase().trim();
    if (isValidEmail(normalized)) {
      const sp = getSp();
      const { error } = await suppressEverywhere(sp, normalized);
      if (error) console.error("[api/unsubscribe] GET suppression failed:", error);
    }
  }

  // Redirect to the unsubscribe confirmation page
  return NextResponse.redirect(`${appUrl}/unsubscribe`);
}

// POST /api/unsubscribe — JSON API for programmatic unsubscribes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email : "";

    if (!email) {
      return NextResponse.json(
        { error: "Email required" },
        { status: 400 }
      );
    }

    const normalized = email.toLowerCase().trim();
    if (!isValidEmail(normalized)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const sp = getSp();
    const { error } = await suppressEverywhere(sp, normalized);

    if (error) {
      console.error("[api/unsubscribe] POST suppression failed:", error);
      return NextResponse.json(
        { error: "Failed to process unsubscribe" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "You have been unsubscribed from all emails.",
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
