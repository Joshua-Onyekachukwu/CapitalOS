import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { detectDuplicates } from "@/lib/services/investor/matching";

export async function POST() {
  try {
    const user = await requireUser();
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
