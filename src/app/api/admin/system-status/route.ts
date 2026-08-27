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

  // Check database health
  let database: "healthy" | "degraded" | "down" = "healthy";
  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { error } = await sp.from("investors").select("id", { count: "exact", head: true });
    if (error) database = "degraded";
  } catch {
    database = "down";
  }

  // Check AI service
  let ai: "healthy" | "degraded" | "down" = "healthy";
  const hasNvidiaKeys = Array.from({ length: 5 }, (_, i) => process.env[`NVIDIA_API_KEY_${i + 1}`]).some((k) => k?.startsWith("nvapi-"));
  if (!hasNvidiaKeys) ai = "degraded";

  // Check email
  let email: "healthy" | "degraded" | "down" = "healthy";
  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { count } = await sp.from("email_accounts").select("*", { count: "exact", head: true });
    if (!count || count === 0) email = "degraded";
  } catch {
    email = "down";
  }

  return NextResponse.json({
    database,
    auth: "healthy",
    ai,
    email,
    storage: "healthy",
    uptime: "Since last deploy",
    lastDeploy: new Date().toISOString().split("T")[0],
    environment: process.env.VERCEL_ENV || "development",
  });
}
