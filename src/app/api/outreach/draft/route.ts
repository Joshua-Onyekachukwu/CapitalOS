// =============================================
// AI Email Draft API Route
// =============================================
// Client components call this to generate personalized investor outreach emails.
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
    const { investorName, investorFirm, investorType, fitScore, aiAnalysis, tone } = body;

    if (!investorName) {
      return NextResponse.json({ error: "investorName is required" }, { status: 400 });
    }

    const response = await chatCompletion({
      task: "email_drafting",
      systemPrompt: `You are an expert fundraising outreach specialist for Capital OS, an AI-powered platform that helps founders manage their fundraising process. Write a personalized, professional investor outreach email. The email should be concise (under 150 words), reference the investor's firm and investment thesis, explain why the startup is relevant, and include a clear ask. Return JSON with "subject" and "body" fields. Keep a warm but professional tone.`,
      messages: [
        {
          role: "user",
          content: `Draft a personalized outreach email to ${investorName} at ${investorFirm || "their firm"}. ${investorType ? `They are a ${investorType.replace(/_/g, " ")}.` : ""} ${fitScore ? `Their fit score with our startup is ${fitScore}%.` : ""} ${aiAnalysis ? `Context: ${aiAnalysis}` : ""} ${tone ? `Tone: ${tone}` : "Tone: warm, professional"}`,
        },
      ],
    });

    // Try to parse JSON from the response
    const content = response.content;
    try {
      const parsed = JSON.parse(content);
      return NextResponse.json({
        subject: parsed.subject || `Partnership opportunity — ${investorFirm || "your firm"}`,
        body: parsed.body || content,
      });
    } catch {
      // If AI response isn't JSON, use it as-is for the body
      return NextResponse.json({
        subject: `Partnership opportunity — ${investorFirm || "your firm"}`,
        body: content,
      });
    }
  } catch (err) {
    console.error("Email draft error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
