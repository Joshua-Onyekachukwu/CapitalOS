import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { investorId, investorEmail, investorName, preferredTime, notes } = body;

    if (!investorEmail) {
      return NextResponse.json(
        { error: "Investor email is required to schedule a meeting" },
        { status: 400 }
      );
    }

    // Get user profile for meeting details
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await sp
      .from("company_profiles")
      .select("company_name, founder_name, user_email")
      .eq("user_id", user.id)
      .single();

    // Generate a scheduling link (in production, this would integrate with Calendly/Cal.com)
    const schedulingToken = Buffer.from(
      JSON.stringify({
        userId: user.id,
        investorId,
        investorEmail,
        investorName,
        hostName: profile?.founder_name || user.email,
        hostCompany: profile?.company_name || "Capital OS",
        preferredTime,
        notes,
        createdAt: new Date().toISOString(),
      })
    ).toString("base64");

    const schedulingUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001"}/schedule/${schedulingToken}`;

    // Log the meeting request
    await sp.from("audit_log").insert({
      user_id: user.id,
      action: "meeting_scheduled",
      details: {
        investorId,
        investorEmail,
        investorName,
        preferredTime,
      },
    }).then(() => {}).catch(() => {}); // Non-critical

    return NextResponse.json({
      success: true,
      schedulingUrl,
      message: `Meeting scheduling link generated for ${investorName || investorEmail}`,
      details: {
        investor: investorName || investorEmail,
        host: profile?.founder_name || user.email,
        company: profile?.company_name || "Your Startup",
        preferredTime,
      },
    });
  } catch (err) {
    console.error("Meeting schedule error:", err);
    return NextResponse.json(
      { error: "Failed to generate scheduling link" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get investors marked as "meeting" in pipeline
    const { data: meetingInvestors } = await sp
      .from("investors")
      .select("id, full_name, email, firm_name, investor_type, fit_score, created_at")
      .eq("outreach_readiness", "meeting")
      .order("fit_score", { ascending: false });

    // Get investors who have replied positively (potential meetings)
    const { data: repliedInvestors } = await sp
      .from("email_messages")
      .select("investor_id, sentiment, reply_detected_at")
      .eq("user_id", user.id)
      .eq("direction", "inbound")
      .eq("sentiment", "positive")
      .not("investor_id", "is", null);

    // Combine and deduplicate
    const investorMap = new Map();
    
    for (const inv of meetingInvestors || []) {
      investorMap.set(inv.id, {
        ...inv,
        status: "meeting",
        readiness: "ready",
      });
    }

    for (const reply of repliedInvestors || []) {
      if (reply.investor_id && !investorMap.has(reply.investor_id)) {
        // Fetch full investor details
        const { data: inv } = await sp
          .from("investors")
          .select("id, full_name, email, firm_name, investor_type, fit_score")
          .eq("id", reply.investor_id)
          .single();
        
        if (inv) {
          investorMap.set(inv.id, {
            ...inv,
            status: "positive_reply",
            readiness: "ready",
            replyDate: reply.reply_detected_at,
          });
        }
      }
    }

    const meetings = Array.from(investorMap.values()).sort(
      (a, b) => (b.fit_score || 0) - (a.fit_score || 0)
    );

    return NextResponse.json({
      meetings,
      stats: {
        total: meetings.length,
        meetingStage: meetingInvestors?.length || 0,
        positiveReplies: repliedInvestors?.length || 0,
      },
    });
  } catch (err) {
    console.error("Meeting list error:", err);
    return NextResponse.json(
      { error: "Failed to load meetings" },
      { status: 500 }
    );
  }
}
