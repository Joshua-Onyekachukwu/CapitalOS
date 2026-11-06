"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Criterion {
  id: string;
  label: string;
  weight: number;
  status: "met" | "missing";
  field: string;
  detail?: string;
}

interface Category {
  id: string;
  label: string;
  purpose: string;
  score: number;
  max: number;
  criteria: Criterion[];
}

interface Action {
  criterionId: string;
  label: string;
  detail: string;
  points: number;
  categoryId: string;
  href: string;
}

interface Assessment {
  hasProfile: boolean;
  companyName?: string | null;
  persisted?: boolean;
  score: number;
  band: string;
  bandLabel: string;
  categories: Category[];
  actions: Action[];
  met: number;
  total: number;
  blockers: string[];
  disclaimer: string;
}

const BAND_TONE: Record<string, string> = {
  not_started: "text-gray-500",
  early: "text-orange-600 dark:text-orange-400",
  developing: "text-amber-600 dark:text-amber-400",
  nearly_ready: "text-lime-700 dark:text-lime-400",
  raise_ready: "text-green-700 dark:text-green-400",
};

export default function ReadinessPage() {
  const [data, setData] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/readiness", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error || `Could not load your readiness assessment (${res.status}).`);
        setData(null);
        return;
      }
      setData(body as Assessment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error loading readiness.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Fundraising Readiness"
        description="What an investor will ask for, and whether it is in your profile yet."
      />

      {loading && (
        <div className="space-y-[16px]">
          <Card>
            <CardBody>
              <div className="h-[20px] w-[180px] rounded bg-gray-100 dark:bg-gray-800 animate-pulse mb-[12px]" />
              <div className="h-[12px] w-[280px] rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
            </CardBody>
          </Card>
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody>
                <div className="h-[14px] w-[140px] rounded bg-gray-100 dark:bg-gray-800 animate-pulse mb-[10px]" />
                <div className="h-[10px] w-full rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {!loading && error && (
        <Card>
          <CardBody>
            <div className="flex items-start gap-[10px] text-[13px] text-red-600 dark:text-red-400">
              <i className="ri-error-warning-line text-[16px] mt-[1px]"></i>
              <div className="flex-1">
                <p className="!mb-[8px]">{error}</p>
                <Button size="sm" variant="secondary" onClick={load}>
                  Try again
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {!loading && !error && data && !data.hasProfile && (
        <Card>
          <CardBody>
            <div className="text-center py-[30px]">
              <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[12px] text-gray-300 text-[18px]">
                <i className="ri-rocket-2-line"></i>
              </div>
              <p className="text-[15px] font-medium text-[#06201b] dark:text-white !mb-[6px]">
                No company profile yet
              </p>
              <p className="text-[13px] text-gray-500 !mb-[16px]">
                Readiness is measured against your company profile, deck and team. Create the
                profile first and this page will fill in.
              </p>
              <Link
                href="/onboarding"
                className="inline-flex items-center gap-[6px] px-[14px] py-[8px] rounded-[8px] bg-[#06201b] text-white text-[13px] font-medium dark:bg-lime-500 dark:text-black"
              >
                Start setup
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      {!loading && !error && data && data.hasProfile && (
        <div className="space-y-[16px]">
          {/* Score */}
          <Card>
            <CardBody>
              <div className="flex flex-wrap items-start justify-between gap-[16px]">
                <div>
                  <div className="flex items-end gap-[10px]">
                    <span className="text-[40px] leading-none font-semibold text-[#06201b] dark:text-white">
                      {data.score}
                    </span>
                    <span className="text-[14px] text-gray-400 mb-[4px]">/ 100</span>
                    <span
                      className={`text-[13px] font-medium mb-[6px] ${BAND_TONE[data.band] || "text-gray-500"}`}
                    >
                      {data.bandLabel}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-500 !mt-[8px] !mb-0">
                    {data.met} of {data.total} items in place
                    {data.companyName ? ` for ${data.companyName}` : ""}.
                  </p>
                </div>
                <div className="flex gap-[8px]">
                  <Button size="sm" variant="secondary" onClick={load}>
                    Re-check
                  </Button>
                  <Link
                    href="/dashboard/startup/edit"
                    className="inline-flex items-center gap-[6px] px-[12px] py-[6px] rounded-[8px] bg-[#06201b] text-white text-[12px] font-medium dark:bg-lime-500 dark:text-black"
                  >
                    Edit profile
                  </Link>
                </div>
              </div>

              <p className="text-[11px] text-gray-400 !mt-[14px] !mb-0">{data.disclaimer}</p>
            </CardBody>
          </Card>

          {/* Blockers */}
          {data.blockers.length > 0 && (
            <Card>
              <CardBody>
                <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-[8px]">
                  Blocking the round
                </p>
                <ul className="space-y-[8px]">
                  {data.blockers.map((b) => (
                    <li key={b} className="flex items-start gap-[8px] text-[13px] text-amber-800 dark:text-amber-300">
                      <i className="ri-alert-line text-[15px] mt-[1px] flex-none"></i>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {/* Next actions */}
          {data.actions.length > 0 && (
            <Card>
              <CardBody>
                <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-[10px]">
                  Highest-impact next steps
                </p>
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.actions.slice(0, 6).map((a) => (
                    <li key={a.criterionId} className="py-[10px] flex items-center gap-[12px]">
                      <span className="flex-none text-[11px] font-semibold px-[7px] py-[2px] rounded-full bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300">
                        +{a.points}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-[#06201b] dark:text-white !mb-0">{a.label}</p>
                        <p className="text-[12px] text-gray-400 !mb-0 truncate">{a.detail}</p>
                      </div>
                      <Link
                        href={a.href}
                        className="flex-none text-[12px] font-medium text-lime-700 dark:text-lime-400 hover:underline"
                      >
                        Fix
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {/* Categories */}
          {data.categories.map((cat) => {
            const pct = cat.max === 0 ? 0 : Math.round((cat.score / cat.max) * 100);
            return (
              <Card key={cat.id}>
                <CardBody>
                  <div className="flex items-start justify-between gap-[12px] mb-[4px]">
                    <div>
                      <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-[2px]">
                        {cat.label}
                      </p>
                      <p className="text-[12px] text-gray-400 !mb-0">{cat.purpose}</p>
                    </div>
                    <span className="flex-none text-[12px] text-gray-500 tabular-nums">
                      {cat.score}/{cat.max}
                    </span>
                  </div>

                  <div className="h-[6px] w-full rounded-full bg-gray-100 dark:bg-gray-800 mt-[10px] mb-[12px] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 80 ? "bg-lime-500" : pct >= 40 ? "bg-amber-400" : "bg-gray-300 dark:bg-gray-600"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <ul className="space-y-[6px]">
                    {cat.criteria.map((c) => (
                      <li key={c.id} className="flex items-start gap-[8px] text-[12px]">
                        <i
                          className={`mt-[2px] flex-none text-[14px] ${
                            c.status === "met"
                              ? "ri-checkbox-circle-fill text-green-500"
                              : "ri-checkbox-blank-circle-line text-gray-300 dark:text-gray-600"
                          }`}
                        ></i>
                        <span className={c.status === "met" ? "text-gray-600 dark:text-gray-300" : "text-gray-400"}>
                          {c.label}
                          {c.detail && <span className="text-gray-400"> — {c.detail}</span>}
                          {c.status === "missing" && (
                            <span className="text-gray-300 dark:text-gray-600">
                              {" "}
                              ({c.weight} pt{c.weight === 1 ? "" : "s"})
                            </span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="text-[10px] text-gray-300 dark:text-gray-600 !mt-[10px] !mb-0 font-mono">
                    source:{" "}
                    {cat.criteria
                      .map((c) => c.field)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .join(", ")}
                  </p>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
