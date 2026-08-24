import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { detectDuplicates } from "@/lib/services/investor/matching";

export async function POST() {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await detectDuplicates(500);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Dedup error:", error);
    return NextResponse.json({ error: "Dedup failed" }, { status: 500 });
  }
}
