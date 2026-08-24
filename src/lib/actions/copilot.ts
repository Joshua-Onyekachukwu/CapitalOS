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

  // Build context
  const context = `
You are Capital OS AI Copilot — a fundraising assistant for startup founders.

CONTEXT:
- Total investors in database: 122819
- Investors loaded for context: ${investors.length}
- Available sectors: ${sectors.map((s) => s.name).join(", ") || "Various sectors available"}
- Top investors by fit score: ${investors.slice(0, 10).map((i) => `${i.full_name} (${i.investor_type?.replace(/_/g, " ") || "Unknown"}, fit: ${i.fit_score || 0}%, status: ${i.outreach_readiness?.replace(/_/g, " ") || "unknown"})`).join(", ") || "None yet"}

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
