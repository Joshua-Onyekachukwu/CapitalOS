"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface AiStats {
  totalOperations: number;
  creditsUsed: number;
  creditsRemaining: number;
  modelUsage: Record<string, number>;
  recentErrors: number;
  avgResponseTime: number;
}

export default function AdminAiPage() {
  const [stats, setStats] = useState<AiStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/ai-stats");
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
        title="AI System"
        description="Monitor NVIDIA AI API usage, credits, and performance."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] mb-[25px]">
        {[
          { label: "Total Operations", value: stats?.totalOperations || 0, icon: "ri-robot-2-line", color: "bg-blue-50 text-blue-600" },
          { label: "Credits Used", value: stats?.creditsUsed || 0, icon: "ri-vip-diamond-line", color: "bg-amber-50 text-amber-600" },
          { label: "Credits Remaining", value: stats?.creditsRemaining || 0, icon: "ri-coins-line", color: "bg-green-50 text-green-600" },
          { label: "Recent Errors", value: stats?.recentErrors || 0, icon: "ri-error-warning-line", color: stats && stats.recentErrors > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[16px]">
              <div className={`w-[44px] h-[44px] rounded-[8px] ${stat.color} flex items-center justify-center text-[20px] flex-none`}>
                <i className={stat.icon} />
              </div>
              <div>
                <p className="text-[12px] text-gray-400 !mb-[2px]">{stat.label}</p>
                <p className="text-[24px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value.toLocaleString()}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Model Usage */}
      <Card className="mb-[25px]">
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">Model Usage</h3>
          {stats?.modelUsage && Object.keys(stats.modelUsage).length > 0 ? (
            <div className="space-y-[12px]">
              {Object.entries(stats.modelUsage).map(([model, count]) => (
                <div key={model} className="flex items-center justify-between">
                  <div className="flex items-center gap-[8px]">
                    <Badge variant="info">{model.split("/").pop()}</Badge>
                  </div>
                  <span className="text-[14px] font-medium text-[#06201b] dark:text-white">{count} calls</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[14px] text-gray-400">No AI operations recorded yet.</p>
          )}
        </CardBody>
      </Card>

      {/* API Configuration */}
      <Card>
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">API Configuration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            <div>
              <p className="text-[12px] text-gray-400 !mb-[4px]">Provider</p>
              <p className="text-[14px] font-medium text-[#06201b] dark:text-white">NVIDIA NIM</p>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[4px]">Default Model</p>
              <p className="text-[14px] font-medium text-[#06201b] dark:text-white">nemotron-3.5-lightning-30b-a3b</p>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[4px]">Key Rotation</p>
              <p className="text-[14px] font-medium text-green-600">Active (5 keys)</p>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[4px]">Avg Response Time</p>
              <p className="text-[14px] font-medium text-[#06201b] dark:text-white">{stats?.avgResponseTime || 0}ms</p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
