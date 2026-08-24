"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

/**
 * Real-time Dashboard Component
 * 
 * This component demonstrates how Convex provides live updates
 * without polling. The data automatically refreshes when the
 * underlying Convex database changes.
 * 
 * In production, this would replace the current Supabase-polling
 * dashboard with Convex real-time queries.
 */
export function RealtimeDashboard() {
  // These queries automatically subscribe to changes
  // No polling, no useEffect, no manual refresh
  const metrics = useQuery(api.dashboard.getMetrics);
  const researchJobs = useQuery(api.researchJobs.stats);
  const scrapingJobs = useQuery(api.scrapingJobs.activeJobs);

  if (!metrics || !researchJobs) {
    return <div className="animate-pulse">Loading real-time data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Live Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Total Investors"
          value={metrics.total_investors?.value ?? 0}
          icon="📊"
        />
        <MetricCard
          label="Active Research"
          value={researchJobs.byStatus?.scraping ?? 0}
          icon="🔍"
          pulse
        />
        <MetricCard
          label="Emails Sent Today"
          value={metrics.emails_sent_today?.value ?? 0}
          icon="📧"
        />
        <MetricCard
          label="Scraping Jobs"
          value={scrapingJobs?.total ?? 0}
          icon="⚡"
          pulse={scrapingJobs?.total > 0}
        />
      </div>

      {/* Live Research Progress */}
      {researchJobs.byStatus && (
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold mb-3">Research Pipeline (Live)</h3>
          <div className="space-y-2">
            <ProgressBar label="Queued" value={researchJobs.byStatus.queued ?? 0} color="bg-gray-300" />
            <ProgressBar label="Scraping" value={researchJobs.byStatus.scraping ?? 0} color="bg-blue-500" pulse />
            <ProgressBar label="Enriching" value={researchJobs.byStatus.enriching ?? 0} color="bg-yellow-500" pulse />
            <ProgressBar label="Scoring" value={researchJobs.byStatus.scoring ?? 0} color="bg-purple-500" pulse />
            <ProgressBar label="Completed" value={researchJobs.byStatus.completed ?? 0} color="bg-green-500" />
            <ProgressBar label="Failed" value={researchJobs.byStatus.failed ?? 0} color="bg-red-500" />
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, icon, pulse }: {
  label: string;
  value: number;
  icon: string;
  pulse?: boolean;
}) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        {pulse && <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />}
      </div>
      <div className="text-2xl font-bold mt-2">{value.toLocaleString()}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

function ProgressBar({ label, value, color, pulse }: {
  label: string;
  value: number;
  color: string;
  pulse?: boolean;
}) {
  if (value === 0) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm w-24 text-gray-600">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div
          className={`h-full ${color} ${pulse ? 'animate-pulse' : ''} transition-all duration-500`}
          style={{ width: `${Math.min(100, (value / Math.max(value, 1)) * 100)}%` }}
        />
      </div>
      <span className="text-sm font-medium w-12 text-right">{value}</span>
    </div>
  );
}
