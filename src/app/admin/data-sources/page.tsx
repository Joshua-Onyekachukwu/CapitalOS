"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Overview {
  database: {
    total: number;
    sources: Record<string, number>;
  };
  collection: {
    recentJobs: Array<{ id: string; jobType: string; status: string; found: number; deduped: number; createdAt: string }>;
  };
  processing: {
    recentJobs: Array<{ id: string; type: string; status: string; progress: number | null; createdAt: string }>;
  };
}

const fmt = (n: number) => n.toLocaleString();

export default function DataSourcesPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/intelligence");
      if (res.ok) setData(await res.json());
    } catch {
      // overview stays null; page renders zeros honestly
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sources = Object.entries(data?.database.sources || {});
  const jobCount = (data?.collection.recentJobs.length || 0) + (data?.processing.recentJobs.length || 0);

  return (
    <div>
      <PageHeader
        title="Data Sources"
        description="External data providers and acquisition pipelines. This page shows real configured sources and recorded jobs only — nothing here is estimated."
      />

      {/* Quick stats — live */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[16px] mb-[25px]">
        <Card>
          <CardBody className="flex items-center gap-[16px]">
            <div className="w-[40px] h-[40px] rounded-[8px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[18px] flex-none">
              <i className="ri-user-search-line" />
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Investors in Database</p>
              <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">
                {loading ? "..." : fmt(data?.database.total || 0)}
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-[16px]">
            <div className="w-[40px] h-[40px] rounded-[8px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-[18px] flex-none">
              <i className="ri-plug-line" />
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Distinct Sources</p>
              <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">
                {loading ? "..." : sources.length}
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-[16px]">
            <div className="w-[40px] h-[40px] rounded-[8px] bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 text-[18px] flex-none">
              <i className="ri-refresh-line" />
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Recorded Jobs</p>
              <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">
                {loading ? "..." : jobCount}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Configured providers — real status only */}
      <h3 className="!text-[15px] !font-semibold !mb-[10px]">Providers</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px] mb-[25px]">
        <Card className="h-full">
          <CardBody>
            <div className="flex items-start justify-between mb-[14px]">
              <div className="flex items-center gap-[8px]">
                <div className="w-[40px] h-[40px] rounded-[8px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 text-[20px]">
                  <i className="ri-plug-line" />
                </div>
                <div>
                  <h3 className="!text-[16px] !font-semibold !mb-0">Apollo</h3>
                  <p className="text-[12px] text-gray-400 !mb-0">Investor Data / Enrichment</p>
                </div>
              </div>
              <Badge variant="default">not configured</Badge>
            </div>
            <p className="text-[13px] text-gray-500 !mb-[12px]">
              No Apollo API key is configured. The import route exists but requires
              credentials before any data can be collected or credits consumed.
            </p>
            <div className="flex gap-[8px]">
              <Link href="/admin/data-sources/apollo">
                <button className="text-[13px] px-[12px] py-[6px] rounded-[8px] border border-gray-200 dark:border-gray-700 hover:border-lime-500 transition-colors">
                  View import tool
                </button>
              </Link>
              <Link href="/admin/intelligence">
                <button className="text-[13px] px-[12px] py-[6px] rounded-[8px] border border-gray-200 dark:border-gray-700 hover:border-lime-500 transition-colors">
                  Intelligence
                </button>
              </Link>
            </div>
          </CardBody>
        </Card>

        {/* SEC EDGAR — the source that actually populated the dataset */}
        <Card className="h-full">
          <CardBody>
            <div className="flex items-start justify-between mb-[14px]">
              <div className="flex items-center gap-[8px]">
                <div className="w-[40px] h-[40px] rounded-[8px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[20px]">
                  <i className="ri-file-chart-line" />
                </div>
                <div>
                  <h3 className="!text-[16px] !font-semibold !mb-0">SEC EDGAR</h3>
                  <p className="text-[12px] text-gray-400 !mb-0">13F institutional holdings</p>
                </div>
              </div>
              <Badge variant={sources.length > 0 ? "success" : "default"}>
                {sources.length > 0 ? "loaded" : "no data"}
              </Badge>
            </div>
            {sources.length > 0 ? (
              sources.map(([src, n]) => (
                <div key={src} className="flex items-center justify-between text-[13px]">
                  <span className="text-gray-500">{src}</span>
                  <span className="font-medium text-[#06201b] dark:text-white">{fmt(n)} records</span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-gray-400 !mb-0">No source metadata recorded.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent acquisition jobs — real rows only */}
      <Card>
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">Recent Acquisition Jobs</h3>
          {data?.collection.recentJobs.length ? (
            data.collection.recentJobs.map((j) => (
              <div key={j.id} className="flex items-center justify-between text-[13px] py-[6px] border-b border-gray-50 dark:border-gray-800 last:border-0">
                <span className="text-[#06201b] dark:text-white">{j.jobType}</span>
                <Badge variant={j.status === "completed" ? "success" : "warning"}>{j.status}</Badge>
                <span className="text-gray-400">
                  {fmt(j.found)} found / {fmt(j.deduped)} deduped · {new Date(j.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-[30px]">
              <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 dark:text-gray-600 text-[24px]">
                <i className="ri-time-line" />
              </div>
              <p className="text-[14px] text-gray-400 !mb-0">
                No acquisition jobs recorded yet. Job history appears here once ingestion runs are logged.
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
