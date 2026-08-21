"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

const columns = [
  { title: "Discovered", count: 0, color: "bg-gray-400" },
  { title: "Qualified", count: 0, color: "bg-blue-500" },
  { title: "Outreach", count: 0, color: "bg-purple-500" },
  { title: "Interested", count: 0, color: "bg-amber-500" },
  { title: "Meeting", count: 0, color: "bg-primary-500" },
  { title: "Closed", count: 0, color: "bg-green-500" },
];

export default function PipelinePage() {
  return (
    <div>
      <PageHeader
        title="Fundraising Pipeline"
        description="Visual Kanban board to track investors from discovery to close."
      />

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-[20px]">
        <div className="flex gap-[16px] min-w-max">
          {columns.map((col) => (
            <div key={col.title} className="w-[260px] flex-shrink-0">
              {/* Column Header */}
              <div className="flex items-center gap-[8px] mb-[12px] px-[4px]">
                <div className={`w-[8px] h-[8px] rounded-full ${col.color}`}></div>
                <h3 className="text-[13px] font-semibold text-[#0f172a] dark:text-white !mb-0">
                  {col.title}
                </h3>
                <span className="text-[12px] text-gray-400 bg-gray-100 dark:bg-gray-800 px-[6px] py-[1px] rounded-full">
                  {col.count}
                </span>
              </div>

              {/* Column Body */}
              <div className="bg-gray-50 dark:bg-gray-800/30 rounded-[12px] p-[12px] min-h-[200px]">
                <div className="text-center py-[30px]">
                  <p className="text-[12px] text-gray-300 dark:text-gray-600 !mb-0">
                    No investors
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
