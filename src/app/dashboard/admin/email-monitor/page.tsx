"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface AccountOverview {
  accountId: string;
  email: string;
  provider: string;
  userId: string;
  healthScore: number;
  healthStatus: string;
  warmupStatus: string;
  warmupDay: number;
  sendsToday: number;
  dailyLimit: number;
  totalSent: number;
  totalBounced: number;
  bounceRate7d: number;
  sendingPaused: boolean;
  pauseReason: string | null;
  tokenExpiry: string | null;
  lastSynced: string | null;
}

interface SystemStats {
  totalAccounts: number;
  activeAccounts: number;
  pausedAccounts: number;
  healthyAccounts: number;
  criticalAccounts: number;
  totalSentToday: number;
  totalSentAllTime: number;
  systemBounceRate: number;
  providerDistribution: Record<string, number>;
  expiringTokens: number;
}

interface AdminEmailData {
  stats: SystemStats;
  accounts: AccountOverview[];
  recentErrors: any[];
  expiringTokens: Array<{ accountId: string; email: string; expiresAt: string }>;
}

export default function AdminEmailMonitorPage() {
  const [data, setData] = useState<AdminEmailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "critical" | "attention">("all");

  const fetchData = async () => {
    try {
      const resp = await fetch("/api/admin/email-monitor");
      if (resp.ok) {
        const result = await resp.json();
        setData(result);
      }
    } catch (err) {
      console.error("Failed to fetch admin email monitor:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-64"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const accounts = data?.accounts || [];
  const expiringTokens = data?.expiringTokens || [];
  const recentErrors = data?.recentErrors || [];

  const filteredAccounts = accounts.filter((acc) => {
    if (filter === "critical") return acc.healthScore < 40 || acc.sendingPaused;
    if (filter === "attention") return acc.healthScore < 70 || acc.bounceRate7d > 3;
    return true;
  });

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-flex items-center gap-1">
          <i className="ri-arrow-left-line"></i> Back to Admin
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email System Monitor</h1>
        <p className="text-sm text-gray-500 mt-1">System-wide email health, deliverability, and account status</p>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Accounts" value={stats?.totalAccounts || 0} sub={`${stats?.activeAccounts || 0} active`} icon="ri-mail-line" />
        <StatCard label="Healthy" value={stats?.healthyAccounts || 0} sub={`${stats?.criticalAccounts || 0} critical`} icon="ri-heart-pulse-line" color="text-green-500" />
        <StatCard label="Sent Today" value={stats?.totalSentToday || 0} sub="across all accounts" icon="ri-send-plane-line" color="text-blue-500" />
        <StatCard label="System Bounce Rate" value={`${(stats?.systemBounceRate || 0).toFixed(1)}%`} sub="7-day average" icon="ri-error-warning-line" color={stats && stats.systemBounceRate > 5 ? "text-red-500" : "text-green-500"} />
      </div>

      {/* Token Expiry Warning */}
      {expiringTokens.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <i className="ri-key-line text-amber-500 text-lg"></i>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              {expiringTokens.length} token{expiringTokens.length > 1 ? "s" : ""} expiring soon
            </p>
          </div>
          <div className="space-y-1">
            {expiringTokens.map((t) => (
              <p key={t.accountId} className="text-sm text-amber-600 dark:text-amber-400">
                {t.email} — expires {new Date(t.expiresAt).toLocaleDateString()}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Provider Distribution */}
      {stats?.providerDistribution && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-4 mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Provider Distribution</h3>
          <div className="flex gap-4">
            {Object.entries(stats.providerDistribution).map(([provider, count]) => (
              <div key={provider} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${provider === "google" ? "bg-red-500" : provider === "microsoft" ? "bg-blue-500" : "bg-lime-500"}`}></span>
                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{provider === "custom_smtp" ? "SMTP" : provider}: {count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(["all", "attention", "critical"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              filter === f
                ? f === "critical" ? "bg-red-500 text-white" : f === "attention" ? "bg-amber-500 text-white" : "bg-lime-500 text-black"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f === "all" ? "All Accounts" : f === "critical" ? "Critical" : "Needs Attention"}
          </button>
        ))}
      </div>

      {/* Account Table */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Account</th>
                <th className="text-center py-3 px-4 text-gray-500 font-medium">Health</th>
                <th className="text-center py-3 px-4 text-gray-500 font-medium">Warm-Up</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Sent Today</th>
                <th className="text-right py-3 px-4 text-gray-500 font-medium">Bounce Rate</th>
                <th className="text-center py-3 px-4 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((acc) => (
                <tr key={acc.accountId} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{acc.email}</p>
                      <p className="text-xs text-gray-400 capitalize">{acc.provider}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      acc.healthScore >= 70 ? "bg-green-100 text-green-700" :
                      acc.healthScore >= 50 ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {acc.healthScore}/100
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`text-xs ${
                      acc.warmupStatus === "active" ? "text-amber-600" :
                      acc.warmupStatus === "completed" ? "text-green-600" :
                      "text-gray-400"
                    }`}>
                      {acc.warmupStatus === "active" ? `Day ${acc.warmupDay}` :
                       acc.warmupStatus === "completed" ? "Done" :
                       acc.warmupStatus || "—"}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${acc.sendsToday >= acc.dailyLimit ? "text-red-500" : "text-gray-700 dark:text-gray-300"}`}>
                      {acc.sendsToday}/{acc.dailyLimit}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className={`font-medium ${acc.bounceRate7d > 5 ? "text-red-500" : acc.bounceRate7d > 3 ? "text-amber-500" : "text-gray-500"}`}>
                      {acc.bounceRate7d.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {acc.sendingPaused ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-600">Paused</span>
                    ) : acc.healthScore < 50 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-600">At Risk</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-600">Active</span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">
                    No accounts match the selected filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <div className="mt-6 bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            <i className="ri-error-warning-line text-red-500 mr-2"></i>
            Recent Errors
          </h3>
          <div className="space-y-3">
            {recentErrors.slice(0, 10).map((err: any) => (
              <div key={err.id} className="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${err.severity === "critical" ? "bg-red-500" : "bg-amber-500"}`}></span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{err.event_type?.replace(/_/g, " ")}</p>
                  <p className="text-xs text-gray-500">{new Date(err.created_at).toLocaleString()}</p>
                  {err.details && typeof err.details === "object" && (
                    <p className="text-xs text-gray-400 mt-1">{JSON.stringify(err.details)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: number | string; sub: string; icon: string; color?: string;
}) {
  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-5">
      <div className="flex items-center gap-3 mb-2">
        <i className={`${icon} ${color || "text-gray-400"} text-xl`}></i>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
