// =============================================
// Email Send API Route
// =============================================
// Client components call this to send emails via connected OAuth accounts.
// Server-side only — email tokens and AI client never exposed to browser bundle.

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/services/email/sender";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.email);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }
    const body = await request.json();
    const { userId, investorId, subject, bodyHtml, bodyText } = body;

    if (!userId || !investorId || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: "userId, investorId, subject, and bodyHtml are required" },
        { status: 400 }
      );
    }

    // Fetch the investor's email from CockroachDB
    const investors = await query<{ email: string }>(
      "SELECT email FROM investors WHERE id = $1",
      [investorId]
    );

    if (!investors.length || !investors[0].email) {
      return NextResponse.json(
        { error: "No email address found for this investor" },
        { status: 404 }
      );
    }

    const investorEmail = investors[0].email;

    // Send the email
    const result = await sendEmail({
      userId,
      to: investorEmail,
      subject,
      bodyHtml,
      bodyText: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
    });

    if (result.success) {
      // Log the email in email_messages via CockroachDB
      await query(
        `INSERT INTO email_messages (user_id, investor_id, direction, subject, body_html, body_text, to_address, status, sent_at, ai_generated)
         VALUES ($1, $2, 'outbound', $3, $4, $5, $6, 'sent', NOW(), true)`,
        [userId, investorId, subject, bodyHtml, bodyText || bodyHtml.replace(/<[^>]*>/g, ""), investorEmail]
      );

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
      { error: err instanceof Error ? err.message : "Email send failed" },
      { status: 500 }
    );
  }
}
