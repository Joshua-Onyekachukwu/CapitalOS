import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";

// GET — Load user's conversations
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: conversations, error } = await sp
      .from("copilot_conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (error) {
      // Table might not exist yet
      return NextResponse.json({ conversations: [] });
    }

    return NextResponse.json({ conversations: conversations || [] });
  } catch {
    return NextResponse.json({ conversations: [] });
  }
}

// POST — Save/update a conversation
export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { conversationId, title, messages } = body;

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (conversationId) {
      // Update existing
      const { error } = await sp
        .from("copilot_conversations")
        .update({
          title: title || "Untitled conversation",
          messages: messages,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .eq("user_id", user.id);

      if (error) throw error;
      return NextResponse.json({ success: true, id: conversationId });
    } else {
      // Create new
      const { data, error } = await sp
        .from("copilot_conversations")
        .insert({
          user_id: user.id,
          title: title || "New conversation",
          messages: messages || [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, id: data.id });
    }
  } catch (err) {
    console.error("Copilot save error:", err);
    return NextResponse.json({ error: "Failed to save conversation" }, { status: 500 });
  }
}

// DELETE — Delete a conversation
export async function DELETE(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get("id");

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation ID required" }, { status: 400 });
    }

    const sp = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await sp
      .from("copilot_conversations")
      .delete()
      .eq("id", conversationId)
      .eq("user_id", user.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
