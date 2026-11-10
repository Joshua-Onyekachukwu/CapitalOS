"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface CompareInvestor {
  id: string;
  full_name: string;
  email: string | null;
  linkedin_url: string | null;
  investor_type: string;
  fit_score: number;
  data_quality_score: number;
  outreach_readiness: string;
  country: string | null;
  city: string | null;
  investment_stages: string[] | null;
  investment_sectors: string[] | null;
  min_check_size: number | null;
  max_check_size: number | null;
  investment_thesis: string | null;
  portfolio_count: number | null;
  is_verified: boolean;
}

const money = (n: number | null) => (n === null ? null : `$${n.toLocaleString()}`);

const list = (values: string[] | null) =>
  values && values.length > 0 ? values.map((v) => v.replace(/_/g, " ")).join(", ") : null;

function Cell({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-[14px] py-[10px] align-top text-[13px] text-gray-700 dark:text-gray-300">
      {children}
    </td>
  );
}

function Missing() {
  return <span className="text-gray-300 dark:text-gray-600">Not recorded</span>;
}

function CompareInner() {
  const params = useSearchParams();
  const ids = (params.get("ids") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4);

  const [investors, setInvestors] = useState<CompareInvestor[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`/api/investors/${id}`);
            if (!res.ok) return null;
            const data = await res.json();
            return (data.investor as CompareInvestor) ?? null;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      setInvestors(results.filter((r): r is CompareInvestor => Boolean(r)));
      setFailed(results.filter((r) => !r).length);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [params]); // re-run when the ids in the URL change

  if (loading) {
    return (
      <div>
        <PageHeader title="Compare investors" description="Loading selection…" />
        <div className="animate-pulse h-[240px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
      </div>
    );
  }

  if (investors.length === 0) {
    return (
      <div>
        <PageHeader title="Compare investors" description="No investors in this selection." />
        <Card>
          <CardBody className="text-center py-[40px]">
            <i className="ri-layout-column-line text-[32px] text-gray-200 dark:text-gray-700 block mb-[12px]"></i>
            <p className="text-[14px] text-gray-500 !mb-[12px]">
              Select two to four investors in the database, then press Compare.
            </p>
            <Link href="/dashboard/investors">
              <Button variant="outline" size="sm">
                Back to the database
              </Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const row = (label: string, render: (inv: CompareInvestor) => React.ReactNode) => (
    <tr className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-[14px] py-[10px] w-[180px] align-top">
        {label}
      </th>
      {investors.map((inv) => (
        <Cell key={inv.id}>{render(inv)}</Cell>
      ))}
    </tr>
  );

  return (
    <div>
      <PageHeader
        title="Compare investors"
        description={`${investors.length} investor${investors.length === 1 ? "" : "s"} side by side. Blank fields are missing evidence, not a poor match.`}
        actions={
          <Link href="/dashboard/investors">
            <Button variant="outline" size="sm">
              Back to the database
            </Button>
          </Link>
        }
      />

      {failed > 0 && (
        <p className="text-[12px] text-amber-600 !mb-[10px]">
          <i className="ri-error-warning-line mr-[4px]"></i>
          {failed} of the selected records could not be loaded.
        </p>
      )}

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-[14px] py-[12px]"></th>
                {investors.map((inv) => (
                  <th key={inv.id} className="text-left px-[14px] py-[12px]">
                    <Link
                      href={`/dashboard/investors/${inv.id}`}
                      className="text-[14px] font-semibold text-[#06201b] dark:text-white hover:text-lime-600"
                    >
                      {inv.full_name}
                    </Link>
                    <p className="text-[11px] text-gray-400 !mb-0 capitalize">
                      {inv.investor_type.replace(/_/g, " ")}
                    </p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {row("Fit score", (inv) => (
                <span
                  className={`font-semibold ${
                    inv.fit_score >= 80
                      ? "text-green-600"
                      : inv.fit_score >= 60
                        ? "text-amber-600"
                        : "text-gray-400"
                  }`}
                >
                  {inv.fit_score}%
                </span>
              ))}
              {row("Data quality", (inv) => `${inv.data_quality_score}%`)}
              {row(
                "Location",
                (inv) => [inv.city, inv.country].filter(Boolean).join(", ") || <Missing />
              )}
              {row("Cheque range", (inv) => {
                const min = money(inv.min_check_size);
                const max = money(inv.max_check_size);
                if (!min && !max) return <Missing />;
                return `${min ?? "?"} — ${max ?? "?"}`;
              })}
              {row("Stage focus", (inv) => list(inv.investment_stages) ?? <Missing />)}
              {row("Sectors", (inv) => list(inv.investment_sectors) ?? <Missing />)}
              {row("Portfolio", (inv) =>
                inv.portfolio_count === null ? <Missing /> : `${inv.portfolio_count} companies`
              )}
              {row("Thesis", (inv) =>
                inv.investment_thesis ? (
                  <span className="line-clamp-4">{inv.investment_thesis}</span>
                ) : (
                  <Missing />
                )
              )}
              {row("Email", (inv) => inv.email || <Missing />)}
              {row("LinkedIn", (inv) =>
                inv.linkedin_url ? (
                  <a
                    href={inv.linkedin_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-lime-600 hover:underline"
                  >
                    Profile
                  </a>
                ) : (
                  <Missing />
                )
              )}
              {row("Readiness", (inv) => (
                <Badge variant="default" size="sm">
                  {inv.outreach_readiness.replace(/_/g, " ")}
                </Badge>
              ))}
              {row("Verified", (inv) =>
                inv.is_verified ? (
                  <Badge variant="success" size="sm">
                    Yes
                  </Badge>
                ) : (
                  <span className="text-gray-400">No</span>
                )
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse h-[240px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
      }
    >
      <CompareInner />
    </Suspense>
  );
}
