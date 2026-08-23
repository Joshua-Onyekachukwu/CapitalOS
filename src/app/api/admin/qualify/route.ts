import { NextRequest, NextResponse } from "next/server";
import { runBatchQualification } from "@/lib/services/investor/qualification";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";

export async function POST(request: NextRequest) {
  const user = await requireAdmin(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { startup } = body;

    if (!startup?.sector || !startup?.stage) {
      return NextResponse.json(
        { error: "startup.sector and startup.stage are required" },
        { status: 400 }
      );
    }

    const result = await runBatchQualification({
      name: startup.name || "My Startup",
      sector: startup.sector,
      stage: startup.stage,
      geography: startup.geography || "United States",
      description: startup.description || "",
      minCheckSize: startup.minCheckSize,
      maxCheckSize: startup.maxCheckSize,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
