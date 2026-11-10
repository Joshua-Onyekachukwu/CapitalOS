import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import CrmBoard, { type CrmTask, type TimelineItem } from "@/components/Dashboard/CrmBoard";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=%2Fdashboard%2Fcrm");

  const sp = getServiceClient();

  const [tasksRes, meetingsRes, eventsRes, savedRes, pipelineRes] = await Promise.all([
    sp
      .from("crm_tasks")
      .select("id, title, notes, due_at, status, investor_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200),
    sp
      .from("meetings")
      .select("id, title, scheduled_at, status, investor_id, created_at")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: false })
      .limit(25),
    sp
      .from("pipeline_events")
      .select("id, investor_id, from_stage, to_stage, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(25),
    sp
      .from("saved_investors")
      .select("id, investor_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(15),
    sp
      .from("user_pipeline_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const taskRows = tasksRes.data ?? [];
  const meetingRows = meetingsRes.data ?? [];
  const eventRows = eventsRes.data ?? [];
  const savedRows = savedRes.data ?? [];

  // One lookup for every investor mentioned anywhere on the page.
  const investorIds = Array.from(
    new Set(
      [
        ...taskRows.map((t) => t.investor_id),
        ...meetingRows.map((m) => m.investor_id),
        ...eventRows.map((e) => e.investor_id),
        ...savedRows.map((s) => s.investor_id),
      ].filter((id): id is string => Boolean(id))
    )
  );

  const names = new Map<string, string>();
  if (investorIds.length > 0) {
    const { data: people } = await sp
      .from("investors")
      .select("id, full_name")
      .in("id", investorIds);
    for (const person of people ?? []) names.set(person.id as string, person.full_name as string);
  }

  const tasks: CrmTask[] = taskRows.map((t) => ({
    id: t.id as string,
    title: t.title as string,
    notes: (t.notes as string | null) ?? null,
    dueAt: (t.due_at as string | null) ?? null,
    status: (t.status as string) ?? "open",
    investorId: (t.investor_id as string | null) ?? null,
    investorName: t.investor_id ? names.get(t.investor_id as string) ?? null : null,
  }));

  const timeline: TimelineItem[] = [
    ...taskRows.slice(0, 10).map((t) => ({
      id: t.id as string,
      kind: "task" as const,
      title: `Task: ${t.title as string}`,
      detail: (t.status as string) === "done" ? "Completed" : "Open",
      at: (t.created_at as string) ?? new Date().toISOString(),
    })),
    ...meetingRows.map((m) => ({
      id: m.id as string,
      kind: "meeting" as const,
      title: m.title as string,
      detail: `${(m.status as string) ?? "scheduled"}${
        m.investor_id ? ` · ${names.get(m.investor_id as string) ?? "Investor"}` : ""
      }`,
      at: (m.scheduled_at as string) ?? (m.created_at as string) ?? new Date().toISOString(),
    })),
    ...eventRows.map((e) => ({
      id: e.id as string,
      kind: "stage" as const,
      title: `${names.get(e.investor_id as string) ?? "Investor"} moved to ${String(
        e.to_stage ?? "a new stage"
      ).replace(/_/g, " ")}`,
      detail: e.from_stage ? `From ${String(e.from_stage).replace(/_/g, " ")}` : "First stage",
      at: (e.created_at as string) ?? new Date().toISOString(),
    })),
    ...savedRows.map((s) => ({
      id: s.id as string,
      kind: "saved" as const,
      title: `Saved ${names.get(s.investor_id as string) ?? "an investor"}`,
      detail: "Added to your shortlist",
      at: (s.created_at as string) ?? new Date().toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 40);

  const openTasks = tasks.filter((t) => t.status === "open").length;
  const overdue = tasks.filter(
    (t) => t.status === "open" && t.dueAt && new Date(t.dueAt).getTime() < Date.now()
  ).length;

  return (
    <div>
      <PageHeader
        title="CRM"
        description="Tasks, reminders and every recorded touchpoint per investor — the working surface behind the pipeline."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[20px]">
        {[
          { label: "Open tasks", value: openTasks, icon: "ri-checkbox-circle-line" },
          { label: "Overdue", value: overdue, icon: "ri-alarm-warning-line" },
          { label: "In pipeline", value: pipelineRes.count ?? 0, icon: "ri-kanban-view" },
          { label: "Meetings logged", value: meetingRows.length, icon: "ri-calendar-check-line" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[12px] p-[16px]">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-lime-100 dark:bg-lime-900/20 text-lime-600 flex items-center justify-center flex-none">
                <i className={stat.icon}></i>
              </div>
              <div>
                <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <CrmBoard tasks={tasks} timeline={timeline} />
    </div>
  );
}
