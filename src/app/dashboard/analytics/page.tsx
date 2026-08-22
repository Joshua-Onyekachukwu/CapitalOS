"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface AnalyticsData {
  totalInvestors: number;
  investorsWithEmail: number;
  highFitInvestors: number;
  verifiedInvestors: number;
  pendingDuplicates: number;
  emailsSent: number;
  emailsReplied: number;
  activeCampaigns: number;
  avgFitScore: number;
  topSectors: Array<{ sector: string; count: number }>;
  topCountries: Array<{ country: string; count: number }>;
  readinessBreakdown: Array<{ stage: string; count: number }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Fetch all data in parallel
      const [
        investorsResult,
        emailResult,
        duplicateResult,
        campaignResult,
      ] = await Promise.all([
        supabase.from("investors").select("id, email, fit_score, is_verified, investment_sectors, country, outreach_readiness"),
        supabase.from("email_messages").select("id, direction, status"),
        supabase.from("duplicate_candidates").select("id").eq("status", "pending"),
        supabase.from("data_acquisition_jobs").select("id, status").eq("job_type", "campaign"),
      ]);

      const investors: Array<{
        id: string; email: string | null; fit_score: number;
        is_verified: boolean; investment_sectors: string[];
        country: string | null; outreach_readiness: string;
      }> = investorsResult.data || [];
      const emails: Array<{ id: string; direction: string; status: string }> = emailResult.data || [];
      const campaigns: Array<{ id: string; status: string }> = campaignResult.data || [];

      // Calculate metrics
      const totalInvestors = investors.length;
      const investorsWithEmail = investors.filter((i) => i.email).length;
      const highFitInvestors = investors.filter((i) => (i.fit_score || 0) >= 80).length;
      const verifiedInvestors = investors.filter((i) => i.is_verified).length;
      const avgFitScore = totalInvestors > 0
        ? Math.round(investors.reduce((sum, i) => sum + (i.fit_score || 0), 0) / totalInvestors)
        : 0;

      const emailsSent = emails.filter((e) => e.direction === "outbound" && e.status === "sent").length;
      const emailsReplied = emails.filter((e) => e.direction === "inbound").length;
      const activeCampaigns = campaigns.filter((c) => c.status === "running" || c.status === "pending").length;

      // Sector distribution
      const sectorMap: Record<string, number> = {};
      investors.forEach((inv) => {
        (inv.investment_sectors || []).forEach((s: string) => {
          sectorMap[s] = (sectorMap[s] || 0) + 1;
        });
      });
      const topSectors = Object.entries(sectorMap)
        .map(([sector, count]) => ({ sector, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Country distribution
      const countryMap: Record<string, number> = {};
      investors.forEach((inv) => {
        if (inv.country) {
          countryMap[inv.country] = (countryMap[inv.country] || 0) + 1;
        }
      });
      const topCountries = Object.entries(countryMap)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Readiness breakdown
      const readinessMap: Record<string, number> = {};
      investors.forEach((inv) => {
        const stage = inv.outreach_readiness || "not_ready";
        readinessMap[stage] = (readinessMap[stage] || 0) + 1;
      });
      const readinessBreakdown = Object.entries(readinessMap)
        .map(([stage, count]) => ({ stage, count }))
        .sort((a, b) => b.count - a.count);

      setData({
        totalInvestors,
        investorsWithEmail,
        highFitInvestors,
        verifiedInvestors,
        pendingDuplicates: duplicateResult.data?.length || 0,
        emailsSent,
        emailsReplied,
        activeCampaigns,
        avgFitScore,
        topSectors,
        topCountries,
        readinessBreakdown,
      });
    } catch {
      // Data may not be available yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Analytics" description="Track your fundraising performance and metrics." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px]">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="animate-pulse h-[80px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
          ))}
        </div>
      </div>
    );
  }

  const d = data || {
    totalInvestors: 0, investorsWithEmail: 0, highFitInvestors: 0, verifiedInvestors: 0,
    pendingDuplicates: 0, emailsSent: 0, emailsReplied: 0, activeCampaigns: 0,
    avgFitScore: 0, topSectors: [], topCountries: [], readinessBreakdown: [],
  };

  const replyRate = d.emailsSent > 0 ? Math.round((d.emailsReplied / d.emailsSent) * 100) : 0;

  return (
    <div>
      <PageHeader title="Analytics" description="Track your fundraising performance and metrics." />

      {/* Primary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[20px]">
        {[
          { label: "Total Investors", value: d.totalInvestors.toLocaleString(), icon: "ri-team-line", color: "bg-lime-100 dark:bg-lime-900/20 text-lime-600" },
          { label: "High-Fit Investors", value: d.highFitInvestors.toLocaleString(), icon: "ri-star-line", color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600" },
          { label: "Avg Fit Score", value: `${d.avgFitScore}%`, icon: "ri-percent-line", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
          { label: "With Email", value: d.investorsWithEmail.toLocaleString(), icon: "ri-mail-line", color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="p-[16px]">
              <div className="flex items-center gap-[10px]">
                <div className={`w-[40px] h-[40px] rounded-[10px] ${stat.color} flex items-center justify-center text-[18px] flex-none`}>
                  <i className={stat.icon}></i>
                </div>
                <div>
                  <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[20px]">
        {[
          { label: "Emails Sent", value: d.emailsSent, icon: "ri-send-plane-line" },
          { label: "Reply Rate", value: `${replyRate}%`, icon: "ri-reply-line" },
          { label: "Active Campaigns", value: d.activeCampaigns, icon: "ri-megaphone-line" },
          { label: "Pending Duplicates", value: d.pendingDuplicates, icon: "ri-file-copy-line" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="p-[16px] text-center">
              <i className={`${stat.icon} text-gray-300 text-[20px] mb-[6px] block`}></i>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
              <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
        {/* Top Sectors */}
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[14px]">
              Top Investor Sectors
            </h3>
            {d.topSectors.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center !mb-0 py-[20px]">No sector data yet.</p>
            ) : (
              <div className="space-y-[10px]">
                {d.topSectors.map((s) => (
                  <div key={s.sector} className="flex items-center gap-[10px]">
                    <span className="text-[13px] text-gray-500 flex-1 capitalize">{s.sector.replace(/_/g, " ")}</span>
                    <div className="w-[80px] h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-lime-500 rounded-full"
                        style={{ width: `${(s.count / d.totalInvestors) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-[13px] font-bold text-[#06201b] dark:text-white w-[30px] text-right">{s.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Top Countries */}
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[14px]">
              Top Investor Countries
            </h3>
            {d.topCountries.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center !mb-0 py-[20px]">No country data yet.</p>
            ) : (
              <div className="space-y-[10px]">
                {d.topCountries.map((c) => (
                  <div key={c.country} className="flex items-center gap-[10px]">
                    <span className="text-[13px] text-gray-500 flex-1">{c.country}</span>
                    <div className="w-[80px] h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(c.count / d.totalInvestors) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-[13px] font-bold text-[#06201b] dark:text-white w-[30px] text-right">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Pipeline Breakdown */}
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[14px]">
              Pipeline Breakdown
            </h3>
            {d.readinessBreakdown.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center !mb-0 py-[20px]">No pipeline data yet.</p>
            ) : (
              <div className="space-y-[10px]">
                {d.readinessBreakdown.map((r) => (
                  <div key={r.stage} className="flex items-center gap-[10px]">
                    <span className="text-[13px] text-gray-500 flex-1 capitalize">{r.stage.replace(/_/g, " ")}</span>
                    <div className="w-[80px] h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${(r.count / d.totalInvestors) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-[13px] font-bold text-[#06201b] dark:text-white w-[30px] text-right">{r.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Data Quality */}
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[14px]">
              Data Quality
            </h3>
            <div className="space-y-[12px]">
              {[
                { label: "With Email", value: d.investorsWithEmail, total: d.totalInvestors, color: "bg-green-500" },
                { label: "Verified", value: d.verifiedInvestors, total: d.totalInvestors, color: "bg-blue-500" },
                { label: "High-Fit", value: d.highFitInvestors, total: d.totalInvestors, color: "bg-purple-500" },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-[4px]">
                    <span className="text-[13px] text-gray-500">{item.label}</span>
                    <span className="text-[12px] text-gray-400">{item.value}/{item.total}</span>
                  </div>
                  <div className="w-full h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
