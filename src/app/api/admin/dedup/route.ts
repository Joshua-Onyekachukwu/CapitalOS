import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/api-auth";
import { detectDuplicates } from "@/lib/services/investor/matching";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request);
    if (user instanceof NextResponse) return user;

    const result = await detectDuplicates(500);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Dedup error:", error);
    return NextResponse.json({ error: "Dedup failed" }, { status: 500 });
  }
}
