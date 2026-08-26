"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface AccountHealth {
  accountId: string;
  overallScore: number;
  status: string;
  authentication: number;
  bounce: number;
  engagement: number;
  consistency: number;
  warmup: number;
  domain: number;
  recommendations: string[];
}

interface Capacity {
  accountId: string;
  email: string;
  provider: string;
  providerLimit: number;
  recommendedToday: number;
  sentToday: number;
  remaining: number;
  warmupLimited: boolean;
  explanation: string;
}

interface Alert {
  id: string;
  type: string;
  title: string;
  message: string;
  category: string;
  actionUrl?: string;
}

interface Recommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  action?: string;
  actionUrl?: string;
  priority: number;
  category: string;
}

interface HealthData {
  accounts: AccountHealth[];
  recommendations: Recommendation[];
  alerts: Alert[];
  alertCount: { total: number; critical: number; warning: number; info: number };
  capacity: Capacity[];
  recentEvents: any[];
  eventCounts: Record<string, number>;
}

export default function EmailHealthPage() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "accounts" | "alerts" | "timeline">("overview");

  const fetchData = async () => {
    try {
      const resp = await fetch("/api/email/health");
      if (resp.ok) {
        const result = await resp.json();
        setData(result);
      }
    } catch (err) {
      console.error("Failed to fetch email health:", err);
    } finally {
      setLoading(false);
    }
  };

  const refreshScores = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/email/health", { method: "POST" });
      await fetchData();
    } finally {
      setRefreshing(false);
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  const accounts = data?.accounts || [];
  const capacity = data?.capacity || [];
  const alerts = data?.alerts || [];
  const recommendations = data?.recommendations || [];
  const recentEvents = data?.recentEvents || [];
  const alertCount = data?.alertCount || { total: 0, critical: 0, warning: 0, info: 0 };

  const overallHealth = accounts.length > 0
    ? Math.round(accounts.reduce((sum, a) => sum + a.overallScore, 0) / accounts.length)
    : 0;

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Email Health
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor account health, deliverability, and sending capacity
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/email-health/warmup"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <i className="ri-fire-line mr-2"></i>Warm-Up
          </Link>
          <Link
            href="/dashboard/email-health/domain"
            className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <i className="ri-global-line mr-2"></i>Domain Health
          </Link>
          <button
            onClick={refreshScores}
            disabled={refreshing}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-lime-500 text-black hover:bg-lime-600 disabled:opacity-50"
          >
            <i className={`ri-refresh-line mr-2 ${refreshing ? "animate-spin" : ""}`}></i>
            Refresh Scores
          </button>
        </div>
      </div>

      {/* Overall Health Score */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Overall Email Health</p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-gray-900 dark:text-white">
                {overallHealth}
              </span>
              <span className="text-sm text-gray-500">/ 100</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(overallHealth)}`}>
                {getStatusText(overallHealth)}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Active Accounts</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{accounts.length}</p>
          </div>
        </div>

        {/* Score breakdown bar */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-6 gap-4">
          <ScoreBar label="Authentication" score={getAvgScore(accounts, "authentication")} />
          <ScoreBar label="Bounce Health" score={getAvgScore(accounts, "bounce")} />
          <ScoreBar label="Engagement" score={getAvgScore(accounts, "engagement")} />
          <ScoreBar label="Consistency" score={getAvgScore(accounts, "consistency")} />
          <ScoreBar label="Warm-Up" score={getAvgScore(accounts, "warmup")} />
          <ScoreBar label="Domain" score={getAvgScore(accounts, "domain")} />
        </div>
      </div>

      {/* Alert Banner */}
      {alertCount.critical > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-3">
            <i className="ri-error-warning-line text-red-500 text-xl"></i>
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">
                {alertCount.critical} critical alert{alertCount.critical > 1 ? "s" : ""}
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                Some accounts need immediate attention.
              </p>
            </div>
            <button
              onClick={() => setActiveTab("alerts")}
              className="ml-auto px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-800 rounded-lg hover:bg-red-200"
            >
              View Alerts
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-6">
        {(["overview", "accounts", "alerts", "timeline"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? "border-lime-500 text-lime-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "alerts" && alerts.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-600">
                {alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Sending Capacity Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {capacity.map((cap) => (
              <CapacityCard key={cap.accountId} capacity={cap} />
            ))}
            {capacity.length === 0 && (
              <div className="col-span-full bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center">
                <i className="ri-mail-line text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
                <p className="text-gray-500 dark:text-gray-400">
                  No email accounts connected.{" "}
                  <Link href="/dashboard/settings" className="text-lime-500 hover:underline">
                    Connect one in Settings
                  </Link>
                </p>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
                <i className="ri-lightbulb-line text-lime-500 mr-2"></i>
                Recommendations
              </h3>
              <div className="space-y-3">
                {recommendations.slice(0, 5).map((rec) => (
                  <div
                    key={rec.id}
                    className={`p-4 rounded-lg border ${
                      rec.type === "critical"
                        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                        : rec.type === "warning"
                        ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
                        : "bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
                    }`}
                  >
                    <p className="font-medium text-sm text-gray-900 dark:text-white">{rec.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{rec.description}</p>
                    {rec.actionUrl && (
                      <Link
                        href={rec.actionUrl}
                        className="inline-block mt-2 text-sm font-medium text-lime-600 hover:underline"
                      >
                        {rec.action || "Take Action"} →
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "accounts" && (
        <div className="space-y-4">
          {accounts.map((account) => (
            <AccountDetailCard key={account.accountId} account={account} />
          ))}
          {accounts.length === 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center">
              <p className="text-gray-500">No email accounts to display.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "alerts" && (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
          {alerts.length === 0 && (
            <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center">
              <i className="ri-check-double-line text-4xl text-green-500 mb-3"></i>
              <p className="text-gray-500">No active alerts. Everything looks good!</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentEvents.map((event: any) => (
              <div key={event.id} className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  event.severity === "critical" ? "bg-red-100 text-red-500" :
                  event.severity === "warning" ? "bg-amber-100 text-amber-500" :
                  "bg-blue-100 text-blue-500"
                }`}>
                  <i className={`ri-${
                    event.event_type.includes("bounce") ? "error-warning" :
                    event.event_type === "sent" ? "send-plane" :
                    event.event_type === "suppressed" ? "forbid" :
                    event.event_type.includes("warmup") ? "fire" :
                    event.event_type.includes("pause") ? "pause-circle" :
                    "information"
                  }-line text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                    {event.event_type.replace(/_/g, " ")}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                  {event.details && typeof event.details === "object" && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {JSON.stringify(event.details)}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {recentEvents.length === 0 && (
              <p className="text-gray-500 text-center py-4">No recent events</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// Sub-components
// =============================================

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 70 ? "bg-green-500" :
            score >= 50 ? "bg-amber-500" :
            "bg-red-500"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1">{score}</p>
    </div>
  );
}

function CapacityCard({ capacity }: { capacity: Capacity }) {
  const usagePercent = capacity.recommendedToday > 0
    ? Math.round((capacity.sentToday / capacity.recommendedToday) * 100)
    : 0;

  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            capacity.remaining > 0 ? "bg-green-500" : "bg-gray-300"
          }`}></div>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{capacity.email}</p>
        </div>
        <span className="text-xs text-gray-500 capitalize">{capacity.provider}</span>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{capacity.sentToday} sent today</span>
          <span>{capacity.remaining} remaining</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              usagePercent >= 90 ? "bg-red-500" :
              usagePercent >= 70 ? "bg-amber-500" :
              "bg-lime-500"
            }`}
            style={{ width: `${Math.min(100, usagePercent)}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between text-xs text-gray-500 mb-2">
        <span>Recommended: {capacity.recommendedToday}/day</span>
        <span>Provider max: {capacity.providerLimit}</span>
      </div>

      {capacity.warmupLimited && (
        <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2 py-1">
          <i className="ri-fire-line"></i>
          <span>In warm-up mode</span>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{capacity.explanation}</p>
    </div>
  );
}

function AccountDetailCard({ account }: { account: AccountHealth }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-5">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold ${
            account.overallScore >= 70 ? "bg-green-100 text-green-700" :
            account.overallScore >= 50 ? "bg-amber-100 text-amber-700" :
            "bg-red-100 text-red-700"
          }`}>
            {account.overallScore}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              Account {account.accountId.slice(0, 8)}...
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {getStatusText(account.overallScore)} · {account.recommendations.length} recommendations
            </p>
          </div>
        </div>
        <i className={`ri-arrow-down-s-line text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}></i>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <ScoreBar label="Authentication" score={account.authentication} />
            <ScoreBar label="Bounce Health" score={account.bounce} />
            <ScoreBar label="Engagement" score={account.engagement} />
            <ScoreBar label="Consistency" score={account.consistency} />
            <ScoreBar label="Warm-Up" score={account.warmup} />
            <ScoreBar label="Domain" score={account.domain} />
          </div>
          {account.recommendations.length > 0 && (
            <div className="space-y-2">
              {account.recommendations.map((rec, i) => (
                <p key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                  <i className="ri-arrow-right-s-line text-lime-500 mt-0.5 flex-shrink-0"></i>
                  {rec}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <div className={`p-4 rounded-xl border ${
      alert.type === "critical"
        ? "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
        : alert.type === "warning"
        ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
        : "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
    }`}>
      <div className="flex items-start gap-3">
        <i className={`ri-${
          alert.type === "critical" ? "error-warning" :
          alert.type === "warning" ? "alert" :
          "check-line"
        }-line text-lg ${
          alert.type === "critical" ? "text-red-500" :
          alert.type === "warning" ? "text-amber-500" :
          "text-green-500"
        }`}></i>
        <div className="flex-1">
          <p className="font-medium text-sm text-gray-900 dark:text-white">{alert.title}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{alert.message}</p>
          {alert.actionUrl && (
            <Link
              href={alert.actionUrl}
              className="inline-block mt-2 text-sm font-medium text-lime-600 hover:underline"
            >
              Take Action →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================
// Helpers
// =============================================

function getAvgScore(accounts: AccountHealth[], field: keyof AccountHealth): number {
  if (accounts.length === 0) return 0;
  const sum = accounts.reduce((s, a) => s + (Number(a[field]) || 0), 0);
  return Math.round(sum / accounts.length);
}

function getStatusColor(score: number): string {
  if (score >= 85) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (score >= 70) return "bg-green-50 text-green-600";
  if (score >= 50) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  if (score >= 30) return "bg-orange-100 text-orange-700";
  return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}

function getStatusText(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Healthy";
  if (score >= 50) return "Needs Attention";
  if (score >= 30) return "At Risk";
  return "Critical";
}
