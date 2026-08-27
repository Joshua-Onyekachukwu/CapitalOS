// =============================================
// Founding Member — Status Check
// =============================================
// Two modes:
// 1. Authenticated (no params) — returns current user's founding member status
// 2. Unauthenticated (?session_id=...) — returns confirmation data after Stripe redirect
//    Only allows session_id lookup (not email) to prevent enumeration.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  const sp = getSupabase();

  // Mode 1: Session ID lookup (for confirmation page after Stripe redirect)
  // This is safe because session IDs are opaque and unguessable
  if (sessionId) {
    // Validate session_id format — Stripe session IDs start with "cs_"
    if (!sessionId.startsWith("cs_") || sessionId.length > 200) {
      return NextResponse.json({ isFoundingMember: false });
    }

    const { data, error } = await sp
      .from("founding_members")
      .select("founding_credit, payment_status, created_at, email, name")
      .eq("stripe_session_id", sessionId)
      .eq("payment_status", "paid")
      .limit(1)
      .single();

    if (error || !data) {
      return NextResponse.json({ isFoundingMember: false });
    }

    // Return confirmation data (email and name are needed for the confirmation page)
    return NextResponse.json({
      isFoundingMember: true,
      foundingCredit: data.founding_credit,
      joinedAt: data.created_at,
      email: data.email,
      name: data.name,
    });
  }

  // Mode 2: Authenticated user lookup (for dashboard/settings)
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const { data, error } = await sp
    .from("founding_members")
    .select("founding_credit, payment_status, created_at")
    .eq("user_id", user.id)
    .eq("payment_status", "paid")
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ isFoundingMember: false });
  }

  // Return minimal data — no email, no Stripe IDs, no payment details
  return NextResponse.json({
    isFoundingMember: true,
    foundingCredit: data.founding_credit,
    joinedAt: data.created_at,
  });
}
