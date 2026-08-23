import { NextRequest, NextResponse } from "next/server";
import { query, queryAs } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch campaign
    const campaigns = await query<any>(
      `SELECT * FROM data_acquisition_jobs WHERE id = $1 AND created_by = $2`,
      [id, user.id]
    );

    if (campaigns.length === 0) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const job = campaigns[0];

    // Fetch email messages for this user
    const emails = await queryAs<any>(
      user.id,
      `SELECT id, investor_id, subject, body_text, status, sent_at, ai_generated, created_at
       FROM email_messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id]
    );

    // Fetch investor details for email investors
    let investors: any[] = [];
    const investorIds = [...new Set(emails.map((e: any) => e.investor_id).filter(Boolean))];
    if (investorIds.length > 0) {
      investors = await query<any>(
        `SELECT id, first_name, last_name, email, fit_score
         FROM investors
         WHERE id = ANY($1)`,
        [investorIds]
      );
    }

    const invMap = new Map(investors.map((i: any) => [i.id, i]));
    const campaignInvestors = emails
      .filter((e: any) => e.investor_id)
      .map((e: any) => {
        const inv = invMap.get(e.investor_id);
        return {
          id: e.id,
          investor_id: e.investor_id,
          first_name: inv?.first_name || "",
          last_name: inv?.last_name || "",
          firm_name: "",
          email: inv?.email || null,
          fit_score: inv?.fit_score || 0,
          status: e.status === "sent" ? "sent" : e.status === "draft" ? "drafted" : "pending",
          subject: e.subject,
          body: e.body_text,
        };
      });

    return NextResponse.json({
      campaign: {
        id: job.id,
        name: job.filters?.name || "Untitled Campaign",
        description: job.filters?.description || "",
        status: job.status === "pending" ? "draft" : job.status === "running" ? "active" : job.status === "completed" ? "completed" : "paused",
        investor_count: job.found_count || 0,
        emails_sent: job.processed_count || 0,
        responses: job.validated_count || 0,
        created_at: job.created_at,
        sector: job.filters?.sector,
        stage: job.filters?.stage,
      },
      investors: campaignInvestors,
    });
  } catch (err) {
    console.error("Campaign detail API error:", err);
    return NextResponse.json({ error: "Failed to load campaign" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await request.json();

    const dbStatus = status === "active" ? "running" : status;

    await query(
      `UPDATE data_acquisition_jobs SET status = $1 WHERE id = $2 AND created_by = $3`,
      [dbStatus, id, user.id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Campaign update API error:", err);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}
