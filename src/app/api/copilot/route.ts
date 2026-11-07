import { NextRequest, NextResponse } from "next/server";
import { chatWithCopilot } from "@/lib/actions/copilot";
import type { CopilotMessage } from "@/lib/actions/copilot";
import { applyRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { requireAuth } from "@/lib/middleware/api-auth";
import { createClient } from "@supabase/supabase-js";
import { detectToolRequest, getTool } from "@/lib/copilot/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSp() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  pendingTool?: { id: string; name: string; summary: string };
}

/** Loads the caller's conversation, or creates one. Never trusts a foreign id. */
async function ensureConversation(
  userId: string,
  conversationId: string | null,
  firstMessage: string
): Promise<{ id: string; messages: StoredMessage[] }> {
  const sp = getSp();

  if (conversationId) {
    const { data } = await sp
      .from("copilot_conversations")
      .select("id, messages")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data) {
      return { id: data.id, messages: Array.isArray(data.messages) ? data.messages : [] };
    }
    // Unknown or foreign id: fall through and start a fresh conversation rather
    // than writing into something the caller does not own.
  }

  const { data, error } = await sp
    .from("copilot_conversations")
    .insert({
      user_id: userId,
      title: firstMessage.slice(0, 60) || "New conversation",
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message || "Could not create conversation");
  return { id: data.id, messages: [] };
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const rateLimitResponse = await applyRateLimit(request, RATE_LIMITS.ai);
    if (rateLimitResponse) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: rateLimitResponse.status, headers: rateLimitResponse.headers }
      );
    }

    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    const messages: CopilotMessage[] = body.messages
      .slice(-50)
      .filter((m: unknown): m is CopilotMessage => {
        const candidate = m as { role?: unknown; content?: unknown };
        return (
          (candidate?.role === "user" || candidate?.role === "assistant") &&
          typeof candidate?.content === "string"
        );
      })
      .map((m: CopilotMessage) => ({ role: m.role, content: m.content.slice(0, 5000) }));

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ error: "A user message is required" }, { status: 400 });
    }

    const conversation = await ensureConversation(
      user.id,
      typeof body.conversationId === "string" ? body.conversationId : null,
      lastUser.content
    );

    // Persist the question before calling the model. If the AI call is slow or
    // the function is cut off, the conversation still records what was asked —
    // otherwise a reload shows an empty thread that looks like data loss.
    const userTurn: StoredMessage = { role: "user", content: lastUser.content };
    const withUser: StoredMessage[] = [...conversation.messages, userTurn].slice(-100);
    await getSp()
      .from("copilot_conversations")
      .update({ messages: withUser, updated_at: new Date().toISOString() })
      .eq("id", conversation.id)
      .eq("user_id", user.id);

    // ── Tool planning ──
    const request_ = detectToolRequest(lastUser.content);
    const tool = request_ ? getTool(request_.tool) : undefined;

    let reply = "";
    let pendingTool: { id: string; name: string; summary: string } | null = null;
    let toolContext = "";

    if (tool?.requiresApproval) {
      const summary = tool.summarize(request_!.args);
      const { data: run, error } = await getSp()
        .from("copilot_tool_runs")
        .insert({
          user_id: user.id,
          conversation_id: conversation.id,
          tool_name: tool.name,
          args: request_!.args,
          summary,
          status: "pending",
        })
        .select("id")
        .single();

      if (error || !run) {
        console.error("[copilot] tool run insert failed:", error?.message);
        reply = "I could not queue that action, so nothing has changed.";
      } else {
        pendingTool = { id: run.id, name: tool.name, summary };
        reply = `I can do that: ${summary}\n\nNothing has changed yet — approve it below and I will carry it out.`;
      }
    } else if (tool) {
      try {
        const result = await tool.execute(user.id, request_!.args);
        toolContext = JSON.stringify(result).slice(0, 4000);
      } catch (err) {
        toolContext = `The ${tool.name} tool failed: ${
          err instanceof Error ? err.message : "unknown error"
        }`;
      }
    }

    if (!pendingTool && !reply) {
      reply = await chatWithCopilot(messages, user.id, toolContext);
    }

    // ── Persist both turns ──
    const assistantTurn: StoredMessage = {
      role: "assistant",
      content: reply,
      ...(pendingTool ? { pendingTool } : {}),
    };
    const stored: StoredMessage[] = [...withUser, assistantTurn].slice(-100);

    await getSp()
      .from("copilot_conversations")
      .update({ messages: stored, updated_at: new Date().toISOString() })
      .eq("id", conversation.id)
      .eq("user_id", user.id);

    return NextResponse.json({
      reply,
      conversationId: conversation.id,
      pendingTool,
    });
  } catch (err) {
    console.error("[copilot] request failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
