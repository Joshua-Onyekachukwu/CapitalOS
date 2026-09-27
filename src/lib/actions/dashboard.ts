"use server";

import { createClient } from "@/lib/supabase/server";

// =============================================
// Dashboard Stats
// =============================================

export interface DashboardStats {
  totalInvestors: number;
  totalFirms: number;
  activeCampaigns: number;
  emailsSent: number;
  emailsReplied: number;
  meetingsScheduled: number;
  highFitInvestors: number;
  investorsThisWeek: number;
  readyInvestors: number;
  avgFitScore: number;
  totalCreditsUsed: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [investorsResult, firmsResult, jobsResult, emailsSentResult, emailsRepliedResult, creditsResult] = await Promise.all([
    supabase.from("investors").select("id", { count: "exact", head: true }),
    supabase.from("investor_firms").select("id", { count: "exact", head: true }),
    supabase.from("data_acquisition_jobs").select("id, status, created_at, found_count"),
    // count queries instead of fetching every row (12k+ rows were being
    // transferred just to count them in JS)
    supabase
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "outbound")
      .eq("status", "sent"),
    supabase
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("direction", "inbound"),
    supabase.from("credit_ledger").select("amount"),
  ]);

  const totalInvestors = investorsResult.count || 0;
  const totalFirms = firmsResult.count || 0;

  const jobs = jobsResult.data || [];
  const activeCampaigns = jobs.filter((j) => j.status === "running" || j.status === "pending").length;

  const emailsSent = emailsSentResult.count || 0;
  const emailsReplied = emailsRepliedResult.count || 0;

  const credits = creditsResult.data || [];
  const totalCreditsUsed = credits.reduce((sum, c) => sum + Math.abs(c.amount || 0), 0);

  // High-fit investors (fit_score >= 80)
  const { count: highFit } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .gte("fit_score", 80);

  // Ready for outreach
  const { count: readyCount } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .eq("outreach_readiness", "ready");

  // Investors added this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: thisWeek } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .gte("created_at", weekAgo.toISOString());

  // Average fit score (sample for performance)
  const { data: fitSample } = await supabase
    .from("investors")
    .select("fit_score")
    .gt("fit_score", 0)
    .limit(1000);

  const avgFitScore = fitSample && fitSample.length > 0
    ? Math.round(fitSample.reduce((sum, i) => sum + (i.fit_score || 0), 0) / fitSample.length)
    : 0;

  return {
    totalInvestors,
    totalFirms,
    activeCampaigns,
    emailsSent,
    emailsReplied,
    meetingsScheduled: 0,
    highFitInvestors: highFit || 0,
    investorsThisWeek: thisWeek || 0,
    readyInvestors: readyCount || 0,
    avgFitScore,
    totalCreditsUsed,
  };
}

// =============================================
// Recent Investors
// =============================================

export interface RecentInvestor {
  id: string;
  full_name: string;
  investor_type: string;
  current_firm_id: string | null;
  firm_name: string | null;
  fit_score: number;
  outreach_readiness: string;
  created_at: string;
}

export async function getRecentInvestors(limit = 5): Promise<RecentInvestor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_investors_with_firms")
    .select("id, full_name, investor_type, current_firm_id, firm_name, fit_score, outreach_readiness, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching recent investors:", error);
    return [];
  }

  return data || [];
}

// =============================================
// Pipeline Summary
// =============================================

export interface PipelineStage {
  stage: string;
  count: number;
}

export async function getPipelineSummary(): Promise<PipelineStage[]> {
  const supabase = await createClient();

  // Aggregate in Postgres via count-per-distinct-value (RPC-free): one head
  // count per known stage is far cheaper than transferring all 12k rows.
  const STAGES = ["not_ready", "needs_verification", "ready", "contacted", "meeting"];
  const results = await Promise.all(
    STAGES.map((stage) =>
      supabase
        .from("investors")
        .select("id", { count: "exact", head: true })
        .eq("outreach_readiness", stage)
    )
  );

  if (results.some((r) => r.error)) {
    console.error("Error fetching pipeline:", results.find((r) => r.error)?.error);
    return [];
  }

  return STAGES.map((stage, i) => ({ stage, count: results[i].count || 0 })).filter(
    (s) => s.count > 0
  );
}

// =============================================
// Sector Distribution
// =============================================

export interface SectorCount {
  sector: string;
  count: number;
}

export async function getSectorDistribution(): Promise<SectorCount[]> {
  const supabase = await createClient();

  // Sample 2,000 rows instead of transferring all 12k+ (the sector array is
  // only used for a top-10 chart; a sample is statistically sufficient and
  // cuts payload ~6x)
  const { data, error } = await supabase
    .from("investors")
    .select("investment_sectors")
    .not("investment_sectors", "is", null)
    .limit(2000);

  if (error) return [];

  const sectorMap: Record<string, number> = {};
  (data || []).forEach((row) => {
    (row.investment_sectors || []).forEach((sector: string) => {
      sectorMap[sector] = (sectorMap[sector] || 0) + 1;
    });
  });

  return Object.entries(sectorMap)
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

// =============================================
// Data Provider Status
// =============================================

export interface ProviderStatus {
  name: string;
  display_name: string;
  status: string;
  credits_remaining: number;
  usage_percentage: number;
}

export async function getProviderStatus(): Promise<ProviderStatus[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_provider_usage")
    .select("name, display_name, status, credits_remaining, usage_percentage");

  if (error) return [];
  return data || [];
}
