import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createClient } from "@supabase/supabase-js";

// =============================================
// Campaign Detail API — Supabase
// =============================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch campaign
    let job: any = null;
    try {
      const { data, error } = await sp
        .from("data_acquisition_jobs")
        .select("*")
        .eq("id", id)
        .eq("created_by", user.id)
        .single();
      if (error) throw error;
      job = data;
    } catch {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Fetch email messages for this user
    let emails: any[] = [];
    try {
      const { data } = await sp
        .from("email_messages")
        .select("id, investor_id, subject, body_text, status, sent_at, ai_generated, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      emails = data || [];
    } catch { /* table may not exist */ }

    // Fetch investor details
    let investors: any[] = [];
    const investorIds = [...new Set(emails.map((e) => e.investor_id).filter(Boolean))];
    if (investorIds.length > 0) {
      const { data } = await sp
        .from("investors")
        .select("id, first_name, last_name, email, fit_score")
        .in("id", investorIds);
      investors = data || [];
    }

    const invMap = new Map(investors.map((i) => [i.id, i]));
    const campaignInvestors = emails
      .filter((e) => e.investor_id)
      .map((e) => {
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
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await request.json();
    const dbStatus = status === "active" ? "running" : status;

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      await sp
        .from("data_acquisition_jobs")
        .update({ status: dbStatus })
        .eq("id", id)
        .eq("created_by", user.id);
    } catch {
      // Table may not exist
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Campaign update API error:", err);
    return NextResponse.json({ error: "Failed to update campaign" }, { status: 500 });
  }
}
