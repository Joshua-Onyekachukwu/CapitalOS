import { NextRequest, NextResponse } from "next/server";
import { chatWithCopilot } from "@/lib/actions/copilot";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { requireAuth } from "@/lib/middleware/api-auth";
import { validateBodyAsync, copilotSchema } from "@/lib/validate";

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = applyRateLimit(request, RATE_LIMITS.ai);
    if (rateLimitResponse) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: rateLimitResponse.status, headers: rateLimitResponse.headers });
    }
    // Validate input
    const body = await request.json();
    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }
    // Validate message content lengths
    const messages = body.messages.slice(0, 50); // Limit to 50 messages
    for (const msg of messages) {
      if (typeof msg.content === "string" && msg.content.length > 5000) {
        msg.content = msg.content.slice(0, 5000);
      }
    }

    const reply = await chatWithCopilot(messages);
    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
