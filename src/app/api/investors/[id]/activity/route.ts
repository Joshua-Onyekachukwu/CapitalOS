// =============================================
// Investor Activity API Route
// =============================================
// One merged, chronological feed for a single investor: tasks and reminders,
// meetings, pipeline stage changes, shortlist saves and email activity. The CRM
// page shows the same event types across every investor; this endpoint is the
// per-record view, so a founder can read one relationship end to end.
//
// Everything is scoped to the signed-in user's own rows: the service client
// bypasses RLS, so the explicit user_id filters are the authorization.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/api-auth";
import { getServiceClient } from "@/lib/supabase/service";

interface ActivityItem {
  id: string;
  kind: "task" | "meeting" | "stage" | "saved" | "email" | "reply";
  title: string;
  detail: string;
  at: string;
}

const stage = (value: unknown) => String(value ?? "").replace(/_/g, " ");

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const sp = getServiceClient();

    const [tasksRes, meetingsRes, eventsRes, savedRes, emailsRes] = await Promise.all([
      sp
        .from("crm_tasks")
        .select("id, title, notes, due_at, status, created_at")
        .eq("user_id", user.id)
        .eq("investor_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      sp
        .from("meetings")
        .select("id, title, scheduled_at, status, created_at")
        .eq("user_id", user.id)
        .eq("investor_id", id)
        .order("scheduled_at", { ascending: false })
        .limit(50),
      sp
        .from("pipeline_events")
        .select("id, from_stage, to_stage, created_at")
        .eq("user_id", user.id)
        .eq("investor_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      sp
        .from("saved_investors")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("investor_id", id)
        .limit(10),
      sp
        .from("email_messages")
        .select("id, subject, direction, status, sent_at, replied_at, created_at")
        .eq("user_id", user.id)
        .eq("investor_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    // A missing optional table must not blank the whole feed; each block
    // degrades to empty and the UI still shows what it does have.
    const items: ActivityItem[] = [];

    for (const task of tasksRes.data ?? []) {
      const status = (task.status as string) ?? "open";
      const due = task.due_at as string | null;
      items.push({
        id: task.id as string,
        kind: "task",
        title: `Task: ${task.title as string}`,
        detail:
          status === "done"
            ? "Completed"
            : status === "snoozed"
              ? `Snoozed${due ? ` · due ${due.slice(0, 10)}` : ""}`
              : due
                ? `Open · due ${due.slice(0, 10)}`
                : "Open",
        at: (task.created_at as string) ?? new Date().toISOString(),
      });
    }

    for (const meeting of meetingsRes.data ?? []) {
      items.push({
        id: meeting.id as string,
        kind: "meeting",
        title: meeting.title as string,
        detail: `Meeting · ${stage(meeting.status) || "scheduled"}`,
        at:
          (meeting.scheduled_at as string) ??
          (meeting.created_at as string) ??
          new Date().toISOString(),
      });
    }

    for (const event of eventsRes.data ?? []) {
      items.push({
        id: event.id as string,
        kind: "stage",
        title: `Moved to ${stage(event.to_stage) || "a new stage"}`,
        detail: event.from_stage ? `From ${stage(event.from_stage)}` : "First stage",
        at: (event.created_at as string) ?? new Date().toISOString(),
      });
    }

    for (const saved of savedRes.data ?? []) {
      items.push({
        id: saved.id as string,
        kind: "saved",
        title: "Saved to your shortlist",
        detail: "",
        at: (saved.created_at as string) ?? new Date().toISOString(),
      });
    }

    for (const email of emailsRes.data ?? []) {
      const inbound = (email.direction as string) === "inbound";
      const replied = Boolean(email.replied_at);
      items.push({
        id: email.id as string,
        kind: inbound ? "reply" : "email",
        title: inbound
          ? `Reply: ${(email.subject as string) || "(no subject)"}`
          : (email.subject as string) || "Email sent",
        detail: replied && !inbound ? "Replied" : stage(email.status) || "draft",
        at: (email.sent_at as string) ?? (email.created_at as string) ?? new Date().toISOString(),
      });
    }

    items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return NextResponse.json(
      { items: items.slice(0, 60) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("[investor-activity]", error);
    return NextResponse.json({ error: "Failed to load activity" }, { status: 500 });
  }
}
