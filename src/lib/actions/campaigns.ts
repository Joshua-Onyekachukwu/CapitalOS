"use server";

import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

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
  const user = await requireUser();

  // Campaigns are stored as acquisition jobs with job_type = 'campaign'
  const rows = await query<any>(
    `SELECT * FROM data_acquisition_jobs
     WHERE job_type = $1 AND created_by = $2
     ORDER BY created_at DESC`,
    ["campaign", user.id]
  );

  return rows.map((job) => ({
    id: job.id,
    name: job.filters?.name || "Untitled Campaign",
    description: job.filters?.description || "",
    status:
      job.status === "pending"
        ? "draft"
        : job.status === "running"
          ? "active"
          : job.status === "completed"
            ? "completed"
            : "paused",
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
  const user = await requireUser();

  const filters = JSON.stringify({
    name: data.name,
    description: data.description,
    sector: data.sector,
    stage: data.stage,
    geography: data.geography,
  });

  const rows = await query<any>(
    `INSERT INTO data_acquisition_jobs (job_type, filters, status, created_by)
     VALUES ('campaign', $1::jsonb, 'pending', $2)
     RETURNING *`,
    [filters, user.id]
  );

  if (!rows || rows.length === 0) return null;

  const job = rows[0];
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
  const dbStatus =
    status === "draft"
      ? "pending"
      : status === "active"
        ? "running"
        : status;

  await query(
    `UPDATE data_acquisition_jobs SET status = $1 WHERE id = $2`,
    [dbStatus, campaignId]
  );

  return true;
}

// =============================================
// Update Pipeline Stage
// =============================================

export async function updateInvestorPipelineStage(
  investorId: string,
  stage: "not_ready" | "needs_verification" | "ready" | "contacted" | "do_not_contact"
): Promise<boolean> {
  await query(
    `UPDATE investors SET outreach_readiness = $1 WHERE id = $2`,
    [stage, investorId]
  );
  return true;
}

// =============================================
// Bulk Update Pipeline Stage
// =============================================

export async function bulkUpdatePipelineStage(
  investorIds: string[],
  stage: "not_ready" | "needs_verification" | "ready" | "contacted" | "do_not_contact"
): Promise<number> {
  if (investorIds.length === 0) return 0;

  // Build parameterized IN clause
  const placeholders = investorIds.map((_, i) => `$${i + 1}`).join(", ");
  const result = await query<{ id: string }>(
    `UPDATE investors SET outreach_readiness = $${investorIds.length + 1}
     WHERE id IN (${placeholders})
     RETURNING id`,
    [...investorIds, stage]
  );

  return result.length;
}

// =============================================
// Delete Campaign
// =============================================

export async function deleteCampaign(campaignId: string): Promise<boolean> {
  await query(
    `DELETE FROM data_acquisition_jobs WHERE id = $1`,
    [campaignId]
  );
  return true;
}
