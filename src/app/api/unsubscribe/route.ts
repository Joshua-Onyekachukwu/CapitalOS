import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/unsubscribe?email=... — suppress and redirect to confirmation page
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://capital-os-nine.vercel.app";

  if (email) {
    const sp = getSp();
    const normalized = email.toLowerCase().trim();

    // Write to the same table the suppression checker reads from
    await sp.from("email_suppression_list").upsert(
      {
        user_id: "global",
        email_address: normalized,
        reason: "unsubscribed",
        source: "unsubscribe_link",
        suppressed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,email_address" }
    ).catch(() => {
      // Fallback: try the other table name in case schema differs
      return sp.from("email_suppression").upsert(
        {
          email: normalized,
          reason: "unsubscribe",
          source: "unsubscribe_link",
          suppressed_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      );
    });

    // Mark all outbound emails to this address as unsubscribed
    await sp
      .from("email_messages")
      .update({ unsubscribed: true })
      .eq("to_address", normalized)
      .catch(() => {});
  }

  // Redirect to the unsubscribe confirmation page
  return NextResponse.redirect(`${appUrl}/unsubscribe`);
}

// POST /api/unsubscribe — JSON API for programmatic unsubscribes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userId } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email required" },
        { status: 400 }
      );
    }

    const sp = getSp();
    const normalized = email.toLowerCase().trim();

    // Write to suppression_list (same table the sender checks)
    const { error } = await sp.from("email_suppression_list").upsert(
      {
        user_id: userId || "global",
        email_address: normalized,
        reason: "unsubscribed",
        source: "unsubscribe_link",
        suppressed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,email_address" }
    );

    if (error) {
      console.error("Suppression error:", error);
      return NextResponse.json(
        { error: "Failed to process unsubscribe" },
        { status: 500 }
      );
    }

    // Mark email_messages as unsubscribed
    await sp
      .from("email_messages")
      .update({ unsubscribed: true })
      .eq("to_address", normalized)
      .catch(() => {});

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
