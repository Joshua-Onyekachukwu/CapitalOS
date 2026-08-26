import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

// GET — List saved investors
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: saved, error } = await sp
      .from("saved_investors")
      .select(`
        id,
        investor_id,
        notes,
        created_at,
        investors (
          id, full_name, email, job_title, investor_type,
          fit_score, country, city, investment_stages, investment_sectors
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Flatten the join
    const investors = (saved || []).map((s: any) => ({
      id: s.id,
      investor_id: s.investor_id,
      notes: s.notes,
      saved_at: s.created_at,
      ...s.investors,
    }));

    return NextResponse.json({ investors });
  } catch (err) {
    console.error("Saved investors GET error:", err);
    return NextResponse.json({ error: "Failed to load saved investors" }, { status: 500 });
  }
}

// POST — Save an investor
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { investorId, notes } = body;

    if (!investorId) {
      return NextResponse.json({ error: "investorId is required" }, { status: 400 });
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if already saved
    const { data: existing } = await sp
      .from("saved_investors")
      .select("id")
      .eq("user_id", user.id)
      .eq("investor_id", investorId)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Already saved", saved: true });
    }

    const { data, error } = await sp
      .from("saved_investors")
      .insert({
        user_id: user.id,
        investor_id: investorId,
        notes: notes || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, savedId: data.id });
  } catch (err) {
    console.error("Saved investors POST error:", err);
    return NextResponse.json({ error: "Failed to save investor" }, { status: 500 });
  }
}

// DELETE — Remove a saved investor
export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { savedId, investorId } = body;

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = sp.from("saved_investors").delete().eq("user_id", user.id);

    if (savedId) {
      query = query.eq("id", savedId);
    } else if (investorId) {
      query = query.eq("investor_id", investorId);
    } else {
      return NextResponse.json({ error: "savedId or investorId required" }, { status: 400 });
    }

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Saved investors DELETE error:", err);
    return NextResponse.json({ error: "Failed to remove saved investor" }, { status: 500 });
  }
}
