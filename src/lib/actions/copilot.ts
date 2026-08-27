"use server";

import { createClient } from "@/lib/supabase/server";
import { aiComplete } from "@/lib/ai";

// =============================================
// Copilot Chat
// =============================================

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

export async function chatWithCopilot(
  messages: CopilotMessage[]
): Promise<string> {
  const supabase = await createClient();

  // Fetch context about the user's investors — use service role key for reads
  const supabaseAdmin = (await import("@supabase/supabase-js")).createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const investorsResult = await supabaseAdmin
    .from("investors")
    .select("full_name, investor_type, investment_sectors, investment_stages, fit_score, outreach_readiness")
    .order("fit_score", { ascending: false })
    .limit(20);

  const investors = investorsResult.data || [];
  // Extract unique sectors from the investor data
  const sectorSet = new Set<string>();
  investors.forEach((inv) => {
    if (Array.isArray(inv.investment_sectors)) {
      inv.investment_sectors.forEach((s: string) => sectorSet.add(s));
    }
  });
  const sectors = Array.from(sectorSet).map((name) => ({ name }));

  // Build context — keep it tight for speed
  const topInvestors = investors.slice(0, 8).map((i) => `${i.full_name} (${i.investor_type?.replace(/_/g, " ") || "Unknown"}, fit: ${i.fit_score || 0}%)`).join("\n");
  const uniqueSectors = Array.from(new Set(sectors.map((s) => s.name))).slice(0, 15).join(", ");

  const context = `You are Capital OS AI Copilot — a fundraising assistant for startup founders.

DATABASE: ${investors.length} investors loaded. Sectors: ${uniqueSectors || "Various"}.

TOP INVESTORS BY FIT:\n${topInvestors || "None scored yet."}

YOUR JOB: Help founders raise capital. Be specific, use real data, give actionable advice.

RESPONSE FORMAT (critical):
- Write in plain, natural English paragraphs
- Never return JSON, code blocks, arrays, or structured data formats
- Never use markdown headers (no # or ##)
- Use short paragraphs and line breaks for readability
- Be direct and specific — say "Contact Sarah Chen at Sequoia" not "Consider reaching out to investors in your sector"
- Keep responses under 200 words unless the question demands more
- If you don't have data to answer, say so honestly
- Never invent investor names, emails, or data`;

  try {
    const { chatCompletion } = await import("@/lib/ai");
    const response = await chatCompletion({
      task: "research_summary",
      systemPrompt: context,
      messages: messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    // Clean the response — strip any JSON wrapping, markdown artifacts
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
      } catch { /* not JSON, keep as-is */ }
    }
    
    // Strip markdown code blocks if present
    clean = clean.replace(/^```[\w]*\n?/gm, "").replace(/```$/gm, "").trim();
    
    // Strip leading/trailing quotes if the whole response is quoted
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) {
      clean = clean.slice(1, -1);
    }

    return clean || "I couldn't generate a response. Please try rephrasing your question.";
  } catch (err) {
    console.error("Copilot error:", err);
    return "I'm having trouble connecting to the AI service. Please try again in a moment.";
  }
}
