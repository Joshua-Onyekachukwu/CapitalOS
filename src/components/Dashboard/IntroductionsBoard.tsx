"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { createIntroduction, deleteIntroduction, setIntroductionStatus } from "@/lib/actions/relationships";

export interface Introduction {
  id: string;
  targetName: string;
  targetFirm: string | null;
  viaName: string | null;
  route: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

const STATUS_TONE: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planned: "default",
  requested: "info",
  made: "success",
  met: "success",
  declined: "danger",
};

const STATUSES = ["planned", "requested", "made", "met", "declined"] as const;

export default function IntroductionsBoard({ introductions }: { introductions: Introduction[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    targetName: "",
    targetFirm: "",
    viaName: "",
    route: "warm",
    notes: "",
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createIntroduction(form);
      if (!result.ok) {
        setError(result.error ?? "Could not save the introduction.");
        return;
      }
      setForm({ targetName: "", targetFirm: "", viaName: "", route: "warm", notes: "" });
      setShowForm(false);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-[14px] gap-[10px] flex-wrap">
        <p className="text-[13px] text-gray-500 !mb-0">
          Record who you are reaching through whom. {introductions.length} tracked.
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <i className="ri-add-line text-[16px]"></i>
          {showForm ? "Close" : "New introduction"}
        </Button>
      </div>

      {error && (
        <div className="mb-[12px] rounded-[8px] border border-red-300 bg-red-50 px-[12px] py-[8px] text-[13px] text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          <i className="ri-error-warning-line mr-[6px]"></i>
          {error}
        </div>
      )}

      {showForm && (
        <Card className="mb-[16px]">
          <CardBody>
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <input
                value={form.targetName}
                onChange={(e) => setForm((f) => ({ ...f, targetName: e.target.value }))}
                placeholder="Who you want to meet *"
                maxLength={200}
                className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <input
                value={form.targetFirm}
                onChange={(e) => setForm((f) => ({ ...f, targetFirm: e.target.value }))}
                placeholder="Their firm"
                className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <input
                value={form.viaName}
                onChange={(e) => setForm((f) => ({ ...f, viaName: e.target.value }))}
                placeholder="Through whom"
                className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <select
                value={form.route}
                onChange={(e) => setForm((f) => ({ ...f, route: e.target.value }))}
                className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                <option value="warm">Warm introduction</option>
                <option value="direct">Direct outreach</option>
                <option value="cold">Cold</option>
              </select>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Context worth remembering"
                className="sm:col-span-2 rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" loading={pending} disabled={!form.targetName.trim()}>
                  Save introduction
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {introductions.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-[13px] text-gray-500 !mb-0">
              No introductions tracked. Add the first one and its status will follow it from
              planned through met.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[10px]">
          {introductions.map((intro) => (
            <Card key={intro.id}>
              <CardBody className="flex flex-col sm:flex-row sm:items-center gap-[12px]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-[8px] flex-wrap">
                    <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0">
                      {intro.targetName}
                    </p>
                    <Badge variant={STATUS_TONE[intro.status] ?? "default"} size="sm">
                      {intro.status}
                    </Badge>
                    <Badge variant="default" size="sm">
                      {intro.route}
                    </Badge>
                  </div>
                  <p className="text-[12px] text-gray-400 !mb-0">
                    {[intro.targetFirm, intro.viaName ? `via ${intro.viaName}` : null]
                      .filter(Boolean)
                      .join(" · ") || "No firm or route recorded"}
                  </p>
                  {intro.notes && (
                    <p className="text-[12px] text-gray-500 !mb-0 mt-[4px]">{intro.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-[8px] flex-none">
                  <select
                    value={intro.status}
                    onChange={(e) => {
                      const next = e.target.value;
                      startTransition(async () => {
                        const result = await setIntroductionStatus(intro.id, next);
                        if (!result.ok) setError(result.error ?? "Could not update status.");
                        router.refresh();
                      });
                    }}
                    className="rounded-[6px] border border-gray-200 bg-white px-[8px] py-[6px] text-[12px] text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteIntroduction(intro.id);
                        if (!result.ok) setError(result.error ?? "Could not delete.");
                        router.refresh();
                      })
                    }
                    className="text-gray-400 hover:text-red-500 px-[6px] py-[4px]"
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
  );
}
