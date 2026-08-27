import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/middleware/api-auth";
import { getUserRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  const roleInfo = await getUserRole(user.id, user.email || "");
  if (!roleInfo.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sp = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { count: foundingMembers } = await sp
      .from("founding_members")
      .select("*", { count: "exact", head: true });

    const { count: waitlistSignups } = await sp
      .from("waitlist")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      totalRevenue: (foundingMembers || 0) * 9.99,
      activeSubscriptions: 0,
      foundingMembers: foundingMembers || 0,
      foundingCredits: (foundingMembers || 0) * 9.99,
      monthlyRecurring: 0,
      waitlistSignups: waitlistSignups || 0,
    });
  } catch {
    return NextResponse.json({
      totalRevenue: 0,
      activeSubscriptions: 0,
      foundingMembers: 0,
      foundingCredits: 0,
      monthlyRecurring: 0,
      waitlistSignups: 0,
    });
  }
}
