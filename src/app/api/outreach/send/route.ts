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
import { hasCredits, consumeCredits, addCredits } from "@/lib/billing/credits";
import { captureServerEvent, serverEvents } from "@/lib/analytics/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.email);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }

    const validated = await validateBodyAsync(request, sendEmailSchema);
    if (validated instanceof NextResponse) return validated;

    const { investorId, subject, bodyHtml, bodyText, attachments, campaignId, approvedDraftId } = validated;
    const userId = user.id;

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Validate the investor BEFORE the credit gate: a bogus investor id must
    // 404 without ever touching the ledger (smoke-test validation gate).
    const { data: investor, error: invError } = await sp
      .from("investors")
      .select("email")
      .eq("id", investorId)
      .single();

    if (invError || !investor?.email) {
      return NextResponse.json({ error: "No email address found for this investor" }, { status: 404 });
    }

    // Pre-send credit gate: the ledger entry must exist before the send happens
    // (task 2.3 audit trail). No balance → 402, never a silent fail-open.
    const credits = await hasCredits(userId, "email_send");
    if (!credits.hasCredits) {
      return NextResponse.json(
        { error: credits.balance === 0 && credits.cost === 0
          ? "No active subscription"
          : `Insufficient credits. Sending costs ${credits.cost}, you have ${credits.balance}.` },
        { status: 402 }
      );
    }
    const deducted = await consumeCredits(userId, "email_send");
    if (!deducted.success) {
      return NextResponse.json({ error: deducted.error }, { status: 402 });
    }

    // NOTE: tracking/compliance injection happens inside the senders
    // (sendEmail / sendEmailViaSmtp) — the canonical email_messages insert
    // with tracking_id lives there too.

    // Send the email — try OAuth first, fall back to SMTP
    const investorEmail = investor.email;

    type FullSendParams = Parameters<typeof sendEmail>[0];
    const sendParams: FullSendParams = {
      userId,
      to: investorEmail,
      subject,
      bodyHtml,
      bodyText: bodyText || bodyHtml.replace(/<[^>]*>/g, ""),
      attachments: attachments?.map((a: { name: string; content: string; mimeType: string }) => ({
        filename: a.name,
        content: a.content,
        mimeType: a.mimeType,
      })),
      investorId,
      campaignId: campaignId || undefined,
      approvedDraftId: approvedDraftId || undefined,
    };

    let result = await sendEmail(sendParams);

    if (!result.success && result.error?.includes("No email account connected")) {
      result = await sendEmailViaSmtp(sendParams);
    }

    if (result.success) {
      // sendEmail()/sendEmailViaSmtp() own the canonical email_messages insert
      // with the audit-trail refs (migration 014 columns).
      cache.invalidate(userCacheKey(userId, "cockpit"));

      void captureServerEvent(userId, serverEvents.EMAIL_SENT, {
        investor_id: investorId,
        campaign_id: campaignId || null,
        via_approved_draft: Boolean(approvedDraftId),
      });
      // The campaign UI approves drafts right before enrollment/send; the
      // persisted approved_draft_id is the canonical approval signal.
      if (approvedDraftId) {
        void captureServerEvent(userId, serverEvents.DRAFT_APPROVED, {
          draft_id: approvedDraftId,
          investor_id: investorId,
        });
      }

      return NextResponse.json({ success: true, messageId: result.messageId });
    } else {
      // Send failed after crediting — refund so users aren't charged for a
      // failed delivery; the refund is also visible in credit_ledger.
      await addCredits(userId, deducted.cost, "email_send_refund", {
        reason: "send_failed", investorId,
      });
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
