import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { getUserRole } from "@/lib/roles";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  // Verify admin
  const roleInfo = await getUserRole(user.id, user.email || "");
  if (!roleInfo.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sp = getSp();
  const sp2 = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const page = parseInt(request.nextUrl.searchParams.get("page") || "0");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const search = request.nextUrl.searchParams.get("search") || "";
  // Demo rows are hidden by default so nobody mistakes them for real signups.
  const includeSynthetic =
    request.nextUrl.searchParams.get("includeSynthetic") === "true";

  // The waitlist table has no `position` column; queue position is signup order.
  // Ordering by a column that does not exist made this endpoint return 500.
  let query = sp
    .from("waitlist")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: true, nullsFirst: false });

  if (!includeSynthetic) query = query.eq("is_synthetic", false);

  if (search) {
    query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`);
  }

  const from = page * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count: syntheticCount } = await sp2
    .from("waitlist")
    .select("id", { count: "exact", head: true })
    .eq("is_synthetic", true);

  return NextResponse.json({
    entries: (data || []).map((row, i) => ({ ...row, position: from + i + 1 })),
    total: count || 0,
    syntheticExcluded: includeSynthetic ? 0 : syntheticCount || 0,
    page,
    limit,
  });
}
