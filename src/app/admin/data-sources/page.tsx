"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

const providers = [
  {
    name: "Apollo",
    slug: "apollo",
    type: "Investor Data",
    status: "active" as const,
    creditsUsed: 8430,
    creditsTotal: 48000,
    health: "healthy",
    lastSync: "21 Aug 2026, 13:20",
  },
];

export default function DataSourcesPage() {
  return (
    <div>
      <PageHeader
        title="Data Sources"
        description="Manage external data providers and acquisition pipelines."
      />

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[15px] mb-[25px]">
        {providers.map((provider) => (
          <Link key={provider.slug} href={`/admin/data-sources/${provider.slug}`}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
              <CardBody>
                <div className="flex items-start justify-between mb-[14px]">
                  <div className="flex items-center gap-[10px]">
                    <div className="w-[40px] h-[40px] rounded-[10px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[20px]">
                      <i className="ri-plug-line" />
                    </div>
                    <div>
                      <h3 className="!text-[16px] !font-semibold !mb-0 group-hover:text-lime-600 transition-colors">
                        {provider.name}
                      </h3>
                      <p className="text-[12px] text-gray-400 !mb-0">{provider.type}</p>
                    </div>
                  </div>
                  <Badge variant={provider.status === "active" ? "success" : "default"}>
                    {provider.status}
                  </Badge>
                </div>

                <div className="space-y-[10px]">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-gray-500">Credits Used</span>
                    <span className="font-medium text-[#06201b] dark:text-white">
                      {provider.creditsUsed.toLocaleString()} / {provider.creditsTotal.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full h-[4px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lime-500 rounded-full"
                      style={{ width: `${(provider.creditsUsed / provider.creditsTotal) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[12px] text-gray-400">
                    <span>Last sync: {provider.lastSync}</span>
                    <span className="flex items-center gap-[4px]">
                      <span className="w-[6px] h-[6px] rounded-full bg-green-500" />
                      {provider.health}
                    </span>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}

        {/* Add Provider Card */}
        <Card className="h-full border-dashed border-2 border-gray-200 dark:border-gray-700 hover:border-lime-500 transition-colors cursor-pointer">
          <CardBody className="flex flex-col items-center justify-center py-[40px]">
            <div className="w-[40px] h-[40px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-[20px] mb-[12px]">
              <i className="ri-add-line" />
            </div>
            <p className="text-[14px] font-medium text-gray-500 !mb-0">Add Provider</p>
            <p className="text-[12px] text-gray-400 !mb-0 mt-[4px]">Connect a new data source</p>
          </CardBody>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[25px]">
        {[
          { label: "Total Investors", value: "0", icon: "ri-user-search-line" },
          { label: "Total Firms", value: "0", icon: "ri-building-2-line" },
          { label: "Acquisition Jobs", value: "0", icon: "ri-refresh-line" },
          { label: "Credits Remaining", value: "39,570", icon: "ri-vip-diamond-line" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[14px]">
              <div className="w-[40px] h-[40px] rounded-[10px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-[20px] flex-none">
                <i className={stat.icon} />
              </div>
              <div>
                <p className="text-[12px] text-gray-400 !mb-[2px]">{stat.label}</p>
                <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">Recent Activity</h3>
          <div className="text-center py-[30px]">
            <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 dark:text-gray-600 text-[24px]">
              <i className="ri-time-line" />
            </div>
            <p className="text-[14px] text-gray-400 !mb-0">No recent activity</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
