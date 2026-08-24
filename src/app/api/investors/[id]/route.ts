// =============================================
// Investor Detail API Route
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch investor from Supabase
    const { data: investor, error } = await supabase
      .from("investors")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 });
    }

    return NextResponse.json({
      investor,
      firm: null,
      profile: null,
    });
  } catch (err) {
    console.error("Investor detail error:", err);
    return NextResponse.json(
      { error: "Failed to load investor" },
      { status: 500 }
    );
  }
}
