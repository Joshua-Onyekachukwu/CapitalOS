// =============================================
// Email Send API Route (Supabase)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/services/email/sender";
import { sendEmailViaSmtp } from "@/lib/services/email/smtp-sender";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { requireAuth } from "@/lib/middleware/api-auth";
import { cache, userCacheKey } from "@/lib/cache";
import { validateBodyAsync, sendEmailSchema } from "@/lib/validate";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.email);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }

    const validated = await validateBodyAsync(request, sendEmailSchema);
    if (validated instanceof NextResponse) return validated;

    const { investorId, subject, bodyHtml, bodyText } = validated;

    // Generate tracking ID and inject tracking into HTML
    const { generateTrackingId, injectTracking } = await import("@/lib/services/email/tracking-supabase");
    const trackingId = generateTrackingId();
    const trackedHtml = injectTracking(bodyHtml, trackingId, true);
    const userId = user.id;

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch investor email from Supabase
    const { data: investor, error: invError } = await sp
      .from("investors")
      .select("email")
      .eq("id", investorId)
      .single();

    if (invError || !investor?.email) {
      return NextResponse.json({ error: "No email address found for this investor" }, { status: 404 });
    }

    const investorEmail = investor.email;

    // Send the email — try OAuth first, fall back to SMTP
    let result = await sendEmail({
      userId,
      to: investorEmail,
      subject,
      bodyHtml: trackedHtml,
      bodyText: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
    });

    if (!result.success && result.error?.includes("No email account connected")) {
      result = await sendEmailViaSmtp({
        to: investorEmail,
        subject,
        bodyHtml: trackedHtml,
        bodyText: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
      });
    }

    if (result.success) {
      // Log email in Supabase (may not exist)
      try {
        await sp.from("email_messages").insert({
          user_id: userId,
          investor_id: investorId,
          direction: "outbound",
          subject,
          body_html: bodyHtml,
          body_text: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
          to_address: investorEmail,
          status: "sent",
          sent_at: new Date().toISOString(),
          ai_generated: true,
          tracking_id: trackingId,
          open_count: 0,
          click_count: 0,
        });
      } catch {
        // email_messages table may not exist — non-critical
      }

      cache.invalidate(userCacheKey(userId, "cockpit"));

      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      return NextResponse.json(
        { error: result.error || "Failed to send email" },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
