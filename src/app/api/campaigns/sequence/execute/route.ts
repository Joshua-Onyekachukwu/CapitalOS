// =============================================
// Sequence Execution API Route (Supabase)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { getPendingSends, executeSend } from "@/lib/services/campaigns/sequence";
import { chatCompletion } from "@/lib/ai";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json().catch(() => ({}));
    const { dryRun = false } = body;

    const userId = user.id;

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get pending sends
    const pending = await getPendingSends(20);

    if (pending.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending follow-ups to send",
        processed: 0,
      });
    }

    // Get company profile from Supabase
    let profile: any = null;
    try {
      const { data } = await sp
        .from("company_profiles")
        .select("*")
        .eq("user_id", userId)
        .limit(1)
        .single();
      profile = data;
    } catch { /* profile may not exist */ }

    const companyName = profile?.company_name || "Our Company";
    const oneLiner = profile?.one_liner || "";
    const senderName = profile?.team_members?.[0]?.name || "The Team";

    let sent = 0;
    let failed = 0;
    const results: Array<{ investor: string; step: number; status: string }> = [];

    for (const item of pending) {
      try {
        const prompt = `You are an expert fundraising email writer. Generate a personalized follow-up email for this investor.

INVESTOR: ${item.investor_name}
COMPANY: ${companyName}
ONE-LINER: ${oneLiner}
STEP TYPE: ${item.step.step_type}
STEP NUMBER: ${item.step.step_number}
TONE: ${item.step.tone}

SUBJECT TEMPLATE:
${item.step.subject_template}

BODY TEMPLATE:
${item.step.body_template}

Replace {{variables}} with real, personalized content. Keep the same structure but make it feel natural and human. Do not use placeholder text.

Return JSON:
{"subject": "...", "bodyHtml": "<p>...</p>"}`;

        const response = await chatCompletion({
          task: "email_drafting",
          messages: [{ role: "user", content: prompt }],
        });

        let subject = item.step.subject_template;
        let bodyHtml = `<p>${item.step.body_template}</p>`;

        try {
          const jsonMatch = response.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            subject = parsed.subject || subject;
            bodyHtml = parsed.bodyHtml || bodyHtml;
          }
        } catch {
          subject = subject
            .replace(/\{\{investor_name\}\}/g, item.investor_name)
            .replace(/\{\{company_name\}\}/g, companyName)
            .replace(/\{\{sender_name\}\}/g, senderName);
          bodyHtml = `<p>${item.step.body_template
            .replace(/\{\{investor_name\}\}/g, item.investor_name)
            .replace(/\{\{company_name\}\}/g, companyName)
            .replace(/\{\{sender_name\}\}/g, senderName)
            .replace(/\{\{one_liner\}\}/g, oneLiner)
            .replace(/\n/g, "<br/>")}</p>`;
        }

        if (dryRun) {
          results.push({
            investor: item.investor_name,
            step: item.step.step_number,
            status: "dry_run",
          });
          sent++;
          continue;
        }

        const success = await executeSend(
          item.id!,
          item.step,
          item.investor_email,
          item.investor_name,
          userId,
          subject,
          bodyHtml
        );

        if (success) {
          sent++;
          results.push({ investor: item.investor_name, step: item.step.step_number, status: "sent" });
        } else {
          failed++;
          results.push({ investor: item.investor_name, step: item.step.step_number, status: "failed" });
        }
      } catch {
        failed++;
        results.push({ investor: item.investor_name, step: item.step.step_number, status: "error" });
      }
    }

    return NextResponse.json({
      success: true,
      processed: pending.length,
      sent,
      failed,
      results,
    });
  } catch (err) {
    console.error("Sequence execution error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
