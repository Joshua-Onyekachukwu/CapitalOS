"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { SearchFilterBar, FilterConfig } from "@/components/Dashboard/SearchFilterBar";

// ── Types ──
type CampaignStatus = "draft" | "active" | "paused" | "completed" | "failed";

interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  investor_count: number;
  emails_sent: number;
  responses: number;
  credits_used: number;
  created_at: string;
  completed_at: string | null;
  user_id: string;
  sector: string | null;
  stage: string | null;
  error_message: string | null;
}

// ── Filter configs ──
const STATUS_OPTIONS = [
  { label: "Active", value: "running" },
  { label: "Draft / Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Paused", value: "paused" },
  { label: "Failed", value: "failed" },
];

const SECTOR_OPTIONS = [
  { label: "AI / ML", value: "ai" },
  { label: "SaaS", value: "saas" },
  { label: "Fintech", value: "fintech" },
  { label: "HealthTech", value: "healthtech" },
  { label: "DevTools", value: "devtools" },
  { label: "Web3", value: "web3" },
  { label: "Consumer", value: "consumer" },
  { label: "Enterprise", value: "enterprise" },
];

const STAGE_OPTIONS = [
  { label: "Pre-Seed", value: "pre_seed" },
  { label: "Seed", value: "seed" },
  { label: "Series A", value: "series_a" },
  { label: "Series B", value: "series_b" },
  { label: "Series C+", value: "series_c" },
  { label: "Growth", value: "growth" },
];

const SORT_OPTIONS = [
  { label: "Newest First", value: "created_at" },
  { label: "Most Investors", value: "found_count" },
  { label: "Most Emails Sent", value: "processed_count" },
  { label: "Most Responses", value: "validated_count" },
];

const QUICK_FILTERS = [
  { label: "Active", key: "status", value: "running" },
  { label: "Draft", key: "status", value: "pending" },
  { label: "Completed", key: "status", value: "completed" },
  { label: "AI", key: "sector", value: "ai" },
  { label: "SaaS", key: "sector", value: "saas" },
  { label: "Seed", key: "stage", value: "seed" },
  { label: "Series A", key: "stage", value: "series_a" },
];

const FILTER_CONFIGS: FilterConfig[] = [
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
  { key: "sector", label: "Sector", type: "select", options: SECTOR_OPTIONS },
  { key: "stage", label: "Stage", type: "select", options: STAGE_OPTIONS },
];

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "info" | "default" | "danger" }> = {
  draft: { label: "Draft", variant: "default" },
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  completed: { label: "Completed", variant: "info" },
  failed: { label: "Failed", variant: "danger" },
};

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  // Filter values
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState("created_at");

  const abortRef = useRef<AbortController | null>(null);
  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});

  const fetchCampaigns = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      params.set("sortBy", sortBy);
      params.set("sortDir", "desc");

      if (filters.search) params.set("search", filters.search);
      if (filters.status) params.set("status", filters.status);
      if (filters.sector) params.set("sector", filters.sector);
      if (filters.stage) params.set("stage", filters.stage);

      const res = await fetch(`/api/dashboard/campaigns?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await res.json();

      if (!controller.signal.aborted) {
        setCampaigns(data.campaigns || []);
        setTotal(data.total || 0);
        if (data.facets) {
          setFacets(data.facets);
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Failed to fetch campaigns:", err);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [filters, sortBy, page, limit]);

  useEffect(() => {
    fetchCampaigns();
    return () => abortRef.current?.abort();
  }, [fetchCampaigns]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleRemoveFilter = (key: string) => {
    setFilters((prev) => ({ ...prev, [key]: "" }));
    setPage(1);
  };

  const handleClearAll = () => {
    setFilters({});
    setPage(1);
  };

  const handleSearch = () => {
    setPage(1);
    fetchCampaigns();
  };

  // Compute stats from current page results
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const totalInvestors = campaigns.reduce((sum, c) => sum + c.investor_count, 0);
  const totalEmails = campaigns.reduce((sum, c) => sum + c.emails_sent, 0);

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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[15px] md:gap-[20px] mb-[16px]">
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[20px] flex-none">
              <i className="ri-megaphone-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Active Campaigns</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{activeCount}</p>
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
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{totalInvestors.toLocaleString()}</p>
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
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{totalEmails.toLocaleString()}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Search + Filter Bar */}
      <SearchFilterBar
        filters={FILTER_CONFIGS}
        values={filters}
        onChange={handleFilterChange}
        onSearch={handleSearch}
        onClearAll={handleClearAll}
        onRemoveFilter={handleRemoveFilter}
        totalResults={total}
        loading={loading}
        searchLabel="Search"
        searchPlaceholder="Search campaigns by name, description, sector..."
        quickFilters={QUICK_FILTERS}
        sortOptions={SORT_OPTIONS}
        sortBy={sortBy}
        onSortChange={(v) => { setSortBy(v); setPage(1); }}
        facetCounts={facets}
      />

      {/* Campaign List */}
      {loading ? (
        <div className="space-y-[15px]">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardBody>
                <div className="animate-pulse flex items-center gap-[16px]">
                  <div className="w-[48px] h-[48px] rounded-[12px] bg-gray-100 dark:bg-gray-800"></div>
                  <div className="flex-1">
                    <div className="h-[16px] bg-gray-100 dark:bg-gray-800 rounded w-[200px] mb-[8px]"></div>
                    <div className="h-[12px] bg-gray-100 dark:bg-gray-800 rounded w-[300px]"></div>
                  </div>
                  <div className="flex gap-[20px]">
                    <div className="h-[24px] bg-gray-100 dark:bg-gray-800 rounded w-[60px]"></div>
                    <div className="h-[24px] bg-gray-100 dark:bg-gray-800 rounded w-[60px]"></div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<i className="ri-megaphone-line"></i>}
              title={Object.values(filters).some(Boolean) ? "No campaigns match your filters" : "No campaigns yet"}
              description={
                Object.values(filters).some(Boolean)
                  ? "Try adjusting your search or filters."
                  : "Create your first fundraising campaign to start tracking investors and outreach."
              }
            />
            {Object.values(filters).some(Boolean) && (
              <div className="text-center mt-[12px]">
                <Button variant="outline" size="sm" onClick={handleClearAll}>
                  Clear Filters
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[15px]">
          {campaigns.map((campaign) => {
            const config = statusConfig[campaign.status] || statusConfig.draft;
            const responseRate = campaign.emails_sent > 0
              ? Math.round((campaign.responses / campaign.emails_sent) * 100)
              : 0;

            return (
              <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                <CardBody>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-[16px]">
                    {/* Campaign Icon */}
                    <div className={`w-[48px] h-[48px] rounded-[12px] flex items-center justify-center text-[22px] flex-none ${
                      campaign.status === "active"
                        ? "bg-lime-100 dark:bg-lime-900/20 text-lime-600"
                        : campaign.status === "completed"
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600"
                        : campaign.status === "failed"
                        ? "bg-red-50 dark:bg-red-900/20 text-red-500"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                    }`}>
                      <i className={
                        campaign.status === "active" ? "ri-megaphone-line" :
                        campaign.status === "completed" ? "ri-check-double-line" :
                        campaign.status === "failed" ? "ri-error-warning-line" :
                        "ri-draft-line"
                      }></i>
                    </div>

                    {/* Campaign Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[8px] mb-[4px] flex-wrap">
                        <h3 className="text-[15px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">
                          {campaign.name}
                        </h3>
                        <Badge variant={config.variant} size="sm">{config.label}</Badge>
                      </div>
                      {campaign.description && (
                        <p className="text-[13px] text-gray-400 !mb-[6px] truncate">{campaign.description}</p>
                      )}
                      <div className="flex items-center gap-[12px] text-[12px] text-gray-400 flex-wrap">
                        {campaign.sector && (
                          <span className="flex items-center gap-[4px]">
                            <i className="ri-building-line"></i>{campaign.sector}
                          </span>
                        )}
                        {campaign.stage && (
                          <span className="flex items-center gap-[4px]">
                            <i className="ri-flag-line"></i>{campaign.stage}
                          </span>
                        )}
                        <span className="flex items-center gap-[4px]">
                          <i className="ri-calendar-line"></i>
                          {new Date(campaign.created_at).toLocaleDateString()}
                        </span>
                        {campaign.credits_used > 0 && (
                          <span className="flex items-center gap-[4px]">
                            <i className="ri-coin-line"></i>{campaign.credits_used} credits
                          </span>
                        )}
                      </div>
                      {campaign.error_message && (
                        <p className="text-[11px] text-red-500 !mb-0 mt-[4px] truncate">
                          <i className="ri-error-warning-line mr-[4px]"></i>
                          {campaign.error_message}
                        </p>
                      )}
                    </div>

                    {/* Campaign Metrics */}
                    <div className="flex items-center gap-[20px] sm:flex-shrink-0">
                      <div className="text-center">
                        <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{campaign.investor_count.toLocaleString()}</p>
                        <p className="text-[11px] text-gray-400 !mb-0">Investors</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{campaign.emails_sent.toLocaleString()}</p>
                        <p className="text-[11px] text-gray-400 !mb-0">Sent</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-[18px] font-bold !mb-0 ${responseRate > 0 ? "text-lime-600" : "text-gray-400"}`}>
                          {responseRate}%
                        </p>
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
                            setTotal((prev) => prev - 1);
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

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between px-[4px]">
              <p className="text-[12px] text-gray-400 !mb-0">
                Page {page} of {Math.ceil(total / limit)} · {total.toLocaleString()} total
              </p>
              <div className="flex items-center gap-[8px]">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                  <i className="ri-arrow-left-s-line text-[16px]"></i> Prev
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={campaigns.length < limit}>
                  Next <i className="ri-arrow-right-s-line text-[16px]"></i>
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
