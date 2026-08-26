"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DailyStats {
  date: string;
  sent: number;
  delivered: number;
  bounced: number;
  hardBounced: number;
  softBounced: number;
  replied: number;
  complaints: number;
}

interface AccountTrend {
  accountId: string;
  email: string;
  provider: string;
  daily: DailyStats[];
}

interface AnalyticsData {
  summary: {
    totalSent: number;
    totalDelivered: number;
    totalBounced: number;
    totalHardBounced: number;
    totalSoftBounced: number;
    totalReplied: number;
    totalComplaints: number;
    deliveryRate: number;
    bounceRate: number;
    replyRate: number;
    complaintRate: number;
  };
  dailyTrend: DailyStats[];
  accountTrends: AccountTrend[];
  bounceBreakdown: { hard: number; soft: number; unknown: number };
  topBouncedAddresses: Array<{ address: string; count: number; type: string }>;
}

export default function EmailAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");

  useEffect(() => {
    fetchData();
  }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/email/health/analytics?days=${period}`);
      if (resp.ok) {
        const result = await resp.json();
        setData(result);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-48"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const summary = data?.summary;
  const dailyTrend = data?.dailyTrend || [];
  const bounceBreakdown = data?.bounceBreakdown || { hard: 0, soft: 0, unknown: 0 };
  const topBounced = data?.topBouncedAddresses || [];

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link href="/dashboard/email-health" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-flex items-center gap-1">
            <i className="ri-arrow-left-line"></i> Back to Email Health
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Analytics</h1>
        </div>
        <div className="flex gap-2">
          {(["7", "30", "90"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                period === p
                  ? "bg-lime-500 text-black"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
              }`}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Sent" value={summary?.totalSent || 0} icon="ri-send-plane-line" color="text-blue-500" />
        <StatCard label="Delivered" value={summary?.totalDelivered || 0} icon="ri-check-line" color="text-green-500" rate={summary?.deliveryRate} />
        <StatCard label="Bounced" value={summary?.totalBounced || 0} icon="ri-error-warning-line" color="text-red-500" rate={summary?.bounceRate} rateColor="text-red-500" />
        <StatCard label="Replied" value={summary?.totalReplied || 0} icon="ri-reply-line" color="text-lime-500" rate={summary?.replyRate} rateColor="text-green-500" />
      </div>

      {/* Bounce Classification */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            <i className="ri-pie-chart-line text-lime-500 mr-2"></i>
            Bounce Classification
          </h3>
          <div className="space-y-4">
            <BounceBar label="Hard Bounces" count={bounceBreakdown.hard} total={bounceBreakdown.hard + bounceBreakdown.soft + bounceBreakdown.unknown} color="bg-red-500" description="Permanent failures (invalid address, domain not found)" />
            <BounceBar label="Soft Bounces" count={bounceBreakdown.soft} total={bounceBreakdown.hard + bounceBreakdown.soft + bounceBreakdown.unknown} color="bg-amber-500" description="Temporary failures (mailbox full, server timeout)" />
            <BounceBar label="Unknown" count={bounceBreakdown.unknown} total={bounceBreakdown.hard + bounceBreakdown.soft + bounceBreakdown.unknown} color="bg-gray-400" description="Unclassified bounce events" />
          </div>
        </div>

        {/* Top Bounced Addresses */}
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            <i className="ri-mail-close-line text-red-500 mr-2"></i>
            Most Bounced Addresses
          </h3>
          {topBounced.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No bounced addresses</p>
          ) : (
            <div className="space-y-3">
              {topBounced.slice(0, 8).map((addr, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${addr.type === "hard" ? "bg-red-500" : "bg-amber-500"}`}></span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{addr.address}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${addr.type === "hard" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                      {addr.type}
                    </span>
                    <span className="text-sm font-medium text-gray-500">{addr.count}x</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Trend */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          <i className="ri-line-chart-line text-lime-500 mr-2"></i>
          Daily Sending Trend ({period} days)
        </h3>
        {dailyTrend.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No data for this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="text-left py-2 text-gray-500 font-medium">Date</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Sent</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Delivered</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Bounced</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Hard</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Soft</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Replied</th>
                  <th className="text-right py-2 text-gray-500 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody>
                {dailyTrend.slice(0, 30).map((day) => (
                  <tr key={day.date} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                    <td className="py-2 text-gray-700 dark:text-gray-300">{new Date(day.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td className="py-2 text-right font-medium text-gray-900 dark:text-white">{day.sent}</td>
                    <td className="py-2 text-right text-green-600">{day.delivered}</td>
                    <td className="py-2 text-right text-red-500">{day.bounced}</td>
                    <td className="py-2 text-right text-red-600">{day.hardBounced}</td>
                    <td className="py-2 text-right text-amber-500">{day.softBounced}</td>
                    <td className="py-2 text-right text-lime-600">{day.replied}</td>
                    <td className="py-2 text-right">
                      <span className={`font-medium ${day.sent > 0 && (day.bounced / day.sent) > 0.05 ? "text-red-500" : "text-gray-500"}`}>
                        {day.sent > 0 ? `${((day.bounced / day.sent) * 100).toFixed(1)}%` : "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Visual Bar Chart */}
      {dailyTrend.length > 0 && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            <i className="ri-bar-chart-grouped-line text-lime-500 mr-2"></i>
            Volume Chart
          </h3>
          <div className="flex items-end gap-1 h-40">
            {dailyTrend.slice(-30).map((day, i) => {
              const maxSent = Math.max(...dailyTrend.slice(-30).map(d => d.sent), 1);
              const sentHeight = (day.sent / maxSent) * 100;
              const bounceHeight = (day.bounced / maxSent) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${day.date}: ${day.sent} sent, ${day.bounced} bounced`}>
                  <div className="w-full flex flex-col items-center" style={{ height: "100%" }}>
                    <div className="w-full flex items-end justify-center" style={{ height: "100%" }}>
                      <div className="w-full max-w-[20px] rounded-t bg-lime-500" style={{ height: `${sentHeight}%` }}></div>
                    </div>
                    {day.bounced > 0 && (
                      <div className="w-full flex items-end justify-center -mt-1">
                        <div className="w-full max-w-[20px] rounded bg-red-400" style={{ height: `${Math.max(2, bounceHeight)}px` }}></div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-lime-500"></span> Sent</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400"></span> Bounced</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, rate, rateColor }: {
  label: string; value: number; icon: string; color: string;
  rate?: number; rateColor?: string;
}) {
  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-5">
      <div className="flex items-center gap-3 mb-2">
        <i className={`${icon} ${color} text-xl`}></i>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString()}</p>
      {rate !== undefined && (
        <p className={`text-sm font-medium mt-1 ${rateColor || "text-gray-500"}`}>{rate.toFixed(1)}%</p>
      )}
    </div>
  );
}

function BounceBar({ label, count, total, color, description }: {
  label: string; count: number; total: number; color: string; description: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-sm text-gray-500">{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }}></div>
      </div>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </div>
  );
}
