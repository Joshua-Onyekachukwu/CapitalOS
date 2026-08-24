import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function GET() {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    return NextResponse.json({ id: user.id, email: user.email });
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
}
