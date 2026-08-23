"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from "recharts";

const CHART_COLORS = ["#84cc16", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];

interface DataHealth {
  totalInvestors: number;
  withEmail: number;
  withLinkedin: number;
  verified: number;
  highQuality: number;
  highFit: number;
  pendingDuplicates: number;
  pendingRawRecords: number;
}

interface IngestionStats {
  totalJobs: number;
  completedJobs: number;
  runningJobs: number;
  failedJobs: number;
  totalRecordsIngested: number;
  totalRecordsProcessed: number;
  totalRecordsMatched: number;
  totalRecordsNew: number;
  totalRecordsDuplicate: number;
  totalRecordsError: number;
  recentJobs: Array<{
    id: string;
    job_type: string;
    status: string;
    found_count: number;
    processed_count: number;
    created_at: string;
    filters: Record<string, unknown>;
  }>;
}

interface SourceAnalytics {
  topSources: Array<{ source: string; count: number }>;
  topSourceProviders: Array<{ provider: string; count: number }>;
  recentChanges: Array<{
    id: string;
    investor_id: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    source_type: string;
    change_type: string;
    created_at: string;
  }>;
}

interface DuplicateQueue {
  pending: number;
  autoResolved: number;
  approved: number;
  rejected: number;
  recentPending: Array<{
    id: string;
    confidence: number;
    investor_a_name: string;
    investor_a_email: string | null;
    investor_b_name: string;
    investor_b_email: string | null;
    firm_a_name: string | null;
    firm_b_name: string | null;
    created_at: string;
  }>;
}

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export default function AdminPage() {
  const [health, setHealth] = useState<DataHealth | null>(null);
  const [ingestion, setIngestion] = useState<IngestionStats | null>(null);
  const [sources, setSources] = useState<SourceAnalytics | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateQueue | null>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningDedup, setRunningDedup] = useState(false);
  const [runningScore, setRunningScore] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    totalRows: number;
    parsed: number;
    normalized: number;
    duplicates: number;
    inserted: number;
    failed: number;
    errors: string[];
  } | null>(null);
  const [importProgress, setImportProgress] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Parallel queries
      const [
        healthResult,
        jobsResult,
        rawRecordsResult,
        sourcesResult,
        duplicatesPendingResult,
        duplicatesAutoResult,
        duplicatesApprovedResult,
        duplicatesRejectedResult,
        recentPendingResult,
        changesResult,
        auditResult,
      ] = await Promise.all([
        // Data health view
        supabase.from("v_data_health").select("*").single(),
        // Acquisition jobs
        supabase.from("data_acquisition_jobs").select("*").order("created_at", { ascending: false }).limit(20),
        // Raw records aggregation
        supabase.from("raw_records").select("id, status, source_provider, created_at"),
        // Data sources
        supabase.from("investor_data_sources").select("field_name, source_type, source_provider, created_at").order("created_at", { ascending: false }).limit(1000),
        // Duplicate candidates
        supabase.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "auto_resolved"),
        supabase.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "approved"),
        supabase.from("duplicate_candidates").select("id", { count: "exact", head: true }).eq("status", "rejected"),
        // Recent pending duplicates with names
        supabase.from("v_pending_duplicates").select("*").limit(10),
        // Recent changes
        supabase.from("data_change_log").select("*").order("created_at", { ascending: false }).limit(20),
        // Audit log
        supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(20),
      ]);

      // Process health
      if (healthResult.data) {
        setHealth(healthResult.data);
      }

      // Process jobs
      const jobs = jobsResult.data || [];
      const rawRecords = rawRecordsResult.data || [];

      const statusCounts: Record<string, number> = {};
      rawRecords.forEach((r) => {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      });

      setIngestion({
        totalJobs: jobs.length,
        completedJobs: jobs.filter((j) => j.status === "completed").length,
        runningJobs: jobs.filter((j) => j.status === "running").length,
        failedJobs: jobs.filter((j) => j.status === "failed").length,
        totalRecordsIngested: rawRecords.length,
        totalRecordsProcessed: rawRecords.filter((r) => r.status !== "pending").length,
        totalRecordsMatched: rawRecords.filter((r) => r.status === "matched").length,
        totalRecordsNew: rawRecords.filter((r) => r.status === "new").length,
        totalRecordsDuplicate: rawRecords.filter((r) => r.status === "duplicate").length,
        totalRecordsError: rawRecords.filter((r) => r.status === "error").length,
        recentJobs: jobs.slice(0, 10),
      });

      // Process sources
      const sources = sourcesResult.data || [];
      const sourceTypeMap: Record<string, number> = {};
      const sourceProviderMap: Record<string, number> = {};
      sources.forEach((s) => {
        sourceTypeMap[s.source_type] = (sourceTypeMap[s.source_type] || 0) + 1;
        if (s.source_provider) {
          sourceProviderMap[s.source_provider] = (sourceProviderMap[s.source_provider] || 0) + 1;
        }
      });

      setSources({
        topSources: Object.entries(sourceTypeMap)
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count),
        topSourceProviders: Object.entries(sourceProviderMap)
          .map(([provider, count]) => ({ provider, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8),
        recentChanges: (changesResult.data || []) as SourceAnalytics["recentChanges"],
      });

      // Process duplicates
      setDuplicates({
        pending: duplicatesPendingResult.count || 0,
        autoResolved: duplicatesAutoResult.count || 0,
        approved: duplicatesApprovedResult.count || 0,
        rejected: duplicatesRejectedResult.count || 0,
        recentPending: (recentPendingResult.data || []) as DuplicateQueue["recentPending"],
      });

      // Process audit log
      setAuditLog((auditResult.data || []) as AuditEntry[]);
    } catch (err) {
      console.error("Failed to load admin data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleRunDedup = async () => {
    setRunningDedup(true);
    try {
      const { detectDuplicates } = await import("@/lib/services/investor/matching");
      const result = await detectDuplicates(500);
      alert(`Dedup complete: ${result.created} new duplicate candidates found`);
      loadAll();
    } catch (err) {
      alert(`Dedup failed: ${String(err)}`);
    } finally {
      setRunningDedup(false);
    }
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      alert("Please select a CSV file");
      return;
    }
    setImporting(true);
    setImportResult(null);
    setImportProgress("Reading file...");
    try {
      const csvContent = await file.text();
      setImportProgress(`Importing ${csvContent.split("\n").length - 1} rows...`);
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent, source: "csv_import" }),
      });
      const result = await response.json();
      if (response.ok) {
        setImportResult(result);
        setImportProgress("");
        loadAll();
      } else {
        setImportProgress("");
        alert(`Import failed: ${result.error}`);
      }
    } catch (err) {
      setImportProgress("");
      alert(`Import failed: ${String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  const handleApolloImport = async () => {
    setImporting(true);
    setImportResult(null);
    setImportProgress("Running Apollo CSV import script...");
    try {
      // Read the Apollo CSV from the test-data folder
      const response = await fetch("/api/admin/import-apollo");
      const result = await response.json();
      if (response.ok) {
        setImportResult(result);
        setImportProgress("");
        loadAll();
      } else {
        setImportProgress("");
        alert(`Apollo import failed: ${result.error}`);
      }
    } catch (err) {
      setImportProgress("");
      alert(`Apollo import failed: ${String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  const handleRunScore = async () => {
    setRunningScore(true);
    try {
      const { getOrCreateCompanyProfile } = await import("@/lib/actions/company");
      const profile = await getOrCreateCompanyProfile();
      if (!profile) {
        alert("No company profile found. Complete onboarding first.");
        return;
      }
      const response = await fetch("/api/investors/fit-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_score" }),
      });
      const data = await response.json();
      if (data.success) {
        alert(`Scoring complete: ${data.scored} investors scored, ${data.ready} ready for outreach`);
      } else {
        alert(`Scoring failed: ${data.error}`);
      }
      loadAll();
    } catch (err) {
      alert(`Scoring failed: ${String(err)}`);
    } finally {
      setRunningScore(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Data Health" description="Monitor data quality, ingestion, and system health." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[20px]">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="animate-pulse h-[80px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
          ))}
        </div>
      </div>
    );
  }

  const h = health || { totalInvestors: 0, withEmail: 0, withLinkedin: 0, verified: 0, highQuality: 0, highFit: 0, pendingDuplicates: 0, pendingRawRecords: 0 };
  const ing = ingestion || { totalJobs: 0, completedJobs: 0, runningJobs: 0, failedJobs: 0, totalRecordsIngested: 0, totalRecordsProcessed: 0, totalRecordsMatched: 0, totalRecordsNew: 0, totalRecordsDuplicate: 0, totalRecordsError: 0, recentJobs: [] };
  const dup = duplicates || { pending: 0, autoResolved: 0, approved: 0, rejected: 0, recentPending: [] };

  // Chart data
  const recordStatusData = [
    { name: "Matched", value: ing.totalRecordsMatched, color: "#84cc16" },
    { name: "New", value: ing.totalRecordsNew, color: "#3b82f6" },
    { name: "Duplicate", value: ing.totalRecordsDuplicate, color: "#f59e0b" },
    { name: "Error", value: ing.totalRecordsError, color: "#ef4444" },
    { name: "Pending", value: h.pendingRawRecords, color: "#9ca3af" },
  ].filter((d) => d.value > 0);

  const qualityData = [
    { name: "With Email", value: h.withEmail, color: "#84cc16" },
    { name: "With LinkedIn", value: h.withLinkedin, color: "#3b82f6" },
    { name: "Verified", value: h.verified, color: "#a855f7" },
    { name: "High Quality", value: h.highQuality, color: "#06b6d4" },
    { name: "High Fit", value: h.highFit, color: "#f59e0b" },
  ];

  const duplicateQueueData = [
    { name: "Pending", value: dup.pending, color: "#f59e0b" },
    { name: "Auto-Resolved", value: dup.autoResolved, color: "#84cc16" },
    { name: "Approved", value: dup.approved, color: "#3b82f6" },
    { name: "Rejected", value: dup.rejected, color: "#ef4444" },
  ].filter((d) => d.value > 0);

  // Jobs by type
  const jobTypeMap: Record<string, { total: number; completed: number }> = {};
  ing.recentJobs.forEach((j) => {
    if (!jobTypeMap[j.job_type]) jobTypeMap[j.job_type] = { total: 0, completed: 0 };
    jobTypeMap[j.job_type].total++;
    if (j.status === "completed") jobTypeMap[j.job_type].completed++;
  });
  const jobTypeData = Object.entries(jobTypeMap).map(([type, counts]) => ({
    type: type.replace(/_/g, " "),
    total: counts.total,
    completed: counts.completed,
  }));

  return (
    <div>
      <PageHeader
        title="Data Health"
        description="Monitor data quality, ingestion pipeline, and system health."
        actions={
          <div className="flex items-center gap-[10px]">
            <Button variant="outline" onClick={loadAll}>
              <i className="ri-refresh-line text-[16px]"></i>
              Refresh
            </Button>
            <Button onClick={handleRunDedup} loading={runningDedup} variant="outline">
              <i className="ri-git-merge-line text-[16px]"></i>
              Run Dedup
            </Button>
            <Button onClick={handleRunScore} loading={runningScore}>
              <i className="ri-sparkling-2-line text-[16px]"></i>
              Run Fit Scoring
            </Button>
          </div>
        }
      />

      {/* Data Import Section */}
      <Card className="mb-[20px]">
        <CardBody>
          <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
            <i className="ri-upload-2-line mr-[6px]"></i>
            Data Import
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
            {/* CSV Upload */}
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[12px] p-[20px] text-center hover:border-lime-400 transition-colors">
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
                id="csv-upload"
                disabled={importing}
              />
              <label htmlFor="csv-upload" className="cursor-pointer">
                <div className="w-[48px] h-[48px] rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center mx-auto mb-[12px]">
                  <i className="ri-file-upload-line text-[22px] text-lime-600"></i>
                </div>
                <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
                  {importing ? "Importing..." : "Upload CSV File"}
                </p>
                <p className="text-[12px] text-gray-400 !mb-0">
                  Drag & drop or click to select. Supports Apollo, LinkedIn, and generic CSV formats.
                </p>
              </label>
              {importProgress && (
                <div className="mt-[12px]">
                  <div className="flex items-center gap-[8px] justify-center">
                    <div className="w-[16px] h-[16px] border-2 border-lime-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[12px] text-lime-600 font-medium">{importProgress}</span>
                  </div>
                </div>
              )}
            </div>
            {/* Apollo Import */}
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[12px] p-[20px] text-center hover:border-blue-400 transition-colors">
              <div className="w-[48px] h-[48px] rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-[12px]">
                <i className="ri-database-2-line text-[22px] text-blue-600"></i>
              </div>
              <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
                Apollo Bulk Import
              </p>
              <p className="text-[12px] text-gray-400 !mb-[12px]">
                Import the bundled Apollo investor dataset (100 records) through the full pipeline.
              </p>
              <Button onClick={handleApolloImport} loading={importing} variant="outline" size="sm">
                <i className="ri-download-2-line text-[14px]"></i>
                Run Apollo Import
              </Button>
            </div>
          </div>
          {/* Import Results */}
          {importResult && (
            <div className="mt-[16px] p-[16px] bg-gray-50 dark:bg-gray-800/50 rounded-[12px]">
              <h4 className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[12px]">
                <i className="ri-check-double-line text-green-500 mr-[6px]"></i>
                Import Complete
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-[12px]">
                {[
                  { label: "Total Rows", value: importResult.totalRows, color: "text-gray-600" },
                  { label: "Parsed", value: importResult.parsed, color: "text-blue-600" },
                  { label: "Inserted", value: importResult.inserted, color: "text-green-600" },
                  { label: "Duplicates", value: importResult.duplicates, color: "text-amber-600" },
                  { label: "Failed", value: importResult.failed, color: "text-red-600" },
                  { label: "Errors", value: importResult.errors.length, color: "text-red-500" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className={`text-[20px] font-bold ${stat.color} !mb-0`}>{stat.value.toLocaleString()}</p>
                    <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
                  </div>
                ))}
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-[12px]">
                  <p className="text-[12px] text-red-500 font-medium !mb-[4px]">Errors:</p>
                  <div className="max-h-[100px] overflow-y-auto text-[11px] text-red-400 font-mono">
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <p key={i} className="!mb-[2px]">• {err}</p>
                    ))}
                    {importResult.errors.length > 10 && (
                      <p className="!mb-0">... and {importResult.errors.length - 10} more</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Primary Health Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[20px]">
        {[
          { label: "Total Investors", value: h.totalInvestors.toLocaleString(), icon: "ri-team-line", color: "bg-lime-100 dark:bg-lime-900/20 text-lime-600" },
          { label: "With Email", value: h.withEmail.toLocaleString(), icon: "ri-mail-line", color: "bg-green-50 dark:bg-green-900/20 text-green-600" },
          { label: "Verified", value: h.verified.toLocaleString(), icon: "ri-shield-check-line", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
          { label: "High Quality (80+)", value: h.highQuality.toLocaleString(), icon: "ri-star-line", color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="p-[16px]">
              <div className="flex items-center gap-[10px]">
                <div className={`w-[40px] h-[40px] rounded-[10px] ${stat.color} flex items-center justify-center text-[18px] flex-none`}>
                  <i className={stat.icon}></i>
                </div>
                <div>
                  <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Ingestion & Queue Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[20px]">
        {[
          { label: "Records Ingested", value: ing.totalRecordsIngested.toLocaleString(), icon: "ri-database-2-line", color: "text-blue-600" },
          { label: "Pending Raw Records", value: h.pendingRawRecords.toLocaleString(), icon: "ri-inbox-line", color: "text-amber-600" },
          { label: "Pending Duplicates", value: dup.pending.toLocaleString(), icon: "ri-file-copy-line", color: "text-orange-600" },
          { label: "Failed Jobs", value: ing.failedJobs.toLocaleString(), icon: "ri-error-warning-line", color: "text-red-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="p-[16px] text-center">
              <i className={`${stat.icon} ${stat.color} text-[20px] mb-[6px] block`}></i>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
              <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Charts Row 1: Record Status + Data Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[20px]">
        {/* Record Processing Status */}
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Record Processing Status
            </h3>
            {recordStatusData.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center !mb-0 py-[30px]">No raw records processed yet.</p>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={recordStatusData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {recordStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Data Quality Breakdown */}
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Data Quality Breakdown
            </h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={qualityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                  <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Investors">
                    {qualityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Charts Row 2: Duplicate Queue + Jobs by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[20px]">
        {/* Duplicate Queue */}
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Duplicate Queue
            </h3>
            {duplicateQueueData.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center !mb-0 py-[30px]">No duplicate candidates.</p>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={duplicateQueueData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {duplicateQueueData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Jobs by Type */}
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              Acquisition Jobs by Type
            </h3>
            {jobTypeData.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center !mb-0 py-[30px]">No jobs recorded yet.</p>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={jobTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} />
                    <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total" />
                    <Bar dataKey="completed" fill="#84cc16" radius={[4, 4, 0, 0]} name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Data Quality Progress Bars */}
      <Card className="mb-[20px]">
        <CardBody>
          <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
            Data Coverage
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            {[
              { label: "Email Coverage", value: h.withEmail, total: h.totalInvestors, color: "bg-green-500" },
              { label: "LinkedIn Coverage", value: h.withLinkedin, total: h.totalInvestors, color: "bg-blue-500" },
              { label: "Verification Rate", value: h.verified, total: h.totalInvestors, color: "bg-purple-500" },
              { label: "High Quality Rate", value: h.highQuality, total: h.totalInvestors, color: "bg-cyan-500" },
              { label: "High Fit Rate", value: h.highFit, total: h.totalInvestors, color: "bg-lime-500" },
              { label: "Records Processed", value: ing.totalRecordsProcessed, total: ing.totalRecordsIngested || 1, color: "bg-amber-500" },
            ].map((item) => {
              const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-[6px]">
                    <span className="text-[13px] text-gray-500">{item.label}</span>
                    <span className="text-[12px] text-gray-400">
                      {item.value.toLocaleString()} / {item.total.toLocaleString()} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-[8px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Tables Row: Recent Jobs + Pending Duplicates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[20px]">
        {/* Recent Jobs */}
        <Card>
          <CardHeader>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-0">
              Recent Acquisition Jobs
            </h3>
          </CardHeader>
          <CardBody className="p-0">
            {ing.recentJobs.length === 0 ? (
              <div className="p-[30px] text-center">
                <p className="text-[13px] text-gray-400 !mb-0">No jobs yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left px-[16px] py-[10px] text-[11px] font-semibold text-gray-400 uppercase">Type</th>
                      <th className="text-left px-[16px] py-[10px] text-[11px] font-semibold text-gray-400 uppercase">Status</th>
                      <th className="text-left px-[16px] py-[10px] text-[11px] font-semibold text-gray-400 uppercase">Found</th>
                      <th className="text-left px-[16px] py-[10px] text-[11px] font-semibold text-gray-400 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ing.recentJobs.map((job) => (
                      <tr key={job.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                        <td className="px-[16px] py-[10px] text-[13px] text-gray-500 capitalize">{job.job_type.replace(/_/g, " ")}</td>
                        <td className="px-[16px] py-[10px]">
                          <Badge variant={job.status === "completed" ? "success" : job.status === "running" ? "info" : job.status === "failed" ? "danger" : "default"} size="sm">
                            {job.status}
                          </Badge>
                        </td>
                        <td className="px-[16px] py-[10px] text-[13px] font-medium text-[#06201b] dark:text-white">{(job.found_count || 0).toLocaleString()}</td>
                        <td className="px-[16px] py-[10px] text-[12px] text-gray-400">{new Date(job.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Pending Duplicates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-0">
                Pending Duplicates
              </h3>
              {dup.pending > 0 && (
                <Badge variant="warning">{dup.pending} pending</Badge>
              )}
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {dup.recentPending.length === 0 ? (
              <div className="p-[30px] text-center">
                <div className="w-[40px] h-[40px] rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600 text-[18px] mx-auto mb-[10px]">
                  <i className="ri-check-line"></i>
                </div>
                <p className="text-[13px] text-gray-400 !mb-0">No pending duplicates. Database is clean.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[350px] overflow-y-auto">
                {dup.recentPending.map((dup_item) => (
                  <div key={dup_item.id} className="px-[16px] py-[12px]">
                    <div className="flex items-center justify-between mb-[4px]">
                      <div className="flex items-center gap-[6px]">
                        <span className="text-[13px] font-medium text-[#06201b] dark:text-white">{dup_item.investor_a_name}</span>
                        <i className="ri-links-line text-gray-300 text-[14px]"></i>
                        <span className="text-[13px] font-medium text-[#06201b] dark:text-white">{dup_item.investor_b_name}</span>
                      </div>
                      <span className={`text-[12px] font-bold ${dup_item.confidence >= 0.9 ? "text-red-600" : dup_item.confidence >= 0.7 ? "text-amber-600" : "text-gray-400"}`}>
                        {Math.round(dup_item.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-[8px] text-[11px] text-gray-400">
                      {dup_item.investor_a_email && <span>{dup_item.investor_a_email}</span>}
                      {dup_item.firm_a_name && <span>• {dup_item.firm_a_name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent Changes + Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
        {/* Recent Data Changes */}
        <Card>
          <CardHeader>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-0">
              Recent Data Changes
            </h3>
          </CardHeader>
          <CardBody className="p-0">
            {sources?.recentChanges.length === 0 ? (
              <div className="p-[30px] text-center">
                <p className="text-[13px] text-gray-400 !mb-0">No changes logged yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[350px] overflow-y-auto">
                {sources?.recentChanges.map((change) => (
                  <div key={change.id} className="px-[16px] py-[10px]">
                    <div className="flex items-center gap-[8px] mb-[2px]">
                      <Badge variant={change.change_type === "create" ? "success" : "info"} size="sm">{change.change_type}</Badge>
                      <span className="text-[12px] font-medium text-[#06201b] dark:text-white">{change.field_name.replace(/_/g, " ")}</span>
                    </div>
                    <div className="flex items-center gap-[6px] text-[11px] text-gray-400">
                      {change.old_value && <span className="line-through">{change.old_value.slice(0, 30)}</span>}
                      {change.old_value && change.new_value && <i className="ri-arrow-right-line"></i>}
                      {change.new_value && <span className="text-gray-600 dark:text-gray-300">{change.new_value.slice(0, 30)}</span>}
                    </div>
                    <p className="text-[10px] text-gray-300 dark:text-gray-600 !mb-0 mt-[2px]">
                      {change.source_type} • {new Date(change.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Audit Log */}
        <Card>
          <CardHeader>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-0">
              Audit Log
            </h3>
          </CardHeader>
          <CardBody className="p-0">
            {auditLog.length === 0 ? (
              <div className="p-[30px] text-center">
                <p className="text-[13px] text-gray-400 !mb-0">No audit entries yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[350px] overflow-y-auto">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="px-[16px] py-[10px]">
                    <div className="flex items-center gap-[8px]">
                      <Badge variant="default" size="sm">{entry.action}</Badge>
                      {entry.entity_type && <span className="text-[12px] text-gray-500">{entry.entity_type}</span>}
                    </div>
                    <p className="text-[10px] text-gray-300 dark:text-gray-600 !mb-0 mt-[4px]">
                      {new Date(entry.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
