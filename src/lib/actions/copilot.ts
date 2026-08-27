"use server";

import { createClient } from "@/lib/supabase/server";

// =============================================
// AI Copilot — Smart Fundraising Assistant
// =============================================

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Build comprehensive context about the user's account, investors, and pipeline
 * so the AI can give specific, actionable answers.
 */
async function buildContext(): Promise<string> {
  const sp = (await import("@supabase/supabase-js")).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Investor stats ──
  const { count: totalInvestors } = await sp
    .from("investors")
    .select("*", { count: "exact", head: true });

  const { count: withEmail } = await sp
    .from("investors")
    .select("*", { count: "exact", head: true })
    .not("email", "is", null);

  const { count: highFit } = await sp
    .from("investors")
    .select("*", { count: "exact", head: true })
    .gte("fit_score", 80);

  const { count: readyForOutreach } = await sp
    .from("investors")
    .select("*", { count: "exact", head: true })
    .eq("outreach_readiness", "ready");

  // ── Top investors by fit score ──
  const { data: topInvestors } = await sp
    .from("investors")
    .select("full_name, investor_type, fit_score, email, company_name, country, investment_sectors, investment_stages, outreach_readiness")
    .not("fit_score", "is", null)
    .order("fit_score", { ascending: false })
    .limit(15);

  // ── Sector distribution ──
  const { data: sectorData } = await sp
    .from("investors")
    .select("investment_sectors")
    .not("investment_sectors", "is", null)
    .limit(500);

  const sectorCounts: Record<string, number> = {};
  sectorData?.forEach((inv) => {
    if (Array.isArray(inv.investment_sectors)) {
      inv.investment_sectors.forEach((s: string) => {
        sectorCounts[s] = (sectorCounts[s] || 0) + 1;
      });
    }
  });
  const topSectors = Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => `${name} (${count})`)
    .join(", ");

  // ── Investor type distribution ──
  const { data: typeData } = await sp
    .from("investors")
    .select("investor_type")
    .limit(500);

  const typeCounts: Record<string, number> = {};
  typeData?.forEach((inv) => {
    const t = inv.investor_type || "Unknown";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => `${name} (${count})`)
    .join(", ");

  // ── Recent outreach activity ──
  let emailMessages = 0;
  try {
    const { count } = await sp
      .from("email_messages")
      .select("*", { count: "exact", head: true });
    emailMessages = count || 0;
  } catch { /* table may not exist */ }

  // ── Campaigns ──
  let campaigns = 0;
  try {
    const { count } = await sp
      .from("campaigns")
      .select("*", { count: "exact", head: true });
    campaigns = count || 0;
  } catch { /* table may not exist */ }

  // ── Saved investors ──
  let savedCount = 0;
  try {
    const { count } = await sp
      .from("saved_investors")
      .select("*", { count: "exact", head: true });
    savedCount = count || 0;
  } catch { /* table may not exist */ }

  // ── Startup profile ──
  const { data: profiles } = await sp
    .from("company_profiles")
    .select("company_name, industry, company_stage, one_liner, currently_raising, funding_amount, round_type, city, country")
    .limit(1);
  const profile = profiles?.[0];

  // ── Build context string ──
  const investorList = topInvestors
    ?.map(
      (i) =>
        `• ${i.full_name} — ${i.investor_type?.replace(/_/g, " ") || "Unknown"}${i.company_name ? ` at ${i.company_name}` : ""}${i.country ? `, ${i.country}` : ""} — fit: ${i.fit_score || 0}%${i.email ? " (has email)" : ""}`
    )
    .join("\n") || "No scored investors yet.";

  const profileInfo = profile
    ? `Company: ${profile.company_name || "Not set"}
Industry: ${profile.industry || "Not set"}
Stage: ${profile.company_stage || "Not set"}
Description: ${profile.one_liner || "Not set"}
Currently raising: ${profile.currently_raising ? "Yes" : "No"}
Funding target: ${profile.funding_amount || "Not set"}
Round type: ${profile.round_type || "Not set"}
Location: ${profile.city || ""}${profile.country ? `, ${profile.country}` : ""}`
    : "No startup profile configured yet.";

  return `You are the Capital OS AI Copilot — an intelligent, experienced fundraising advisor embedded in the founder's workspace. You have direct access to their investor database, pipeline, and startup profile.

═══ FOUNDER'S STARTUP ═══
${profileInfo}

═══ INVESTOR DATABASE ═══
Total investors: ${totalInvestors || 0}
With email: ${withEmail || 0}
High fit (80%+): ${highFit || 0}
Ready for outreach: ${readyForOutreach || 0}
Saved investors: ${savedCount || 0}
Emails sent: ${emailMessages || 0}
Active campaigns: ${campaigns || 0}

═══ TOP INVESTORS BY FIT ═══
${investorList}

═══ SECTOR BREAKDOWN ═══
${topSectors || "No sector data"}

═══ INVESTOR TYPES ═══
${topTypes || "No type data"}

═══ YOUR CAPABILITIES ═══
You can advise on ALL of these topics with specific, data-backed answers:

1. INVESTOR STRATEGY — Which investors to contact first, why, and how to approach them. Reference specific investors by name.

2. OUTREACH PLANNING — Email timing, follow-up sequences, personalization strategies. Reference the user's email account status and campaign data.

3. FUNDRAISING STRATEGY — Round sizing, valuation guidance, pitch positioning, term sheet negotiation tips.

4. PITCH DECK — When the user asks about their pitch deck, guide them to generate one at /dashboard/decks/new. If they ask you to "build" or "create" a deck, tell them to use the deck generator page and offer to help them plan the content.

5. INVESTOR RESEARCH — Deep-dive on specific investors, check their fit, analyze their portfolio and investment patterns from the database.

6. PIPELINE MANAGEMENT — Help prioritize the pipeline, identify bottlenecks, suggest next actions.

7. COMPETITIVE ANALYSIS — How to position against competitors in the space.

8. FUNDRAISING MATH — Run calculations for runway, burn rate, valuation, dilution.

═══ DASHBOARD NAVIGATION ═══
When relevant, guide the user to the right page:
• /dashboard/investors — Browse investor database
• /dashboard/investors/discover — AI-powered investor discovery
• /dashboard/investors/fit — Fit analysis and scoring
• /dashboard/investors/saved — Saved investors list
• /dashboard/outreach — Email outreach campaigns
• /dashboard/campaigns — Campaign management
• /dashboard/copilot — This chat (where they are now)
• /dashboard/decks — Pitch deck management
• /dashboard/decks/new — Generate new pitch deck
• /dashboard/startup — Edit startup profile
• /dashboard/pipeline — Kanban pipeline view
• /dashboard/settings — Account settings

═══ RESPONSE RULES ═══
• Write in plain, natural English. Short paragraphs. Line breaks between ideas.
• NEVER return JSON, code blocks, arrays, markdown headers, or structured data formats.
• Be direct and specific. Say "Contact Sarah Chen at Sequoia (fit: 92%) — she leads seed-stage fintech" not "Consider reaching out to investors in your sector."
• Use real numbers from the database. Reference actual investor names.
• Keep responses concise — under 200 words unless the question demands detail.
• If you don't have enough data to answer well, say so and suggest what data they'd need.
• NEVER invent investor names, emails, or data that isn't in the database.
• If asked to do something you can't do (like send an email), explain what they need to do and where.
• You can ask clarifying questions to give better advice. Don't assume — ask.
• Be conversational but authoritative. Like a smart advisor, not a chatbot.
• Use emoji sparingly — only when it genuinely adds warmth (like 🎯 for targeting, 📊 for data).
• When suggesting actions, mention the specific page URL they can go to.`;
}

/**
 * Main copilot chat function — builds context and calls AI
 */
export async function chatWithCopilot(
  messages: CopilotMessage[]
): Promise<string> {
  try {
    console.log("[Copilot] Building context...");
    const context = await buildContext();
    console.log("[Copilot] Context built, length:", context.length, "chars");

    const { chatCompletion } = await import("@/lib/ai");
    console.log("[Copilot] Calling AI...");
    const response = await chatCompletion({
      task: "research_summary",
      systemPrompt: context,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });
    console.log("[Copilot] AI responded, length:", response.content.length);

    // Clean the response
    let clean = response.content.trim();

    // If the AI returned JSON, try to extract the text
    if (clean.startsWith("{") || clean.startsWith("[")) {
      try {
        const parsed = JSON.parse(clean);
        if (typeof parsed === "string") clean = parsed;
        else if (parsed.response) clean = parsed.response;
        else if (parsed.answer) clean = parsed.answer;
        else if (parsed.content) clean = parsed.content;
        else if (parsed.message) clean = parsed.message;
        else clean = JSON.stringify(parsed, null, 2);
      } catch {
        /* not JSON, keep as-is */
      }
    }

    // Strip markdown code blocks
    clean = clean
      .replace(/^```[\w]*\n?/gm, "")
      .replace(/```$/gm, "")
      .trim();

    // Strip leading/trailing quotes
    if (
      (clean.startsWith('"') && clean.endsWith('"')) ||
      (clean.startsWith("'") && clean.endsWith("'"))
    ) {
      clean = clean.slice(1, -1);
    }

    return (
      clean ||
      "I couldn't generate a response. Please try rephrasing your question."
    );
  } catch (err: any) {
    console.error("Copilot error:", err?.message || err);
    if (err?.message?.includes("429")) {
      return "The AI service is busy right now. Please wait a moment and try again.";
    }
    if (err?.message?.includes("401") || err?.message?.includes("403")) {
      return "AI API authentication failed. Please check the NVIDIA API keys in settings.";
    }
    if (err?.message?.includes("410")) {
      return "The AI model is currently unavailable. Please try again later.";
    }
    return "I'm having trouble connecting to the AI service: " + (err?.message?.substring(0, 100) || "unknown error") + ". Please try again.";
  }
}
