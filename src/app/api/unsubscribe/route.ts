import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/unsubscribe — unsubscribe a recipient from all emails
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token } = body;

    if (!email && !token) {
      return NextResponse.json(
        { error: "Email or token required" },
        { status: 400 }
      );
    }

    const sp = getSp();

    // Add to suppression list
    const { error } = await sp.from("email_suppression").upsert(
      {
        email: email?.toLowerCase()?.trim(),
        reason: "unsubscribe",
        source: "unsubscribe_link",
        suppressed_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

    if (error) {
      console.error("Suppression error:", error);
      return NextResponse.json(
        { error: "Failed to process unsubscribe" },
        { status: 500 }
      );
    }

    // Update email_messages to mark as unsubscribed
    if (email) {
      await sp
        .from("email_messages")
        .update({ unsubscribed: true })
        .eq("to_address", email.toLowerCase().trim());
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

// GET /api/unsubscribe?email=... — render unsubscribe confirmation
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams.get("email");
  if (sp) {
    const supabase = getSp();
    await supabase.from("email_suppression").upsert(
      {
        email: sp.toLowerCase().trim(),
        reason: "unsubscribe",
        source: "unsubscribe_link",
        suppressed_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );
  }

  return NextResponse.json({
    success: true,
    message: "You have been unsubscribed.",
  });
}
