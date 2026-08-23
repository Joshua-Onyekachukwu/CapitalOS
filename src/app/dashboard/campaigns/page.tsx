"use client";

import React, { useState, useEffect, useCallback } from "react";import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

type CampaignStatus = "draft" | "active" | "paused" | "completed";

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  investor_count: number;
  emails_sent: number;
  responses: number;
  created_at: string;
  user_id: string;
  sector?: string;
  stage?: string;
}

const statusConfig: Record<CampaignStatus, { label: string; variant: "success" | "warning" | "info" | "default" }> = {
  draft: { label: "Draft", variant: "default" },
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  completed: { label: "Completed", variant: "info" },
};

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | CampaignStatus>("all");
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { getCampaigns } = await import("@/lib/actions/campaigns");
      const data = await getCampaigns();
      setCampaigns(data);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const filtered = filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter);

  const stats = {
    active: campaigns.filter((c) => c.status === "active").length,
    totalInvestors: campaigns.reduce((sum, c) => sum + c.investor_count, 0),
    totalEmails: campaigns.reduce((sum, c) => sum + c.emails_sent, 0),
  };

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Manage your fundraising campaigns and outreach sequences."
        actions={
          <Button onClick={() => router.push("/dashboard/campaigns/new")}>
            <i className="ri-add-line text-[18px]"></i>
            New Campaign
          </Button>
        }
      />

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[15px] md:gap-[20px] mb-[25px]">
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[20px] flex-none">
              <i className="ri-megaphone-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Active Campaigns</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stats.active}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-[20px] flex-none">
              <i className="ri-team-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Total Investors</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stats.totalInvestors}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 text-[20px] flex-none">
              <i className="ri-mail-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Emails Generated</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stats.totalEmails}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-[8px] mb-[20px] overflow-x-auto">
        {(["all", "active", "draft", "paused", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-[14px] py-[6px] rounded-full text-[13px] font-medium transition-all whitespace-nowrap ${
              filter === f
                ? "bg-[#06201b] text-white dark:bg-lime-500 dark:text-black"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Campaign List */}
      {loading ? (
        <div className="space-y-[15px]">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody>
                <div className="animate-pulse flex items-center gap-[16px]">
                  <div className="w-[48px] h-[48px] rounded-[12px] bg-gray-100 dark:bg-gray-800"></div>
                  <div className="flex-1">
                    <div className="h-[16px] bg-gray-100 dark:bg-gray-800 rounded w-[200px] mb-[8px]"></div>
                    <div className="h-[12px] bg-gray-100 dark:bg-gray-800 rounded w-[300px]"></div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<i className="ri-megaphone-line"></i>}
              title="No campaigns yet"
              description="Create your first fundraising campaign to start tracking investors and outreach."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[15px]">
          {filtered.map((campaign) => {
            const config = statusConfig[campaign.status];
            const responseRate = campaign.emails_sent > 0 ? Math.round((campaign.responses / campaign.emails_sent) * 100) : 0;

            return (
              <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                <CardBody>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-[16px]">
                    {/* Campaign Icon */}
                    <div className="w-[48px] h-[48px] rounded-[12px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[22px] flex-none">
                      <i className="ri-megaphone-line"></i>
                    </div>

                    {/* Campaign Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[8px] mb-[4px]">
                        <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">
                          {campaign.name}
                        </h3>
                        <Badge variant={config.variant} size="sm">{config.label}</Badge>
                      </div>
                      <p className="text-[13px] text-gray-400 !mb-0 truncate">{campaign.description}</p>
                      <div className="flex items-center gap-[12px] mt-[8px] text-[12px] text-gray-400">
                        {campaign.sector && <span><i className="ri-building-line mr-[4px]"></i>{campaign.sector}</span>}
                        {campaign.stage && <span><i className="ri-flag-line mr-[4px]"></i>{campaign.stage}</span>}
                        <span><i className="ri-calendar-line mr-[4px]"></i>{new Date(campaign.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Campaign Metrics */}
                    <div className="flex items-center gap-[20px] sm:flex-shrink-0">
                      <div className="text-center">
                        <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{campaign.investor_count}</p>
                        <p className="text-[11px] text-gray-400 !mb-0">Investors</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{campaign.emails_sent}</p>
                        <p className="text-[11px] text-gray-400 !mb-0">Sent</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[18px] font-bold text-lime-600 !mb-0">{responseRate}%</p>
                        <p className="text-[11px] text-gray-400 !mb-0">Response</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-[8px] sm:flex-shrink-0">
                      <Link href={`/dashboard/campaigns/${campaign.id}`}>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async (e) => {
                          e.preventDefault();
                          if (confirm("Delete this campaign?")) {
                            setDeleting(campaign.id);
                            const { deleteCampaign } = await import("@/lib/actions/campaigns");
                            await deleteCampaign(campaign.id);
                            setCampaigns((prev) => prev.filter((c) => c.id !== campaign.id));
                            setDeleting(null);
                          }
                        }}
                        loading={deleting === campaign.id}
                      >
                        <i className="ri-delete-bin-line text-[14px]"></i>
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
