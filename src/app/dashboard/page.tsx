"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import Link from "next/link";

// ── Types ──
interface DashboardStats {
  totalInvestors: number;
  totalFirms: number;
  activeCampaigns: number;
  emailsSent: number;
  emailsReplied: number;
  meetingsScheduled: number;
  highFitInvestors: number;
  investorsThisWeek: number;
  readyInvestors: number;
  avgFitScore: number;
  totalCreditsUsed: number;
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

interface CockpitData {
  stats: DashboardStats;
  recentInvestors: RecentInvestor[];
  pipeline: PipelineStage[];
  topSectors: { sector: string; count: number }[];
  companyProfile?: CompanyProfile | null;
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

  useEffect(() => {
    fetch("/api/dashboard/cockpit")
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const stats = data?.stats;
  const recentInvestors = data?.recentInvestors || [];
  const pipeline = data?.pipeline || [];

  // Determine next steps based on what's missing
  const nextSteps: Array<{ label: string; href: string; icon: string }> = [];
  if (stats) {
    if (stats.totalInvestors === 0) {
      nextSteps.push({ label: "Discover your first investors", href: "/dashboard/investors/discover", icon: "ri-radar-line" });
    }
    if (stats.highFitInvestors === 0 && stats.totalInvestors > 0) {
      nextSteps.push({ label: "Run fit analysis on your investors", href: "/dashboard/investors", icon: "ri-star-line" });
    }
    if (stats.totalInvestors > 0 && stats.readyInvestors === 0) {
      nextSteps.push({ label: "Complete your company profile", href: "/onboarding", icon: "ri-building-line" });
    }
  }
  if (nextSteps.length === 0) {
    nextSteps.push({ label: "Start an outreach campaign", href: "/dashboard/campaigns", icon: "ri-megaphone-line" });
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Dashboard" description="Loading your workspace..." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px] md:gap-[20px] mb-[25px] md:mb-[30px]">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardBody>
                <div className="animate-pulse flex items-center gap-[15px]">
                  <div className="w-[44px] h-[44px] rounded-[10px] bg-gray-100 dark:bg-gray-800"></div>
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

  return (
    <div>
      <PageHeader
        title="Welcome back 👋"
        description="Here is an overview of your fundraising progress."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px] md:gap-[20px] mb-[25px] md:mb-[30px]">
        {[
          { label: "Total Investors", value: (stats?.totalInvestors || 0).toLocaleString(), icon: "ri-database-2-line", color: "bg-lime-100 dark:bg-lime-900/20", iconColor: "text-lime-600" },
          { label: "High-Fit Investors", value: (stats?.highFitInvestors || 0).toLocaleString(), icon: "ri-star-line", color: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-600" },
          { label: "Avg Fit Score", value: `${stats?.avgFitScore || 0}%`, icon: "ri-percent-line", color: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600" },
          { label: "Ready for Outreach", value: (stats?.readyInvestors || 0).toLocaleString(), icon: "ri-send-plane-line", color: "bg-green-50 dark:bg-green-900/20", iconColor: "text-green-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[15px]">
              <div className={`w-[44px] h-[44px] rounded-[10px] ${stat.color} flex items-center justify-center ${stat.iconColor} text-[22px] flex-none`}>
                <i className={stat.icon}></i>
              </div>
              <div>
                <p className="text-[12px] md:text-[13px] text-gray-400 !mb-[2px]">{stat.label}</p>
                <p className="text-[20px] md:text-[24px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Email & Campaign Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[15px] mb-[25px] md:mb-[30px]">
        {[
          { label: "Emails Sent", value: (stats?.emailsSent || 0).toLocaleString(), icon: "ri-mail-send-line", color: "text-blue-600" },
          { label: "Replies Received", value: (stats?.emailsReplied || 0).toLocaleString(), icon: "ri-reply-line", color: "text-green-600" },
          { label: "Active Campaigns", value: (stats?.activeCampaigns || 0).toLocaleString(), icon: "ri-megaphone-line", color: "text-purple-600" },
          { label: "Credits Used", value: (stats?.totalCreditsUsed || 0).toLocaleString(), icon: "ri-vip-diamond-line", color: "text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[12px]">
              <i className={`${stat.icon} ${stat.color} text-[20px]`}></i>
              <div>
                <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[14px]">
              <div>
                <p className="text-[11px] text-gray-400 !mb-[2px]">Company</p>
                <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">
                  {data.companyProfile.companyName}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 !mb-[2px]">Stage</p>
                <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0">
                  {data.companyProfile.companyStage || "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 !mb-[2px]">Industry</p>
                <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">
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
                    <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0">
                      {data.companyProfile.roundType || "—"}
                    </p>
                  </div>
                </>
              )}
              {data.companyProfile.mrr && data.companyProfile.mrr > 0 && (
                <div>
                  <p className="text-[11px] text-gray-400 !mb-[2px]">MRR</p>
                  <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0">
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

      {/* Quick Actions + Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[15px] md:gap-[20px] mb-[25px] md:mb-[30px]">
        {/* Next Steps */}
        <Card>
          <CardBody>
            <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-[16px]">
              Next Steps
            </h3>
            <div className="space-y-[10px]">
              {nextSteps.map((step, i) => (
                <Link key={i} href={step.href}>
                  <div className="flex items-center gap-[12px] p-[14px] rounded-[10px] border border-gray-200 dark:border-gray-700 hover:border-lime-500 dark:hover:border-lime-500 hover:bg-lime-50/50 dark:hover:bg-lime-900/10 transition-all cursor-pointer group">
                    <div className="w-[36px] h-[36px] rounded-[8px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[18px] flex-none">
                      <i className={step.icon}></i>
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0">{step.label}</p>
                    </div>
                    <i className="ri-arrow-right-line text-gray-300 group-hover:text-lime-500 text-[16px]"></i>
                  </div>
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>

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
                <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 dark:text-gray-600 text-[24px]">
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
                    <span className="text-[14px] font-bold text-[#06201b] dark:text-white">{stage.count.toLocaleString()}</span>
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
              <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 dark:text-gray-600 text-[24px]">
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
                        <Link href={`/dashboard/investors/${investor.id}`} className="text-[14px] font-medium text-[#06201b] dark:text-white hover:text-lime-600 transition-colors">
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
