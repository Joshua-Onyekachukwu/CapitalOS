import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createSequence } from "@/lib/services/campaigns/sequence";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (user instanceof NextResponse) return user;
    const body = await request.json();
    const { campaignId, name, steps, stopOnReply } = body;

    if (!campaignId || !name || !steps?.length) {
      return NextResponse.json(
        { error: "Missing required fields: campaignId, name, steps" },
        { status: 400 }
      );
    }

    const sequence = await createSequence(campaignId, user.id, {
      name,
      steps,
      stop_on_reply: stopOnReply ?? true,
    });

    return NextResponse.json({ sequence });
  } catch (error: any) {
    console.error("[sequence/create]", error);
    return NextResponse.json(
      { error: error.message || "Failed to create sequence" },
      { status: 500 }
    );
  }
}
