// =============================================
// AI Email Draft API Route
// =============================================
// Generates personalized, natural-sounding investor outreach emails.
// Server-side only — AI client is never exposed to the browser bundle.

import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/ai";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { requireAuth } from "@/lib/middleware/api-auth";
import { brandedOutreachEmail, type UserBranding } from "@/lib/services/email/branded-template";
import { createClient } from "@supabase/supabase-js";

/**
 * Extract the actual email from an AI response that may contain
 * chain-of-thought reasoning, thinking process, or draft comparisons.
 * This model (nemotron) often outputs verbose thinking before the actual email.
 */
function extractEmailFromResponse(raw: string): string {
  let text = raw.trim();

  // Strip markdown code blocks
  text = text.replace(/```[\w]*\n?/gm, "").replace(/```$/gm, "").trim();

  // If JSON, try to extract
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      text = parsed.body || parsed.email || parsed.text || parsed.content || parsed.message || JSON.stringify(parsed);
    } catch { /* not JSON */ }
  }

  // STRATEGY 1: If it looks like a clean email already (no reasoning), return it
  const greetingOnly = /^(?:Hi|Dear|Hello|Hey)\s+[A-Z][a-z]+[,.]?\s*\n/i;
  if (greetingOnly.test(text) && text.length < 1500 && !/here'?s a thinking|let me (?:analyze|consider|draft|\d)|\*\*\d+\./i.test(text)) {
    return text;
  }

  // STRATEGY 2: Nemotron-specific — extract quoted text segments from verification text
  // The model outputs: - yes "Hi David," - yes "Your focus on..." (8), "I'm building..." (18)
  // We extract ALL quoted strings and join them as the email
  const quotedSegments = [...text.matchAll(/"([^"]{3,500})"/g)]
    .map(m => m[1])
    .filter(s => !/^(?:Hi|Hello|Dear|Hey)\s*$/.test(s) && s.length > 5)
    // Filter out non-email segments (reasoning text, analysis, etc.)
    .filter(s => !/^(?:Analyze|Identify|Consider|Think|Draft|Draft \d|Here|Let me|Check|Verify|Word count|I need|I'll|I can|Maybe|Hmm|Actually|Wait|So the|No,|Ensure|The email|Note:|Important|\*\*|Total)/i.test(s.trim()));

  if (quotedSegments.length >= 2) {
    // Reconstruct email from quoted parts: first should be greeting, rest is body
    const email = quotedSegments.join(" ").trim();
    if (email.length > 30) {
      // Clean up any trailing numbers or parenthetical counts
      return email.replace(/\s*\(\d+\)/g, "").replace(/\s*Total\s*~?\d+\s*words?.*/i, "").trim();
    }
  }

  // STRATEGY 3: Find the email by looking for greeting + body + closing pattern
  // Look for "Hi <Name>," on its own line followed by body paragraphs
  const fullEmailMatch = text.match(/(?:^|\n)\s*((?:Hi|Dear|Hello|Hey)\s+[A-Z][a-z]+[,.]?\s*\n[\s\S]*?(?:Happy to (?:share|send|discuss|connect|chat)|Looking forward|Would (?:you|that)|Let me know|Best regards|Thanks|[A-Z][a-z]+,?\s*$|No pressure.*$))/im);
  if (fullEmailMatch && fullEmailMatch[1].length > 40) {
    let email = fullEmailMatch[1].trim();
    // Trim at verification markers
    email = email.replace(/\n\s*(?:Check|Verify|Word count|Final|Let'|Revised|\*\*|Total|\(\d+\)).*/is, "").trim();
    if (email.length > 30 && email.length < 1500) return email;
  }

  // STRATEGY 4: Find standalone email blocks (greeting on own line)
  const lines = text.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(Hi|Dear|Hello|Hey)\s+[A-Z][a-z]+[,.]?\s*$/.test(lines[i].trim())) {
      // Collect lines until we hit a non-email line
      const emailLines = [lines[i].trim()];
      for (let j = i + 1; j < lines.length; j++) {
        const line = lines[j].trim();
        // Stop at verification/analysis markers
        if (/^(?:Check|Verify|Word count|Final|Let'|Revised|\*\*|Total|\(\d+\)|Draft\s|I need|I'll|I can|Maybe I|Let me|Hmm|So the|Actually|Wait,|No,|Ensure|The email should|Note:)/i.test(line)) break;
        if (line) emailLines.push(line);
      }
      const candidate = emailLines.join("\n").trim();
      if (candidate.length > 40 && candidate.length < 1500) return candidate;
    }
  }

  // STRATEGY 5: Last resort — find the most email-like block
  const paragraphs = text.split(/\n\n+/);
  const emailLike = paragraphs
    .filter(p => /(?:Hi|Dear|Hello|Hey)\s+[A-Z][a-z]+/i.test(p) && p.trim().length > 40 && p.trim().length < 1500)
    .map(p => p.trim());
  if (emailLike.length > 0) {
    let lastEmail = emailLike[emailLike.length - 1];
    lastEmail = lastEmail.replace(/\n\s*(?:Check|Verify|\(\d+\)|Total|Draft).*/is, "").trim();
    return lastEmail;
  }

  return text;
}

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

    const systemPrompt = `You write investor outreach emails.

OUTPUT FORMAT:
After all your analysis, end with exactly these two sections on separate lines:
SUBJECT: your subject line here
BODY:
your email body here

EMAIL RULES:
- Start with Hi [InvestorFirstName],
- Start with something specific about the investor
- Briefly say why you are reaching out
- End with one low-pressure next step
- Under 120 words
- No signature block
- Tone: ${toneMap[tone] || toneMap.warm}`;

    const contextParts: string[] = [];
    if (investorName) contextParts.push(`Investor: ${investorName}`);
    if (investorFirm) contextParts.push(`Firm: ${investorFirm}`);
    if (investorType) contextParts.push(`Type: ${investorType.replace(/_/g, " ")}`);
    if (fitScore) contextParts.push(`Fit score: ${fitScore}%`);
    if (investorSectors?.length) contextParts.push(`Sectors: ${investorSectors.join(", ")}`);
    if (investorStages?.length) contextParts.push(`Stages: ${investorStages.join(", ")}`);
    if (checkSize) contextParts.push(`Check size: ${checkSize}`);
    if (fundSize) contextParts.push(`Fund size: ${fundSize}`);
    if (aiAnalysis) contextParts.push(`AI analysis: ${aiAnalysis}`);
    if (customInstructions) contextParts.push(`Founder notes: ${customInstructions}`);

    const response = await chatCompletion({
      task: "email_drafting",
      systemPrompt,
      messages: [
        {
          role: "user",
          content: `Write email to ${investorName}${investorFirm ? ` at ${investorFirm}` : ""}\n${contextParts.join("\n")}`,
        },
      ],
    });

    const raw = response.content;

    // Extract from structured markers — use LAST SUBJECT: as anchor
    // Nemotron outputs reasoning BEFORE the final email, so the actual
    // email always comes after the LAST SUBJECT: marker.
    let subject = "";
    let emailBody = "";

    const lastSubjectIdx = raw.lastIndexOf("SUBJECT:");
    if (lastSubjectIdx >= 0) {
      // Extract subject from the line
      const subjectEnd = raw.indexOf("\n", lastSubjectIdx);
      const subjectLine = raw.substring(lastSubjectIdx, subjectEnd > 0 ? subjectEnd : raw.length);
      subject = subjectLine.replace(/^SUBJECT:\s*/i, "").trim().replace(/^["']|["']$/g, "");

      // Everything after SUBJECT: line
      const afterSubject = raw.substring(lastSubjectIdx + subjectLine.length);

      // Find the email greeting pattern after BODY: or directly
      const greetingMatch = afterSubject.match(/(?:BODY:\s*\n\s*)?((?:Hi|Dear|Hello|Hey)\s+[A-Z][a-z]+[,.]?)/i);
      if (greetingMatch) {
        const emailStart = afterSubject.indexOf(greetingMatch[0]);
        emailBody = afterSubject.substring(emailStart).replace(/^BODY:\s*\n\s*/i, "").trim();

        // Trim at reasoning patterns
        const reasoningPatterns = [ /\n\s*(?:Check|Verify|Word count|Final|Let|Revised|I need|Wait|Actually|No |Ensure|The email|Note|\*\*|\d+\.|I'll|I can|Maybe|Hmm|So the|Actually|Wait,|Draft:)/i ];
        for (const pattern of reasoningPatterns) {
          const match = emailBody.match(pattern);
          if (match && match.index > 50) {
            emailBody = emailBody.substring(0, match.index).trim();
          }
        }

        // Trim at last sentence with proper punctuation
        const lastPeriod = emailBody.lastIndexOf(".");
        const lastExcl = emailBody.lastIndexOf("!");
        const lastQ = emailBody.lastIndexOf("?");
        const lastSentence = Math.max(lastPeriod, lastExcl, lastQ);
        if (lastSentence > 50 && lastSentence < emailBody.length - 5) {
          emailBody = emailBody.substring(0, lastSentence + 1).trim();
        }
      }
    }

    // Fallback: use extraction function if structured extraction failed
    if (!emailBody || emailBody.length < 30) {
      emailBody = extractEmailFromResponse(raw);
      if (!subject && emailBody.length > 20) {
        const words = emailBody.replace(/^(Hi|Dear|Hello|Hey)\s+\w+[,.]?\s*/i, "").split(/\s+/).slice(0, 6);
        subject = words.join(" ");
      }
    }

    if (!emailBody || emailBody.length < 20) {
      return NextResponse.json({ error: "Could not generate email. Please try again." }, { status: 500 });
    }

    // Load user branding from company_profiles
    let branding: UserBranding | undefined;
    try {
      const sp = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data: profile } = await sp
        .from("company_profiles")
        .select("email_brand_name, email_tagline, email_accent_color, email_logo_url, email_website, email_footer_text, email_cta_text, email_cta_url, email_signature, company_name")
        .eq("user_id", user.id)
        .single();

      if (profile) {
        branding = {
          brandName: profile.email_brand_name || profile.company_name || "Capital OS",
          tagline: profile.email_tagline || "AI-Powered Fundraising",
          accentColor: profile.email_accent_color || "#84cc16",
          logoUrl: profile.email_logo_url,
          website: profile.email_website || profile.company_name,
          footerText: profile.email_footer_text,
          ctaText: profile.email_cta_text || "Let's Connect",
          ctaUrl: profile.email_cta_url,
          signature: profile.email_signature,
        };
      }
    } catch {
      // Use defaults if branding load fails
    }

    // Generate qualification-based context for the branded template
    // This explains WHY we're reaching out and HOW we qualified this investor
    const contextParts2: string[] = [];
    if (fitScore && parseInt(String(fitScore)) >= 70) {
      contextParts2.push(`${fitScore}% fit score`);
    }
    if (investorType) {
      contextParts2.push(`${investorType.replace(/_/g, ' ')} type`);
    }
    if (investorSectors?.length) {
      contextParts2.push(`focuses on ${investorSectors.slice(0, 3).join(', ')}`);
    }
    if (investorStages?.length) {
      contextParts2.push(`invests at ${investorStages.slice(0, 2).join(' & ')} stage`);
    }
    if (checkSize) {
      contextParts2.push(`typical check: ${checkSize}`);
    }
    const qualificationReason = contextParts2.length > 0
      ? `We matched ${investorName || 'this investor'} based on: ${contextParts2.join(', ')}. Their investment thesis and portfolio align with what we are building.`
      : `We identified ${investorName || 'this investor'} as a strong match based on your startup profile and their investment focus.`;

    // Generate branded HTML template
    const finalSubject = subject || emailBody.split(/\n/)[0].substring(0, 60);
    const { html: brandedHtml, text: brandedText } = brandedOutreachEmail({
      emailBody,
      subject: finalSubject,
      investorName: investorName || "there",
      context: qualificationReason,
      branding,
      unsubscribeEmail: user.email,
    });

    return NextResponse.json({
      subject: finalSubject,
      body: emailBody,
      html: brandedHtml,
      text: brandedText,
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
