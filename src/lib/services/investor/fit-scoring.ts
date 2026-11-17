// =============================================
// Shared investor-fit scoring
// =============================================
// One deterministic implementation used by both the per-investor analysis
// route and the ranked Matches list. Every factor states its evidence; a
// missing field lowers the score and says so rather than being treated as a
// neutral 50. Weights are normalised, so the total can never exceed 100.

export interface FitFactor {
  factor: string;
  score: number;
  weight: number;
  explanation: string;
}

export interface FitStartup {
  sector: string;
  stage: string;
  geography: string;
}

export interface FitResult {
  overallScore: number;
  factors: FitFactor[];
  confidence: number;
  dataQuality: number;
  outreachReadiness: "ready" | "needs_verification" | "not_ready";
}

function scoreSectorMatch(
  investorSectors: string[],
  startupSector: string
): { score: number; explanation: string } {
  if (!investorSectors.length) return { score: 0, explanation: "No sector data — not scored" };
  if (!startupSector) return { score: 0, explanation: "Startup sector not set — not scored" };

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target = normalize(startupSector);
  const sectors = investorSectors.map(normalize);

  if (sectors.includes(target))
    return { score: 100, explanation: `Direct match: ${startupSector}` };

  const sectorGroups: Record<string, string[]> = {
    ai: ["ai", "machinelearning", "deeplearning", "ml", "datascience"],
    fintech: ["fintech", "financialtechnology", "payments", "banking"],
    saas: ["saas", "enterprise", "b2b", "software", "cloud"],
    healthtech: ["healthtech", "healthcare", "biotech", "medtech"],
    climatetech: ["climatetech", "cleantech", "energy", "sustainability"],
    consumer: ["consumer", "b2c", "marketplace", "ecommerce"],
    web3: ["web3", "blockchain", "crypto", "defi"],
    deeptech: ["deeptech", "robotics", "hardware", "spacetech", "devtools"],
    cybersecurity: ["cybersecurity", "security", "infosec"],
  };

  for (const keywords of Object.values(sectorGroups)) {
    if (keywords.includes(target)) {
      const overlaps = sectors.filter((s) => keywords.includes(s)).length;
      if (overlaps > 0)
        return { score: 85, explanation: `Related sector group (${overlaps} overlap${overlaps === 1 ? "" : "s"})` };
    }
  }

  for (const sector of sectors) {
    if (sector.includes(target) || target.includes(sector))
      return { score: 70, explanation: `Partial overlap with ${sector}` };
  }

  return {
    score: 15,
    explanation: `No sector overlap. Investor focuses on: ${investorSectors.slice(0, 3).join(", ")}`,
  };
}

function scoreStageMatch(
  investorStages: string[],
  startupStage: string
): { score: number; explanation: string } {
  if (!investorStages.length) return { score: 0, explanation: "No stage data — not scored" };
  if (!startupStage) return { score: 0, explanation: "Startup stage not set — not scored" };

  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "_");
  const target = norm(startupStage);
  const stages = investorStages.map(norm);
  if (stages.includes(target)) return { score: 100, explanation: `Direct stage match: ${startupStage}` };

  const order = ["pre_seed", "seed", "series_a", "series_b", "series_c", "growth", "late_stage"];
  const idx = order.indexOf(target);
  for (const stage of stages) {
    const other = order.indexOf(stage);
    if (idx < 0 || other < 0) continue;
    const distance = Math.abs(idx - other);
    if (distance === 1) return { score: 75, explanation: `Adjacent stage: investor does ${stage}` };
    if (distance === 2) return { score: 40, explanation: "Two stages apart" };
  }
  return { score: 10, explanation: `Stage mismatch. Investor focuses on: ${investorStages.join(", ")}` };
}

function scoreGeographyMatch(
  investorGeos: string[],
  investorCountry: string | null,
  startupGeo: string
): { score: number; explanation: string } {
  if (!startupGeo) return { score: 0, explanation: "Startup geography not set — not scored" };
  const target = startupGeo.toLowerCase().trim();

  if (investorCountry && investorCountry.toLowerCase() === target)
    return { score: 100, explanation: `Same country: ${startupGeo}` };

  if (investorGeos.length > 0) {
    const match = investorGeos.find(
      (g) => g.toLowerCase().includes(target) || target.includes(g.toLowerCase())
    );
    if (match) return { score: 100, explanation: `Geography match: ${match}` };
    if (investorGeos.some((g) => g.toLowerCase().includes("global")))
      return { score: 90, explanation: "Global investor" };
  }

  return { score: 20, explanation: "No geographic overlap on record" };
}

export function computeFitScore(investor: Record<string, unknown>, startup: FitStartup): FitResult {
  const factors: FitFactor[] = [];

  const sector = scoreSectorMatch((investor.investment_sectors as string[]) || [], startup.sector);
  factors.push({ factor: "Sector Match", score: sector.score, weight: 0.3, explanation: sector.explanation });

  const stage = scoreStageMatch((investor.investment_stages as string[]) || [], startup.stage);
  factors.push({ factor: "Stage Match", score: stage.score, weight: 0.25, explanation: stage.explanation });

  const geo = scoreGeographyMatch(
    (investor.investment_geographies as string[]) || [],
    (investor.country as string) || null,
    startup.geography
  );
  factors.push({ factor: "Geography Match", score: geo.score, weight: 0.15, explanation: geo.explanation });

  // Activity: a Form D first-sale date is evidence the fund is deploying now.
  const firstSale =
    (investor.first_sale_date as string | null) ||
    ((investor.provenance as Record<string, unknown> | null)?.first_sale_date as string | null) ||
    null;
  let activityScore = 0;
  let activityText = "No filing activity date — not scored";
  if (firstSale) {
    const days = Math.floor((Date.now() - new Date(firstSale).getTime()) / 86_400_000);
    if (Number.isFinite(days) && days >= 0) {
      if (days < 180) {
        activityScore = 100;
        activityText = `First sale ${days}d ago — actively deploying`;
      } else if (days < 420) {
        activityScore = 75;
        activityText = `First sale ~${Math.floor(days / 30)}mo ago`;
      } else {
        activityScore = 35;
        activityText = `First sale ~${Math.floor(days / 365)}y ago`;
      }
    }
  }
  factors.push({ factor: "Recent Activity", score: activityScore, weight: 0.15, explanation: activityText });

  // Cheque evidence is rarely present in filings; missing means unscored, not
  // a neutral pass.
  const hasCheque = investor.min_check_size || investor.max_check_size;
  factors.push({
    factor: "Cheque Fit",
    score: hasCheque ? 70 : 0,
    weight: 0.15,
    explanation: hasCheque
      ? "Cheque range on record — compare against your round"
      : "No cheque range — minimum LP commitment is not a startup cheque",
  });

  const fields = ["email", "website_url", "investment_stages", "investment_sectors", "country"];
  let filled = 0;
  const missing: string[] = [];
  for (const field of fields) {
    const value = investor[field];
    if (value && (Array.isArray(value) ? value.length > 0 : true)) filled += 1;
    else missing.push(field.replace(/_/g, " "));
  }
  const completeness = Math.round((filled / fields.length) * 100);
  factors.push({
    factor: "Evidence",
    score: completeness,
    weight: 0.1,
    explanation:
      missing.length > 0
        ? `${filled}/${fields.length} fields present. Missing: ${missing.slice(0, 3).join(", ")}`
        : "All key fields present",
  });

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const overallScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight
  );

  return {
    overallScore,
    factors,
    confidence: completeness,
    dataQuality: completeness,
    outreachReadiness:
      overallScore >= 70 && completeness >= 60
        ? "ready"
        : overallScore >= 45
          ? "needs_verification"
          : "not_ready",
  };
}
