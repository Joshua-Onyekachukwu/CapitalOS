"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-[25px] md:mb-[30px]">
        <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[4px]">
          Analytics
        </h1>
        <p className="text-[14px] text-gray-500 !mb-0">
          Track your fundraising performance and metrics.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px] md:gap-[20px] mb-[25px]">
        {[
          { label: "Reply Rate", value: "—" },
          { label: "Meeting Rate", value: "—" },
          { label: "Conversion", value: "—" },
          { label: "Pipeline Velocity", value: "—" },
        ].map((metric) => (
          <Card key={metric.label}>
            <CardBody>
              <p className="text-[12px] md:text-[13px] text-gray-400 !mb-[4px]">{metric.label}</p>
              <p className="text-[24px] md:text-[28px] font-bold text-[#06201b] dark:text-white !mb-0">{metric.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-line-chart-line"></i>}
            title="No data yet"
            description="Analytics will appear once you start discovering investors and sending outreach."
          />
        </CardBody>
      </Card>
    </div>
  );
}
