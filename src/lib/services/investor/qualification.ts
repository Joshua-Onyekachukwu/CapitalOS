// =============================================
// Investor Qualification Engine
// =============================================
// Deterministic scoring + AI enrichment for investor fit.
// No LLM needed for scoring — pure rules-based.
// AI used only for thesis interpretation and explanations.

import { createClient } from "@supabase/supabase-js";

// =============================================
// Types
// =============================================

export interface StartupProfile {
  name: string;
  sector: string;
  stage: string;
  geography: string;
  description: string;
  minCheckSize?: number;
  maxCheckSize?: number;
}

export interface FitFactor {
  factor: string;
  score: number; // 0-100
  weight: number; // 0-1
  explanation: string;
  details?: string[];
}

export interface FitResult {
  investorId: string;
  overallScore: number;
  factors: FitFactor[];
  confidence: number;
  dataQuality: number;
  outreachReadiness: string;
  recommendedAngle?: string;
}

// =============================================
// Deterministic Scoring Rules
// =============================================

/** Score sector match (0-100) */
function scoreSectorMatch(
  investorSectors: string[],
  startupSector: string
): { score: number; explanation: string } {
  if (!investorSectors.length || !startupSector) {
    return { score: 50, explanation: "Insufficient sector data for matching" };
  }

  const normalizedStartup = startupSector.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalizedSectors = investorSectors.map((s) => s.toLowerCase().replace(/[^a-z0-9]/g, ""));

  // Exact match
  if (normalizedSectors.includes(normalizedStartup)) {
    return { score: 100, explanation: `Direct sector match: ${startupSector}` };
  }

  // Sector groupings
  const sectorGroups: Record<string, string[]> = {
    ai: ["ai", "machinelearning", "deeplearning", "ml", "datascience", "nlp", "computervision"],
    fintech: ["fintech", "financialtechnology", "payments", "banking", "insurtech", "wealthtech"],
    saas: ["saas", "enterprise", "b2b", "software", "cloud", "devtools"],
    healthtech: ["healthtech", "healthcare", "biotech", "medtech", "digitalhealth"],
    climatetech: ["climatetech", "cleantech", "energy", "sustainability", "renewables"],
    consumer: ["consumer", "b2c", "marketplace", "ecommerce", "retail"],
    web3: ["web3", "blockchain", "crypto", "defi", "nft"],
    deepTech: ["deeptech", "robotics", "hardware", "spacetech", "quantum"],
  };

  for (const [group, keywords] of Object.entries(sectorGroups)) {
    if (keywords.includes(normalizedStartup)) {
      const matchCount = normalizedSectors.filter((s) => keywords.includes(s)).length;
      if (matchCount > 0) {
        return {
          score: 85,
          explanation: `Related sector group: ${group} (${matchCount} investor interests overlap)`,
        };
      }
    }
  }

  // Partial keyword match
  for (const sector of normalizedSectors) {
    if (sector.includes(normalizedStartup) || normalizedStartup.includes(sector)) {
      return { score: 70, explanation: `Partial sector overlap with ${sector}` };
    }
  }

  return { score: 20, explanation: `No sector overlap detected. Investor focuses on: ${investorSectors.slice(0, 3).join(", ")}` };
}

/** Score stage match (0-100) */
function scoreStageMatch(
  investorStages: string[],
  startupStage: string
): { score: number; explanation: string } {
  if (!investorStages.length || !startupStage) {
    return { score: 50, explanation: "Insufficient stage data" };
  }

  const normalizedStage = startupStage.toLowerCase().replace(/\s+/g, "_");
  const normalizedStages = investorStages.map((s) => s.toLowerCase().replace(/\s+/g, "_"));

  if (normalizedStages.includes(normalizedStage)) {
    return { score: 100, explanation: `Direct stage match: ${startupStage}` };
  }

  // Adjacent stages get partial credit
  const stageOrder = ["pre_seed", "seed", "series_a", "series_b", "series_c", "growth", "late_stage"];
  const startupIdx = stageOrder.indexOf(normalizedStage);

  for (const stage of normalizedStages) {
    const investorIdx = stageOrder.indexOf(stage);
    if (startupIdx >= 0 && investorIdx >= 0) {
      const distance = Math.abs(startupIdx - investorIdx);
      if (distance === 1) return { score: 75, explanation: `Adjacent stage: investor does ${stage}, startup is ${startupStage}` };
      if (distance === 2) return { score: 40, explanation: `Two stages apart: investor does ${stage}, startup is ${startupStage}` };
    }
  }

  return { score: 15, explanation: `Stage mismatch. Investor focuses on: ${investorStages.join(", ")}` };
}

/** Score geography match (0-100) */
function scoreGeographyMatch(
  investorGeos: string[],
  investorCountry: string | null,
  startupGeo: string
): { score: number; explanation: string } {
  if (!startupGeo) {
    return { score: 50, explanation: "No geography specified for startup" };
  }

  const normalized = startupGeo.toLowerCase().trim();

  // Check direct country match
  if (investorCountry && investorCountry.toLowerCase() === normalized) {
    return { score: 100, explanation: `Same country: ${startupGeo}` };
  }

  // Check geographies list
  if (investorGeos.length > 0) {
    const match = investorGeos.find(
      (g) => g.toLowerCase().includes(normalized) || normalized.includes(g.toLowerCase())
    );
    if (match) {
      return { score: 100, explanation: `Geography match: ${match}` };
    }

    // Global investor
    if (investorGeos.some((g) => g.toLowerCase().includes("global") || g.toLowerCase().includes("worldwide"))) {
      return { score: 90, explanation: "Global investor — accepts any geography" };
    }
  }

  // US-based investors typically accept US startups
  if (investorCountry && ["united states", "usa", "us"].includes(investorCountry.toLowerCase())) {
    if (["united states", "usa", "us"].includes(normalized)) {
      return { score: 95, explanation: "US investor, US startup" };
    }
  }

  return { score: 30, explanation: `Geography may not align. Investor: ${investorCountry || "Unknown"}, Startup: ${startupGeo}` };
}

/** Score check size match (0-100) */
function scoreCheckSizeMatch(
  investorMin: number | null,
  investorMax: number | null,
  startupMin?: number,
  startupMax?: number
): { score: number; explanation: string } {
  if (!investorMin && !investorMax) {
    return { score: 60, explanation: "Investor check size not specified" };
  }

  if (!startupMin && !startupMax) {
    return { score: 60, explanation: "Startup funding target not specified" };
  }

  const invMin = investorMin || 0;
  const invMax = investorMax || Infinity;
  const stMin = startupMin || 0;
  const stMax = startupMax || Infinity;

  // Check overlap
  const overlapMin = Math.max(invMin, stMin);
  const overlapMax = Math.min(invMax, stMax);

  if (overlapMin <= overlapMax) {
    // There's overlap
    const overlapRange = overlapMax - overlapMin;
    const totalRange = Math.max(invMax, stMax) - Math.min(invMin, stMin);
    const overlapPercent = totalRange > 0 ? overlapRange / totalRange : 1;
    const score = Math.round(60 + overlapPercent * 40);
    return {
      score,
      explanation: `Check size overlap: $${(overlapMin / 1000).toFixed(0)}K — $${overlapMax === Infinity ? "∞" : (overlapMax / 1000).toFixed(0) + "K"}`,
    };
  }

  return { score: 15, explanation: `No check size overlap. Investor: $${(invMin / 1000).toFixed(0)}K — $${invMax === Infinity ? "∞" : (invMax / 1000).toFixed(0) + "K"}` };
}

/** Score data completeness (0-100) */
function scoreDataCompleteness(investor: Record<string, unknown>): { score: number; explanation: string } {
  const fields = [
    "email", "linkedin_url", "job_title", "phone",
    "investment_stages", "investment_sectors", "investment_geographies",
    "min_check_size", "max_check_size", "bio",
  ];

  let filled = 0;
  const missing: string[] = [];

  for (const field of fields) {
    const val = investor[field];
    if (val && (Array.isArray(val) ? val.length > 0 : true)) {
      filled++;
    } else {
      missing.push(field.replace(/_/g, " "));
    }
  }

  const score = Math.round((filled / fields.length) * 100);

  return {
    score,
    explanation: missing.length > 0
      ? `${filled}/${fields.length} fields populated. Missing: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` +${missing.length - 3} more` : ""}`
      : "All key fields populated",
  };
}

/** Score outreach readiness (0-100) */
function scoreOutreachReadiness(investor: Record<string, unknown>): { score: number; explanation: string } {
  let score = 0;
  const signals: string[] = [];

  if (investor.email) { score += 30; signals.push("has email"); }
  if (investor.linkedin_url) { score += 20; signals.push("has LinkedIn"); }
  if (investor.is_verified) { score += 15; signals.push("verified"); }
  if (investor.data_quality_score && (investor.data_quality_score as number) >= 70) {
    score += 15; signals.push("high data quality");
  }
  if (investor.investment_sectors && (investor.investment_sectors as string[]).length > 0) {
    score += 10; signals.push("sectors defined");
  }
  if (investor.do_not_contact) { score = 0; signals.push("do-not-contact flag"); }

  return {
    score: Math.min(score, 100),
    explanation: signals.length > 0
      ? `Outreach signals: ${signals.join(", ")}`
      : "No outreach signals available",
  };
}

// =============================================
// Main Scoring Function
// =============================================

export function computeFitScore(
  investor: Record<string, unknown>,
  startup: StartupProfile
): FitResult {
  const factors: FitFactor[] = [];

  // Sector match (25% weight)
  const sectorResult = scoreSectorMatch(
    (investor.investment_sectors as string[]) || [],
    startup.sector
  );
  factors.push({ factor: "Sector Match", score: sectorResult.score, weight: 0.25, explanation: sectorResult.explanation });

  // Stage match (20% weight)
  const stageResult = scoreStageMatch(
    (investor.investment_stages as string[]) || [],
    startup.stage
  );
  factors.push({ factor: "Stage Match", score: stageResult.score, weight: 0.20, explanation: stageResult.explanation });

  // Geography match (15% weight)
  const geoResult = scoreGeographyMatch(
    (investor.investment_geographies as string[]) || [],
    (investor.country as string) || null,
    startup.geography
  );
  factors.push({ factor: "Geography Match", score: geoResult.score, weight: 0.15, explanation: geoResult.explanation });

  // Check size match (15% weight)
  const checkResult = scoreCheckSizeMatch(
    (investor.min_check_size as number) || null,
    (investor.max_check_size as number) || null,
    startup.minCheckSize,
    startup.maxCheckSize
  );
  factors.push({ factor: "Check Size Fit", score: checkResult.score, weight: 0.15, explanation: checkResult.explanation });

  // Data completeness (10% weight)
  const completenessResult = scoreDataCompleteness(investor);
  factors.push({ factor: "Data Completeness", score: completenessResult.score, weight: 0.10, explanation: completenessResult.explanation });

  // Outreach readiness (10% weight)
  const outreachResult = scoreOutreachReadiness(investor);
  factors.push({ factor: "Contactability", score: outreachResult.score, weight: 0.10, explanation: outreachResult.explanation });

  // Activity recency (5% weight)
  const lastInvestment = investor.last_investment_date as string | null;
  let activityScore = 50;
  let activityExplanation = "No investment date data";
  if (lastInvestment) {
    const daysSince = Math.floor((Date.now() - new Date(lastInvestment).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince < 90) { activityScore = 100; activityExplanation = `Last investment ${daysSince} days ago — very active`; }
    else if (daysSince < 365) { activityScore = 75; activityExplanation = `Last investment ${Math.floor(daysSince / 30)} months ago`; }
    else { activityScore = 30; activityExplanation = `Last investment ${Math.floor(daysSince / 365)} years ago`; }
  }
  factors.push({ factor: "Recent Activity", score: activityScore, weight: 0.05, explanation: activityExplanation });

  // Compute weighted overall score
  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  // Confidence based on data completeness
  const confidence = completenessResult.score;

  // Determine outreach readiness
  let outreachReadiness = "not_ready";
  if (investor.do_not_contact) outreachReadiness = "do_not_contact";
  else if (overallScore >= 70 && confidence >= 60) outreachReadiness = "ready";
  else if (overallScore >= 50 || confidence >= 40) outreachReadiness = "needs_verification";

  return {
    investorId: investor.id as string,
    overallScore,
    factors,
    confidence,
    dataQuality: completenessResult.score,
    outreachReadiness,
  };
}

// =============================================
// Batch Qualification Pipeline
// =============================================

export async function runBatchQualification(
  startup: StartupProfile,
  batchSize = 100
): Promise<{ scored: number; ready: number; needsReview: number }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let scored = 0;
  let ready = 0;
  let needsReview = 0;
  let offset = 0;

  while (true) {
    const { data: investors } = await supabase
      .from("investors")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (!investors || investors.length === 0) break;

    for (const investor of investors) {
      const result = computeFitScore(investor, startup);

      // Update investor record
      await supabase
        .from("investors")
        .update({
          fit_score: result.overallScore,
          data_quality_score: result.dataQuality,
          outreach_readiness: result.outreachReadiness,
        })
        .eq("id", investor.id);

      // Store detailed profile
      await supabase
        .from("investor_profiles")
        .upsert(
          {
            investor_id: investor.id,
            ai_summary: result.factors.map((f) => `${f.factor}: ${f.explanation}`).join("\n"),
            ai_reasoning: JSON.stringify(result.factors),
            last_ai_analyzed_at: new Date().toISOString(),
          },
          { onConflict: "investor_id" }
        );

      scored++;
      if (result.outreachReadiness === "ready") ready++;
      if (result.outreachReadiness === "needs_verification") needsReview++;
    }

    offset += batchSize;
    if (investors.length < batchSize) break;
  }

  return { scored, ready, needsReview };
}
