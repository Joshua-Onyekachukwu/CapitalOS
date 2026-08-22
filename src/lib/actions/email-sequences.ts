// =============================================
// Campaign Email Sequence — AI Drafting
// =============================================
// Generates personalized email sequences for campaigns.
// Each sequence is a series of follow-up emails tailored to each investor.

"use server";

import { createClient } from "@supabase/supabase-js";
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch investor + firm data
  const { data: investor } = await supabase
    .from("investors")
    .select("*")
    .eq("id", params.investorId)
    .single();

  if (!investor) return null;

  const { data: firm } = await supabase
    .from("investor_firms")
    .select("*")
    .eq("id", investor.current_firm_id)
    .single();

  const { data: profile } = await supabase
    .from("investor_profiles")
    .select("*")
    .eq("investor_id", params.investorId)
    .single();

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
- Investment Stages: ${(investor.preferred_stages || []).join(", ") || "Not specified"}
- Sectors: ${(investor.preferred_sectors || []).join(", ") || "Not specified"}
- Geography: ${(investor.preferred_geographies || []).join(", ") || "Not specified"}
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get investors assigned to this campaign
  const { data: campaign } = await supabase
    .from("data_acquisition_jobs")
    .select("*")
    .eq("id", params.campaignId)
    .single();

  if (!campaign) return { generated: 0, total: 0 };

  // Find investors that match the campaign's filter criteria
  let query = supabase
    .from("investors")
    .select("id")
    .not("email_address", "is", null)
    .eq("outreach_readiness", "ready");

  if (campaign.filters?.sector) {
    query = query.contains("preferred_sectors", [campaign.filters.sector]);
  }
  if (campaign.filters?.stage) {
    query = query.contains("preferred_stages", [campaign.filters.stage]);
  }

  const limit = params.limit || 20;
  const { data: investors } = await query.order("fit_score", { ascending: false }).limit(limit);

  if (!investors || investors.length === 0) return { generated: 0, total: 0 };

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
