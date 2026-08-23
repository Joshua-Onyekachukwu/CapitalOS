import { NextRequest, NextResponse } from "next/server";
import { chatWithCopilot } from "@/lib/actions/copilot";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { requireAuth } from "@/lib/middleware/api-auth";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.ai);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const reply = await chatWithCopilot(messages);
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Copilot failed" },
      { status: 500 }
    );
  }
}
