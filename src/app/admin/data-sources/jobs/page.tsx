"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Job {
  id: string;
  job_type: string;
  provider_id: string;
  status: string;
  requested_count: number | null;
  found_count: number | null;
  processed_count: number | null;
  filters: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

const statusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400";
    case "running":
    case "in_progress":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400";
    case "failed":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400";
    case "pending":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400";
    default:
      return "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400";
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return "ri-check-line text-green-500";
    case "running":
    case "in_progress":
      return "ri-loader-4-line text-blue-500 animate-spin";
    case "failed":
      return "ri-error-warning-line text-red-500";
    case "pending":
      return "ri-time-line text-yellow-500";
    default:
      return "ri-question-line text-gray-400";
  }
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    running: 0,
    failed: 0,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchJobs();
  }, [page]);

  async function fetchJobs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/jobs?page=${page}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        setStats(data.stats || { total: 0, completed: 0, running: 0, failed: 0 });
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      // Table may not exist yet
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(start: string, end: string | null) {
    if (!end) return "Running...";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  return (
    <div>
      <PageHeader
        title="Acquisition Jobs"
        description="Track data import, scraping, and enrichment job history."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] mb-[24px]">
        {loading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardBody>
                  <Skeleton className="h-[20px] w-[60px] mb-[8px]" />
                  <Skeleton className="h-[28px] w-[40px]" />
                </CardBody>
              </Card>
            ))}
          </>
        ) : (
          <>
            <Card>
              <CardBody>
                <p className="text-[12px] text-gray-500 mb-[4px]">Total Jobs</p>
                <p className="text-[24px] font-bold text-[#06201b] dark:text-white">
                  {stats.total}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-[12px] text-gray-500 mb-[4px]">Completed</p>
                <p className="text-[24px] font-bold text-green-600">{stats.completed}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-[12px] text-gray-500 mb-[4px]">Running</p>
                <p className="text-[24px] font-bold text-blue-600">{stats.running}</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <p className="text-[12px] text-gray-500 mb-[4px]">Failed</p>
                <p className="text-[24px] font-bold text-red-600">{stats.failed}</p>
              </CardBody>
            </Card>
          </>
        )}
      </div>

      {/* Job Table */}
      <Card>
        <CardHeader>
          <h3 className="!text-[16px] !font-semibold !text-[#06201b] dark:!text-white !mb-0">
            Job History
          </h3>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-[20px] space-y-[12px]">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-[48px] w-full rounded-[8px]" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-[40px]">
              <EmptyState
                icon={<i className="ri-refresh-line text-[48px] text-gray-300" />}
                title="No acquisition jobs yet"
                description="Jobs will appear here when data acquisition is initiated from the Data Sources pages."
              />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left px-[16px] py-[12px] font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Status
                      </th>
                      <th className="text-left px-[16px] py-[12px] font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Type
                      </th>
                      <th className="text-left px-[16px] py-[12px] font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Provider
                      </th>
                      <th className="text-center px-[16px] py-[12px] font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Requested
                      </th>
                      <th className="text-center px-[16px] py-[12px] font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Found
                      </th>
                      <th className="text-center px-[16px] py-[12px] font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Processed
                      </th>
                      <th className="text-center px-[16px] py-[12px] font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Duration
                      </th>
                      <th className="text-left px-[16px] py-[12px] font-semibold text-gray-500 text-[11px] uppercase tracking-wider">
                        Started
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr
                        key={job.id}
                        className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-[16px] py-[12px]">
                          <span className={`inline-flex items-center gap-[4px] text-[12px] font-medium px-[8px] py-[3px] rounded-[6px] ${statusColor(job.status)}`}>
                            <i className={`${statusIcon(job.status)} text-[14px]`} />
                            {job.status}
                          </span>
                        </td>
                        <td className="px-[16px] py-[12px] text-gray-700 dark:text-gray-300 capitalize">
                          {job.job_type?.replace(/_/g, " ") || "—"}
                        </td>
                        <td className="px-[16px] py-[12px] text-gray-700 dark:text-gray-300">
                          {job.provider_id || "—"}
                        </td>
                        <td className="px-[16px] py-[12px] text-center text-gray-700 dark:text-gray-300">
                          {job.requested_count ?? "—"}
                        </td>
                        <td className="px-[16px] py-[12px] text-center text-gray-700 dark:text-gray-300">
                          {job.found_count ?? "—"}
                        </td>
                        <td className="px-[16px] py-[12px] text-center text-gray-700 dark:text-gray-300">
                          {job.processed_count ?? "—"}
                        </td>
                        <td className="px-[16px] py-[12px] text-center text-gray-500 text-[12px]">
                          {formatDuration(job.started_at, job.completed_at)}
                        </td>
                        <td className="px-[16px] py-[12px] text-gray-500 text-[12px]">
                          {job.started_at
                            ? new Date(job.started_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-[16px] py-[12px] border-t border-gray-100 dark:border-gray-800">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="text-[12px] text-gray-500 hover:text-lime-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                  >
                    ← Previous
                  </button>
                  <span className="text-[12px] text-gray-500">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="text-[12px] text-gray-500 hover:text-lime-600 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {/* Error Details */}
      {jobs.some((j) => j.error_message) && (
        <Card className="mt-[16px]">
          <CardHeader>
            <h3 className="!text-[14px] !font-semibold !text-red-600 !mb-0">
              Failed Job Details
            </h3>
          </CardHeader>
          <CardBody className="p-0">
            {jobs
              .filter((j) => j.error_message)
              .map((job) => (
                <div
                  key={job.id}
                  className="px-[16px] py-[12px] border-b border-gray-50 dark:border-gray-800/50 last:border-0"
                >
                  <div className="flex items-center gap-[8px] mb-[4px]">
                    <span className="text-[12px] font-medium text-gray-700 dark:text-gray-300 capitalize">
                      {job.job_type?.replace(/_/g, " ")}
                    </span>
                    <span className="text-[11px] text-gray-400">•</span>
                    <span className="text-[11px] text-gray-400">
                      {new Date(job.started_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[12px] text-red-600 dark:text-red-400 font-mono">
                    {job.error_message}
                  </p>
                </div>
              ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
