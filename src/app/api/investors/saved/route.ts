// =============================================
// Saved Investors API Route (Supabase)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get saved investor records
    const { data: saved, error: savedError } = await sp
      .from("saved_investors")
      .select("id, investor_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (savedError || !saved?.length) {
      return NextResponse.json({ investors: [] });
    }

    // Get investor details
    const investorIds = saved.map((s) => s.investor_id);
    const { data: investorData } = await sp
      .from("investors")
      .select("id, full_name, email, job_title, investor_type, fit_score, country, city, investment_stages")
      .in("id", investorIds);

    const invMap = new Map((investorData || []).map((i) => [i.id, i]));
    const merged = saved
      .map((s) => {
        const inv = invMap.get(s.investor_id);
        if (!inv) return null;
        return {
          id: s.id,
          investor_id: s.investor_id,
          full_name: inv.full_name,
          email: inv.email,
          job_title: inv.job_title,
          investor_type: inv.investor_type,
          fit_score: inv.fit_score,
          country: inv.country,
          city: inv.city,
          investment_stages: inv.investment_stages,
          saved_at: s.created_at,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ investors: merged });
  } catch (err) {
    console.error("Saved investors error:", err);
    return NextResponse.json(
      { error: "Failed to load saved investors" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }

    const { investorId, notes } = await request.json();
    if (!investorId) {
      return NextResponse.json({ error: "investorId required" }, { status: 400 });
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await sp
      .from("saved_investors")
      .upsert(
        {
          user_id: user.id,
          investor_id: investorId,
          notes: notes || null,
        },
        { onConflict: "user_id,investor_id", ignoreDuplicates: true }
      );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Save investor error:", err);
    return NextResponse.json(
      { error: "Failed to save investor" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.api);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }

    const { savedId } = await request.json();
    if (!savedId) {
      return NextResponse.json({ error: "savedId required" }, { status: 400 });
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await sp
      .from("saved_investors")
      .delete()
      .eq("id", savedId)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Unsave investor error:", err);
    return NextResponse.json(
      { error: "Failed to unsave investor" },
      { status: 500 }
    );
  }
}
