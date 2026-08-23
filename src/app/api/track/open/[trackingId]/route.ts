// =============================================
// Email Open Tracking Pixel
// =============================================
// Returns a 1x1 transparent GIF and records the open event.
// Called when an email client loads the embedded pixel.

import { NextRequest, NextResponse } from "next/server";
import { recordOpen } from "@/lib/services/email/tracking";

// 1x1 transparent GIF (43 bytes)
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00,
  0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
  0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  const { trackingId } = await params;

  if (trackingId && trackingId.length >= 8) {
    // Record the open event (fire and forget — don't block the response)
    const userAgent = request.headers.get("user-agent") || undefined;
    const forwarded = request.headers.get("x-forwarded-for");
    const ipAddress = forwarded?.split(",")[0]?.trim() || undefined;

    // Use waitUntil if available, otherwise just fire
    try {
      await recordOpen(trackingId, userAgent, ipAddress);
    } catch {
      // Silently fail — tracking should never block the pixel
    }
  }

  // Return the transparent GIF with aggressive caching headers
  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": "43",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
