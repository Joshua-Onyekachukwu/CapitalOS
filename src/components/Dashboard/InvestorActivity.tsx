"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { createTask } from "@/lib/actions/relationships";

interface ActivityItem {
  id: string;
  kind: "task" | "meeting" | "stage" | "saved" | "email" | "reply";
  title: string;
  detail: string;
  at: string;
}

const ICONS: Record<ActivityItem["kind"], string> = {
  task: "ri-checkbox-circle-line",
  meeting: "ri-calendar-check-line",
  stage: "ri-kanban-view",
  saved: "ri-bookmark-line",
  email: "ri-mail-send-line",
  reply: "ri-reply-line",
};

export default function InvestorActivity({ investorId }: { investorId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", dueAt: "" });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/investors/${investorId}/activity`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load activity");
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTask({
        title: form.title,
        dueAt: form.dueAt,
        investorId,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not save the task.");
        return;
      }
      setForm({ title: "", dueAt: "" });
      await load();
      router.refresh();
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-[8px] mb-[4px]">
        <h3 className="!text-[16px] !font-semibold !mb-0">Activity</h3>
      </div>
      <p className="text-[12px] text-gray-400 !mb-[14px]">
        Tasks, meetings, stage changes, saves and email in one place.
      </p>

      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-[8px] mb-[16px]">
        <input
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          placeholder="Add a task or reminder for this investor"
          maxLength={200}
          className="flex-1 rounded-[8px] border border-gray-200 bg-white px-[10px] py-[7px] text-[13px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <input
          type="date"
          value={form.dueAt}
          onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
          className="rounded-[8px] border border-gray-200 bg-white px-[10px] py-[7px] text-[13px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
        />
        <Button type="submit" size="sm" loading={pending} disabled={!form.title.trim()}>
          Add
        </Button>
      </form>

      {error && (
        <p className="text-[12px] text-red-600 !mb-[12px]">
          <i className="ri-error-warning-line mr-[4px]"></i>
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-[13px] text-gray-400 !mb-0">Loading activity…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-gray-500 !mb-0">
          Nothing recorded for this investor yet. Adding a task above is the first entry.
        </p>
      ) : (
        <ol className="relative border-l border-gray-100 dark:border-gray-800 ml-[6px]">
          {items.map((item) => (
            <li key={`${item.kind}-${item.id}`} className="ml-[16px] pb-[14px]">
              <span className="absolute -left-[5px] mt-[6px] w-[9px] h-[9px] rounded-full bg-lime-500"></span>
              <p className="text-[13px] text-[#06201b] dark:text-white !mb-0">
                <i className={`${ICONS[item.kind]} mr-[6px] text-gray-400`}></i>
                {item.title}
              </p>
              {item.detail && <p className="text-[12px] text-gray-400 !mb-0">{item.detail}</p>}
              <p className="text-[11px] text-gray-300 dark:text-gray-600 !mb-0">
                {new Date(item.at).toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
