import { NextRequest, NextResponse } from "next/server";
import { chatWithCopilot } from "@/lib/actions/copilot";

export async function POST(request: NextRequest) {
  try {
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
