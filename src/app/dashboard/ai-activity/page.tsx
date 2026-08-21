"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function AiActivityPage() {
  return (
    <div>
      <PageHeader
        title="AI Activity"
        description="Monitor your AI agents and their tasks."
      />

      {/* Agent Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[15px] md:gap-[20px] mb-[25px]">
        {[
          { name: "Investor Scout", status: "Idle", icon: "ri-radar-line" },
          { name: "Research Agent", status: "Idle", icon: "ri-search-eye-line" },
          { name: "Matching Agent", status: "Idle", icon: "ri-git-merge-line" },
          { name: "Outreach Writer", status: "Idle", icon: "ri-quill-pen-line" },
          { name: "Reply Classifier", status: "Idle", icon: "ri-reply-line" },
          { name: "Follow-Up Agent", status: "Idle", icon: "ri-loop-left-line" },
        ].map((agent) => (
          <div
            key={agent.name}
            className="flex items-center gap-[14px] p-[16px] rounded-[12px] border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#0f1629]"
          >
            <div className="w-[40px] h-[40px] rounded-[10px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-[20px] flex-none">
              <i className={agent.icon}></i>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-[#0f172a] dark:text-white !mb-[2px]">{agent.name}</p>
              <p className="text-[12px] text-gray-400 !mb-0">{agent.status}</p>
            </div>
            <div className="w-[8px] h-[8px] rounded-full bg-gray-300 dark:bg-gray-600 flex-none"></div>
          </div>
        ))}
      </div>

      {/* Task Log */}
      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-robot-2-line"></i>}
            title="No AI activity yet"
            description="AI agent tasks will appear here as you discover investors, generate outreach, and manage your pipeline."
          />
        </CardBody>
      </Card>
    </div>
  );
}
