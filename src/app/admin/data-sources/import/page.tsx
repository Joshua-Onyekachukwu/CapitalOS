"use client";

import React, { useRef, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface ImportCounts {
  totalRows: number;
  parsed: number;
  normalized: number;
  duplicates: number;
  inserted: number;
  wouldInsert?: number;
  failed: number;
  errors: string[];
}

type Phase = "idle" | "previewing" | "previewed" | "importing" | "done";

function Count({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="text-center p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
      <p className={`text-[20px] font-bold ${tone} !mb-0`}>{value}</p>
      <p className="text-[11px] text-gray-400 !mb-0">{label}</p>
    </div>
  );
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [csvContent, setCsvContent] = useState("");
  const [preview, setPreview] = useState<ImportCounts | null>(null);
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [result, setResult] = useState<ImportCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "previewing" || phase === "importing";

  const reset = () => {
    setPhase("idle");
    setFileName("");
    setCsvContent("");
    setPreview(null);
    setPreviewToken(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const chooseFile = async (file: File) => {
    setError(null);
    setResult(null);
    setPreview(null);
    setPreviewToken(null);
    setFileName(file.name);
    setPhase("previewing");

    try {
      const content = await file.text();
      const response = await fetch("/api/admin/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent: content, source: "csv_import" }),
      });
      const body = await response.json();

      if (!response.ok) {
        setPhase("idle");
        setError(body.error || "Could not preview this file.");
        return;
      }

      setCsvContent(content);
      setPreview(body);
      setPreviewToken(body.previewToken);
      setPhase("previewed");
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmImport = async () => {
    setError(null);
    setPhase("importing");

    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, source: "csv_import", previewToken }),
      });
      const body = await response.json();

      if (!response.ok) {
        // The token may have expired while the preview sat open.
        setPhase("previewed");
        setError(body.error || "Import failed.");
        return;
      }

      setResult(body);
      setPhase("done");
    } catch (err) {
      setPhase("previewed");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Import Investors"
        description="Upload a CSV, review exactly what would change, then confirm the write."
      />

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
              Nothing is written until you confirm the preview.
              <br />
              Column names are auto-detected (e.g., &quot;full_name&quot;, &quot;name&quot;, &quot;investor_name&quot; all work).
            </p>

            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void chooseFile(file);
              }}
            />

            <div className="flex items-center justify-center gap-[12px]">
              <Button onClick={() => fileRef.current?.click()} disabled={busy}>
                {phase === "previewing" ? (
                  <>
                    <i className="ri-loader-4-line animate-spin text-[18px]"></i>
                    Reading file...
                  </>
                ) : (
                  <>
                    <i className="ri-file-upload-line text-[18px]"></i>
                    {preview ? "Choose a different file" : "Select CSV File"}
                  </>
                )}
              </Button>
            </div>

            {fileName && (
              <p className="text-[12px] text-gray-400 !mb-0 mt-[12px]">{fileName}</p>
            )}
          </div>
        </CardBody>
      </Card>

      {error && (
        <Card className="mb-[20px]">
          <CardBody>
            <p className="text-[13px] text-red-600 !mb-0">{error}</p>
          </CardBody>
        </Card>
      )}

      {preview && phase === "previewed" && (
        <Card className="mb-[20px]">
          <CardBody>
            <div className="flex items-center gap-[8px] mb-[16px]">
              <i className="ri-eye-line text-amber-600 text-[20px]"></i>
              <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-0">
                Dry run — nothing has been written yet
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-[12px] mb-[16px]">
              <Count value={preview.totalRows} label="Rows" tone="text-gray-600" />
              <Count value={preview.wouldInsert ?? 0} label="Would insert" tone="text-green-600" />
              <Count value={preview.duplicates} label="Duplicates" tone="text-amber-600" />
              <Count value={preview.failed} label="Failed" tone="text-red-600" />
              <Count value={preview.normalized} label="Normalised" tone="text-blue-600" />
            </div>

            {preview.errors.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/10 rounded-[8px] p-[12px] mb-[16px]">
                <p className="text-[13px] font-medium text-amber-700 !mb-[8px]">
                  Rows that would be skipped:
                </p>
                <ul className="text-[12px] text-amber-700 space-y-[4px]">
                  {preview.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                  {preview.errors.length > 10 && (
                    <li className="text-gray-400">... and {preview.errors.length - 10} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-[10px]">
              <Button onClick={confirmImport} disabled={busy}>
                <i className="ri-check-double-line text-[18px]"></i>
                Confirm import
              </Button>
              <Button variant="outline" onClick={reset} disabled={busy}>
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {phase === "importing" && (
        <Card className="mb-[20px]">
          <CardBody>
            <p className="text-[13px] text-gray-500 !mb-0">Importing the previewed rows…</p>
          </CardBody>
        </Card>
      )}

      {result && phase === "done" && (
        <Card className="mb-[20px]">
          <CardBody>
            <div className="flex items-center gap-[8px] mb-[16px]">
              <i className="ri-check-double-line text-lime-600 text-[20px]"></i>
              <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-0">
                Import complete — {fileName}
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[12px] mb-[16px]">
              <Count value={result.totalRows} label="Total rows" tone="text-gray-600" />
              <Count value={result.inserted} label="Inserted" tone="text-green-600" />
              <Count value={result.duplicates} label="Duplicates" tone="text-amber-600" />
              <Count value={result.failed} label="Failed" tone="text-red-600" />
            </div>

            {result.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/10 rounded-[8px] p-[12px]">
                <p className="text-[13px] font-medium text-red-600 !mb-[8px]">Errors:</p>
                <ul className="text-[12px] text-red-500 space-y-[4px]">
                  {result.errors.slice(0, 10).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button variant="outline" onClick={reset} className="mt-[16px]">
              Import another file
            </Button>
          </CardBody>
        </Card>
      )}

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
