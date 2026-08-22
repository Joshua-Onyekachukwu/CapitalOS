// =============================================
// Email Send API Route
// =============================================
// Client components call this to send emails via connected OAuth accounts.
// Server-side only — email tokens and AI client never exposed to browser bundle.

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/services/email/sender";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, investorId, subject, bodyHtml, bodyText } = body;

    if (!userId || !investorId || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: "userId, investorId, subject, and bodyHtml are required" },
        { status: 400 }
      );
    }

    // Fetch the investor's email
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: investor } = await supabase
      .from("investors")
      .select("email")
      .eq("id", investorId)
      .single();

    if (!investor?.email) {
      return NextResponse.json(
        { error: "No email address found for this investor" },
        { status: 404 }
      );
    }

    // Send the email
    const result = await sendEmail({
      userId,
      to: investor.email,
      subject,
      bodyHtml,
      bodyText: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
    });

    if (result.success) {
      // Log the email in email_messages
      await supabase.from("email_messages").insert({
        user_id: userId,
        investor_id: investorId,
        direction: "outbound",
        subject,
        body_html: bodyHtml,
        body_text: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
        to_address: investor.email,
        status: "sent",
        sent_at: new Date().toISOString(),
        ai_generated: true,
      });

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
