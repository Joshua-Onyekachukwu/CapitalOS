// =============================================
// Campaign Email Sequence — AI Drafting
// =============================================
// Generates personalized email sequences for campaigns.
// Uses CockroachDB for data.

"use server";

import { query } from "@/lib/db";
import { chatCompletion } from "@/lib/ai";

interface EmailSequenceStep {
  stepNumber: number;
  subject: string;
  body: string;
  delayDays: number;
  purpose: string;
}

interface CampaignSequence {
  investorId: string;
  investorName: string;
  firmName: string;
  emails: EmailSequenceStep[];
}

/**
 * Generate a 3-step email sequence for a single investor.
 */
export async function generateEmailSequence(params: {
  investorId: string;
  startupName: string;
  startupDescription: string;
  startupStage: string;
  founderName: string;
}): Promise<CampaignSequence | null> {
  // Fetch investor data from CockroachDB
  const investors = await query<any>(
    `SELECT * FROM investors WHERE id = $1`,
    [params.investorId]
  );

  if (!investors.length) return null;
  const investor = investors[0];

  // Fetch firm data
  const firms = investor.current_firm_id
    ? await query<any>(`SELECT * FROM investor_firms WHERE id = $1`, [investor.current_firm_id])
    : [];
  const firm = firms[0] || null;

  // Fetch existing profile
  const profiles = await query<any>(
    `SELECT * FROM investor_profiles WHERE investor_id = $1`,
    [params.investorId]
  );
  const profile = profiles[0] || null;

  const prompt = `You are an expert fundraising strategist for startup founders. Generate a 3-step email outreach sequence for the following investor.

STARTUP:
- Name: ${params.startupName}
- Description: ${params.startupDescription}
- Stage: ${params.startupStage}
- Founder: ${params.founderName}

INVESTOR:
- Name: ${investor.first_name} ${investor.last_name}
- Type: ${investor.investor_type}
- Firm: ${firm?.name || "Independent"}
- Investment Stages: ${(investor.investment_stages || []).join(", ") || "Not specified"}
- Sectors: ${(investor.investment_sectors || []).join(", ") || "Not specified"}
- Geography: ${(investor.investment_geographies || []).join(", ") || "Not specified"}
- Thesis: ${profile?.ai_summary || "Not available"}

Generate 3 emails:
1. Initial cold outreach (Day 0) — introduce yourself, reference their thesis
2. Follow-up with traction/update (Day 3) — share a metric or milestone
3. Break-up email (Day 7) — respectful close, leave door open

Respond in this EXACT JSON format (no markdown, no code blocks):
{
  "emails": [
    {
      "stepNumber": 1,
      "subject": "<email subject>",
      "body": "<email body, under 150 words>",
      "delayDays": 0,
      "purpose": "<one-line description of purpose>"
    },
    {
      "stepNumber": 2,
      "subject": "<email subject>",
      "body": "<email body, under 120 words>",
      "delayDays": 3,
      "purpose": "<one-line description>"
    },
    {
      "stepNumber": 3,
      "subject": "<email subject>",
      "body": "<email body, under 80 words>",
      "delayDays": 7,
      "purpose": "<one-line description>"
    }
  ]
}`;

  try {
    const response = await chatCompletion({
      task: "email_drafting",
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      investorId: params.investorId,
      investorName: `${investor.first_name} ${investor.last_name}`,
      firmName: firm?.name || "Independent",
      emails: parsed.emails.map((e: any) => ({
        stepNumber: e.stepNumber,
        subject: e.subject,
        body: e.body,
        delayDays: e.delayDays,
        purpose: e.purpose,
      })),
    };
  } catch (err) {
    console.error("Email sequence generation error:", err);
    return null;
  }
}

/**
 * Generate email sequences for all investors in a campaign.
 */
export async function generateCampaignSequences(params: {
  campaignId: string;
  startupName: string;
  startupDescription: string;
  startupStage: string;
  founderName: string;
  limit?: number;
}): Promise<{ generated: number; total: number }> {
  // Get campaign data from CockroachDB
  const campaigns = await query<any>(
    `SELECT * FROM data_acquisition_jobs WHERE id = $1`,
    [params.campaignId]
  );

  if (!campaigns.length) return { generated: 0, total: 0 };
  const campaign = campaigns[0];

  // Find investors that match the campaign's filter criteria
  let sql = `SELECT id FROM investors WHERE email IS NOT NULL AND outreach_readiness = 'ready'`;
  const params_arr: any[] = [];

  if (campaign.filters?.sector) {
    params_arr.push(campaign.filters.sector);
    sql += ` AND $${params_arr.length} = ANY(investment_sectors)`;
  }
  if (campaign.filters?.stage) {
    params_arr.push(campaign.filters.stage);
    sql += ` AND $${params_arr.length} = ANY(investment_stages)`;
  }

  sql += ` ORDER BY fit_score DESC LIMIT $${params_arr.length + 1}`;
  params_arr.push(params.limit || 20);

  const investors = await query<{ id: string }>(sql, params_arr);

  if (!investors.length) return { generated: 0, total: 0 };

  let generated = 0;

  for (const inv of investors) {
    const sequence = await generateEmailSequence({
      investorId: inv.id,
      startupName: params.startupName,
      startupDescription: params.startupDescription,
      startupStage: params.startupStage,
      founderName: params.founderName,
    });

    if (sequence) generated++;
  }

  return { generated, total: investors.length };
}
