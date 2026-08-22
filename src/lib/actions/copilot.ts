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

  // Fetch context about the user's investors and campaigns
  const [investorsResult, firmsResult, sectorsResult] = await Promise.all([
    supabase
      .from("investors")
      .select("full_name, investor_type, investment_sectors, investment_stages, fit_score, outreach_readiness")
      .order("fit_score", { ascending: false })
      .limit(20),
    supabase
      .from("investor_firms")
      .select("name, firm_type, investment_stages, investment_sectors, fund_size, country")
      .limit(10),
    supabase.from("investor_sectors").select("name"),
  ]);

  const investors = investorsResult.data || [];
  const firms = firmsResult.data || [];
  const sectors = sectorsResult.data || [];

  // Build context
  const context = `
You are Capital OS AI Copilot — a fundraising assistant for startup founders.

CONTEXT:
- Total investors in database: ${investors.length}
- Top investor firms: ${firms.map((f) => `${f.name} (${f.firm_type}, fund: $${f.fund_size || "N/A"})`).join(", ") || "None yet"}
- Available sectors: ${sectors.map((s) => s.name).join(", ") || "Loading..."}
- Top investors by fit score: ${investors.slice(0, 5).map((i) => `${i.full_name} (${i.investor_type}, fit: ${i.fit_score}%)`).join(", ") || "None yet"}

CAPABILITIES:
- Help founders understand their investor pipeline
- Recommend outreach strategies
- Explain investor fit scores and matching logic
- Suggest which investors to prioritize
- Help craft fundraising strategy
- Answer questions about the platform

RULES:
- Be concise and actionable
- Use data from the context when available
- If you don't have enough data, say so honestly
- Never make up investor data
- Focus on practical fundraising advice
`;

  const fullMessages: CopilotMessage[] = [
    { role: "user", content: context },
    ...messages,
  ];

  try {
    const { chatCompletion } = await import("@/lib/ai");
    const response = await chatCompletion({
      task: "research_summary",
      systemPrompt: context,
      messages: messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    });

    return response.content;
  } catch (err) {
    console.error("Copilot error:", err);
    return "I'm having trouble connecting to the AI service. Please try again in a moment.";
  }
}
