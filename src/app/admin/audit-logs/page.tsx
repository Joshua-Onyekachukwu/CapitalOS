"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

// Mirrors the real audit_log columns (see route.ts): actor is resolved to
// user_email at write time; target lives in entity_type/entity_id.
interface AuditEntry {
  id: string;
  action: string;
  user_email: string | null;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

const PAGE_SIZE = 200;

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [totalLoaded, setTotalLoaded] = useState(0);

  // Debounce filter changes so typing doesn't fire a request per keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstLoad = useRef(true);

  const buildUrl = (before?: string | null) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (actionFilter.trim()) params.set("action", actionFilter.trim());
    if (actorFilter.trim()) params.set("actor", actorFilter.trim());
    if (before) params.set("before", before);
    return `/api/admin/audit-logs?${params.toString()}`;
  };

  const fetchLogs = useCallback(async (filters: { action: string; actor: string }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (filters.action) params.set("action", filters.action);
      if (filters.actor) params.set("actor", filters.actor);
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setNextBefore(data.nextBefore || null);
        setTotalLoaded((data.logs || []).length);
      }
    } catch {}
    setLoading(false);
  }, []);

  // Initial load (unfiltered).
  useEffect(() => {
    if (!firstLoad.current) return;
    firstLoad.current = false;
    fetchLogs({ action: "", actor: "" });
  }, [fetchLogs]);

  // Server-side filter fetch, debounced 400ms; resets pagination.
  useEffect(() => {
    if (firstLoad.current) return; // skip until initial load kicks off
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLogs({ action: actionFilter.trim(), actor: actorFilter.trim() });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, actorFilter]);

  const loadMore = async () => {
    if (!nextBefore || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(nextBefore));
      if (res.ok) {
        const data = await res.json();
        const more: AuditEntry[] = data.logs || [];
        setLogs((prev) => [...prev, ...more]);
        setNextBefore(data.nextBefore || null);
        setTotalLoaded((n) => n + more.length);
      }
    } catch {}
    setLoadingMore(false);
  };

  const hasActiveFilters = Boolean(actionFilter.trim() || actorFilter.trim());

  const actionColor = (action: string) => {
    if (action?.includes("delete") || action?.includes("remove")) return "danger";
    if (action?.includes("create") || action?.includes("add") || action?.includes("import")) return "success";
    if (action?.includes("update") || action?.includes("edit") || action?.includes("merge")) return "warning";
    return "default";
  };

  const filterInputClass =
    "w-full py-[9px] pl-[34px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30";

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description={`${totalLoaded} loaded${hasActiveFilters ? " (filtered)" : ""}${nextBefore ? " — more available" : ""}.`}
      />

      {/* Filters (server-side) */}
      <Card className="mb-[16px]">
        <CardBody className="py-[14px] px-[16px]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-[12px]">
            <div className="relative flex-1">
              <i className="ri-terminal-line absolute left-[11px] top-1/2 -translate-y-1/2 text-gray-400 text-[16px]" />
              <input
                type="text"
                placeholder="Filter by action (e.g. role_change, delete)…"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className={filterInputClass}
              />
            </div>
            <div className="relative flex-1">
              <i className="ri-user-3-line absolute left-[11px] top-1/2 -translate-y-1/2 text-gray-400 text-[16px]" />
              <input
                type="text"
                placeholder="Filter by actor email…"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                className={filterInputClass}
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setActionFilter("");
                  setActorFilter("");
                }}
                className="text-[13px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 whitespace-nowrap px-[8px]"
              >
                <i className="ri-close-line align-[-2px]" /> Clear
              </button>
            )}
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
          ) : logs.length === 0 ? (
            <div className="p-[40px] text-center text-gray-400">
              <i className="ri-file-list-3-line text-[32px] mb-[12px] block" />
              <p className="font-medium text-[#06201b] dark:text-white !mb-[4px]">
                {hasActiveFilters ? "No matching logs" : "No audit logs yet"}
              </p>
              <p className="text-[13px]">Admin actions will appear here as they occur.</p>
            </div>
          ) : (
            <>
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
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                        <td className="py-[12px] px-[16px]">
                          <Badge variant={actionColor(log.action)}>
                            {log.action?.replace(/_/g, " ") || "Unknown"}
                          </Badge>
                        </td>
                        <td className="py-[12px] px-[16px] text-gray-500">
                          {log.user_email || "System"}
                        </td>
                        <td className="py-[12px] px-[16px] text-gray-400 text-[12px]">
                          {log.entity_type}
                          {log.entity_id ? ` (${log.entity_id.slice(0, 8)})` : ""}
                        </td>
                        <td className="py-[12px] px-[16px] text-gray-400 text-[12px] whitespace-nowrap">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {nextBefore && (
                <div className="p-[14px] text-center border-t border-gray-100 dark:border-gray-800/50">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="text-[13px] font-medium text-lime-600 dark:text-lime-400 hover:underline disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : `Load more (older than ${new Date(nextBefore).toLocaleString()})`}
                  </button>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
