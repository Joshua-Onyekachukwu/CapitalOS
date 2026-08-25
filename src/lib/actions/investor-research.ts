// =============================================
// Investor Research Summary — AI-Powered (Supabase)
// =============================================

"use server";

import { createClient } from "@supabase/supabase-js";
import { chatCompletion } from "@/lib/ai";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface ResearchSummary {
  investorId: string;
  summary: string;
  investmentThesis: string;
  keyStrengths: string[];
  potentialConcerns: string[];
  recommendedApproach: string;
  talkingPoints: string[];
  generatedAt: string;
}

/**
 * Generate an AI research summary for a single investor.
 */
export async function generateInvestorResearch(investorId: string): Promise<ResearchSummary | null> {
  const sp = getSp();

  // Fetch investor data from Supabase
  const { data: investor } = await sp
    .from("investors")
    .select("*")
    .eq("id", investorId)
    .single();

  if (!investor) return null;

  // Fetch firm data
  let firm: any = null;
  if (investor.current_firm_id) {
    const { data } = await sp
      .from("investor_firms")
      .select("*")
      .eq("id", investor.current_firm_id)
      .single();
    firm = data;
  }

  // Fetch existing profile
  let profile: any = null;
  try {
    const { data } = await sp
      .from("investor_profiles")
      .select("*")
      .eq("investor_id", investorId)
      .single();
    profile = data;
  } catch { /* table may not exist */ }

  // Fetch data sources
  let sources: any[] = [];
  try {
    const { data } = await sp
      .from("investor_data_sources")
      .select("*")
      .eq("investor_id", investorId)
      .order("collected_at", { ascending: false })
      .limit(5);
    sources = data || [];
  } catch { /* table may not exist */ }

  // Fetch employment history
  let employment: any[] = [];
  try {
    const { data } = await sp
      .from("investor_employment_history")
      .select("*")
      .eq("investor_id", investorId)
      .order("start_date", { ascending: false })
      .limit(5);
    employment = data || [];
  } catch { /* table may not exist */ }

  const prompt = `You are a senior fundraising strategist analyzing an investor for a startup founder. Generate a comprehensive research summary.

INVESTOR PROFILE:
- Name: ${investor.first_name} ${investor.last_name}
- Email: ${investor.email || "Not available"}
- LinkedIn: ${investor.linkedin_url || "Not available"}
- Current Title: ${investor.job_title || "Not specified"}
- Location: ${investor.city || ""}, ${investor.country || ""}
- Investor Type: ${investor.investor_type || "Unknown"}

FIRM:
- Name: ${firm?.name || "Independent / No firm"}
- Type: ${firm?.firm_type || "Unknown"}
- Fund Size: ${firm?.fund_size ? `$${firm.fund_size}` : "Not disclosed"}
- Location: ${firm?.headquarters || "Unknown"}

INVESTMENT PREFERENCES:
- Stages: ${(investor.investment_stages || []).join(", ") || "Not specified"}
- Sectors: ${(investor.investment_sectors || []).join(", ") || "Not specified"}
- Geographies: ${(investor.investment_geographies || []).join(", ") || "Not specified"}
- Check Size: ${investor.min_check_size ? `$${investor.min_check_size}` : "?"} — ${investor.max_check_size ? `$${investor.max_check_size}` : "?"}

FIT SCORE: ${investor.fit_score || 0}/100
DATA QUALITY: ${investor.data_quality_score || 0}/100
OUTREACH READINESS: ${investor.outreach_readiness || "not_ready"}

EMPLOYMENT HISTORY:
${employment?.map((e: any) => `- ${e.title || "Unknown"} at ${e.firm_name || "Unknown"} (${e.start_date || "?"} — ${e.end_date || "Present"})`).join("\n") || "Not available"}

EXISTING AI ANALYSIS:
${profile?.ai_summary || "No previous analysis"}
${profile?.recommended_angle ? `Recommended Angle: ${profile.recommended_angle}` : ""}
${profile?.potential_objections?.length ? `Known Concerns: ${profile.potential_objections.join(", ")}` : ""}

DATA SOURCES:
${sources?.map((s: any) => `- ${s.source_provider}: ${s.field_name} = ${s.source_value} (confidence: ${s.confidence || "unknown"})`).join("\n") || "Not available"}

Generate a comprehensive research summary in this EXACT JSON format (no markdown, no code blocks):
{
  "summary": "2-3 sentence executive summary of this investor and why they matter",
  "investmentThesis": "Your assessment of their likely investment thesis based on available data",
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "potentialConcerns": ["concern 1", "concern 2"],
  "recommendedApproach": "Specific advice on how to approach this investor and what to emphasize",
  "talkingPoints": ["talking point 1", "talking point 2", "talking point 3", "talking point 4"]
}`;

  try {
    const response = await chatCompletion({
      task: "research_summary",
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Store the research summary (may not exist in Supabase)
    try {
      await sp.from("investor_profiles").upsert(
        {
          investor_id: investorId,
          ai_summary: parsed.summary,
          ai_reasoning: JSON.stringify(parsed),
          recommended_angle: parsed.recommendedApproach,
          potential_objections: parsed.potentialConcerns,
          last_ai_analyzed_at: new Date().toISOString(),
        },
        { onConflict: "investor_id" }
      );
    } catch {
      // Table may not exist
    }

    return {
      investorId,
      summary: parsed.summary,
      investmentThesis: parsed.investmentThesis,
      keyStrengths: parsed.keyStrengths || [],
      potentialConcerns: parsed.potentialConcerns || [],
      recommendedApproach: parsed.recommendedApproach,
      talkingPoints: parsed.talkingPoints || [],
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("Investor research error:", err);
    return null;
  }
}

/**
 * Generate a brief outreach-ready email draft for an investor.
 */
export async function generateOutreachDraft(params: {
  investorId: string;
  founderName: string;
  companyName: string;
  companyDescription: string;
  roundType: string;
  raiseAmount: string;
  tone?: "formal" | "warm" | "casual";
}): Promise<{ subject: string; body: string } | null> {
  const sp = getSp();

  // Fetch investor data from Supabase
  const { data: investor } = await sp
    .from("investors")
    .select("*")
    .eq("id", params.investorId)
    .single();

  if (!investor) return null;

  // Fetch firm data
  let firm: any = null;
  if (investor.current_firm_id) {
    const { data } = await sp
      .from("investor_firms")
      .select("*")
      .eq("id", investor.current_firm_id)
      .single();
    firm = data;
  }

  // Fetch existing profile
  let profile: any = null;
  try {
    const { data } = await sp
      .from("investor_profiles")
      .select("*")
      .eq("investor_id", params.investorId)
      .single();
    profile = data;
  } catch { /* table may not exist */ }

  const prompt = `You are an expert fundraising outreach specialist. Write a personalized investor outreach email.

FOUNDER: ${params.founderName}
COMPANY: ${params.companyName}
DESCRIPTION: ${params.companyDescription}
RAISE: ${params.raiseAmount} ${params.roundType}

INVESTOR:
- Name: ${investor.first_name} ${investor.last_name}
- Title: ${investor.job_title || "Investor"}
- Firm: ${firm?.name || "Independent"}
- Investment Stages: ${(investor.investment_stages || []).join(", ") || "Not specified"}
- Investment Sectors: ${(investor.investment_sectors || []).join(", ") || "Not specified"}
- AI Summary: ${profile?.ai_summary || "No data"}
- Recommended Angle: ${profile?.recommended_angle || "None"}

TONE: ${params.tone || "warm"}

Write a concise, professional email (under 150 words) that:
1. Introduces the founder and company in one sentence
2. Explains why this specific investor is a good fit (reference their thesis/sectors)
3. Includes one compelling metric or traction point
4. Asks for a brief meeting
5. Keeps a professional but warm tone

Return JSON with "subject" and "body" fields (no markdown, no code blocks):
{
  "subject": "<email subject line>",
  "body": "<email body>"
}`;

  try {
    const response = await chatCompletion({
      task: "email_drafting",
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error("Outreach draft error:", err);
    return null;
  }
}
