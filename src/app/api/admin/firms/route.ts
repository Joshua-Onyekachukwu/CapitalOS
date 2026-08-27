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

  // Get unique company names from investors table as a proxy for firms
  const { data: investors } = await sp
    .from("investors")
    .select("company_name, investor_type, country, fit_score")
    .not("company_name", "is", null)
    .limit(5000);

  // Group by company name
  const firmMap = new Map<string, {
    name: string;
    type: string;
    location: string;
    investor_count: number;
    total_fit: number;
  }>();

  investors?.forEach((inv) => {
    const name = inv.company_name;
    if (!name || name.length < 3) return;

    const existing = firmMap.get(name);
    if (existing) {
      existing.investor_count++;
      existing.total_fit += inv.fit_score || 0;
    } else {
      firmMap.set(name, {
        name,
        type: inv.investor_type?.replace(/_/g, " ") || "Investment Firm",
        location: inv.country || "",
        investor_count: 1,
        total_fit: inv.fit_score || 0,
      });
    }
  });

  // Convert to array and sort by investor count
  const firms = Array.from(firmMap.values())
    .filter((f) => f.investor_count >= 1)
    .sort((a, b) => b.investor_count - a.investor_count)
    .slice(0, 200)
    .map((f, i) => ({
      id: `firm-${i}`,
      ...f,
      avg_fit_score: f.investor_count > 0 ? Math.round(f.total_fit / f.investor_count) : 0,
    }));

  return NextResponse.json({ firms });
}
