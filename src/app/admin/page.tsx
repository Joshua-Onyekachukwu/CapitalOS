"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

const stats = [
  { label: "Total Users", value: "1", icon: "ri-team-line", color: "bg-blue-50 text-blue-600", href: "/admin/users" },
  { label: "Investors", value: "0", icon: "ri-user-search-line", color: "bg-lime-100 text-lime-600", href: "/admin/investors" },
  { label: "Firms", value: "0", icon: "ri-building-2-line", color: "bg-purple-50 text-purple-600", href: "/admin/investor-firms" },
  { label: "Data Sources", value: "1", icon: "ri-database-2-line", color: "bg-amber-50 text-amber-600", href: "/admin/data-sources" },
];

const quickLinks = [
  { label: "Apollo Connection", href: "/admin/data-sources/apollo", icon: "ri-plug-line", description: "Manage Apollo data provider" },
  { label: "Investor Database", href: "/admin/investors", icon: "ri-user-search-line", description: "Browse and manage investors" },
  { label: "Acquisition Jobs", href: "/admin/data-sources/jobs", icon: "ri-refresh-line", description: "View data import history" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "ri-file-list-3-line", description: "Track admin actions" },
];

export default function AdminOverviewPage() {
  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="System overview and management."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[25px]">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardBody className="flex items-center gap-[14px]">
                <div className={`w-[44px] h-[44px] rounded-[10px] ${stat.color} flex items-center justify-center text-[20px] flex-none`}>
                  <i className={stat.icon} />
                </div>
                <div>
                  <p className="text-[12px] text-gray-400 !mb-[2px]">{stat.label}</p>
                  <p className="text-[22px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Links */}
      <Card>
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-[12px] p-[14px] rounded-[10px] border border-gray-200 dark:border-gray-700 hover:border-lime-500 hover:bg-lime-50/50 dark:hover:bg-lime-900/10 transition-all group"
              >
                <div className="w-[36px] h-[36px] rounded-[8px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 group-hover:text-lime-600 text-[18px] flex-none transition-colors">
                  <i className={link.icon} />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0">{link.label}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">{link.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
