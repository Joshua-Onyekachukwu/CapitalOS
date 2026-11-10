"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { createOpportunity, deleteOpportunity, setOpportunityStatus } from "@/lib/actions/relationships";

export interface Opportunity {
  id: string;
  title: string;
  org: string | null;
  kind: string;
  deadline: string | null;
  url: string | null;
  notes: string | null;
  status: string;
}

const STATUS_TONE: Record<string, "default" | "info" | "success" | "warning"> = {
  watching: "default",
  applied: "info",
  won: "success",
  skipped: "warning",
};

const STATUSES = ["watching", "applied", "won", "skipped"] as const;
const KINDS = ["grant", "accelerator", "event", "challenge", "other"] as const;

function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  const target = new Date(`${deadline}T23:59:59`).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

export default function OpportunitiesBoard({ opportunities }: { opportunities: Opportunity[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    org: "",
    kind: "grant",
    deadline: "",
    url: "",
    notes: "",
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createOpportunity(form);
      if (!result.ok) {
        setError(result.error ?? "Could not save the opportunity.");
        return;
      }
      setForm({ title: "", org: "", kind: "grant", deadline: "", url: "", notes: "" });
      setShowForm(false);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-[14px] gap-[10px] flex-wrap">
        <p className="text-[13px] text-gray-500 !mb-0">
          Entered by hand — no grant or accelerator feed is connected, so nothing here is
          scraped or invented.
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <i className="ri-add-line text-[16px]"></i>
          {showForm ? "Close" : "Add opportunity"}
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
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Opportunity name *"
                maxLength={200}
                className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <input
                value={form.org}
                onChange={(e) => setForm((f) => ({ ...f, org: e.target.value }))}
                placeholder="Organisation"
                className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <select
                value={form.kind}
                onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
                className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
                className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://"
                className="sm:col-span-2 rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Eligibility notes, what they ask for"
                className="sm:col-span-2 rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" loading={pending} disabled={!form.title.trim()}>
                  Save opportunity
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {opportunities.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-[13px] text-gray-500 !mb-0">
              Nothing tracked yet. Add a grant, accelerator or demo day with its deadline and
              it will show how long is left.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[10px]">
          {opportunities.map((opp) => {
            const left = daysLeft(opp.deadline);
            return (
              <Card key={opp.id}>
                <CardBody className="flex flex-col sm:flex-row sm:items-center gap-[12px]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[8px] flex-wrap">
                      <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0">
                        {opp.title}
                      </p>
                      <Badge variant={STATUS_TONE[opp.status] ?? "default"} size="sm">
                        {opp.status}
                      </Badge>
                      <Badge variant="default" size="sm">
                        {opp.kind}
                      </Badge>
                      {left !== null && opp.status === "watching" && left >= 0 && left <= 14 && (
                        <Badge variant={left <= 3 ? "danger" : "warning"} size="sm">
                          {left === 0 ? "Closes today" : `${left}d left`}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[12px] text-gray-400 !mb-0">
                      {[opp.org, opp.deadline ? `deadline ${opp.deadline}` : null]
                        .filter(Boolean)
                        .join(" · ") || "No dates or organisation recorded"}
                    </p>
                    {opp.notes && (
                      <p className="text-[12px] text-gray-500 !mb-0 mt-[4px]">{opp.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-[8px] flex-none">
                    {opp.url && (
                      <a
                        href={opp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-lime-600 px-[6px] py-[4px]"
                        title="Open link"
                      >
                        <i className="ri-external-link-line text-[16px]"></i>
                      </a>
                    )}
                    <select
                      value={opp.status}
                      onChange={(e) => {
                        const next = e.target.value;
                        startTransition(async () => {
                          const result = await setOpportunityStatus(opp.id, next);
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
                          const result = await deleteOpportunity(opp.id);
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
            );
          })}
        </div>
      )}
    </div>
  );
}
