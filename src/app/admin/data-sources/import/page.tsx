"use client";

import React, { useState, useRef } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface ImportProgress {
  status: "idle" | "parsing" | "importing" | "done" | "error";
  totalRows: number;
  parsed: number;
  normalized: number;
  duplicates: number;
  inserted: number;
  failed: number;
  errors: string[];
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    status: "idle",
    totalRows: 0,
    parsed: 0,
    normalized: 0,
    duplicates: 0,
    inserted: 0,
    failed: 0,
    errors: [],
  });
  const [fileName, setFileName] = useState<string>("");

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setProgress({ status: "parsing", totalRows: 0, parsed: 0, normalized: 0, duplicates: 0, inserted: 0, failed: 0, errors: [] });

    try {
      const content = await file.text();

      setProgress((p) => ({ ...p, status: "importing" }));

      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent: content, source: "csv_import" }),
      });

      const result = await response.json();

      if (!response.ok) {
        setProgress((p) => ({ ...p, status: "error", errors: [result.error || "Import failed"] }));
        return;
      }

      setProgress({
        status: "done",
        totalRows: result.totalRows,
        parsed: result.parsed,
        normalized: result.normalized,
        duplicates: result.duplicates,
        inserted: result.inserted,
        failed: result.failed,
        errors: result.errors || [],
      });
    } catch (err) {
      setProgress((p) => ({ ...p, status: "error", errors: [String(err)] }));
    }
  };

  return (
    <div>
      <PageHeader
        title="Import Investors"
        description="Upload a CSV file to bulk import investor data into your database."
      />

      {/* Upload Card */}
      <Card className="mb-[20px]">
        <CardBody>
          <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[12px] p-[40px] text-center">
            <div className="w-[56px] h-[56px] rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center mx-auto mb-[16px] text-lime-600 text-[24px]">
              <i className="ri-upload-cloud-2-line"></i>
            </div>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[8px]">
              Upload CSV File
            </h3>
            <p className="text-[14px] text-gray-400 !mb-[20px]">
              Supports any CSV with investor names, emails, firms, sectors, stages, and more.
              <br />
              Column names are auto-detected (e.g., &quot;full_name&quot;, &quot;name&quot;, &quot;investor_name&quot; all work).
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={handleUpload}
            />

            <div className="flex items-center justify-center gap-[12px]">
              <Button onClick={() => fileRef.current?.click()} disabled={progress.status === "parsing" || progress.status === "importing"}>
                {progress.status === "parsing" || progress.status === "importing" ? (
                  <>
                    <svg className="animate-spin h-[16px] w-[16px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 8.5824 3 7.938l3-2.647z"></path>
                    </svg>
                    {progress.status === "parsing" ? "Parsing..." : "Importing..."}
                  </>
                ) : (
                  <>
                    <i className="ri-file-upload-line text-[18px]"></i>
                    Select CSV File
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Results */}
      {progress.status === "done" && (
        <Card className="mb-[20px]">
          <CardBody>
            <div className="flex items-center gap-[10px] mb-[16px]">
              <i className="ri-check-double-line text-lime-600 text-[20px]"></i>
              <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-0">
                Import Complete — {fileName}
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-[12px] mb-[16px]">
              {[
                { label: "Total Rows", value: progress.totalRows, color: "text-gray-600" },
                { label: "Parsed", value: progress.parsed, color: "text-blue-600" },
                { label: "Inserted", value: progress.inserted, color: "text-green-600" },
                { label: "Duplicates", value: progress.duplicates, color: "text-amber-600" },
                { label: "Failed", value: progress.failed, color: "text-red-600" },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
                  <p className={`text-[20px] font-bold ${stat.color} !mb-0`}>{stat.value}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
                </div>
              ))}
            </div>

            {progress.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/10 rounded-[8px] p-[12px]">
                <p className="text-[13px] font-medium text-red-600 !mb-[8px]">Errors:</p>
                <ul className="text-[12px] text-red-500 space-y-[4px]">
                  {progress.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {progress.errors.length > 10 && (
                    <li className="text-gray-400">... and {progress.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Expected CSV Format */}
      <Card>
        <CardBody>
          <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[12px]">
            Expected CSV Format
          </h3>
          <p className="text-[13px] text-gray-400 !mb-[12px]">
            Your CSV should have a header row. These column names are auto-detected:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-[8px] font-semibold text-gray-500">Field</th>
                  <th className="text-left py-[8px] font-semibold text-gray-500">Accepted Column Names</th>
                </tr>
              </thead>
              <tbody className="text-gray-400">
                <tr className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-[6px] font-medium text-gray-600">Name</td>
                  <td className="py-[6px]">full_name, name, investor_name</td>
                </tr>
                <tr className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-[6px] font-medium text-gray-600">Email</td>
                  <td className="py-[6px]">email, email_address, e-mail</td>
                </tr>
                <tr className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-[6px] font-medium text-gray-600">Firm</td>
                  <td className="py-[6px]">firm_name, firm, company, organization</td>
                </tr>
                <tr className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-[6px] font-medium text-gray-600">Type</td>
                  <td className="py-[6px]">investor_type, type, fund_type</td>
                </tr>
                <tr className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-[6px] font-medium text-gray-600">Stages</td>
                  <td className="py-[6px]">investment_stages, stages, stage (comma or pipe separated)</td>
                </tr>
                <tr className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="py-[6px] font-medium text-gray-600">Sectors</td>
                  <td className="py-[6px]">investment_sectors, sectors, industry (comma or pipe separated)</td>
                </tr>
                <tr>
                  <td className="py-[6px] font-medium text-gray-600">LinkedIn</td>
                  <td className="py-[6px]">linkedin_url, linkedin, profile_url</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
