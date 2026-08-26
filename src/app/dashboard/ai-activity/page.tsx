"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface CreditEntry {
  id: string;
  amount: number;
  balanceAfter: number;
  operation: string;
  operationDetail: Record<string, unknown>;
  modelUsed: string | null;
  tokensUsed: number | null;
  createdAt: string;
}

interface BillingInfo {
  planName: string;
  creditsRemaining: number;
  creditsUsedThisPeriod: number;
  includedCredits: number;
}

const OPERATION_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  investor_research: { label: "Investor Research", icon: "ri-search-eye-line", color: "bg-purple-50 text-purple-600" },
  email_draft: { label: "Email Draft", icon: "ri-mail-draft-line", color: "bg-blue-50 text-blue-600" },
  fit_analysis: { label: "Fit Analysis", icon: "ri-bar-chart-grouped-line", color: "bg-amber-50 text-amber-600" },
  pitch_deck_generate: { label: "Pitch Deck", icon: "ri-file-ppt-2-line", color: "bg-red-50 text-red-600" },
  pitch_deck_revision: { label: "Deck Revision", icon: "ri-refresh-line", color: "bg-orange-50 text-orange-600" },
  deep_enrichment: { label: "Deep Enrichment", icon: "ri-database-2-line", color: "bg-green-50 text-green-600" },
  company_intelligence: { label: "Company Intel", icon: "ri-building-line", color: "bg-cyan-50 text-cyan-600" },
  email_sequence: { label: "Email Sequence", icon: "ri-list-check-3", color: "bg-indigo-50 text-indigo-600" },
  copilot_chat: { label: "Copilot Chat", icon: "ri-sparkling-2-line", color: "bg-lime-50 text-lime-600" },
};

export default function AIActivityPage() {
  const [entries, setEntries] = useState<CreditEntry[]>([]);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/ai-activity");
      const data = await res.json();

      if (data.entries) {
        setEntries(data.entries);
      }
      if (data.billing) {
        setBilling(data.billing);
      }
    } catch {
      // Data may not be available yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const creditUsagePercent = billing
    ? Math.round((billing.creditsUsedThisPeriod / billing.includedCredits) * 100)
    : 0;

  // Aggregate stats
  const totalCreditsUsed = entries.reduce((sum, e) => sum + Math.abs(e.amount), 0);
  const operationCounts: Record<string, number> = {};
  entries.forEach((e) => {
    operationCounts[e.operation] = (operationCounts[e.operation] || 0) + 1;
  });

  return (
    <div>
      <PageHeader
        title="AI Activity"
        description="Monitor your Capital Credit usage and AI operations."
      />

      {/* Credit Balance */}
      {billing && (
        <Card className="mb-[20px]">
          <CardBody className="p-[20px]">
            <div className="flex items-center gap-[20px] flex-wrap">
              <div className="flex items-center gap-[16px] flex-1">
                <div className="w-[56px] h-[56px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center flex-none">
                  <span className="text-[18px] font-bold text-lime-700 dark:text-lime-400">{billing.creditsRemaining}</span>
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                    Capital Credits Remaining
                  </p>
                  <p className="text-[12px] text-gray-400 !mb-0">
                    {billing.planName} plan • {billing.creditsUsedThisPeriod} used of {billing.includedCredits} this period
                  </p>
                </div>
              </div>
              <div className="w-[160px] flex-none">
                <div className="flex items-center justify-between mb-[4px]">
                  <span className="text-[11px] text-gray-400">Usage</span>
                  <span className="text-[11px] text-gray-400">{creditUsagePercent}%</span>
                </div>
                <div className="w-full h-[8px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      creditUsagePercent > 80 ? "bg-red-500" : creditUsagePercent > 50 ? "bg-amber-500" : "bg-lime-500"
                    }`}
                    style={{ width: `${Math.min(100, creditUsagePercent)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px] mb-[20px]">
        {[
          { label: "Total Operations", value: entries.length, icon: "ri-robot-2-line" },
          { label: "Credits Used", value: totalCreditsUsed, icon: "ri-flashlight-line" },
          { label: "AI Models Used", value: new Set(entries.filter((e) => e.modelUsed).map((e) => e.modelUsed)).size, icon: "ri-cpu-line" },
          { label: "Most Used", value: (() => { const top = Object.entries(operationCounts).sort(([, a], [, b]) => b - a)[0]?.[0]; return top ? (OPERATION_LABELS[top]?.label || top.replace(/_/g, " ")) : "—"; })(), icon: "ri-trophy-line" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="p-[16px] text-center">
              <i className={`${stat.icon} text-gray-300 text-[18px] mb-[6px] block`}></i>
              <p className="text-[16px] font-bold text-[#06201b] dark:text-white !mb-0 capitalize">{stat.value}</p>
              <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Activity Log */}
      <Card>
        <CardBody>
          <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
            Recent Activity
          </h3>

          {loading ? (
            <div className="space-y-[10px]">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-[12px] p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
                  <div className="w-[40px] h-[40px] rounded-[8px] bg-gray-200 dark:bg-gray-700"></div>
                  <div className="flex-1">
                    <div className="h-[14px] bg-gray-200 dark:bg-gray-700 rounded w-[150px] mb-[6px]"></div>
                    <div className="h-[10px] bg-gray-200 dark:bg-gray-700 rounded w-[100px]"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-[40px]">
              <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px] text-gray-300 text-[24px]">
                <i className="ri-robot-2-line"></i>
              </div>
              <p className="text-[14px] text-gray-400 !mb-[4px]">No AI activity yet</p>
              <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-0">
                AI operations will appear here as you use the platform.
              </p>
            </div>
          ) : (
            <div className="space-y-[8px]">
              {entries.map((entry) => {
                const opInfo = OPERATION_LABELS[entry.operation] || {
                  label: entry.operation.replace(/_/g, " "),
                  icon: "ri-flashlight-line",
                  color: "bg-gray-50 text-gray-600",
                };
                return (
                  <div key={entry.id} className="flex items-center gap-[12px] p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
                    <div className={`w-[40px] h-[40px] rounded-[8px] ${opInfo.color} flex items-center justify-center text-[16px] flex-none`}>
                      <i className={opInfo.icon}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0">
                        {opInfo.label}
                      </p>
                      <p className="text-[11px] text-gray-400 !mb-0">
                        {entry.modelUsed && <span>{entry.modelUsed.split("/").pop()}</span>}
                        {entry.tokensUsed && <span> • {entry.tokensUsed.toLocaleString()} tokens</span>}
                      </p>
                    </div>
                    <div className="text-right flex-none">
                      <p className="text-[13px] font-bold text-red-500 !mb-0">{entry.amount} credits</p>
                      <p className="text-[11px] text-gray-400 !mb-0">
                        {new Date(entry.createdAt).toLocaleDateString()} {new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
