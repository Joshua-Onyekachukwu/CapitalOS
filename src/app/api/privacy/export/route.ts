// =============================================
// Privacy — Export my data
// =============================================
// GET /api/privacy/export
//
// Streams the requesting founder's complete data set (every user-scoped
// table, credentials redacted) as a download. The file reflects production
// state at the time of request. Retained financial rows are included.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import { exportUserData } from "@/lib/services/privacy/user-data";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = getSp();
    const { data, tables } = await exportUserData(sp, user.id);

    const payload = {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email ?? null },
      notes:
        "Email account credentials are redacted. Financial/audit rows " +
        "(subscriptions, billing events, credits, founding-member records, admin audit) " +
        "are shown for transparency but are retained for billing integrity on deletion.",
      tables,
      data,
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="capital-os-data-export-${user.id.slice(0, 8)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[privacy/export] failed:", err);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
