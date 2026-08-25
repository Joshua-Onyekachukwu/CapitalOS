"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface AdminStats {
  totalUsers: number;
  totalInvestors: number;
  totalFirms: number;
  totalDataSources: number;
  investorsWithEmail: number;
  investorsWithFitScore: number;
  loading: boolean;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalInvestors: 0,
    totalFirms: 0,
    totalDataSources: 0,
    investorsWithEmail: 0,
    investorsWithFitScore: 0,
    loading: true,
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard/admin");
        if (res.ok) {
          const data = await res.json();
          const dh = data.dataHealth || {};
          setStats({
            totalUsers: 1, // Supabase auth users counted separately
            totalInvestors: dh.total_investors || 0,
            totalFirms: 0, // investor_firms table not yet populated
            totalDataSources: (data.dataSources?.length || 0) + 1,
            investorsWithEmail: dh.with_email || 0,
            investorsWithFitScore: dh.high_fit || 0,
            loading: false,
          });
        } else {
          setStats((s) => ({ ...s, loading: false }));
        }
      } catch {
        setStats((s) => ({ ...s, loading: false }));
      }
    }
    fetchStats();
  }, []);

  const statCards = [
    {
      label: "Total Users",
      value: stats.loading ? "..." : stats.totalUsers.toLocaleString(),
      icon: "ri-team-line",
      color: "bg-blue-50 text-blue-600",
      href: "/admin/users",
    },
    {
      label: "Total Investors",
      value: stats.loading ? "..." : stats.totalInvestors.toLocaleString(),
      icon: "ri-user-search-line",
      color: "bg-lime-100 text-lime-600",
      href: "/admin/investors",
      subtitle: stats.investorsWithEmail > 0 ? `${stats.investorsWithEmail.toLocaleString()} with email` : undefined,
    },
    {
      label: "Investor Firms",
      value: stats.loading ? "..." : stats.totalFirms.toLocaleString(),
      icon: "ri-building-2-line",
      color: "bg-purple-50 text-purple-600",
      href: "/admin/investor-firms",
    },
    {
      label: "Data Sources",
      value: stats.loading ? "..." : String(stats.totalDataSources),
      icon: "ri-database-2-line",
      color: "bg-amber-50 text-amber-600",
      href: "/admin/data-sources",
    },
  ];

  const quickLinks = [
    {
      label: "CSV Import",
      href: "/admin/data-sources/import",
      icon: "ri-file-upload-line",
      description: "Bulk import investors from CSV",
    },
    {
      label: "Apollo Connection",
      href: "/admin/data-sources/apollo",
      icon: "ri-plug-line",
      description: "Manage Apollo data provider",
    },
    {
      label: "Investor Database",
      href: "/admin/investors",
      icon: "ri-user-search-line",
      description: "Browse and manage investors",
    },
    {
      label: "Acquisition Jobs",
      href: "/admin/data-sources/jobs",
      icon: "ri-refresh-line",
      description: "View data import history",
    },
    {
      label: "Duplicate Review",
      href: "/admin/review/duplicates",
      icon: "ri-git-merge-line",
      description: "Review and merge duplicates",
    },
    {
      label: "Audit Logs",
      href: "/admin/audit-logs",
      icon: "ri-file-list-3-line",
      description: "Track admin actions",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="System overview and management."
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[25px]">
        {statCards.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardBody className="flex items-center gap-[14px]">
                <div className={`w-[44px] h-[44px] rounded-[10px] ${stat.color} flex items-center justify-center text-[20px] flex-none`}>
                  <i className={stat.icon} />
                </div>
                <div>
                  <p className="text-[12px] text-gray-400 !mb-[2px]">{stat.label}</p>
                  <p className="text-[22px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
                  {stat.subtitle && (
                    <p className="text-[11px] text-gray-400 !mb-0">{stat.subtitle}</p>
                  )}
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      {/* Data Quality Overview */}
      {!stats.loading && stats.totalInvestors > 0 && (
        <Card className="mb-[25px]">
          <CardBody>
            <h3 className="!text-[16px] !font-semibold !mb-[16px]">Data Quality</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[16px]">
              <div>
                <p className="text-[12px] text-gray-400 !mb-[4px]">Email Coverage</p>
                <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">
                  {stats.totalInvestors > 0
                    ? ((stats.investorsWithEmail / stats.totalInvestors) * 100).toFixed(1)
                    : "0"}%
                </p>
                <p className="text-[11px] text-gray-400 !mb-0">
                  {stats.investorsWithEmail.toLocaleString()} / {stats.totalInvestors.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-gray-400 !mb-[4px]">Fit Scored</p>
                <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">
                  {stats.totalInvestors > 0
                    ? ((stats.investorsWithFitScore / stats.totalInvestors) * 100).toFixed(1)
                    : "0"}%
                </p>
                <p className="text-[11px] text-gray-400 !mb-0">
                  {stats.investorsWithFitScore.toLocaleString()} / {stats.totalInvestors.toLocaleString()}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Quick Links */}
      <Card>
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[12px]">
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
