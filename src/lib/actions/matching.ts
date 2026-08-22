"use server";

import { createClient } from "@/lib/supabase/server";


// =============================================
// Fit Score Breakdown
// =============================================

export interface FitFactor {
  factor: string;
  score: number;
  explanation: string;
}

export interface InvestorFitResult {
  investorId: string;
  investorName: string;
  firmName: string;
  overallFit: number;
  factors: FitFactor[];
  recommendedAngle: string;
  potentialObjections: string[];
}

// =============================================
// Score a single investor against startup profile
// =============================================

export async function scoreInvestorFit(
  investorId: string,
  startupProfile: {
    name: string;
    sector: string;
    stage: string;
    geography: string;
    description: string;
  }
): Promise<InvestorFitResult | null> {
  const supabase = await createClient();

  // Fetch investor data
  const { data: investor, error } = await supabase
    .from("v_investors_with_firms")
    .select("*")
    .eq("id", investorId)
    .single();

  if (error || !investor) return null;

  const context = `
You are an investor matching AI for Capital OS. Score how well this investor fits the startup.

STARTUP:
- Name: ${startupProfile.name}
- Sector: ${startupProfile.sector}
- Stage: ${startupProfile.stage}
- Geography: ${startupProfile.geography}
- Description: ${startupProfile.description}

INVESTOR:
- Name: ${investor.full_name}
- Type: ${investor.investor_type}
- Firm: ${investor.firm_name || "Independent"}
- Investment Stages: ${(investor.investment_stages || []).join(", ") || "Not specified"}
- Investment Sectors: ${(investor.investment_sectors || []).join(", ") || "Not specified"}
- Investment Geographies: ${(investor.investment_geographies || []).join(", ") || "Not specified"}
- Check Size: ${investor.min_check_size ? `$${investor.min_check_size}` : "?"} - ${investor.max_check_size ? `$${investor.max_check_size}` : "?"}
- Portfolio Count: ${investor.portfolio_count || "Unknown"}

Respond in this EXACT JSON format (no markdown, no code blocks):
{
  "overallFit": <0-100>,
  "factors": [
    { "factor": "Sector Match", "score": <0-100>, "explanation": "<why>" },
    { "factor": "Stage Match", "score": <0-100>, "explanation": "<why>" },
    { "factor": "Geography Match", "score": <0-100>, "explanation": "<why>" },
    { "factor": "Portfolio Fit", "score": <0-100>, "explanation": "<why>" }
  ],
  "recommendedAngle": "<1-2 sentence pitch angle>",
  "potentialObjections": ["<objection 1>", "<objection 2>"]
}
`;

  try {
    const { chatCompletion } = await import("@/lib/ai");
    const response = await chatCompletion({
      task: "fit_analysis",
      messages: [{ role: "user", content: context }],
    });
    const content = response.content;

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    // Store the fit score
    await supabase
      .from("investors")
      .update({ fit_score: parsed.overallFit })
      .eq("id", investorId);

    // Store the profile
    await supabase
      .from("investor_profiles")
      .upsert(
        {
          investor_id: investorId,
          ai_summary: parsed.recommendedAngle,
          ai_reasoning: JSON.stringify(parsed.factors),
          recommended_angle: parsed.recommendedAngle,
          potential_objections: parsed.potentialObjections,
          last_ai_analyzed_at: new Date().toISOString(),
        },
        { onConflict: "investor_id" }
      );

    return {
      investorId,
      investorName: investor.full_name,
      firmName: investor.firm_name || "Independent",
      overallFit: parsed.overallFit,
      factors: parsed.factors,
      recommendedAngle: parsed.recommendedAngle,
      potentialObjections: parsed.potentialObjections,
    };
  } catch (err) {
    console.error("Fit analysis error:", err);
    return null;
  }
}

// =============================================
// Batch score top investors
// =============================================

export async function scoreTopInvestors(
  startupProfile: {
    name: string;
    sector: string;
    stage: string;
    geography: string;
    description: string;
  },
  limit = 10
): Promise<InvestorFitResult[]> {
  const supabase = await createClient();

  const { data: investors } = await supabase
    .from("investors")
    .select("id")
    .order("fit_score", { ascending: false })
    .limit(limit);

  if (!investors) return [];

  const results: InvestorFitResult[] = [];
  for (const inv of investors) {
    const result = await scoreInvestorFit(inv.id, startupProfile);
    if (result) results.push(result);
  }

  return results.sort((a, b) => b.overallFit - a.overallFit);
}
