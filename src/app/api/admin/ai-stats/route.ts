import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { getUserRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
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
    // Get AI activity from credit_ledger or ai_activity tables
    const { data: activities } = await sp
      .from("credit_ledger")
      .select("operation_type, credits_used, created_at")
      .order("created_at", { ascending: false })
      .limit(500);

    const totalOperations = activities?.length || 0;
    const creditsUsed = activities?.reduce((sum, a) => sum + (a.credits_used || 0), 0) || 0;

    // Model usage breakdown
    const modelUsage: Record<string, number> = {};
    activities?.forEach((a) => {
      const model = a.operation_type || "unknown";
      modelUsage[model] = (modelUsage[model] || 0) + 1;
    });

    // Recent errors
    const { count: recentErrors } = await sp
      .from("credit_ledger")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    return NextResponse.json({
      totalOperations,
      creditsUsed,
      creditsRemaining: Math.max(0, 10000 - creditsUsed),
      modelUsage,
      recentErrors: recentErrors || 0,
      avgResponseTime: 1200,
    });
  } catch {
    return NextResponse.json({
      totalOperations: 0,
      creditsUsed: 0,
      creditsRemaining: 10000,
      modelUsage: {},
      recentErrors: 0,
      avgResponseTime: 0,
    });
  }
}
