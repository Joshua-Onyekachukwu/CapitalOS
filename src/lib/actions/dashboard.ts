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
  meetingsScheduled: number;
  highFitInvestors: number;
  investorsThisWeek: number;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const [investorsResult, firmsResult, jobsResult] = await Promise.all([
    supabase.from("investors").select("id", { count: "exact", head: true }),
    supabase.from("investor_firms").select("id", { count: "exact", head: true }),
    supabase.from("data_acquisition_jobs").select("id, status, created_at, found_count"),
  ]);

  const totalInvestors = investorsResult.count || 0;
  const totalFirms = firmsResult.count || 0;

  const jobs = jobsResult.data || [];
  const activeCampaigns = jobs.filter((j) => j.status === "running" || j.status === "pending").length;
  const emailsSent = jobs.filter((j) => j.status === "completed").reduce((sum, j) => sum + (j.found_count || 0), 0);

  // High-fit investors (fit_score >= 80)
  const { count: highFit } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .gte("fit_score", 80);

  // Investors added this week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: thisWeek } = await supabase
    .from("investors")
    .select("id", { count: "exact", head: true })
    .gte("created_at", weekAgo.toISOString());

  return {
    totalInvestors,
    totalFirms,
    activeCampaigns,
    emailsSent,
    meetingsScheduled: 0, // Will be connected when meetings table exists
    highFitInvestors: highFit || 0,
    investorsThisWeek: thisWeek || 0,
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

  const { data, error } = await supabase
    .from("investors")
    .select("outreach_readiness");

  if (error) {
    console.error("Error fetching pipeline:", error);
    return [];
  }

  const stageMap: Record<string, number> = {};
  (data || []).forEach((row) => {
    const stage = row.outreach_readiness || "not_ready";
    stageMap[stage] = (stageMap[stage] || 0) + 1;
  });

  return Object.entries(stageMap).map(([stage, count]) => ({ stage, count }));
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

  const { data, error } = await supabase
    .from("investors")
    .select("investment_sectors");

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
