"use server";

import { createClient } from "@/lib/supabase/server";

// =============================================
// Types
// =============================================

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "completed";
  investor_count: number;
  emails_sent: number;
  responses: number;
  created_at: string;
  user_id: string;
}

// =============================================
// List Campaigns
// =============================================

export async function getCampaigns(): Promise<Campaign[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Campaigns are stored as acquisition jobs with job_type = 'campaign'
  const { data, error } = await supabase
    .from("data_acquisition_jobs")
    .select("*")
    .eq("job_type", "campaign")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data || []).map((job) => ({
    id: job.id,
    name: job.filters?.name || "Untitled Campaign",
    description: job.filters?.description || "",
    status: job.status === "pending" ? "draft" : job.status === "running" ? "active" : job.status === "completed" ? "completed" : "paused",
    investor_count: job.found_count || 0,
    emails_sent: job.processed_count || 0,
    responses: job.validated_count || 0,
    created_at: job.created_at,
    user_id: job.created_by,
  }));
}

// =============================================
// Create Campaign
// =============================================

export async function createCampaign(data: {
  name: string;
  description: string;
  sector?: string;
  stage?: string;
  geography?: string;
}): Promise<Campaign | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: job, error } = await supabase
    .from("data_acquisition_jobs")
    .insert({
      job_type: "campaign",
      filters: {
        name: data.name,
        description: data.description,
        sector: data.sector,
        stage: data.stage,
        geography: data.geography,
      },
      status: "pending",
      created_by: user.id,
    })
    .select()
    .single();

  if (error || !job) return null;

  return {
    id: job.id,
    name: data.name,
    description: data.description,
    status: "draft",
    investor_count: 0,
    emails_sent: 0,
    responses: 0,
    created_at: job.created_at,
    user_id: user.id,
  };
}

// =============================================
// Update Campaign Status
// =============================================

export async function updateCampaignStatus(
  campaignId: string,
  status: "draft" | "active" | "paused" | "completed"
): Promise<boolean> {
  const supabase = await createClient();
  const dbStatus = status === "draft" ? "pending" : status === "active" ? "running" : status;

  const { error } = await supabase
    .from("data_acquisition_jobs")
    .update({ status: dbStatus })
    .eq("id", campaignId);

  return !error;
}

// =============================================
// Update Pipeline Stage
// =============================================

export async function updateInvestorPipelineStage(
  investorId: string,
  stage: "not_ready" | "needs_verification" | "ready" | "contacted" | "do_not_contact"
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("investors")
    .update({ outreach_readiness: stage })
    .eq("id", investorId);

  return !error;
}

// =============================================
// Bulk Update Pipeline Stage
// =============================================

export async function bulkUpdatePipelineStage(
  investorIds: string[],
  stage: "not_ready" | "needs_verification" | "ready" | "contacted" | "do_not_contact"
): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("investors")
    .update({ outreach_readiness: stage })
    .in("id", investorIds)
    .select("id");

  if (error) return 0;
  return data?.length || 0;
}

// =============================================
// Delete Campaign
// =============================================

export async function deleteCampaign(campaignId: string): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("data_acquisition_jobs")
    .delete()
    .eq("id", campaignId);

  return !error;
}
