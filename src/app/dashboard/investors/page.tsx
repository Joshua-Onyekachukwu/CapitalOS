"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, type Column } from "@/components/ui/Table";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Investor {
  id: string;
  full_name: string;
  email: string | null;
  investor_type: string;
  job_title: string | null;
  company: string | null;
  location: string | null;
  investment_stages: string[];
  investment_sectors: string[];
  fit_score: number;
  data_quality_score: number;
  outreach_readiness: string;
  is_verified: boolean;
}

// Placeholder data — will be replaced with Supabase queries
const PLACEHOLDER_INVESTORS: Investor[] = [
  {
    id: "1",
    full_name: "Sarah Chen",
    email: "sarah@horizonvc.com",
    investor_type: "venture_capital",
    job_title: "General Partner",
    company: "Horizon Ventures",
    location: "San Francisco, CA",
    investment_stages: ["seed", "series_a"],
    investment_sectors: ["AI", "SaaS", "Developer Tools"],
    fit_score: 94,
    data_quality_score: 88,
    outreach_readiness: "ready",
    is_verified: true,
  },
  {
    id: "2",
    full_name: "Marcus Williams",
    email: "marcus@greenscale.io",
    investor_type: "angel_investor",
    job_title: "Angel Investor",
    company: "Independent",
    location: "New York, NY",
    investment_stages: ["pre_seed", "seed"],
    investment_sectors: ["ClimateTech", "FinTech", "SaaS"],
    fit_score: 91,
    data_quality_score: 72,
    outreach_readiness: "ready",
    is_verified: false,
  },
  {
    id: "3",
    full_name: "Priya Patel",
    email: "priya@neuralfund.com",
    investor_type: "venture_capital",
    job_title: "Partner",
    company: "Neural Fund",
    location: "London, UK",
    investment_stages: ["seed", "series_a", "series_b"],
    investment_sectors: ["AI", "Machine Learning", "HealthTech"],
    fit_score: 89,
    data_quality_score: 95,
    outreach_readiness: "needs_verification",
    is_verified: true,
  },
  {
    id: "4",
    full_name: "David Kim",
    email: "david@accrete.vc",
    investor_type: "micro_vc",
    job_title: "Founding Partner",
    company: "Accrete VC",
    location: "Austin, TX",
    investment_stages: ["pre_seed", "seed"],
    investment_sectors: ["AI Infrastructure", "Developer Tools", "DeepTech"],
    fit_score: 87,
    data_quality_score: 81,
    outreach_readiness: "ready",
    is_verified: true,
  },
  {
    id: "5",
    full_name: "Elena Rodriguez",
    email: "elena@forgeaccelerator.com",
    investor_type: "accelerator",
    job_title: "Director",
    company: "Forge Accelerator",
    location: "Miami, FL",
    investment_stages: ["pre_seed"],
    investment_sectors: ["SaaS", "Consumer", "Marketplace"],
    fit_score: 78,
    data_quality_score: 65,
    outreach_readiness: "not_ready",
    is_verified: false,
  },
];

const readinessMap: Record<string, { label: string; variant: "success" | "warning" | "default" | "info" | "danger" }> = {
  ready: { label: "Ready", variant: "success" },
  needs_verification: { label: "Needs Review", variant: "warning" },
  not_ready: { label: "Not Ready", variant: "default" },
  contacted: { label: "Contacted", variant: "info" },
  do_not_contact: { label: "Do Not Contact", variant: "danger" },
};

const typeLabels: Record<string, string> = {
  venture_capital: "VC",
  angel_investor: "Angel",
  micro_vc: "Micro VC",
  accelerator: "Accelerator",
  corporate_venture: "CVC",
  family_office: "Family Office",
};

export default function InvestorsPage() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");

  const filteredInvestors = PLACEHOLDER_INVESTORS.filter((inv) => {
    const matchesSearch =
      !search ||
      inv.full_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.company?.toLowerCase().includes(search.toLowerCase()) ||
      inv.investment_sectors.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    const matchesStage = !stageFilter || inv.investment_stages.includes(stageFilter);
    const matchesType = !typeFilter || inv.investor_type === typeFilter;
    return matchesSearch && matchesStage && matchesType;
  });

  const columns: Column<Investor>[] = [
    {
      key: "full_name",
      header: "Investor",
      render: (inv) => (
        <div className="flex items-center gap-[10px]">
          <div className="w-[36px] h-[36px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[14px] font-semibold text-lime-700 dark:text-lime-400 flex-none">
            {inv.full_name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div>
            <div className="flex items-center gap-[6px]">
              <span className="font-medium text-gray-900 dark:text-white">{inv.full_name}</span>
              {inv.is_verified && <i className="ri-verified-badge-fill text-lime-500 text-[14px]"></i>}
            </div>
            <span className="text-[12px] text-gray-400">{inv.job_title} {inv.company ? `at ${inv.company}` : ""}</span>
          </div>
        </div>
      ),
    },
    {
      key: "investor_type",
      header: "Type",
      render: (inv) => (
        <Badge variant="default" size="sm">{typeLabels[inv.investor_type] || inv.investor_type}</Badge>
      ),
    },
    {
      key: "location",
      header: "Location",
      render: (inv) => (
        <span className="flex items-center gap-[4px]">
          <i className="ri-map-pin-line text-gray-400 text-[13px]"></i>
          {inv.location || "—"}
        </span>
      ),
    },
    {
      key: "fit_score",
      header: "Fit Score",
      render: (inv) => (
        <div className="flex items-center gap-[6px]">
          <div className="w-[36px] h-[6px] bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${inv.fit_score}%`,
                backgroundColor: inv.fit_score >= 85 ? "#b1ff84" : inv.fit_score >= 70 ? "#ffc107" : "#ff4023",
              }}
            />
          </div>
          <span className="text-[13px] font-medium">{inv.fit_score}%</span>
        </div>
      ),
    },
    {
      key: "outreach_readiness",
      header: "Status",
      render: (inv) => {
        const readiness = readinessMap[inv.outreach_readiness] || readinessMap.not_ready;
        return <Badge variant={readiness.variant} size="sm">{readiness.label}</Badge>;
      },
    },
    {
      key: "id",
      header: "",
      render: (inv) => (
        <Link
          href={`/dashboard/investors/${inv.id}`}
          className="text-lime-600 hover:text-lime-700 text-[13px] font-medium"
        >
          View <i className="ri-arrow-right-s-line"></i>
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Investors"
        description="Discover, research, and track investors for your fundraising campaign."
        actions={
          <Link href="/dashboard/investors/discover">
            <Button>
              <i className="ri-radar-line text-[18px]"></i>
              Discover Investors
            </Button>
          </Link>
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] mb-[20px]">
        {[
          { label: "Total Investors", value: PLACEHOLDER_INVESTORS.length, icon: "ri-user-line", color: "text-lime-500" },
          { label: "Ready to Contact", value: PLACEHOLDER_INVESTORS.filter((i) => i.outreach_readiness === "ready").length, icon: "ri-check-double-line", color: "text-success-500" },
          { label: "High Fit (85%+)", value: PLACEHOLDER_INVESTORS.filter((i) => i.fit_score >= 85).length, icon: "ri-heart-line", color: "text-warning-500" },
          { label: "Verified", value: PLACEHOLDER_INVESTORS.filter((i) => i.is_verified).length, icon: "ri-verified-badge-line", color: "text-info-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="py-[16px] px-[18px]">
              <div className="flex items-center gap-[10px] mb-[8px]">
                <i className={`${stat.icon} ${stat.color} text-[18px]`}></i>
                <span className="text-[12px] text-gray-400 uppercase tracking-wide">{stat.label}</span>
              </div>
              <span className="text-[22px] font-bold text-gray-900 dark:text-white">{stat.value}</span>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <Card className="mb-[20px]">
        <CardBody className="py-[14px] px-[16px]">
          <div className="flex items-center gap-[12px] flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <i className="ri-search-line absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 text-[18px]"></i>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, firm, sector..."
                className="w-full py-[9px] pl-[38px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500"
              />
            </div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
            >
              <option value="">All Stages</option>
              <option value="pre_seed">Pre-Seed</option>
              <option value="seed">Seed</option>
              <option value="series_a">Series A</option>
              <option value="series_b">Series B</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
            >
              <option value="">All Types</option>
              <option value="venture_capital">VC</option>
              <option value="angel_investor">Angel</option>
              <option value="micro_vc">Micro VC</option>
              <option value="accelerator">Accelerator</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Results Table */}
      <Card>
        <div className="px-[16px] py-[12px] border-b border-gray-100 dark:border-gray-800">
          <span className="text-[13px] text-gray-500">
            {filteredInvestors.length} investor{filteredInvestors.length !== 1 ? "s" : ""} found
          </span>
        </div>
        <Table
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          data={filteredInvestors as unknown as Record<string, unknown>[]}
          rowKey={(item) => String((item as Record<string, unknown>).id)}
          onRowClick={(item) => {
            window.location.href = `/dashboard/investors/${(item as unknown as Investor).id}`;
          }}
          emptyMessage="No investors match your filters."
        />
      </Card>
    </div>
  );
}
