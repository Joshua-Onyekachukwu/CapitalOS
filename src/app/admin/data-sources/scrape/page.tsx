"use client";

import React, { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { QualificationCard } from "@/components/Dashboard/QualificationCard";

interface ScrapeJob {
  id: string;
  source: string;
  status: "idle" | "running" | "done" | "error";
  result?: {
    filingsFound: number;
    parsed: number;
    staged: number;
    errors: string[];
  };
}

export default function ScrapePage() {
  const [edgarJob, setEdgarJob] = useState<ScrapeJob>({
    id: "edgar",
    source: "SEC EDGAR Form D",
    status: "idle",
  });
  const [edgarConfig, setEdgarConfig] = useState({
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    limit: 200,
  });

  const runEdgarPipeline = async () => {
    setEdgarJob((prev) => ({ ...prev, status: "running" }));

    try {
      const response = await fetch("/api/admin/scrape/edgar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(edgarConfig),
      });

      const result = await response.json();

      if (!response.ok) {
        setEdgarJob((prev) => ({
          ...prev,
          status: "error",
          result: { filingsFound: 0, parsed: 0, staged: 0, errors: [result.error] },
        }));
        return;
      }

      setEdgarJob((prev) => ({
        ...prev,
        status: "done",
        result,
      }));
    } catch (err) {
      setEdgarJob((prev) => ({
        ...prev,
        status: "error",
        result: { filingsFound: 0, parsed: 0, staged: 0, errors: [String(err)] },
      }));
    }
  };

  const runNormalizationPipeline = async () => {
    setEdgarJob((prev) => ({ ...prev, status: "running" }));

    try {
      const response = await fetch("/api/admin/scrape/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok) {
        setEdgarJob((prev) => ({
          ...prev,
          status: "error",
          result: { filingsFound: 0, parsed: 0, staged: 0, errors: [result.error] },
        }));
        return;
      }

      setEdgarJob((prev) => ({
        ...prev,
        status: "done",
        result: {
          filingsFound: result.totalRecords,
          parsed: result.parsed,
          staged: result.matched + result.newRecords,
          errors: result.errorMessages,
        },
      }));
    } catch (err) {
      setEdgarJob((prev) => ({
        ...prev,
        status: "error",
        result: { filingsFound: 0, parsed: 0, staged: 0, errors: [String(err)] },
      }));
    }
  };

  return (
    <div>
      <PageHeader
        title="Data Source Scrapers"
        description="Fetch investor data from public sources and process through the intelligence pipeline."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
        {/* SEC EDGAR */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-[16px]">
              <div className="flex items-center gap-[10px]">
                <div className="w-[40px] h-[40px] rounded-[10px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-[20px]">
                  <i className="ri-government-line"></i>
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-0">SEC EDGAR</h3>
                  <p className="text-[12px] text-gray-400 !mb-0">Form D fund filings</p>
                </div>
              </div>
              <Badge variant={edgarJob.status === "done" ? "success" : edgarJob.status === "running" ? "warning" : edgarJob.status === "error" ? "danger" : "default"}>
                {edgarJob.status === "idle" ? "Ready" : edgarJob.status === "running" ? "Running..." : edgarJob.status === "done" ? "Complete" : "Error"}
              </Badge>
            </div>

            {/* Config */}
            <div className="grid grid-cols-3 gap-[10px] mb-[16px]">
              <div>
                <label className="block text-[11px] text-gray-400 mb-[4px]">Start Date</label>
                <input
                  type="date"
                  value={edgarConfig.startDate}
                  onChange={(e) => setEdgarConfig((c) => ({ ...c, startDate: e.target.value }))}
                  className="w-full py-[6px] px-[10px] text-[13px] border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-[4px]">End Date</label>
                <input
                  type="date"
                  value={edgarConfig.endDate}
                  onChange={(e) => setEdgarConfig((c) => ({ ...c, endDate: e.target.value }))}
                  className="w-full py-[6px] px-[10px] text-[13px] border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-[11px] text-gray-400 mb-[4px]">Limit</label>
                <input
                  type="number"
                  value={edgarConfig.limit}
                  onChange={(e) => setEdgarConfig((c) => ({ ...c, limit: parseInt(e.target.value) || 200 }))}
                  className="w-full py-[6px] px-[10px] text-[13px] border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800"
                />
              </div>
            </div>

            <p className="text-[12px] text-gray-400 !mb-[12px]">
              Fetches Form D filings from SEC EDGAR. Each filing contains fund names, locations, and investment types.
              Rate-limited to 8 requests/second.
            </p>

            <Button onClick={runEdgarPipeline} disabled={edgarJob.status === "running"}>
              {edgarJob.status === "running" ? (
                <>
                  <svg className="animate-spin h-[14px] w-[14px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 8.5824 3 7.938l3-2.647z"></path>
                  </svg>
                  Fetching...
                </>
              ) : (
                <>
                  <i className="ri-download-line text-[16px]"></i>
                  Fetch from EDGAR
                </>
              )}
            </Button>

            {/* Results */}
            {edgarJob.result && (
              <div className="mt-[16px] p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
                <div className="grid grid-cols-3 gap-[8px] text-center">
                  <div>
                    <p className="text-[16px] font-bold text-[#06201b] dark:text-white !mb-0">{edgarJob.result.filingsFound}</p>
                    <p className="text-[10px] text-gray-400 !mb-0">Filings</p>
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-blue-600 !mb-0">{edgarJob.result.parsed}</p>
                    <p className="text-[10px] text-gray-400 !mb-0">Parsed</p>
                  </div>
                  <div>
                    <p className="text-[16px] font-bold text-green-600 !mb-0">{edgarJob.result.staged}</p>
                    <p className="text-[10px] text-gray-400 !mb-0">Staged</p>
                  </div>
                </div>
                {edgarJob.result.errors.length > 0 && (
                  <div className="mt-[8px] text-[11px] text-red-500">
                    {edgarJob.result.errors.slice(0, 3).map((e, i) => (
                      <p key={i} className="!mb-0">• {e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Normalization Pipeline */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-[10px] mb-[16px]">
              <div className="w-[40px] h-[40px] rounded-[10px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[20px]">
                <i className="ri-filter-3-line"></i>
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-0">Process Pipeline</h3>
                <p className="text-[12px] text-gray-400 !mb-0">Normalize, match, and promote raw records</p>
              </div>
            </div>

            <p className="text-[12px] text-gray-400 !mb-[12px]">
              After fetching data from any source, run this to process the raw records through the
              normalization, matching, and deduplication pipeline. This moves records from
              <code className="text-[11px] bg-gray-100 dark:bg-gray-800 px-[4px] py-[2px] rounded">raw_records</code> →
              <code className="text-[11px] bg-gray-100 dark:bg-gray-800 px-[4px] py-[2px] rounded ml-[4px]">investors</code>.
            </p>

            <div className="space-y-[8px] mb-[16px]">
              <div className="flex items-center gap-[8px] text-[12px] text-gray-500">
                <i className="ri-check-line text-green-500"></i>
                Normalize names, emails, countries, sectors
              </div>
              <div className="flex items-center gap-[8px] text-[12px] text-gray-500">
                <i className="ri-check-line text-green-500"></i>
                Match against existing investors (email, LinkedIn, name)
              </div>
              <div className="flex items-center gap-[8px] text-[12px] text-gray-500">
                <i className="ri-check-line text-green-500"></i>
                Deduplicate and create merge candidates
              </div>
              <div className="flex items-center gap-[8px] text-[12px] text-gray-500">
                <i className="ri-check-line text-green-500"></i>
                Promote new records to canonical investors
              </div>
            </div>

            <Button onClick={runNormalizationPipeline}>
              <i className="ri-play-line text-[16px]"></i>
              Run Pipeline
            </Button>
          </CardBody>
        </Card>

        {/* Apollo CSV Import */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-[10px] mb-[16px]">
              <div className="w-[40px] h-[40px] rounded-[10px] bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 text-[20px]">
                <i className="ri-file-upload-line"></i>
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-0">Apollo CSV Import</h3>
                <p className="text-[12px] text-gray-400 !mb-0">Upload exported Apollo contacts</p>
              </div>
            </div>

            <p className="text-[12px] text-gray-400 !mb-[12px]">
              Export contacts from Apollo.io as CSV, then upload through the existing import page.
              The pipeline will normalize and deduplicate automatically.
            </p>

            <a href="/admin/data-sources/import">
              <Button variant="outline">
                <i className="ri-upload-line text-[16px]"></i>
                Go to Import Page
              </Button>
            </a>
          </CardBody>
        </Card>

        {/* Batch Qualification */}
        <QualificationCard />

        {/* Data Health */}
        <Card>
          <CardBody>
            <div className="flex items-center gap-[10px] mb-[16px]">
              <div className="w-[40px] h-[40px] rounded-[10px] bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 text-[20px]">
                <i className="ri-heart-pulse-line"></i>
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-0">Data Health</h3>
                <p className="text-[12px] text-gray-400 !mb-0">Overview of investor database quality</p>
              </div>
            </div>

            <a href="/admin/data-sources">
              <Button variant="outline">
                <i className="ri-dashboard-line text-[16px]"></i>
                View Dashboard
              </Button>
            </a>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
