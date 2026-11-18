"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import Link from "next/link";

// ── Types ──
interface DashboardStats {
  totalInvestors: number;
  totalFirms: number;
  activeCampaigns: number;
  emailsSent: number;
  emailsReplied: number;
  /** null = could not be computed (feature not provisioned), not zero. */
  meetingsScheduled: number | null;
  highFitInvestors: number;
  investorsThisWeek: number;
  readyInvestors: number;
  /** null = none of the user's investors have a score yet. */
  avgFitScore: number | null;
  totalCreditsUsed: number | null;
}

interface Availability {
  outreach: boolean;
  meetings: boolean;
  pipeline: boolean;
}

/** Render a stat that may be unknown. Never prints a fake 0. */
function statValue(value: number | null | undefined, suffix = ""): string {
  if (value === null || value === undefined) return "—";
  return `${value.toLocaleString()}${suffix}`;
}

interface RecentInvestor {
  id: string;
  full_name: string;
  investor_type: string;
  current_firm_id: string | null;
  firm_name: string | null;
  fit_score: number;
  outreach_readiness: string;
  created_at: string;
}

interface PipelineStage {
  stage: string;
  count: number;
}

interface CompanyProfile {
  companyName: string | null;
  industry: string | null;
  companyStage: string | null;
  oneLiner: string | null;
  currentlyRaising: boolean;
  fundingAmount: number | null;
  roundType: string | null;
  mrr: number | null;
  customerCount: number | null;
  hasPitchDeck: boolean;
  readinessScore: number;
}

interface RoundState {
  committed: number;
  projected: number;
  percentOfTarget: number | null;
  remaining: number | null;
}

interface NextAction {
  id: string;
  label: string;
  reason: string;
  href: string;
}

interface CorpusStats {
  investors: number | null;
  ventureFunds: number | null;
  people: number | null;
  withEmail: number | null;
  withWebsite: number | null;
}

interface CockpitData {
  stats: DashboardStats;
  corpus?: CorpusStats;
  availability?: Availability;
  recentInvestors: RecentInvestor[];
  pipeline: PipelineStage[];
  topSectors: { sector: string; count: number }[];
  companyProfile?: CompanyProfile | null;
  round?: RoundState | null;
  nextActions?: NextAction[];
  pipelineInvestors?: number;
}

const stageColors: Record<string, string> = {
  not_ready: "bg-gray-400",
  needs_verification: "bg-amber-500",
  ready: "bg-lime-500",
  contacted: "bg-blue-500",
  do_not_contact: "bg-red-500",
  low_priority: "bg-gray-300",
};

const readinessColors: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
  ready: "success",
  needs_verification: "warning",
  not_ready: "default",
  contacted: "info",
  do_not_contact: "danger",
};

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `$${amount.toLocaleString()}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  /** Distinct from empty: a failed cockpit fetch never renders as a fresh account. */
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch loop. All state writes happen after an await, so the mount effect
  // never sets state synchronously (no cascading render).
  const fetchCockpit = useCallback(async (retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch("/api/dashboard/cockpit");
        if (res.status === 401 && i < retries - 1) {
          // Auth not ready yet, wait and retry
          await new Promise((r) => setTimeout(r, delay * (i + 1)));
          continue;
        }
        if (!res.ok) {
          // A real failure — surface it instead of rendering the empty state.
          let message = "Could not load your dashboard.";
          try {
            const body = await res.json();
            if (typeof body?.error === "string" && body.error.length <= 200) {
              message = body.error;
            }
          } catch {
            /* response body is optional */
          }
          setLoadError(message);
          setLoading(false);
          return;
        }
        const d = await res.json();
        setData(d);
        setLoading(false);
        return;
      } catch {
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, delay * (i + 1)));
          continue;
        }
        setLoadError(
          "Could not reach the server after several tries. Check your connection and try again."
        );
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // fetchCockpit is await-first: no state is written synchronously on the
    // mount path, so this does not cascade renders. The rule cannot see
    // through the async call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCockpit();
  }, [fetchCockpit]);

  // Retry from the error banner: reset to the loading skeleton, then refetch.
  const retryCockpit = () => {
    setLoading(true);
    setLoadError(null);
    fetchCockpit();
  };

  const stats = data?.stats;
  const availability = data?.availability;
  const recentInvestors = data?.recentInvestors || [];
  const pipeline = data?.pipeline || [];

  // Next actions come from the API only (single engine, each action carries the
  // state that triggered it). The page no longer keeps a second heuristic list.

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Loading your workspace..." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px] md:gap-[20px] mb-[25px] md:mb-[30px]">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardBody>
                <div className="animate-pulse flex items-center gap-[16px]">
                  <div className="w-[44px] h-[44px] rounded-[12px] bg-gray-100 dark:bg-gray-800"></div>
                  <div>
                    <div className="h-[12px] bg-gray-100 dark:bg-gray-800 rounded w-[80px] mb-[6px]"></div>
                    <div className="h-[24px] bg-gray-100 dark:bg-gray-800 rounded w-[60px]"></div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Here is an overview of your fundraising progress." />
        <Alert variant="danger" title="Your dashboard could not be loaded">
          <p>{loadError}</p>
          <Button size="sm" className="mt-[10px]" onClick={retryCockpit}>
            <i className="ri-refresh-line text-[14px] mr-[4px]"></i>
            Try again
          </Button>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Welcome back 👋"
        description="Here is an overview of your fundraising progress."
      />

      {/* Next actions — the single action engine. Each row names the state that
          triggered it, and the list is empty only when nothing needs attention. */}
      <Card className="mb-[25px] md:mb-[30px]">
        <CardBody>
          <div className="flex items-center justify-between mb-[12px] gap-[10px] flex-wrap">
            <div>
              <h3 className="!text-[16px] !font-semibold !mb-[2px]">Next best actions</h3>
              <p className="text-[12px] text-gray-500 !mb-0">
                Ordered by what unblocks the next step of your round.
              </p>
            </div>
          </div>
          {data?.nextActions && data.nextActions.length > 0 ? (
            <div className="space-y-[8px]">
              {data.nextActions.map((a) => (
                <Link
                  key={a.id}
                  href={a.href}
                  className="group flex items-start gap-[10px] p-[10px] rounded-[10px] border border-gray-100 dark:border-gray-800 hover:border-lime-300 dark:hover:border-lime-700 hover:bg-lime-50/50 dark:hover:bg-lime-900/10 transition-colors"
                >
                  <i className="ri-arrow-right-circle-line text-[16px] text-lime-600 mt-[1px] flex-none"></i>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-brand-dark dark:text-white">
                      {a.label}
                    </span>
                    <span className="block text-[12px] text-gray-500">{a.reason}</span>
                  </span>
                  <i className="ri-arrow-right-line text-gray-300 group-hover:text-lime-600 text-[16px] mt-[1px] flex-none"></i>
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-[10px] p-[12px] rounded-[10px] bg-lime-50 dark:bg-lime-900/10">
              <i className="ri-checkbox-circle-line text-[18px] text-lime-600 flex-none"></i>
              <div>
                <p className="text-[13px] font-medium text-brand-dark dark:text-white !mb-0">
                  You&apos;re all caught up
                </p>
                <p className="text-[12px] text-gray-500 !mb-0">
                  Nothing needs attention right now. Review your pipeline or check new investor matches.
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[16px] md:gap-[20px] mb-[25px] md:mb-[30px]">
        {[
          { label: "Tracked investors", value: statValue(stats?.totalInvestors), icon: "ri-database-2-line", color: "bg-lime-100 dark:bg-lime-900/20", iconColor: "text-lime-600" },
          { label: "High-Fit Investors", value: statValue(stats?.highFitInvestors), icon: "ri-star-line", color: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-600" },
          { label: "Avg Fit Score", value: stats?.avgFitScore === null || stats?.avgFitScore === undefined ? "—" : `${stats.avgFitScore}%`, icon: "ri-percent-line", color: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600" },
          { label: "Ready for Outreach", value: statValue(stats?.readyInvestors), icon: "ri-send-plane-line", color: "bg-green-50 dark:bg-green-900/20", iconColor: "text-green-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[16px]">
              <div className={`w-[44px] h-[44px] rounded-[12px] ${stat.color} flex items-center justify-center ${stat.iconColor} text-[24px] flex-none`}>
                <i className={stat.icon}></i>
              </div>
              <div>
                <p className="text-[12px] md:text-[13px] text-gray-400 !mb-[2px]">{stat.label}</p>
                <p className="text-[18px] md:text-[24px] font-bold text-brand-dark dark:text-white !mb-0">{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Shared corpus — the database every founder searches, clearly not the
          founder's own list */}
      {data?.corpus && (
        <Card className="mb-[25px] md:mb-[30px]">
          <CardBody>
            <div className="flex items-center justify-between mb-[14px]">
              <div>
                <h3 className="!text-[16px] !font-semibold !mb-[2px]">Investor database</h3>
                <p className="text-[12px] text-gray-400 !mb-0">
                  Shared corpus, not your pipeline. Emails are on file, none are verified.
                </p>
              </div>
              <Link
                href="/dashboard/investors/discover"
                className="text-[13px] font-medium text-lime-600 hover:text-lime-700 flex-none"
              >
                Search →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[12px]">
              {[
                { label: "Investor records", value: data.corpus.investors },
                { label: "Venture funds", value: data.corpus.ventureFunds },
                { label: "Named people", value: data.corpus.people },
                { label: "With an email", value: data.corpus.withEmail },
              ].map((item) => (
                <div key={item.label} className="rounded-[10px] border border-gray-100 dark:border-gray-800 p-[12px]">
                  <p className="text-[18px] font-bold text-brand-dark dark:text-white !mb-0">
                    {item.value === null || item.value === undefined
                      ? "—"
                      : item.value.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-gray-400 !mb-0">{item.label}</p>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Round money — computed server-side, never estimated here */}
      {data?.round && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[16px] mb-[25px] md:mb-[30px]">
          <Card>
            <CardBody>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Committed</p>
              <p className="text-[18px] md:text-[24px] font-bold text-brand-dark dark:text-white !mb-0">
                {formatCurrency(data.round.committed)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Projected total</p>
              <p className="text-[18px] md:text-[24px] font-bold text-brand-dark dark:text-white !mb-0">
                {formatCurrency(data.round.projected)}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Of target</p>
              <p className="text-[18px] md:text-[24px] font-bold text-brand-dark dark:text-white !mb-0">
                {data.round.percentOfTarget === null
                  ? "—"
                  : Math.round(data.round.percentOfTarget * 100) + "%"}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Still to raise</p>
              <p className="text-[18px] md:text-[24px] font-bold text-brand-dark dark:text-white !mb-0">
                {data.round.remaining === null ? "—" : formatCurrency(data.round.remaining)}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Next actions moved to the top of the cockpit (single engine). */}

      {/* Email & Campaign Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[16px] mb-[25px] md:mb-[30px]">
        {[
          { label: "Emails Sent", value: stats?.emailsSent != null && availability?.outreach === false ? "—" : statValue(stats?.emailsSent), icon: "ri-mail-send-line", color: "text-blue-600" },
          { label: "Replies Received", value: statValue(stats?.emailsReplied), icon: "ri-reply-line", color: "text-green-600" },
          { label: "Active Campaigns", value: statValue(stats?.activeCampaigns), icon: "ri-megaphone-line", color: "text-purple-600" },
          { label: "Credits Used", value: stats?.totalCreditsUsed === null ? "—" : statValue(stats?.totalCreditsUsed), icon: "ri-vip-diamond-line", color: "text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[12px]">
              <i className={`${stat.icon} ${stat.color} text-[18px]`}></i>
              <div>
                <p className="text-[18px] font-bold text-brand-dark dark:text-white !mb-0">{stat.value}</p>
                <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Company Profile Card */}
      {data?.companyProfile?.companyName && (
        <Card className="mb-[25px] md:mb-[30px]">
          <CardBody>
            <div className="flex items-center justify-between mb-[16px]">
              <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-0">
                Company Profile
              </h3>
              <Link href="/onboarding" className="text-[13px] text-lime-600 hover:text-lime-700 font-medium">
                Edit →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[16px]">
              <div>
                <p className="text-[11px] text-gray-400 !mb-[2px]">Company</p>
                <p className="text-[14px] font-semibold text-brand-dark dark:text-white !mb-0 truncate">
                  {data.companyProfile.companyName}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 !mb-[2px]">Stage</p>
                <p className="text-[14px] font-semibold text-brand-dark dark:text-white !mb-0">
                  {data.companyProfile.companyStage || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 !mb-[2px]">Industry</p>
                <p className="text-[14px] font-semibold text-brand-dark dark:text-white !mb-0 truncate">
                  {data.companyProfile.industry || "—"}
                </p>
              </div>
              {data.companyProfile.currentlyRaising && (
                <>
                  <div>
                    <p className="text-[11px] text-gray-400 !mb-[2px]">Raising</p>
                    <p className="text-[14px] font-bold text-lime-600 !mb-0">
                      {data.companyProfile.fundingAmount ? formatCurrency(data.companyProfile.fundingAmount) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-400 !mb-[2px]">Round</p>
                    <p className="text-[14px] font-semibold text-brand-dark dark:text-white !mb-0">
                      {data.companyProfile.roundType || "—"}
                    </p>
                  </div>
                </>
              )}
              {data.companyProfile.mrr && data.companyProfile.mrr > 0 && (
                <div>
                  <p className="text-[11px] text-gray-400 !mb-[2px]">MRR</p>
                  <p className="text-[14px] font-semibold text-brand-dark dark:text-white !mb-0">
                    {formatCurrency(data.companyProfile.mrr)}
                  </p>
                </div>
              )}
            </div>
            {data.companyProfile.oneLiner && (
              <p className="text-[13px] text-gray-400 mt-[12px] !mb-0">
                {data.companyProfile.oneLiner}
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Pipeline */}
      <div className="mb-[25px] md:mb-[30px]">
        {/* Pipeline Summary */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-[16px]">
              <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-0">
                Pipeline Overview
              </h3>
              <Link href="/dashboard/investors" className="text-[13px] text-lime-600 hover:text-lime-700 font-medium">
                View All →
              </Link>
            </div>
            {pipeline.length === 0 ? (
              <div className="text-center py-[30px]">
                <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px] text-gray-300 dark:text-gray-600 text-[24px]">
                  <i className="ri-kanban-view"></i>
                </div>
                <p className="text-[14px] text-gray-400 !mb-[4px]">No pipeline data yet</p>
                <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-0">
                  Discover investors to populate your pipeline.
                </p>
              </div>
            ) : (
              <div className="space-y-[10px]">
                {pipeline.map((stage) => (
                  <div key={stage.stage} className="flex items-center gap-[12px]">
                    <div className={`w-[8px] h-[8px] rounded-full flex-none ${stageColors[stage.stage] || "bg-gray-400"}`}></div>
                    <span className="text-[13px] text-gray-500 flex-1 capitalize">{stage.stage.replace(/_/g, " ")}</span>
                    <span className="text-[14px] font-bold text-brand-dark dark:text-white">{stage.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent Investors */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-[16px]">
            <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-0">
              Recent Investors
            </h3>
            <Link href="/dashboard/investors" className="text-[13px] text-lime-600 hover:text-lime-700 font-medium">
              View All →
            </Link>
          </div>
          {recentInvestors.length === 0 ? (
            <div className="text-center py-[30px]">
              <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px] text-gray-300 dark:text-gray-600 text-[24px]">
                <i className="ri-team-line"></i>
              </div>
              <p className="text-[14px] text-gray-400 !mb-[4px]">No investors yet</p>
              <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-0">
                Discover investors from our database to start building your pipeline.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wider pb-[10px]">Name</th>
                    <th className="text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wider pb-[10px]">Type</th>
                    <th className="text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wider pb-[10px]">Firm</th>
                    <th className="text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wider pb-[10px]">Fit</th>
                    <th className="text-left text-[12px] font-semibold text-gray-400 uppercase tracking-wider pb-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvestors.map((investor) => (
                    <tr key={investor.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                      <td className="py-[12px]">
                        <Link href={`/dashboard/investors/${investor.id}`} className="text-[14px] font-medium text-brand-dark dark:text-white hover:text-lime-600 transition-colors">
                          {investor.full_name}
                        </Link>
                      </td>
                      <td className="py-[12px]">
                        <span className="text-[13px] text-gray-500 capitalize">{investor.investor_type.replace(/_/g, " ")}</span>
                      </td>
                      <td className="py-[12px]">
                        <span className="text-[13px] text-gray-500">{investor.firm_name || "—"}</span>
                      </td>
                      <td className="py-[12px]">
                        <span className={`text-[14px] font-bold ${investor.fit_score >= 80 ? "text-green-600" : investor.fit_score >= 60 ? "text-amber-600" : "text-gray-400"}`}>
                          {investor.fit_score}%
                        </span>
                      </td>
                      <td className="py-[12px]">
                        <Badge
                          variant={readinessColors[investor.outreach_readiness] || "default"}
                          size="sm"
                        >
                          {investor.outreach_readiness.replace(/_/g, " ")}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
