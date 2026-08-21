"use client";

import React from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

const primaryMetrics = [
  { label: "Reply Rate", value: "—", change: "", icon: "ri-reply-line", color: "bg-primary-100 dark:bg-primary-900/20 text-primary-600" },
  { label: "Meeting Rate", value: "—", change: "", icon: "ri-calendar-check-line", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
  { label: "Conversion", value: "—", change: "", icon: "ri-exchange-funds-line", color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600" },
  { label: "Pipeline Velocity", value: "—", change: "", icon: "ri-speed-line", color: "bg-amber-50 dark:bg-amber-900/20 text-amber-600" },
];

const secondaryMetrics = [
  { label: "Total Investors", value: "0" },
  { label: "Emails Sent", value: "0" },
  { label: "Meetings Held", value: "0" },
  { label: "Avg Response Time", value: "—" },
  { label: "Active Conversations", value: "0" },
  { label: "Pipeline Value", value: "—" },
];

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Track your fundraising performance and metrics."
      />

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px] md:gap-[20px] mb-[25px]">
        {primaryMetrics.map((metric) => (
          <Card key={metric.label}>
            <CardBody>
              <div className="flex items-center justify-between mb-[12px]">
                <div className={`w-[36px] h-[36px] rounded-[8px] ${metric.color} flex items-center justify-center text-[18px]`}>
                  <i className={metric.icon}></i>
                </div>
                {metric.change && (
                  <span className="text-[12px] font-medium text-success-600">
                    {metric.change}
                  </span>
                )}
              </div>
              <p className="text-[12px] md:text-[13px] text-gray-400 !mb-[4px]">{metric.label}</p>
              <p className="text-[24px] md:text-[28px] font-bold text-[#0f172a] dark:text-white !mb-0">{metric.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[15px] md:gap-[20px] mb-[25px]">
        <Card>
          <CardHeader>
            <h3 className="!text-[16px] !font-semibold !mb-0">Outreach Over Time</h3>
          </CardHeader>
          <CardBody>
            <div className="h-[200px] flex items-center justify-center text-gray-300 dark:text-gray-600">
              <div className="text-center">
                <i className="ri-bar-chart-line text-[32px] mb-[8px]"></i>
                <p className="text-[13px]">Chart will appear after outreach data</p>
              </div>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader>
            <h3 className="!text-[16px] !font-semibold !mb-0">Pipeline Distribution</h3>
          </CardHeader>
          <CardBody>
            <div className="h-[200px] flex items-center justify-center text-gray-300 dark:text-gray-600">
              <div className="text-center">
                <i className="ri-pie-chart-line text-[32px] mb-[8px]"></i>
                <p className="text-[13px]">Chart will appear after pipeline data</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <Card>
        <CardHeader>
          <h3 className="!text-[16px] !font-semibold !mb-0">Key Metrics</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-[20px]">
            {secondaryMetrics.map((metric) => (
              <div key={metric.label}>
                <p className="text-[12px] text-gray-400 !mb-[4px]">{metric.label}</p>
                <p className="text-[18px] font-bold text-[#0f172a] dark:text-white !mb-0">{metric.value}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
