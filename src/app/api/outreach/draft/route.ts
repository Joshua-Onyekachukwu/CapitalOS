// =============================================
// AI Email Draft API Route
// =============================================
// Generates personalized, natural-sounding investor outreach emails.
// Server-side only — AI client is never exposed to the browser bundle.

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/ai";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.ai);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }
    const body = await request.json();
    const { investorName, investorFirm, investorType, fitScore, aiAnalysis, tone, customInstructions, investorSectors, investorStages, checkSize, fundSize } = body;

    if (!investorName) {
      return NextResponse.json({ error: "investorName is required" }, { status: 400 });
    }

    const toneMap: Record<string, string> = {
      warm: "Warm but professional. Friendly, genuine, not pushy.",
      professional: "Direct and business-like. Respect their time.",
      casual: "Conversational and relaxed. Like a smart introduction over coffee.",
      bold: "Confident and direct. Lead with the most compelling data point.",
      referral: "Warm introduction style. Mention shared connections or interests.",
    };

    const systemPrompt = `You are an expert fundraising outreach writer. You draft emails that founders send to investors.

CRITICAL RULES:
- Return ONLY the final email text. Nothing else.
- Do NOT include your thinking process, analysis, reasoning, or chain-of-thought.
- Do NOT include "Here is my thinking" or "Let me analyze" or numbered steps.
- Do NOT include Draft 1, Draft 2, or comparison sections.
- Do NOT include word count checks or rule verification.
- Output ONLY the email the founder would actually send. Start with the greeting.
- Write as if you are the founder writing directly to this specific investor.
- NEVER use: "I hope this email finds you well", "I'm reaching out to explore", "I believe there may be synergies", "I'd love to connect and discuss", "pitch deck", "book a call", or any generic fundraising language.
- Keep the email under 120 words.
- The email should feel like a real person wrote it for this specific investor.
- Start with something specific about the investor (their focus, a recent investment, their thesis).
- Then briefly explain why this matters for them specifically.
- End with one clear, low-pressure next step.
- No signature block — the sending system adds one automatically.
- Tone: ${toneMap[tone] || toneMap.warm}

The email will be sent as a plain text email. Write it accordingly.`;

    const contextParts: string[] = [];
    if (investorName) contextParts.push(`Investor: ${investorName}`);
    if (investorFirm) contextParts.push(`Firm: ${investorFirm}`);
    if (investorType) contextParts.push(`Type: ${investorType.replace(/_/g, " ")}`);
    if (fitScore) contextParts.push(`Fit score: ${fitScore}%`);
    if (investorSectors?.length) contextParts.push(`Sectors they invest in: ${investorSectors.join(", ")}`);
    if (investorStages?.length) contextParts.push(`Stages they invest in: ${investorStages.join(", ")}`);
    if (checkSize) contextParts.push(`Check size: ${checkSize}`);
    if (fundSize) contextParts.push(`Fund size: ${fundSize}`);
    if (aiAnalysis) contextParts.push(`Additional context: ${aiAnalysis}`);
    if (customInstructions) contextParts.push(`Founder notes: ${customInstructions}`);

    const response = await chatCompletion({
      task: "email_drafting",
      systemPrompt,
      messages: [
        {
          role: "user",
          content: `Write a personalized outreach email to ${investorName}${investorFirm ? ` at ${investorFirm}` : ""}.\n\n${contextParts.join("\n")}`,
        },
      ],
    });

    // Clean the response — strip any JSON wrapping, code blocks, or preamble
    let emailBody = response.content.trim();

    // Strip markdown code blocks
    emailBody = emailBody.replace(/^```[\w]*\n?/gm, "").replace(/```$/gm, "").trim();

    // If AI returned JSON despite instructions, extract the body text
    if (emailBody.startsWith("{") || emailBody.startsWith("[")) {
      try {
        const parsed = JSON.parse(emailBody);
        emailBody = parsed.body || parsed.email || parsed.text || parsed.content || parsed.message || JSON.stringify(parsed);
      } catch {
        // Not valid JSON, keep as-is
      }
    }

    // Strip any leading/trailing quotes
    if ((emailBody.startsWith('"') && emailBody.endsWith('"')) || (emailBody.startsWith("'") && emailBody.endsWith("'"))) {
      emailBody = emailBody.slice(1, -1);
    }

    // Generate a subject line based on the email content
    const subjectResponse = await chatCompletion({
      task: "email_drafting",
      systemPrompt: `Generate a short email subject line (under 8 words). Return ONLY the subject text, nothing else. No quotes, no JSON, no explanation.`,
      messages: [
        {
          role: "user",
          content: `Investor: ${investorName}${investorFirm ? ` at ${investorFirm}` : ""}. Email body: ${emailBody.substring(0, 300)}`,
        },
      ],
    });

    let subject = subjectResponse.content.trim().replace(/^["']|["']$/g, "").replace(/^Subject:\s*/i, "");

    if (!emailBody || emailBody.length < 20) {
      return NextResponse.json({ error: "Could not generate email. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      subject,
      body: emailBody,
      tone: tone || "warm",
    });
  } catch (err) {
    console.error("Email draft error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
