"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface FinanceStats {
  totalRevenue: number;
  activeSubscriptions: number;
  foundingMembers: number;
  foundingCredits: number;
  monthlyRecurring: number;
  waitlistSignups: number;
}

export default function AdminFinancePage() {
  const [stats, setStats] = useState<FinanceStats>({
    totalRevenue: 0,
    activeSubscriptions: 0,
    foundingMembers: 0,
    foundingCredits: 0,
    monthlyRecurring: 0,
    waitlistSignups: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/finance-stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {}
    setLoading(false);
  };

  return (
    <div>
      <PageHeader
        title="Finance"
        description="Revenue, subscriptions, and billing overview."
      />

      {/* Revenue Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-[16px] mb-[25px]">
        {[
          { label: "Total Revenue", value: `$${stats.totalRevenue.toLocaleString()}`, icon: "ri-money-dollar-circle-line", color: "bg-green-50 text-green-600" },
          { label: "Monthly Recurring", value: `$${stats.monthlyRecurring.toLocaleString()}`, icon: "ri-repeat-line", color: "bg-blue-50 text-blue-600" },
          { label: "Active Subscriptions", value: stats.activeSubscriptions, icon: "ri-user-star-line", color: "bg-purple-50 text-purple-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[16px]">
              <div className={`w-[44px] h-[44px] rounded-[8px] ${stat.color} flex items-center justify-center text-[20px] flex-none`}>
                <i className={stat.icon} />
              </div>
              <div>
                <p className="text-[12px] text-gray-400 !mb-[2px]">{stat.label}</p>
                <p className="text-[24px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Founding Members */}
      <Card className="mb-[25px]">
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">Founding Members</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-[20px]">
            <div>
              <p className="text-[12px] text-gray-400 !mb-[4px]">Total Founding Members</p>
              <p className="text-[24px] font-bold text-[#06201b] dark:text-white !mb-0">{stats.foundingMembers}</p>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[4px]">Total Credits Issued</p>
              <p className="text-[24px] font-bold text-amber-600 !mb-0">${stats.foundingCredits.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[4px]">Revenue from Founding</p>
              <p className="text-[24px] font-bold text-green-600 !mb-0">${(stats.foundingMembers * 9.99).toFixed(0)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Pricing Tiers */}
      <Card>
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">Pricing Tiers</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[16px]">
            {[
              { name: "Founding Member", price: "$9.99", type: "One-time", features: ["$9.99 platform credit", "Priority access", "Founding pricing"], color: "border-amber-200 dark:border-amber-800" },
              { name: "Starter", price: "$49/mo", type: "Monthly", features: ["500 investor matches", "AI email drafting", "Pipeline board"], color: "border-gray-200 dark:border-gray-700" },
              { name: "Professional", price: "$199/mo", type: "Monthly", features: ["Unlimited investors", "Advanced AI scoring", "Full analytics"], color: "border-lime-200 dark:border-lime-800" },
            ].map((tier) => (
              <div key={tier.name} className={`border rounded-[12px] p-[20px] ${tier.color}`}>
                <Badge variant={tier.name === "Professional" ? "success" : tier.name === "Founding Member" ? "warning" : "default"}>
                  {tier.type}
                </Badge>
                <h4 className="text-[18px] font-bold text-[#06201b] dark:text-white mt-[12px] !mb-[4px]">{tier.name}</h4>
                <p className="text-[28px] font-black text-[#06201b] dark:text-white !mb-[12px]">{tier.price}</p>
                <ul className="space-y-[6px]">
                  {tier.features.map((f) => (
                    <li key={f} className="text-[13px] text-gray-500 flex items-center gap-[6px]">
                      <i className="ri-check-line text-lime-500 text-[14px]"></i> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
