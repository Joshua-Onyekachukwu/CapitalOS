// =============================================
// API: Investor Fit Analysis
// =============================================
// POST /api/investors/fit-analysis
// Actions: batch_score, individual_score, ai_analysis

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { chatCompletion } from "@/lib/ai";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// =============================================
// Deterministic Scoring (same as qualification.ts but inline for API use)
// =============================================

function scoreSectorMatch(investorSectors: string[], startupSector: string): { score: number; explanation: string } {
  if (!investorSectors.length || !startupSector) return { score: 50, explanation: "Insufficient sector data" };

  const normalizedStartup = startupSector.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedSectors = investorSectors.map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ""));

  if (normalizedSectors.includes(normalizedStartup)) return { score: 100, explanation: `Direct match: ${startupSector}` };

  const sectorGroups: Record<string, string[]> = {
    ai: ["ai", "machinelearning", "deeplearning", "ml", "datascience"],
    fintech: ["fintech", "financialtechnology", "payments", "banking"],
    saas: ["saas", "enterprise", "b2b", "software", "cloud"],
    healthtech: ["healthtech", "healthcare", "biotech", "medtech"],
    climatetech: ["climatetech", "cleantech", "energy", "sustainability"],
    consumer: ["consumer", "b2c", "marketplace", "ecommerce"],
    web3: ["web3", "blockchain", "crypto", "defi"],
    deepTech: ["deeptech", "robotics", "hardware", "spacetech"],
  };

  for (const [, keywords] of Object.entries(sectorGroups)) {
    if (keywords.includes(normalizedStartup)) {
      const matchCount = normalizedSectors.filter((s) => keywords.includes(s)).length;
      if (matchCount > 0) return { score: 85, explanation: `Related sector group (${matchCount} overlaps)` };
    }
  }

  for (const sector of normalizedSectors) {
    if (sector.includes(normalizedStartup) || normalizedStartup.includes(sector)) {
      return { score: 70, explanation: `Partial overlap with ${sector}` };
    }
  }

  return { score: 20, explanation: `No sector overlap. Investor focuses on: ${investorSectors.slice(0, 3).join(", ")}` };
}

function scoreStageMatch(investorStages: string[], startupStage: string): { score: number; explanation: string } {
  if (!investorStages.length || !startupStage) return { score: 50, explanation: "Insufficient stage data" };

  const normalizedStage = startupStage.toLowerCase().replace(/\s+/g, "_");
  const normalizedStages = investorStages.map((s) => s.toLowerCase().replace(/\s+/g, "_"));

  if (normalizedStages.includes(normalizedStage)) return { score: 100, explanation: `Direct stage match: ${startupStage}` };

  const stageOrder = ["pre_seed", "seed", "series_a", "series_b", "series_c", "growth", "late_stage"];
  const startupIdx = stageOrder.indexOf(normalizedStage);

  for (const stage of normalizedStages) {
    const investorIdx = stageOrder.indexOf(stage);
    if (startupIdx >= 0 && investorIdx >= 0) {
      const distance = Math.abs(startupIdx - investorIdx);
      if (distance === 1) return { score: 75, explanation: `Adjacent stage: investor does ${stage}` };
      if (distance === 2) return { score: 40, explanation: `Two stages apart` };
    }
  }

  return { score: 15, explanation: `Stage mismatch. Investor focuses on: ${investorStages.join(", ")}` };
}

function scoreGeographyMatch(investorGeos: string[], investorCountry: string | null, startupGeo: string): { score: number; explanation: string } {
  if (!startupGeo) return { score: 50, explanation: "No geography specified" };
  const normalized = startupGeo.toLowerCase().trim();

  if (investorCountry && investorCountry.toLowerCase() === normalized) return { score: 100, explanation: `Same country: ${startupGeo}` };

  if (investorGeos.length > 0) {
    const match = investorGeos.find((g) => g.toLowerCase().includes(normalized) || normalized.includes(g.toLowerCase()));
    if (match) return { score: 100, explanation: `Geography match: ${match}` };
    if (investorGeos.some((g) => g.toLowerCase().includes("global"))) return { score: 90, explanation: "Global investor" };
  }

  return { score: 30, explanation: `Geography may not align` };
}

function computeFitScore(investor: Record<string, unknown>, startup: { sector: string; stage: string; geography: string }) {
  const factors: Array<{ factor: string; score: number; weight: number; explanation: string }> = [];

  const sector = scoreSectorMatch((investor.investment_sectors as string[]) || [], startup.sector);
  factors.push({ factor: "Sector Match", score: sector.score, weight: 0.25, explanation: sector.explanation });

  const stage = scoreStageMatch((investor.investment_stages as string[]) || [], startup.stage);
  factors.push({ factor: "Stage Match", score: stage.score, weight: 0.20, explanation: stage.explanation });

  const geo = scoreGeographyMatch((investor.investment_geographies as string[]) || [], (investor.country as string) || null, startup.geography);
  factors.push({ factor: "Geography Match", score: geo.score, weight: 0.15, explanation: geo.explanation });

  // Data completeness
  const fields = ["email", "linkedin_url", "job_title", "investment_stages", "investment_sectors"];
  let filled = 0;
  const missing: string[] = [];
  for (const field of fields) {
    const val = investor[field];
    if (val && (Array.isArray(val) ? val.length > 0 : true)) filled++;
    else missing.push(field.replace(/_/g, " "));
  }
  const completeness = Math.round((filled / fields.length) * 100);
  factors.push({
    factor: "Data Completeness",
    score: completeness,
    weight: 0.10,
    explanation: missing.length > 0 ? `${filled}/${fields.length} fields. Missing: ${missing.slice(0, 3).join(", ")}` : "All key fields populated",
  });

  // Outreach readiness
  let outreachScore = 0;
  if (investor.email) outreachScore += 30;
  if (investor.linkedin_url) outreachScore += 20;
  if (investor.is_verified) outreachScore += 15;
  factors.push({
    factor: "Contactability",
    score: Math.min(outreachScore, 100),
    weight: 0.10,
    explanation: outreachScore > 0 ? "Has contact information" : "No contact data",
  });

  // Check size
  const hasCheckSize = investor.min_check_size || investor.max_check_size;
  factors.push({
    factor: "Check Size Fit",
    score: hasCheckSize ? 70 : 50,
    weight: 0.10,
    explanation: hasCheckSize ? "Check size data available" : "Check size not specified",
  });

  // Activity recency
  const lastInvestment = investor.last_investment_date as string | null;
  let activityScore = 50;
  let activityExplanation = "No investment date data";
  if (lastInvestment) {
    const daysSince = Math.floor((Date.now() - new Date(lastInvestment).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 90) { activityScore = 100; activityExplanation = `Last investment ${daysSince}d ago — very active`; }
    else if (daysSince < 365) { activityScore = 75; activityExplanation = `Last investment ${Math.floor(daysSince / 30)}mo ago`; }
    else { activityScore = 30; activityExplanation = `Last investment ${Math.floor(daysSince / 365)}y ago`; }
  }
  factors.push({ factor: "Recent Activity", score: activityScore, weight: 0.10, explanation: activityExplanation });

  // Bio / description quality
  const hasBio = investor.bio && (investor.bio as string).length > 50;
  factors.push({
    factor: "Profile Depth",
    score: hasBio ? 80 : investor.bio ? 40 : 20,
    weight: 0.10,
    explanation: hasBio ? "Detailed bio available" : investor.bio ? "Brief bio" : "No bio",
  });

  const overallScore = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));

  return {
    overallScore,
    factors,
    confidence: completeness,
    dataQuality: completeness,
    outreachReadiness: overallScore >= 70 && completeness >= 60 ? "ready" : overallScore >= 50 ? "needs_verification" : "not_ready",
  };
}

// =============================================
// AI-Enhanced Analysis
// =============================================

async function generateAIAnalysis(
  investor: Record<string, unknown>,
  startupProfile: Record<string, unknown>
): Promise<string> {
  const prompt = `You are an expert investor-startup matching analyst for a fundraising operating system.

Analyze this investor-startup fit:

INVESTOR:
- Name: ${investor.full_name}
- Firm: ${investor.firm_name || "Unknown"}
- Type: ${investor.investor_type}
- Stages: ${(investor.investment_stages as string[])?.join(", ") || "Unknown"}
- Sectors: ${(investor.investment_sectors as string[])?.join(", ") || "Unknown"}
- Geography: ${investor.country || "Unknown"}
- Bio: ${(investor.bio as string)?.slice(0, 500) || "Not available"}

STARTUP:
- Name: ${startupProfile.company_name || "Unknown"}
- Industry: ${startupProfile.industry || "Unknown"}
- Stage: ${startupProfile.company_stage || "Unknown"}
- Description: ${(startupProfile.one_liner as string) || "Not available"}
- Differentiator: ${(startupProfile.differentiator as string) || "Not available"}
- Target Customer: ${(startupProfile.target_customer as string) || "Not available"}
- Currently Raising: ${startupProfile.currently_raising ? "Yes" : "No"}
- Round Type: ${startupProfile.round_type || "Unknown"}
- MRR: ${startupProfile.mrr || "Unknown"}
- Customer Count: ${startupProfile.customer_count || "Unknown"}

Provide a concise investor fit analysis in 2-3 paragraphs covering:
1. Why this investor could be a strong match (or not)
2. The most relevant angle for approaching this investor
3. Any risks or misalignment to be aware of

Be specific and reference actual data points. Do not fabricate information.`;

  const result = await chatCompletion({
    task: "fit_analysis",
    messages: [{ role: "user", content: prompt }],
    maxRetries: 2,
  });

  return result.content;
}

// =============================================
// POST Handler
// =============================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, investorId } = body;

    if (action === "batch_score") {
      // Batch score all investors
      const supabase = getSupabase();

      // Get startup profile
      const { data: profiles } = await supabase
        .from("company_profiles")
        .select("*")
        .limit(1)
        .order("created_at", { ascending: false });

      if (!profiles || profiles.length === 0) {
        return NextResponse.json({ error: "No company profile found. Complete onboarding first." }, { status: 400 });
      }

      const profile = profiles[0];
      const startup = {
        sector: profile.industry || "",
        stage: profile.company_stage || "",
        geography: profile.location || "",
      };

      // Get all investors
      const { data: investors } = await supabase
        .from("investors")
        .select("*")
        .eq("is_active", true)
        .order("created_at")
        .limit(5000);

      if (!investors) return NextResponse.json({ error: "No investors found" }, { status: 404 });

      let scored = 0;
      let ready = 0;

      for (const investor of investors) {
        const result = computeFitScore(investor, startup);

        await supabase
          .from("investors")
          .update({
            fit_score: result.overallScore,
            fit_score_breakdown: {
              factors: result.factors,
              confidence: result.confidence,
              dataQuality: result.dataQuality,
            },
            data_quality_score: result.dataQuality,
            outreach_readiness: result.outreachReadiness,
          })
          .eq("id", investor.id);

        scored++;
        if (result.outreachReadiness === "ready") ready++;
      }

      return NextResponse.json({ success: true, scored, ready, total: investors.length });
    }

    if (action === "individual_score" || action === "ai_analysis") {
      if (!investorId) return NextResponse.json({ error: "investorId required" }, { status: 400 });

      const supabase = getSupabase();

      // Get investor
      const { data: investor } = await supabase
        .from("investors")
        .select("*")
        .eq("id", investorId)
        .single();

      if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 });

      // Get startup profile
      const { data: profiles } = await supabase
        .from("company_profiles")
        .select("*")
        .limit(1)
        .order("created_at", { ascending: false });

      if (!profiles || profiles.length === 0) {
        return NextResponse.json({ error: "No company profile found" }, { status: 400 });
      }

      const profile = profiles[0];
      const startup = {
        sector: profile.industry || "",
        stage: profile.company_stage || "",
        geography: profile.location || "",
      };

      const fitResult = computeFitScore(investor, startup);

      // Update investor record
      await supabase
        .from("investors")
        .update({
          fit_score: fitResult.overallScore,
          fit_score_breakdown: {
            factors: fitResult.factors,
            confidence: fitResult.confidence,
            dataQuality: fitResult.dataQuality,
          },
          data_quality_score: fitResult.dataQuality,
          outreach_readiness: fitResult.outreachReadiness,
        })
        .eq("id", investorId);

      let aiAnalysis = "";
      if (action === "ai_analysis") {
        try {
          aiAnalysis = await generateAIAnalysis(investor, profile);
        } catch (err) {
          aiAnalysis = "AI analysis unavailable. Using deterministic scoring.";
          console.error("AI analysis error:", err);
        }
      }

      return NextResponse.json({
        success: true,
        investorId,
        fitScore: fitResult.overallScore,
        factors: fitResult.factors,
        confidence: fitResult.confidence,
        dataQuality: fitResult.dataQuality,
        outreachReadiness: fitResult.outreachReadiness,
        aiAnalysis,
      });
    }

    return NextResponse.json({ error: "Invalid action. Use: batch_score, individual_score, or ai_analysis" }, { status: 400 });
  } catch (error) {
    console.error("Fit analysis error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
