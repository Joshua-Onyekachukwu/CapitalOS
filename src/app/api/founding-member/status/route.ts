// =============================================
// Founding Member — Status Check
// =============================================
// Checks if the current user (or email) is a founding member.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const sp = getSupabase();
    const { searchParams } = new URL(request.url);

    // Check by email (for the confirmation page after Stripe redirect)
    const email = searchParams.get("email");
    const sessionId = searchParams.get("session_id");

    if (!email && !sessionId) {
      return NextResponse.json({ isFoundingMember: false });
    }

    let query = sp.from("founding_members").select("*").eq("payment_status", "paid");

    if (sessionId) {
      query = query.eq("stripe_session_id", sessionId);
    } else if (email) {
      query = query.eq("email", email.toLowerCase());
    }

    const { data, error } = await query.limit(1).single();

    if (error || !data) {
      return NextResponse.json({ isFoundingMember: false });
    }

    return NextResponse.json({
      isFoundingMember: true,
      foundingCredit: data.founding_credit,
      paymentDate: data.created_at,
      email: data.email,
      name: data.name,
    });
  } catch (err) {
    console.error("Status check error:", err);
    return NextResponse.json({ isFoundingMember: false });
  }
}
