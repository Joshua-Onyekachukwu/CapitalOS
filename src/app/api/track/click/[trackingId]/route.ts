// =============================================
// Email Click Tracking Redirect (Supabase)
// =============================================
// Records the click event, then redirects to the destination that was stored
// for this message. The `?url=` parameter is only a lookup key now: accepting
// it as the destination made every tracked link an open redirect.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { recordClick } from "@/lib/services/email/tracking-supabase";
import { resolveClickDestination } from "@/lib/services/email/click-destinations";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const { searchParams } = new URL(request.url);
  const requestedUrl = searchParams.get("url");

  if (!trackingId || !requestedUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const sp = getSp();
  const { data: stored } = await sp
    .from("email_messages")
    .select("body_html")
    .eq("tracking_id", trackingId)
    .maybeSingle();

  const destination = stored?.body_html
    ? resolveClickDestination(stored.body_html, requestedUrl)
    : null;

  // Not a link from this message: do not redirect anywhere attacker-chosen.
  if (!destination) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const userAgent = request.headers.get("user-agent") || undefined;
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || undefined;

  try {
    await recordClick(trackingId, destination, userAgent, ipAddress);
  } catch {
    // Silently fail
  }

  return NextResponse.redirect(destination, { status: 302 });
}
