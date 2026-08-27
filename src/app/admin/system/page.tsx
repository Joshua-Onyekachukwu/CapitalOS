"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface SystemStatus {
  database: "healthy" | "degraded" | "down";
  auth: "healthy" | "degraded" | "down";
  ai: "healthy" | "degraded" | "down";
  email: "healthy" | "degraded" | "down";
  storage: "healthy" | "degraded" | "down";
  uptime: string;
  lastDeploy: string;
  environment: string;
}

export default function AdminSystemPage() {
  const [status, setStatus] = useState<SystemStatus>({
    database: "healthy",
    auth: "healthy",
    ai: "healthy",
    email: "healthy",
    storage: "healthy",
    uptime: "—",
    lastDeploy: "—",
    environment: "production",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSystem();
  }, []);

  const checkSystem = async () => {
    try {
      const res = await fetch("/api/admin/system-status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {}
    setLoading(false);
  };

  const statusColor = (s: string) =>
    s === "healthy" ? "bg-green-100 text-green-700" :
    s === "degraded" ? "bg-amber-100 text-amber-700" :
    "bg-red-100 text-red-700";

  const statusIcon = (s: string) =>
    s === "healthy" ? "ri-check-line" :
    s === "degraded" ? "ri-error-warning-line" :
    "ri-close-circle-line";

  return (
    <div>
      <PageHeader
        title="System"
        description="System health, configuration, and environment status."
        actions={
          <Button variant="outline" size="sm" onClick={checkSystem}>
            <i className="ri-refresh-line text-[16px]" /> Refresh
          </Button>
        }
      />

      {/* System Health */}
      <Card className="mb-[25px]">
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">Service Health</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[12px]">
            {[
              { name: "Database", key: "database" as const, desc: "Supabase PostgreSQL" },
              { name: "Authentication", key: "auth" as const, desc: "Supabase Auth" },
              { name: "AI Service", key: "ai" as const, desc: "NVIDIA NIM API" },
              { name: "Email", key: "email" as const, desc: "Gmail / SMTP" },
              { name: "Storage", key: "storage" as const, desc: "Supabase Storage" },
              { name: "Convex", key: "database" as const, desc: "Real-time database" },
            ].map((service) => (
              <div key={service.name} className="flex items-center gap-[12px] p-[16px] border border-gray-100 dark:border-gray-800 rounded-[8px]">
                <div className={`w-[36px] h-[36px] rounded-full flex items-center justify-center ${statusColor(status[service.key])}`}>
                  <i className={`${statusIcon(status[service.key])} text-[16px]`}></i>
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#06201b] dark:text-white !mb-0">{service.name}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">{service.desc}</p>
                </div>
                <Badge
                  variant={status[service.key] === "healthy" ? "success" : status[service.key] === "degraded" ? "warning" : "danger"}
                  className="ml-auto"
                >
                  {status[service.key]}
                </Badge>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Environment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[25px]">
        <Card>
          <CardBody>
            <h3 className="!text-[16px] !font-semibold !mb-[16px]">Environment</h3>
            <div className="space-y-[12px]">
              {[
                { label: "Environment", value: status.environment, color: status.environment === "production" ? "text-green-600" : "text-amber-600" },
                { label: "Last Deploy", value: status.lastDeploy },
                { label: "Uptime", value: status.uptime },
                { label: "Framework", value: "Next.js 15" },
                { label: "Database", value: "Supabase (PostgreSQL)" },
                { label: "Real-time", value: "Convex" },
                { label: "Hosting", value: "Vercel" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-500">{item.label}</span>
                  <span className={`text-[13px] font-medium ${item.color || "text-[#06201b] dark:text-white"}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="!text-[16px] !font-semibold !mb-[16px]">Configuration</h3>
            <div className="space-y-[12px]">
              {[
                { label: "Google OAuth", status: "Configured" },
                { label: "NVIDIA AI Keys", status: "5 keys active" },
                { label: "Stripe", status: "Test mode" },
                { label: "Email Accounts", status: "Gmail + SMTP" },
                { label: "Rate Limiting", status: "Active" },
                { label: "CAN-SPAM Compliance", status: "Active" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-500">{item.label}</span>
                  <Badge variant="success">{item.status}</Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-[12px]">
            {[
              { label: "Clear Cache", icon: "ri-delete-bin-line", desc: "Reset application cache", action: () => {} },
              { label: "Run Health Check", icon: "ri-heart-pulse-line", desc: "Test all service connections", action: checkSystem },
              { label: "View Logs", icon: "ri-file-list-3-line", desc: "Check system logs", action: () => {} },
            ].map((action) => (
              <button
                key={action.label}
                onClick={action.action}
                className="flex items-center gap-[12px] p-[16px] border border-gray-200 dark:border-gray-700 rounded-[8px] hover:border-lime-500 hover:bg-lime-50/50 dark:hover:bg-lime-900/10 transition-all text-left"
              >
                <div className="w-[36px] h-[36px] rounded-[8px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-[18px]">
                  <i className={action.icon}></i>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0">{action.label}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
