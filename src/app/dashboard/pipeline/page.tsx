"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface PipelineInvestor {
  id: string;
  name: string;
  firm: string;
  type: string;
  fitScore: number;
  lastActivity: string;
  avatar?: string;
}

interface PipelineColumn {
  id: string;
  title: string;
  color: string;
  bgColor: string;
  investors: PipelineInvestor[];
}

const pipelineData: PipelineColumn[] = [
  {
    id: "discovered",
    title: "Discovered",
    color: "bg-gray-400",
    bgColor: "bg-gray-50 dark:bg-gray-800/30",
    investors: [
      { id: "1", name: "Sarah Chen", firm: "Sequoia Capital", type: "VC", fitScore: 94, lastActivity: "2h ago" },
      { id: "2", name: "Marcus Williams", firm: "a16z", type: "VC", fitScore: 91, lastActivity: "5h ago" },
      { id: "3", name: "Priya Patel", firm: "Y Combinator", type: "Accelerator", fitScore: 88, lastActivity: "1d ago" },
    ],
  },
  {
    id: "qualified",
    title: "Qualified",
    color: "bg-blue-500",
    bgColor: "bg-blue-50/50 dark:bg-blue-900/10",
    investors: [
      { id: "4", name: "James Liu", firm: "Lightspeed VP", type: "VC", fitScore: 87, lastActivity: "3h ago" },
      { id: "5", name: "Emma Rodriguez", firm: "Founders Fund", type: "VC", fitScore: 85, lastActivity: "1d ago" },
    ],
  },
  {
    id: "outreach",
    title: "Outreach",
    color: "bg-purple-500",
    bgColor: "bg-purple-50/50 dark:bg-purple-900/10",
    investors: [
      { id: "6", name: "David Kim", firm: "Benchmark", type: "VC", fitScore: 82, lastActivity: "6h ago" },
    ],
  },
  {
    id: "interested",
    title: "Interested",
    color: "bg-amber-500",
    bgColor: "bg-amber-50/50 dark:bg-amber-900/10",
    investors: [
      { id: "7", name: "Lisa Thompson", firm: "Greylock", type: "VC", fitScore: 90, lastActivity: "2d ago" },
    ],
  },
  {
    id: "meeting",
    title: "Meeting",
    color: "bg-lime-500",
    bgColor: "bg-lime-50/50 dark:bg-lime-900/10",
    investors: [],
  },
  {
    id: "closed",
    title: "Closed",
    color: "bg-green-500",
    bgColor: "bg-green-50/50 dark:bg-green-900/10",
    investors: [],
  },
];

function InvestorCard({ investor }: { investor: PipelineInvestor }) {
  const scoreColor = investor.fitScore >= 90 ? "text-green-600" : investor.fitScore >= 80 ? "text-amber-600" : "text-gray-500";

  return (
    <Link href={`/dashboard/investors/${investor.id}`}>
      <div className="bg-white dark:bg-[#1a1f2e] rounded-[10px] p-[14px] border border-gray-100 dark:border-gray-800 hover:border-lime-300 dark:hover:border-lime-700 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-center gap-[10px] mb-[10px]">
          <div className="w-[32px] h-[32px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[13px] font-semibold text-gray-500 flex-none">
            {investor.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">{investor.name}</p>
            <p className="text-[11px] text-gray-400 !mb-0 truncate">{investor.firm}</p>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="default" size="sm">{investor.type}</Badge>
          <span className={`text-[13px] font-bold ${scoreColor}`}>{investor.fitScore}%</span>
        </div>
        <p className="text-[11px] text-gray-300 dark:text-gray-600 !mb-0 mt-[8px]">{investor.lastActivity}</p>
      </div>
    </Link>
  );
}

export default function PipelinePage() {
  const totalInvestors = pipelineData.reduce((sum, col) => sum + col.investors.length, 0);

  return (
    <div>
      <PageHeader
        title="Fundraising Pipeline"
        description={`${totalInvestors} investors across ${pipelineData.length} stages.`}
      />

      {/* Pipeline Stats */}
      <div className="flex items-center gap-[12px] mb-[20px] overflow-x-auto pb-[4px]">
        {pipelineData.map((col) => (
          <div key={col.id} className="flex items-center gap-[6px] px-[12px] py-[6px] rounded-full bg-white dark:bg-[#1a1f2e] border border-gray-100 dark:border-gray-800 whitespace-nowrap">
            <div className={`w-[8px] h-[8px] rounded-full ${col.color}`}></div>
            <span className="text-[12px] font-medium text-gray-500">{col.title}</span>
            <span className="text-[12px] font-bold text-[#06201b] dark:text-white">{col.investors.length}</span>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-[20px]">
        <div className="flex gap-[16px] min-w-max">
          {pipelineData.map((col) => (
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
              <div className={`${col.bgColor} rounded-[12px] p-[10px] min-h-[300px] space-y-[10px]`}>
                {col.investors.length === 0 ? (
                  <div className="text-center py-[40px]">
                    <p className="text-[12px] text-gray-300 dark:text-gray-600 !mb-0">
                      Drop investors here
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
    </div>
  );
}
