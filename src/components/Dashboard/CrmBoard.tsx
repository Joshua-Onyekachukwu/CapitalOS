"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { createTask, deleteTask, setTaskStatus } from "@/lib/actions/relationships";

export interface CrmTask {
  id: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  status: string;
  investorName: string | null;
  investorId: string | null;
}

export interface TimelineItem {
  id: string;
  kind: "meeting" | "stage" | "task" | "saved";
  title: string;
  detail: string;
  at: string;
}

const STATUS_TABS = [
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
] as const;

function when(iso: string | null): string {
  if (!iso) return "No due date";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "No due date";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function isOverdue(task: CrmTask): boolean {
  if (task.status !== "open" || !task.dueAt) return false;
  const due = new Date(task.dueAt).getTime();
  return !Number.isNaN(due) && due < Date.now();
}

export default function CrmBoard({
  tasks,
  timeline,
}: {
  tasks: CrmTask[];
  timeline: TimelineItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]["key"]>("open");
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", dueAt: "", notes: "" });

  const visible = tasks.filter((t) => (tab === "all" ? true : t.status === tab));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTask(form);
      if (!result.ok) {
        setError(result.error ?? "Could not save the task.");
        return;
      }
      setForm({ title: "", dueAt: "", notes: "" });
      setShowForm(false);
      router.refresh();
    });
  };

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "That did not work.");
      router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-[20px]">
      <div>
        <div className="flex items-center justify-between mb-[12px] gap-[8px] flex-wrap">
          <div className="flex items-center gap-[6px]">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-[12px] py-[6px] rounded-[6px] text-[13px] font-medium transition-colors ${
                  tab === t.key
                    ? "bg-lime-100 text-[#06201b] dark:bg-lime-900/30 dark:text-white"
                    : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <i className="ri-add-line text-[16px]"></i>
            {showForm ? "Close" : "New task"}
          </Button>
        </div>

        {error && (
          <div className="mb-[12px] rounded-[8px] border border-red-300 bg-red-50 px-[12px] py-[8px] text-[13px] text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            <i className="ri-error-warning-line mr-[6px]"></i>
            {error}
          </div>
        )}

        {showForm && (
          <Card className="mb-[14px]">
            <CardBody>
              <form onSubmit={submit} className="space-y-[10px]">
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Follow up with Sequoia about the data room"
                  maxLength={200}
                  className="w-full rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                <div className="flex flex-col sm:flex-row gap-[10px]">
                  <input
                    type="date"
                    value={form.dueAt}
                    onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
                    className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  <input
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Optional note"
                    className="flex-1 rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <Button type="submit" size="sm" loading={pending} disabled={!form.title.trim()}>
                  Save task
                </Button>
              </form>
            </CardBody>
          </Card>
        )}

        {visible.length === 0 ? (
          <Card>
            <CardBody>
              <p className="text-[13px] text-gray-500 !mb-0">
                {tab === "open"
                  ? "No open tasks. Anything you need to chase lives here, with a due date."
                  : "Nothing in this view yet."}
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-[10px]">
            {visible.map((task) => (
              <Card key={task.id}>
                <CardBody className="flex items-start gap-[12px]">
                  <button
                    aria-label={task.status === "done" ? "Reopen task" : "Complete task"}
                    onClick={() =>
                      act(() => setTaskStatus(task.id, task.status === "done" ? "open" : "done"))
                    }
                    className={`mt-[2px] w-[20px] h-[20px] rounded-full border flex-none flex items-center justify-center text-[12px] ${
                      task.status === "done"
                        ? "border-lime-500 bg-lime-500 text-black"
                        : "border-gray-300 text-transparent hover:border-lime-500"
                    }`}
                  >
                    <i className="ri-check-line"></i>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[8px] flex-wrap">
                      <p
                        className={`text-[14px] font-medium !mb-0 ${
                          task.status === "done"
                            ? "text-gray-400 line-through"
                            : "text-[#06201b] dark:text-white"
                        }`}
                      >
                        {task.title}
                      </p>
                      {isOverdue(task) && (
                        <Badge variant="danger" size="sm">
                          Overdue
                        </Badge>
                      )}
                      {task.status === "snoozed" && (
                        <Badge variant="warning" size="sm">
                          Snoozed
                        </Badge>
                      )}
                    </div>
                    <p className="text-[12px] text-gray-400 !mb-0">
                      {when(task.dueAt)}
                      {task.investorName ? ` · ${task.investorName}` : ""}
                    </p>
                    {task.notes && (
                      <p className="text-[12px] text-gray-500 !mb-0 mt-[4px]">{task.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-[4px] flex-none">
                    {task.status === "open" && (
                      <button
                        onClick={() => act(() => setTaskStatus(task.id, "snoozed"))}
                        className="text-[12px] text-gray-400 hover:text-gray-600 px-[6px] py-[4px]"
                        title="Snooze"
                      >
                        <i className="ri-time-line text-[16px]"></i>
                      </button>
                    )}
                    <button
                      onClick={() => act(() => deleteTask(task.id))}
                      className="text-[12px] text-gray-400 hover:text-red-500 px-[6px] py-[4px]"
                      title="Delete"
                    >
                      <i className="ri-delete-bin-line text-[16px]"></i>
                    </button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <Card>
          <CardBody>
            <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
              Relationship timeline
            </h3>
            <p className="text-[12px] text-gray-400 !mb-[16px]">
              Built from your pipeline stage changes, meetings, saved investors and tasks.
            </p>
            {timeline.length === 0 ? (
              <p className="text-[13px] text-gray-500 !mb-0">
                Nothing recorded yet. Add an investor to your pipeline and the activity appears
                here.
              </p>
            ) : (
              <ol className="relative border-l border-gray-100 dark:border-gray-800 ml-[6px]">
                {timeline.map((item) => (
                  <li key={`${item.kind}-${item.id}`} className="ml-[16px] pb-[16px]">
                    <span className="absolute -left-[5px] mt-[6px] w-[9px] h-[9px] rounded-full bg-lime-500"></span>
                    <p className="text-[13px] text-[#06201b] dark:text-white !mb-0">{item.title}</p>
                    <p className="text-[12px] text-gray-400 !mb-0">{item.detail}</p>
                    <p className="text-[11px] text-gray-300 dark:text-gray-600 !mb-0">
                      {new Date(item.at).toLocaleString(undefined, {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </li>
                ))}
              </ol>
            )}
            <Link
              href="/dashboard/pipeline"
              className="inline-flex items-center gap-[6px] text-[12px] font-medium text-lime-600 hover:underline mt-[4px]"
            >
              Open pipeline
              <i className="ri-arrow-right-line"></i>
            </Link>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
