"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

interface EmailStats {
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalBounced: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
}

interface TimelineEntry {
  date: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
}

interface TopEmail {
  id: string;
  investorName: string;
  subject: string;
  status: string;
  opens: number;
  clicks: number;
  sentAt: string;
}

interface AnalyticsData {
  stats: EmailStats;
  timeline: TimelineEntry[];
  deviceBreakdown: Array<{ name: string; count: number }>;
  clientBreakdown: Array<{ name: string; count: number }>;
  topPerforming: TopEmail[];
}

export default function EmailAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/email/analytics")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load analytics");
        setLoading(false);
      });
  }, []);

  const maxTimeline = Math.max(
    1,
    ...(data?.timeline || []).map((t) => t.sent + t.opened + t.clicked + t.replied)
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e19]">
      <PageHeader
        title="Email Analytics"
        subtitle="Track opens, clicks, replies, and delivery performance across all your outreach."
      />

      <div className="max-w-[1200px] mx-auto px-[16px] py-[24px]">
        {loading ? (
          <div className="space-y-[24px]">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[100px] rounded-[12px]" />
              ))}
            </div>
            <Skeleton className="h-[300px] rounded-[12px]" />
          </div>
        ) : error ? (
          <Card className="p-[40px] text-center">
            <p className="text-red-500">{error}</p>
          </Card>
        ) : data ? (
          <div className="space-y-[24px]">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px]">
              <StatCard
                label="Emails Sent"
                value={data.stats.totalSent}
                icon="ri-mail-send-line"
                color="text-blue-500"
              />
              <StatCard
                label="Open Rate"
                value={`${data.stats.openRate}%`}
                subtitle={`${data.stats.totalOpened} opened`}
                icon="ri-mail-open-line"
                color="text-green-500"
              />
              <StatCard
                label="Click Rate"
                value={`${data.stats.clickRate}%`}
                subtitle={`${data.stats.totalClicked} clicked`}
                icon="ri-cursor-line"
                color="text-purple-500"
              />
              <StatCard
                label="Reply Rate"
                value={`${data.stats.replyRate}%`}
                subtitle={`${data.stats.totalReplied} replied`}
                icon="ri-reply-line"
                color="text-lime-500"
              />
            </div>

            {/* Timeline Chart */}
            <Card className="p-[24px]">
              <h3 className="text-[16px] font-semibold mb-[16px]">Send Activity (Last 30 Days)</h3>
              <div className="flex items-end gap-[4px] h-[200px]">
                {data.timeline.map((entry, i) => {
                  const total = entry.sent + entry.opened + entry.clicked + entry.replied;
                  const height = total > 0 ? (total / maxTimeline) * 100 : 0;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-[2px] group relative">
                      <div className="absolute bottom-full mb-[8px] hidden group-hover:block bg-gray-900 text-white text-[11px] rounded-[6px] px-[8px] py-[4px] whitespace-nowrap z-10">
                        {entry.date}: {entry.sent} sent, {entry.opened} opened, {entry.clicked} clicked
                      </div>
                      <div
                        className="w-full rounded-t-[4px] bg-lime-500 transition-all hover:bg-lime-400"
                        style={{ height: `${Math.max(height, total > 0 ? 4 : 0)}%` }}
                        title={`${entry.sent} sent, ${entry.opened} opened, ${entry.clicked} clicked`}
                      />
                      {i % 5 === 0 && (
                        <span className="text-[10px] text-gray-400 mt-[4px]">{entry.date}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-[16px] mt-[12px] text-[11px] text-gray-400">
                <span className="flex items-center gap-[4px]"><span className="w-[8px] h-[8px] rounded-[2px] bg-lime-500 inline-block" /> Sent + Engagement</span>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
              {/* Device Breakdown */}
              <Card className="p-[24px]">
                <h3 className="text-[16px] font-semibold mb-[16px]">Device Breakdown</h3>
                {data.deviceBreakdown.length === 0 ? (
                  <p className="text-[13px] text-gray-400">No tracking data yet. Send emails to see device analytics.</p>
                ) : (
                  <div className="space-y-[12px]">
                    {data.deviceBreakdown.map((device) => {
                      const total = data.deviceBreakdown.reduce((s, d) => s + d.count, 0);
                      const pct = total > 0 ? Math.round((device.count / total) * 100) : 0;
                      return (
                        <div key={device.name}>
                          <div className="flex justify-between text-[13px] mb-[4px]">
                            <span className="capitalize">{device.name}</span>
                            <span className="text-gray-400">{pct}%</span>
                          </div>
                          <div className="h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-lime-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Email Client Breakdown */}
              <Card className="p-[24px]">
                <h3 className="text-[16px] font-semibold mb-[16px]">Email Client Breakdown</h3>
                {data.clientBreakdown.length === 0 ? (
                  <p className="text-[13px] text-gray-400">No tracking data yet. Send emails to see client analytics.</p>
                ) : (
                  <div className="space-y-[12px]">
                    {data.clientBreakdown.map((client) => {
                      const total = data.clientBreakdown.reduce((s, c) => s + c.count, 0);
                      const pct = total > 0 ? Math.round((client.count / total) * 100) : 0;
                      return (
                        <div key={client.name}>
                          <div className="flex justify-between text-[13px] mb-[4px]">
                            <span className="capitalize">{client.name}</span>
                            <span className="text-gray-400">{pct}%</span>
                          </div>
                          <div className="h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Top Performing Emails */}
            <Card className="p-[24px]">
              <h3 className="text-[16px] font-semibold mb-[16px]">Top Performing Emails</h3>
              {data.topPerforming.length === 0 ? (
                <p className="text-[13px] text-gray-400">No emails sent yet. Start your first outreach campaign to see analytics here.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800">
                        <th className="text-left py-[8px] font-medium text-gray-400">Investor</th>
                        <th className="text-left py-[8px] font-medium text-gray-400">Subject</th>
                        <th className="text-center py-[8px] font-medium text-gray-400">Status</th>
                        <th className="text-center py-[8px] font-medium text-gray-400">Opens</th>
                        <th className="text-center py-[8px] font-medium text-gray-400">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topPerforming.map((email) => (
                        <tr key={email.id} className="border-b border-gray-50 dark:border-gray-800/50">
                          <td className="py-[10px] font-medium">{email.investorName}</td>
                          <td className="py-[10px] text-gray-500 max-w-[300px] truncate">{email.subject || "No subject"}</td>
                          <td className="py-[10px] text-center">
                            <Badge variant={email.status === "sent" ? "success" : email.status === "opened" ? "info" : "default"}>
                              {email.status}
                            </Badge>
                          </td>
                          <td className="py-[10px] text-center font-medium">{email.opens}</td>
                          <td className="py-[10px] text-center font-medium">{email.clicks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Bounce Info */}
            {data.stats.totalBounced > 0 && (
              <Card className="p-[24px] border border-red-200 dark:border-red-900">
                <div className="flex items-center gap-[12px]">
                  <div className="w-[40px] h-[40px] rounded-[8px] bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <i className="ri-error-warning-line text-red-500 text-xl"></i>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-red-600">
                      {data.stats.totalBounced} Bounced Emails
                    </h3>
                    <p className="text-[12px] text-gray-400">
                      Bounce rate: {data.stats.bounceRate}%. Check your suppression list to avoid sending to invalid addresses.
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: string;
  color: string;
}) {
  return (
    <Card className="p-[20px]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] text-gray-400 mb-[4px]">{label}</p>
          <p className="text-[24px] font-bold">{value}</p>
          {subtitle && <p className="text-[11px] text-gray-400 mt-[2px]">{subtitle}</p>}
        </div>
        <div className={`w-[36px] h-[36px] rounded-[8px] bg-gray-50 dark:bg-gray-800 flex items-center justify-center`}>
          <i className={`${icon} ${color} text-lg`}></i>
        </div>
      </div>
    </Card>
  );
}
