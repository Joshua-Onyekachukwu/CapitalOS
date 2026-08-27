"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface AuditEntry {
  id: string;
  action: string;
  actor_email: string;
  target_type: string;
  target_id: string;
  details: Record<string, any>;
  created_at: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/audit-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {}
    setLoading(false);
  };

  const filtered = filter
    ? logs.filter((l) => l.action?.includes(filter) || l.actor_email?.includes(filter))
    : logs;

  const actionColor = (action: string) => {
    if (action?.includes("delete") || action?.includes("remove")) return "danger";
    if (action?.includes("create") || action?.includes("add") || action?.includes("import")) return "success";
    if (action?.includes("update") || action?.includes("edit") || action?.includes("merge")) return "warning";
    return "default";
  };

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description={`${logs.length} recorded actions.`}
      />

      {/* Filter */}
      <Card className="mb-[16px]">
        <CardBody className="py-[14px] px-[16px]">
          <div className="flex items-center gap-[12px]">
            <div className="relative flex-1">
              <i className="ri-search-line absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 text-[18px]" />
              <input
                type="text"
                placeholder="Filter by action or user..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full py-[9px] pl-[38px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Logs */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-[40px] text-center text-gray-400">
              <div className="animate-spin h-[24px] w-[24px] border-2 border-lime-500 border-t-transparent rounded-full mx-auto mb-[12px]" />
              Loading audit logs...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-[40px] text-center text-gray-400">
              <i className="ri-file-list-3-line text-[32px] mb-[12px] block" />
              <p className="font-medium text-[#06201b] dark:text-white !mb-[4px]">
                {filter ? "No matching logs" : "No audit logs yet"}
              </p>
              <p className="text-[13px]">Admin actions will appear here as they occur.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Action</th>
                    <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Actor</th>
                    <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Target</th>
                    <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="py-[12px] px-[16px]">
                        <Badge variant={actionColor(log.action)}>
                          {log.action?.replace(/_/g, " ") || "Unknown"}
                        </Badge>
                      </td>
                      <td className="py-[12px] px-[16px] text-gray-500">
                        {log.actor_email || "System"}
                      </td>
                      <td className="py-[12px] px-[16px] text-gray-400 text-[12px]">
                        {log.target_type}{log.target_id ? ` (${log.target_id.slice(0, 8)})` : ""}
                      </td>
                      <td className="py-[12px] px-[16px] text-gray-400 text-[12px]">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
