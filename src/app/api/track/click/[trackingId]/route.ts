// =============================================
// Email Click Tracking Redirect (Supabase)
// =============================================
// Records the click event, then redirects to the original URL.

import { NextRequest, NextResponse } from "next/server";
import { recordClick } from "@/lib/services/email/tracking-supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const { searchParams } = new URL(request.url);
  const originalUrl = searchParams.get("url");

  if (!trackingId || !originalUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(originalUrl);
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!decodedUrl.startsWith("http://") && !decodedUrl.startsWith("https://")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const userAgent = request.headers.get("user-agent") || undefined;
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || undefined;

  try {
    await recordClick(trackingId, decodedUrl, userAgent, ipAddress);
  } catch {
    // Silently fail
  }

  return NextResponse.redirect(decodedUrl, { status: 302 });
}
