// =============================================
// Email Click Tracking Redirect
// =============================================
// Records the click event, then redirects to the original URL.
// Links in emails are rewritten to go through this endpoint.

import { NextRequest, NextResponse } from "next/server";
import { recordClick } from "@/lib/services/email/tracking";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;
  const { searchParams } = new URL(request.url);
  const originalUrl = searchParams.get("url");

  // Validate
  if (!trackingId || !originalUrl) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Decode the original URL
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(originalUrl);
  } catch {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Safety: only allow http/https URLs
  if (!decodedUrl.startsWith("http://") && !decodedUrl.startsWith("https://")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Record the click event (fire and forget)
  const userAgent = request.headers.get("user-agent") || undefined;
  const forwarded = request.headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || undefined;

  try {
    await recordClick(trackingId, decodedUrl, userAgent, ipAddress);
  } catch {
    // Silently fail — tracking should never block the redirect
  }

  // Redirect to the original URL
  return NextResponse.redirect(decodedUrl, { status: 302 });
}
