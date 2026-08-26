"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface PipelineInvestor {
  id: string;
  full_name: string;
  firm_name: string | null;
  investor_type: string;
  fit_score: number;
  outreach_readiness: string;
  created_at: string;
}

interface PipelineColumn {
  id: string;
  title: string;
  color: string;
  bgColor: string;
  investors: PipelineInvestor[];
}

const STAGES: Array<{ id: string; title: string; color: string; bgColor: string }> = [
  { id: "not_ready", title: "Discovered", color: "bg-gray-400", bgColor: "bg-gray-50 dark:bg-gray-800/30" },
  { id: "needs_verification", title: "Qualified", color: "bg-blue-500", bgColor: "bg-blue-50/50 dark:bg-blue-900/10" },
  { id: "ready", title: "Outreach Ready", color: "bg-lime-500", bgColor: "bg-lime-50/50 dark:bg-lime-900/10" },
  { id: "contacted", title: "Contacted", color: "bg-purple-500", bgColor: "bg-purple-50/50 dark:bg-purple-900/10" },
  { id: "interested", title: "Interested", color: "bg-amber-500", bgColor: "bg-amber-50/50 dark:bg-amber-900/10" },
  { id: "meeting", title: "Meeting", color: "bg-green-500", bgColor: "bg-green-50/50 dark:bg-green-900/10" },
  { id: "do_not_contact", title: "Passed", color: "bg-red-400", bgColor: "bg-red-50/50 dark:bg-red-900/10" },
];

function InvestorCard({ investor }: { investor: PipelineInvestor }) {
  const initials = investor.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  const scoreColor =
    investor.fit_score >= 90
      ? "text-green-600"
      : investor.fit_score >= 80
      ? "text-amber-600"
      : "text-gray-500";
  const timeAgo = getTimeAgo(investor.created_at);

  return (
    <Link href={`/dashboard/investors/${investor.id}`}>
      <div className="bg-white dark:bg-[#1a1f2e] rounded-[10px] p-[14px] border border-gray-100 dark:border-gray-800 hover:border-lime-300 dark:hover:border-lime-700 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-center gap-[10px] mb-[10px]">
          <div className="w-[32px] h-[32px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[13px] font-semibold text-gray-500 flex-none">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">
              {investor.full_name}
            </p>
            <p className="text-[11px] text-gray-400 !mb-0 truncate">
              {investor.firm_name || "Independent"}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="default" size="sm">
            {investor.investor_type?.replace(/_/g, " ") || "Unknown"}
          </Badge>
          <span className={`text-[13px] font-bold ${scoreColor}`}>{investor.fit_score}%</span>
        </div>
        <p className="text-[11px] text-gray-300 dark:text-gray-600 !mb-0 mt-[8px]">{timeAgo}</p>
      </div>
    </Link>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export default function PipelinePage() {
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalInvestors, setTotalInvestors] = useState(0);

  const fetchPipeline = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all investors in batches to avoid loading everything at once
      const batchSize = 500;
      let allInvestors: PipelineInvestor[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await fetch(`/api/investors?limit=${batchSize}&offset=${offset}&sortBy=fit_score&sortDirection=desc`);
        const data = await response.json();
        const batch = data.investors || [];
        allInvestors = [...allInvestors, ...batch];
        if (batch.length < batchSize) hasMore = false;
        else offset += batchSize;
      }

      const investors = allInvestors;
      setTotalInvestors(investors.length);

      // Group by outreach_readiness
      const grouped: Record<string, PipelineInvestor[]> = {};
      for (const stage of STAGES) {
        grouped[stage.id] = [];
      }

      for (const inv of investors) {
        const stage = inv.outreach_readiness || "not_ready";
        if (!grouped[stage]) grouped[stage] = [];
        grouped[stage].push(inv);
      }

      setColumns(
        STAGES.map((stage) => ({
          ...stage,
          investors: grouped[stage.id] || [],
        }))
      );
    } catch (err) {
      console.error("Failed to fetch pipeline:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipeline();
  }, [fetchPipeline]);

  return (
    <div>
      <PageHeader
        title="Fundraising Pipeline"
        description={`${totalInvestors} investors across ${STAGES.length} stages.`}
      />

      {/* Pipeline Stats */}
      <div className="flex items-center gap-[12px] mb-[20px] overflow-x-auto pb-[4px]">
        {columns.map((col) => (
          <div
            key={col.id}
            className="flex items-center gap-[6px] px-[12px] py-[6px] rounded-full bg-white dark:bg-[#1a1f2e] border border-gray-100 dark:border-gray-800 whitespace-nowrap"
          >
            <div className={`w-[8px] h-[8px] rounded-full ${col.color}`}></div>
            <span className="text-[12px] font-medium text-gray-500">{col.title}</span>
            <span className="text-[12px] font-bold text-[#06201b] dark:text-white">
              {col.investors.length}
            </span>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="flex gap-[16px] overflow-x-auto pb-[20px]">
          {STAGES.map((stage) => (
            <div key={stage.id} className="w-[270px] flex-shrink-0">
              <div className="flex items-center gap-[8px] mb-[12px] px-[4px]">
                <div className={`w-[8px] h-[8px] rounded-full ${stage.color}`}></div>
                <div className="h-[14px] bg-gray-100 dark:bg-gray-800 rounded w-[100px]"></div>
              </div>
              <div className={`${stage.bgColor} rounded-[12px] p-[10px] min-h-[300px]`}>
                {[1, 2].map((i) => (
                  <div key={i} className="animate-pulse bg-white dark:bg-[#1a1f2e] rounded-[10px] p-[14px] mb-[10px]">
                    <div className="h-[14px] bg-gray-100 dark:bg-gray-800 rounded w-[120px] mb-[6px]"></div>
                    <div className="h-[10px] bg-gray-100 dark:bg-gray-800 rounded w-[80px]"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto pb-[20px]">
          <div className="flex gap-[16px] min-w-max">
            {columns.map((col) => (
              <div key={col.id} className="w-[270px] flex-shrink-0">
                {/* Column Header */}
                <div className="flex items-center gap-[8px] mb-[12px] px-[4px]">
                  <div className={`w-[8px] h-[8px] rounded-full ${col.color}`}></div>
                  <h3 className="text-[13px] font-semibold text-[#06201b] dark:text-white !mb-0">
                    {col.title}
                  </h3>
                  <span className="text-[12px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-[6px] py-[1px] rounded-full">
                    {col.investors.length}
                  </span>
                </div>

                {/* Column Body */}
                <div
                  className={`${col.bgColor} rounded-[12px] p-[10px] min-h-[300px] space-y-[10px]`}
                >
                  {col.investors.length === 0 ? (
                    <div className="text-center py-[40px]">
                      <p className="text-[12px] text-gray-300 dark:text-gray-600 !mb-0">
                        No investors in this stage
                      </p>
                    </div>
                  ) : (
                    col.investors.map((investor) => (
                      <InvestorCard key={investor.id} investor={investor} />
                    ))
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
