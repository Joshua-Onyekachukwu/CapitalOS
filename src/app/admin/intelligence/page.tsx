"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Overview {
  database: {
    total: number;
    verified: number;
    aiClassified: number;
    unknownProvenance: number;
    qualified: number;
    highRelevance: number;
    withEmail: number;
    stale: number;
    archived: number;
    recentlyAdded7d: number;
    recentlyVerified7d: number;
    duplicateCandidatesOpen: number;
    sources: Record<string, number>;
  };
  storage: {
    topTables: Array<{ table: string; bytes: number }>;
    dbTotalBytes: number;
  };
  collection: {
    recentJobs: Array<{ id: string; jobType: string; status: string; found: number; deduped: number; createdAt: string }>;
  };
  processing: {
    jobsByStatus: Record<string, number>;
    recentJobs: Array<{ id: string; type: string; status: string; progress: number | null; createdAt: string }>;
  };
}

const SUPABASE_BUDGET_BYTES = 500 * 1024 * 1024;
const fmtBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmt = (n: number) => n.toLocaleString();

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <Card>
      <CardBody className="p-[16px]">
        <p className="text-[11px] uppercase tracking-wide text-gray-400 !mb-[4px]">{label}</p>
        <p className={`text-[20px] font-bold !mb-0 ${tone || "text-[#06201b] dark:text-white"}`}>{value}</p>
      </CardBody>
    </Card>
  );
}

export default function AdminIntelligencePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/intelligence");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runDuplicateScan = async () => {
    setScanning(true);
    setScanResult("");
    try {
      const res = await fetch("/api/admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan_duplicates" }),
      });
      const j = await res.json();
      setScanResult(res.ok ? `Scan complete: ${j.created} new duplicate pair(s) queued for review.` : `Scan failed: ${j.error || res.status}`);
      await load();
    } catch {
      setScanResult("Scan failed — network error.");
    } finally {
      setScanning(false);
    }
  };

  const runExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/intelligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "export", format: "jsonl" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `capitalos-investors-${new Date().toISOString().slice(0, 10)}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) {
    return (
      <div>
        <PageHeader title="Investor Intelligence" description="Loading live database statistics..." />
        <div className="animate-pulse space-y-[16px]">
          <div className="h-[90px] bg-gray-100 dark:bg-gray-800 rounded-[12px]" />
          <div className="h-[200px] bg-gray-100 dark:bg-gray-800 rounded-[12px]" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <PageHeader title="Investor Intelligence" />
        <Card>
          <CardBody className="text-center py-[40px]">
            <p className="text-[14px] text-red-500 !mb-[12px]">{error}</p>
            <Button variant="outline" onClick={load}>Retry</Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const db = data?.database;
  const storage = data?.storage;
  const usedPct = storage ? Math.min(100, (storage.dbTotalBytes / SUPABASE_BUDGET_BYTES) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Investor Intelligence"
        description="Live database health, provenance, storage and collection status. All numbers are queried from production, not estimated."
        actions={
          <div className="flex gap-[8px]">
            <Button variant="outline" size="sm" onClick={runDuplicateScan} disabled={scanning}>
              <i className={`ri-file-copy-line ${scanning ? "animate-spin" : ""}`} /> {scanning ? "Scanning..." : "Scan Duplicates"}
            </Button>
            <Button variant="outline" size="sm" onClick={runExport} disabled={exporting}>
              <i className={`ri-download-2-line ${exporting ? "animate-spin" : ""}`} /> {exporting ? "Exporting..." : "Export JSONL"}
            </Button>
            <Button variant="ghost" size="sm" onClick={load}><i className="ri-refresh-line" /> Refresh</Button>
          </div>
        }
      />

      {/* Database overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[12px] mb-[20px]">
        <Stat label="Total Investors" value={db ? fmt(db.total) : "—"} />
        <Stat label="Verified (source-backed)" value={db ? fmt(db.verified) : "—"} tone={db && db.verified === 0 ? "text-amber-500" : "text-green-600"} />
        <Stat label="Qualified (fit ≥ 50)" value={db ? fmt(db.qualified) : "—"} />
        <Stat label="High Relevance (fit ≥ 70)" value={db ? fmt(db.highRelevance) : "—"} />
        <Stat label="With Email" value={db ? fmt(db.withEmail) : "—"} tone={db && db.withEmail === 0 ? "text-amber-500" : undefined} />
        <Stat label="Unknown Provenance" value={db ? fmt(db.unknownProvenance) : "—"} tone="text-amber-500" />
        <Stat label="Stale (>90d unverified)" value={db ? fmt(db.stale) : "—"} />
        <Stat label="Duplicates Pending Review" value={db ? fmt(db.duplicateCandidatesOpen) : "—"} tone={db && db.duplicateCandidatesOpen > 0 ? "text-amber-500" : undefined} />
      </div>

      {scanResult && (
        <div className="mb-[16px] p-[12px] bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-[8px] text-[13px] text-blue-700 dark:text-blue-400">
          {scanResult}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px] mb-[20px]">
        {/* Storage */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-[12px]">
              <h3 className="!text-[15px] !font-semibold !mb-0">Supabase Storage</h3>
              <Badge variant={usedPct > 80 ? "danger" : usedPct > 60 ? "warning" : "success"}>
                {storage ? fmtBytes(storage.dbTotalBytes) : "—"} / 500 MB
              </Badge>
            </div>
            <div className="w-full h-[10px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-[8px]">
              <div
                className={`h-full rounded-full ${usedPct > 80 ? "bg-red-500" : usedPct > 60 ? "bg-amber-500" : "bg-green-500"}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="text-[12px] text-gray-400 !mb-[14px]">
              {storage ? `${(100 - usedPct).toFixed(1)}% headroom remaining` : ""}
            </p>
            <div className="space-y-[6px]">
              {storage?.topTables.slice(0, 6).map((t) => (
                <div key={t.table} className="flex items-center justify-between text-[13px]">
                  <span className="text-[#06201b] dark:text-white">{t.table}</span>
                  <span className="text-gray-400">{fmtBytes(t.bytes)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Sources */}
        <Card>
          <CardBody>
            <h3 className="!text-[15px] !font-semibold !mb-[12px]">Data Sources</h3>
            {db && Object.keys(db.sources).length > 0 ? (
              <div className="space-y-[6px]">
                {Object.entries(db.sources).map(([src, n]) => (
                  <div key={src} className="flex items-center justify-between text-[13px]">
                    <span className="text-[#06201b] dark:text-white">{src}</span>
                    <span className="text-gray-400">{fmt(n)} records</span>
                  </div>
                ))}
                <p className="text-[12px] text-gray-400 !mb-0 mt-[10px]">
                  Single-source dependency: 100% of the dataset comes from one source. Diversifying sources is the top data risk reduction.
                </p>
              </div>
            ) : (
              <p className="text-[13px] text-gray-400">No source metadata recorded yet.</p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Collection + processing jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        <Card>
          <CardBody>
            <h3 className="!text-[15px] !font-semibold !mb-[12px]">Collection Jobs (data_acquisition_jobs)</h3>
            {data?.collection.recentJobs.length ? (
              data.collection.recentJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between text-[13px] py-[6px] border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <span>{j.jobType}</span>
                  <Badge variant={j.status === "completed" ? "success" : "warning"}>{j.status}</Badge>
                  <span className="text-gray-400">{fmt(j.found)} found / {fmt(j.deduped)} deduped</span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-gray-400 !mb-0">No collection jobs recorded yet. Ingestion history will appear here.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h3 className="!text-[15px] !font-semibold !mb-[12px]">Background Jobs (background_jobs)</h3>
            {data?.processing.recentJobs.length ? (
              data.processing.recentJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between text-[13px] py-[6px] border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <span>{j.type}</span>
                  <Badge variant={j.status === "completed" ? "success" : j.status === "failed" ? "danger" : "warning"}>{j.status}</Badge>
                  <span className="text-gray-400">{j.progress != null ? `${j.progress}%` : ""}</span>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-gray-400 !mb-0">No background jobs recorded. Long-running ingestion will show progress here.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
