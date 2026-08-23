"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from "recharts";

const COLORS = ["#84cc16", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

interface EmailRecord {
  id: string;
  investor_id: string;
  subject: string;
  status: string;
  direction: string;
  sent_at: string | null;
  created_at: string;
  ai_generated: boolean;
}

interface CampaignStats {
  totalEmails: number;
  sent: number;
  drafted: number;
  replied: number;
  bounced: number;
  opened: number;
  responseRate: number;
  avgSendTime: string;
  emailsByDay: Array<{ date: string; sent: number; replied: number }>;
  statusBreakdown: Array<{ name: string; value: number; color: string }>;
  toneBreakdown: Array<{ name: string; count: number }>;
  topInvestors: Array<{ name: string; firm: string; status: string; fitScore: number }>;
}

export default function CampaignMetricsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all email messages
      const { data: emails } = await supabase
        .from("email_messages")
        .select("id, investor_id, subject, status, direction, sent_at, created_at, ai_generated")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const allEmails = (emails || []) as EmailRecord[];
      const outbound = allEmails.filter((e) => e.direction === "outbound");

      // Compute stats
      const sent = outbound.filter((e) => e.status === "sent" || e.status === "delivered").length;
      const drafted = outbound.filter((e) => e.status === "draft").length;
      const replied = allEmails.filter((e) => e.direction === "inbound").length;
      const bounced = outbound.filter((e) => e.status === "bounced").length;
      const opened = outbound.filter((e) => e.status === "opened").length;

      // Emails by day (last 14 days)
      const now = new Date();
      const emailsByDay: Array<{ date: string; sent: number; replied: number }> = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        emailsByDay.push({
          date: dayLabel,
          sent: outbound.filter((e) => e.sent_at?.startsWith(dateStr) || e.created_at.startsWith(dateStr)).length,
          replied: allEmails.filter((e) => e.direction === "inbound" && e.created_at.startsWith(dateStr)).length,
        });
      }

      // Status breakdown
      const statusBreakdown = [
        { name: "Sent", value: sent, color: "#3b82f6" },
        { name: "Drafted", value: drafted, color: "#f59e0b" },
        { name: "Replied", value: replied, color: "#84cc16" },
        { name: "Bounced", value: bounced, color: "#ef4444" },
      ].filter((s) => s.value > 0);

      // Fetch unique investor names for top investors
      const investorIds = [...new Set(outbound.map((e) => e.investor_id).filter(Boolean))];
      let topInvestors: CampaignStats["topInvestors"] = [];
      if (investorIds.length > 0) {
        const { data: invs } = await supabase
          .from("investors")
          .select("id, first_name, last_name, fit_score")
          .in("id", investorIds.slice(0, 20));
        const invMap = new Map((invs || []).map((i: any) => [i.id, i]));
        topInvestors = outbound.slice(0, 10).map((e) => {
          const inv = invMap.get(e.investor_id);
          return {
            name: inv ? `${inv.first_name} ${inv.last_name}` : "Unknown",
            firm: "",
            status: e.status,
            fitScore: inv?.fit_score || 0,
          };
        });
      }

      setStats({
        totalEmails: allEmails.length,
        sent,
        drafted,
        replied,
        bounced,
        opened,
        responseRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
        avgSendTime: "—",
        emailsByDay,
        statusBreakdown,
        toneBreakdown: [],
        topInvestors,
      });
    } catch {
      // Stats may not be available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Outreach Metrics" description="Loading..." />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[80px] bg-gray-100 dark:bg-gray-800 rounded-[12px] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const s = stats || {
    totalEmails: 0, sent: 0, drafted: 0, replied: 0, bounced: 0, opened: 0,
    responseRate: 0, avgSendTime: "—", emailsByDay: [], statusBreakdown: [], toneBreakdown: [], topInvestors: [],
  };

  return (
    <div>
      <PageHeader
        title="Outreach Metrics"
        description="Track email performance, response rates, and campaign health."
        actions={
          <Button variant="outline" onClick={() => router.push("/dashboard/outreach")}>
            <i className="ri-arrow-left-line text-[16px] mr-[6px]"></i>
            Back to Outreach
          </Button>
        }
      />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[15px] mb-[20px]">
        {[
          { label: "Total Emails", value: s.totalEmails, icon: "ri-mail-line", color: "bg-blue-50 text-blue-600" },
          { label: "Sent", value: s.sent, icon: "ri-send-plane-line", color: "bg-lime-100 text-lime-600" },
          { label: "Replies", value: s.replied, icon: "ri-reply-line", color: "bg-green-50 text-green-600" },
          { label: "Response Rate", value: `${s.responseRate}%`, icon: "ri-percent-line", color: "bg-purple-50 text-purple-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[12px] p-[16px]">
              <div className={`w-[40px] h-[40px] rounded-[10px] ${stat.color} flex items-center justify-center text-[18px] flex-none`}>
                <i className={stat.icon}></i>
              </div>
              <div>
                <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
                <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[20px]">
        {/* Email Activity Over Time */}
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              <i className="ri-line-chart-line text-lime-500 mr-[6px]"></i>
              Email Activity (14 Days)
            </h3>
            {s.emailsByDay.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center !mb-0 py-[30px]">No email data yet.</p>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={s.emailsByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} />
                    <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px", fontSize: "13px" }} />
                    <Area type="monotone" dataKey="sent" stroke="#84cc16" fill="#84cc16" fillOpacity={0.2} name="Sent" />
                    <Area type="monotone" dataKey="replied" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Replied" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardBody>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
              <i className="ri-pie-chart-line text-lime-500 mr-[6px]"></i>
              Email Status Breakdown
            </h3>
            {s.statusBreakdown.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center !mb-0 py-[30px]">No data to display.</p>
            ) : (
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={s.statusBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                      {s.statusBreakdown.map((entry, index) => (
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
      </div>

      {/* Outreach Funnel */}
      <Card className="mb-[20px]">
        <CardBody>
          <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
            <i className="ri-filter-3-line text-lime-500 mr-[6px]"></i>
            Outreach Funnel
          </h3>
          <div className="space-y-[12px]">
            {[
              { label: "Total Emails Generated", value: s.totalEmails, pct: 100, color: "bg-blue-500" },
              { label: "Emails Sent", value: s.sent, pct: s.totalEmails > 0 ? Math.round((s.sent / s.totalEmails) * 100) : 0, color: "bg-lime-500" },
              { label: "Opened", value: s.opened, pct: s.sent > 0 ? Math.round((s.opened / s.sent) * 100) : 0, color: "bg-cyan-500" },
              { label: "Replied", value: s.replied, pct: s.sent > 0 ? Math.round((s.replied / s.sent) * 100) : 0, color: "bg-green-500" },
            ].map((step) => (
              <div key={step.label} className="flex items-center gap-[16px]">
                <div className="w-[180px] flex-none">
                  <p className="text-[13px] text-gray-500 !mb-0">{step.label}</p>
                </div>
                <div className="flex-1">
                  <div className="w-full h-[24px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${step.color} rounded-full transition-all duration-700 flex items-center justify-end pr-[8px]`}
                      style={{ width: `${Math.max(step.pct, 2)}%` }}
                    >
                      {step.pct > 15 && (
                        <span className="text-[11px] font-bold text-white">{step.pct}%</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="w-[60px] text-right flex-none">
                  <p className="text-[14px] font-bold text-[#06201b] dark:text-white !mb-0">{step.value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Recent Activity Table */}
      <Card>
        <CardHeader>
          <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-0">
            <i className="ri-history-line text-lime-500 mr-[6px]"></i>
            Recent Email Activity
          </h3>
        </CardHeader>
        <CardBody className="p-0">
          {s.topInvestors.length === 0 ? (
            <div className="p-[40px] text-center">
              <p className="text-[14px] text-gray-400 !mb-0">No email activity yet. Go to Outreach to start sending.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-[20px] py-[12px] text-[12px] font-medium text-gray-400 uppercase">Investor</th>
                    <th className="text-left px-[20px] py-[12px] text-[12px] font-medium text-gray-400 uppercase">Fit Score</th>
                    <th className="text-left px-[20px] py-[12px] text-[12px] font-medium text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.topInvestors.map((inv, i) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                      <td className="px-[20px] py-[12px] text-[14px] font-medium text-[#06201b] dark:text-white">{inv.name}</td>
                      <td className="px-[20px] py-[12px]">
                        <span className={`text-[13px] font-bold ${
                          inv.fitScore >= 80 ? "text-green-600" : inv.fitScore >= 60 ? "text-amber-600" : "text-gray-400"
                        }`}>{inv.fitScore}%</span>
                      </td>
                      <td className="px-[20px] py-[12px]">
                        <Badge variant={
                          inv.status === "sent" ? "info" : inv.status === "replied" ? "success" : "default"
                        } size="sm">{inv.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
