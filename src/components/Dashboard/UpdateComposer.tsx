"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { saveInvestorUpdate, deleteInvestorUpdate } from "@/lib/actions/ir";

export interface UpdateMetrics {
  companyName: string | null;
  mrr: number | null;
  customers: number | null;
  raiseTarget: number | null;
  raisedSoFar: number | null;
  pipelineInvestors: number;
  monthName: string;
}

export interface SavedUpdate {
  id: string;
  periodLabel: string;
  subject: string;
  body: string;
  status: string;
  createdAt: string;
}

const money = (n: number | null) =>
  n === null ? "not recorded" : `$${Math.round(n).toLocaleString()}`;

/**
 * Deterministic template, not an AI call: every number in it comes from the
 * founder's own profile and pipeline, and anything unrecorded is written as
 * "not recorded" rather than zero. The founder edits before saving.
 */
function draft(metrics: UpdateMetrics, highlights: string, asks: string, period: string) {
  const subject = `${metrics.companyName ?? "Company"} update — ${period}`;
  const lines = [
    "Hi,",
    "",
    `Here is the ${period} update for ${metrics.companyName ?? "the company"}.`,
    "",
    "Numbers",
    `- MRR: ${money(metrics.mrr)}`,
    `- Customers: ${metrics.customers === null ? "not recorded" : metrics.customers.toLocaleString()}`,
    `- Round: ${money(metrics.raisedSoFar)} committed against a ${money(metrics.raiseTarget)} target`,
    `- Investors in the pipeline: ${metrics.pipelineInvestors.toLocaleString()}`,
    "",
    "Highlights",
    highlights.trim() || "(add the two or three things that actually moved)",
    "",
    "Asks",
    asks.trim() || "(introductions, hiring, customer referrals — be specific)",
    "",
    "Thanks,",
  ];
  return { subject, body: lines.join("\n") };
}

export default function UpdateComposer({
  metrics,
  updates,
}: {
  metrics: UpdateMetrics;
  updates: SavedUpdate[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState(metrics.monthName);
  const [highlights, setHighlights] = useState("");
  const [asks, setAsks] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const generate = () => {
    const { subject: s, body: b } = draft(metrics, highlights, asks, period);
    setSubject(s);
    setBody(b);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setError(null);
    } catch {
      setError("Copy failed — select the text and copy manually.");
    }
  };

  const save = (status: "draft" | "ready") => {
    setError(null);
    startTransition(async () => {
      const result = await saveInvestorUpdate({
        id: editingId ?? undefined,
        periodLabel: period,
        subject,
        body,
        status,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not save the update.");
        return;
      }
      setEditingId(result.id ?? null);
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deleteInvestorUpdate(id);
      if (!result.ok) setError(result.error ?? "Could not delete the update.");
      else router.refresh();
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] gap-[20px]">
      <Card>
        <CardBody>
          <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
            Monthly update drafter
          </h3>
          <p className="text-[12px] text-gray-400 !mb-[14px]">
            Every figure is pulled from your profile and pipeline. Unrecorded fields are labelled,
            not zeroed. Sending is not connected yet, so this saves a draft you can copy out.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px] mb-[10px]">
            <label className="text-[11px] text-gray-400 uppercase tracking-wide">
              Period
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                maxLength={80}
                className="mt-[4px] w-full rounded-[8px] border border-gray-200 bg-white px-[10px] py-[8px] text-[13px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </label>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={generate}>
                <i className="ri-magic-line text-[16px]"></i>
                Draft from my numbers
              </Button>
            </div>
          </div>

          <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-[10px]">
            Highlights
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              rows={2}
              placeholder="What actually moved this month?"
              className="mt-[4px] w-full rounded-[8px] border border-gray-200 bg-white px-[10px] py-[8px] text-[13px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>

          <label className="block text-[11px] text-gray-400 uppercase tracking-wide mb-[12px]">
            Asks
            <textarea
              value={asks}
              onChange={(e) => setAsks(e.target.value)}
              rows={2}
              placeholder="Introductions, hires, customers"
              className="mt-[4px] w-full rounded-[8px] border border-gray-200 bg-white px-[10px] py-[8px] text-[13px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>

          {error && (
            <p className="text-[12px] text-red-600 !mb-[10px]">
              <i className="ri-error-warning-line mr-[4px]"></i>
              {error}
            </p>
          )}

          <label className="block text-[11px] text-gray-400 uppercase tracking-wide">
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="mt-[4px] w-full rounded-[8px] border border-gray-200 bg-white px-[10px] py-[8px] text-[13px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white mb-[10px]"
            />
          </label>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            placeholder="Press “Draft from my numbers”, then edit."
            className="w-full rounded-[8px] border border-gray-200 bg-white px-[10px] py-[8px] text-[13px] leading-relaxed text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white mb-[10px] font-mono"
          />

          <div className="flex items-center gap-[8px] flex-wrap">
            <Button
              size="sm"
              loading={pending}
              disabled={!subject || !body}
              onClick={() => save("draft")}
            >
              Save draft
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={pending}
              disabled={!subject || !body}
              onClick={() => save("ready")}
            >
              Mark ready
            </Button>
            <Button variant="outline" size="sm" onClick={copy} disabled={!body}>
              <i className="ri-file-copy-line text-[16px]"></i>
              Copy
            </Button>
          </div>
        </CardBody>
      </Card>

      <div>
        <Card>
          <CardBody>
            <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
              Saved updates
            </h3>
            <p className="text-[12px] text-gray-400 !mb-[12px]">
              Drafts live here. Nothing has been sent to investors.
            </p>
            {updates.length === 0 ? (
              <p className="text-[13px] text-gray-500 !mb-0">
                No updates yet. Write the first one on the left.
              </p>
            ) : (
              <ul className="space-y-[8px]">
                {updates.map((u) => (
                  <li
                    key={u.id}
                    className="rounded-[10px] border border-gray-100 dark:border-gray-800 px-[12px] py-[10px]"
                  >
                    <div className="flex items-start justify-between gap-[8px]">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0 truncate">
                          {u.subject}
                        </p>
                        <p className="text-[11px] text-gray-400 !mb-0">
                          {u.periodLabel} · {new Date(u.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant={u.status === "ready" ? "success" : "default"} size="sm">
                        {u.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-[10px] mt-[6px]">
                      <button
                        onClick={() => {
                          setEditingId(u.id);
                          setPeriod(u.periodLabel);
                          setSubject(u.subject);
                          setBody(u.body);
                        }}
                        className="text-[11px] text-lime-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => remove(u.id)}
                        className="text-[11px] text-gray-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
