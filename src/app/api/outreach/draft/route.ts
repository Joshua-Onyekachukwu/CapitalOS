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
      systemPrompt: `You are an expert fundraising outreach specialist. Write a personalized investor outreach email.\n\nRULES:\n- Return ONLY a JSON object, no markdown, no code blocks, no explanation\n- The JSON must have exactly two fields: "subject" and "body"\n- The body must be the email text only (plain text, not HTML)\n- Keep the body under 150 words\n- Warm, professional tone\n- Reference the investor's focus areas\n- Include a clear call to action\n\nExample format (return ONLY this, nothing else):\n{"subject": "Your subject line", "body": "Dear [Name],\n\nYour email text here...\n\nBest,\n[Your Name]"}`,
      messages: [
        {
          role: "user",
          content: `Draft a personalized outreach email to ${investorName} at ${investorFirm || "their firm"}. ${investorType ? `They are a ${investorType.replace(/_/g, " ")}.` : ""} ${fitScore ? `Their fit score with our startup is ${fitScore}%.` : ""} ${aiAnalysis ? `Context: ${aiAnalysis}` : ""} ${tone ? `Tone: ${tone}` : "Tone: warm, professional"}`,
        },
      ],
    });

    // Try to parse JSON from the response
    let content = response.content;

    // Strip markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      content = jsonMatch[1].trim();
    }

    // Also strip any preamble text before the JSON object
    const braceIndex = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (braceIndex !== -1 && lastBrace > braceIndex) {
      content = content.substring(braceIndex, lastBrace + 1);
    }

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
