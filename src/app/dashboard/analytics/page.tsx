"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from "recharts";

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
  investorTypes: Array<{ type: string; count: number }>;
  fitDistribution: Array<{ range: string; count: number }>;
  weeklyInvestors: Array<{ week: string; count: number }>;
}

const CHART_COLORS = ["#84cc16", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];

const READINESS_COLORS: Record<string, string> = {
  ready: "#84cc16",
  needs_verification: "#f59e0b",
  not_ready: "#9ca3af",
  contacted: "#3b82f6",
  do_not_contact: "#ef4444",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/analytics");
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();

      // Server returns pre-computed totals (no more fetching 82K rows into memory)
      const totalInvestors = json.totalInvestors || 0;
      const investorsWithEmail = json.withEmail || 0;
      const highFitInvestors = json.highFitInvestors || 0;
      const avgFitScore = json.avgFitScore || 0;
      const emailsSent = json.emailsSent || 0;
      const emailsReplied = 0;
      const activeCampaigns = json.activeCampaigns || 0;
      const withLinkedIn = json.withLinkedIn || 0;

      // For charts, fetch a sampled subset (1000 investors) for distribution data
      let investors: Array<{
        fit_score: number; investment_sectors: string[];
        country: string | null; investor_type: string;
        outreach_readiness: string; created_at: string;
      }> = [];
      try {
        const sampleRes = await fetch("/api/investors?limit=1000&fields=fit_score,investment_sectors,country,investor_type,outreach_readiness,created_at");
        if (sampleRes.ok) {
          const sampleJson = await sampleRes.json();
          investors = sampleJson.investors || [];
        }
      } catch { /* chart data not available */ }

      // Sector distribution
      const sectorMap: Record<string, number> = {};
      investors.forEach((inv) => {
        (inv.investment_sectors || []).forEach((s: string) => {
          sectorMap[s] = (sectorMap[s] || 0) + 1;
        });
      });
      const topSectors = Object.entries(sectorMap)
        .map(([sector, count]) => ({ sector: sector.replace(/_/g, " "), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Country distribution
      const countryMapFixed: Record<string, number> = {};
      investors.forEach((inv) => {
        if (inv.country) {
          countryMapFixed[inv.country] = (countryMapFixed[inv.country] || 0) + 1;
        }
      });
      const topCountries = Object.entries(countryMapFixed)
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      // Investor type distribution
      const typeMap: Record<string, number> = {};
      investors.forEach((inv) => {
        const type = (inv.investor_type || "unknown").replace(/_/g, " ");
        typeMap[type] = (typeMap[type] || 0) + 1;
      });
      const investorTypes = Object.entries(typeMap)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      // Fit score distribution
      const fitBuckets = [
        { range: "0-20", min: 0, max: 20 },
        { range: "21-40", min: 21, max: 40 },
        { range: "41-60", min: 41, max: 60 },
        { range: "61-80", min: 61, max: 80 },
        { range: "81-100", min: 81, max: 100 },
      ];
      const fitDistribution = fitBuckets.map((bucket) => ({
        range: bucket.range,
        count: investors.filter((i) => (i.fit_score || 0) >= bucket.min && (i.fit_score || 0) <= bucket.max).length,
      }));

      // Readiness breakdown
      const readinessMap: Record<string, number> = {};
      investors.forEach((inv) => {
        const stage = inv.outreach_readiness || "not_ready";
        readinessMap[stage] = (readinessMap[stage] || 0) + 1;
      });
      const readinessBreakdown = Object.entries(readinessMap)
        .map(([stage, count]) => ({ stage, count }))
        .sort((a, b) => b.count - a.count);

      // Weekly trend (placeholder with empty weeks)
      const weeklyMap: Record<string, number> = {};
      for (let i = 7; i >= 0; i--) {
        const weekLabel = `W${8 - i}`;
        weeklyMap[weekLabel] = 0;
      }
      investors.forEach((inv) => {
        const created = new Date(inv.created_at);
        const now = new Date();
        const weeksAgo = Math.floor((now.getTime() - created.getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeksAgo >= 0 && weeksAgo < 8) {
          const weekLabel = `W${8 - weeksAgo}`;
          if (weeklyMap[weekLabel] !== undefined) {
            weeklyMap[weekLabel]++;
          }
        }
      });
      const weeklyInvestors = Object.entries(weeklyMap).map(([week, count]) => ({ week, count }));

      setData({
        totalInvestors,
        investorsWithEmail,
        highFitInvestors,
        verifiedInvestors: 0,
        pendingDuplicates: json.pendingDuplicates || 0,
        emailsSent,
        emailsReplied,
        activeCampaigns,
        avgFitScore,
        topSectors,
        topCountries,
        readinessBreakdown,
        investorTypes,
        fitDistribution,
        weeklyInvestors,
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[20px]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse h-[80px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse h-[300px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
          ))}
        </div>
      </div>
    );
  }

  const d = data || {
    totalInvestors: 0, investorsWithEmail: 0, highFitInvestors: 0, verifiedInvestors: 0,
    pendingDuplicates: 0, emailsSent: 0, emailsReplied: 0, activeCampaigns: 0,
    avgFitScore: 0, topSectors: [], topCountries: [], readinessBreakdown: [],
    investorTypes: [], fitDistribution: [], weeklyInvestors: [],
  };

  const replyRate = d.emailsSent > 0 ? Math.round((d.emailsReplied / d.emailsSent) * 100) : 0;

  const funnelData = [
    { stage: "Total Investors", count: d.totalInvestors, color: "#9ca3af" },
    { stage: "With Email", count: d.investorsWithEmail, color: "#3b82f6" },
    { stage: "High-Fit", count: d.highFitInvestors, color: "#a855f7" },
    { stage: "Verified", count: d.verifiedInvestors, color: "#06b6d4" },
    { stage: "Emails Sent", count: d.emailsSent, color: "#84cc16" },
    { stage: "Replies", count: d.emailsReplied, color: "#f59e0b" },
  ];

  const maxFunnel = Math.max(...funnelData.map((f) => f.count), 1);

  return (
    <div>
      <PageHeader title="Analytics" description="Track your fundraising performance and metrics." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[20px]">
        {[
          { label: "Total Investors", value: d.totalInvestors.toLocaleString(), icon: "ri-team-line", color: "bg-lime-100 dark:bg-lime-900/20 text-lime-600" },
          { label: "High-Fit Investors", value: d.highFitInvestors.toLocaleString(), icon: "ri-star-line", color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600" },
          { label: "Avg Fit Score", value: `${d.avgFitScore}%`, icon: "ri-percent-line", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
          { label: "With Email", value: d.investorsWithEmail.toLocaleString(), icon: "ri-mail-line", color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="p-[16px]">
              <div className="flex items-center gap-[10px]">
                <div className={`w-[40px] h-[40px] rounded-[12px] ${stat.color} flex items-center justify-center text-[18px] flex-none`}>
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

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[20px]">
        {[
          { label: "Emails Sent", value: d.emailsSent, icon: "ri-send-plane-line", color: "text-blue-600" },
          { label: "Reply Rate", value: `${replyRate}%`, icon: "ri-reply-line", color: "text-green-600" },
          { label: "Active Campaigns", value: d.activeCampaigns, icon: "ri-megaphone-line", color: "text-purple-600" },
          { label: "Pending Duplicates", value: d.pendingDuplicates, icon: "ri-file-copy-line", color: "text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="p-[16px] text-center">
              <i className={`${stat.icon} ${stat.color} text-[18px] mb-[6px] block`}></i>
              <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
              <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[20px]">
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Investor Growth (8 Weeks)
            </h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={d.weeklyInvestors}>
                  <defs>
                    <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#84cc16" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} />
                  <Area type="monotone" dataKey="count" stroke="#84cc16" fill="url(#growthGradient)" strokeWidth={2} name="Investors" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Fit Score Distribution
            </h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.fitDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="range" tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Investors">
                    {d.fitDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[20px]">
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Top Investor Sectors
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.topSectors} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <YAxis type="category" dataKey="sector" tick={{ fontSize: 12, fill: "#9ca3af" }} width={100} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Investors">
                    {d.topSectors.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Investor Type Distribution
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.investorTypes} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="count" nameKey="type">
                    {d.investorTypes.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} formatter={(value: string) => value.length > 15 ? `${value.slice(0, 15)}...` : value} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[20px]">
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Outreach Funnel
            </h3>
            <div className="space-y-[8px]">
              {funnelData.map((item) => (
                <div key={item.stage}>
                  <div className="flex items-center justify-between mb-[4px]">
                    <span className="text-[13px] text-gray-500">{item.stage}</span>
                    <span className="text-[13px] font-bold text-[#06201b] dark:text-white">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-[24px] bg-gray-100 dark:bg-gray-800 rounded-[6px] overflow-hidden">
                    <div className="h-full rounded-[6px] transition-all duration-700 flex items-center justify-end pr-[8px]" style={{ width: `${Math.max((item.count / maxFunnel) * 100, 2)}%`, backgroundColor: item.color }}>
                      {item.count > 0 && (
                        <span className="text-[11px] font-bold text-white">
                          {item.count > 1000 ? `${(item.count / 1000).toFixed(1)}k` : item.count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Pipeline by Stage
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.readinessBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(val: string) => val.replace(/_/g, " ")} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} formatter={(value) => [Number(value).toLocaleString(), "Investors"]} labelFormatter={(label) => String(label).replace(/_/g, " ")} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Investors">
                    {d.readinessBreakdown.map((entry) => (
                      <Cell key={`cell-${entry.stage}`} fill={READINESS_COLORS[entry.stage] || "#9ca3af"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Top Investor Countries
            </h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.topCountries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="country" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Investors">
                    {d.topCountries.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Data Quality Overview
            </h3>
            <div className="space-y-[16px]">
              {[
                { label: "With Email", value: d.investorsWithEmail, total: d.totalInvestors, color: "bg-green-500" },
                { label: "Verified", value: d.verifiedInvestors, total: d.totalInvestors, color: "bg-blue-500" },
                { label: "High-Fit (80+)", value: d.highFitInvestors, total: d.totalInvestors, color: "bg-purple-500" },
                { label: "Ready for Outreach", value: d.readinessBreakdown.find((r) => r.stage === "ready")?.count || 0, total: d.totalInvestors, color: "bg-lime-500" },
                { label: "With LinkedIn", value: d.withLinkedIn || 0, total: d.totalInvestors, color: "bg-cyan-500" },
              ].map((item) => {
                const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-[6px]">
                      <span className="text-[13px] text-gray-500">{item.label}</span>
                      <span className="text-[12px] text-gray-400">
                        {item.value.toLocaleString()} / {item.total.toLocaleString()} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-[8px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
