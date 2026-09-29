import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { getUserRole } from "@/lib/roles";

// GET /api/admin/audit-logs?action=…&actor=…&limit=…&before=…
// Server-side filtering so the audit viewer stays useful as the log grows.
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

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action")?.trim();
  const actor = searchParams.get("actor")?.trim();
  const before = searchParams.get("before")?.trim();
  const limit = Math.min(500, Math.max(10, parseInt(searchParams.get("limit") || "200", 10)));

  let query = sp
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) query = query.ilike("action", `%${action}%`);
  if (actor) query = query.ilike("user_email", `%${actor}%`);
  if (before) query = query.lt("created_at", before);

  const { data, error } = await query;

  if (error) {
    console.error("[admin/audit-logs] query failed:", error.message);
    return NextResponse.json({ logs: [] });
  }

  const logs = data || [];
  const last = logs[logs.length - 1] as { created_at?: string } | undefined;
  return NextResponse.json({
    logs,
    nextBefore: logs.length === limit ? last?.created_at ?? null : null,
  });
}
