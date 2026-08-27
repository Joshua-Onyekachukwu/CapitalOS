"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { SearchFilterBar, FilterConfig } from "@/components/Dashboard/SearchFilterBar";

// ── Types ──
interface Investor {
  id: string;
  full_name: string;
  email: string | null;
  linkedin_url: string | null;
  job_title: string | null;
  investor_type: string;
  fit_score: number;
  data_quality_score: number;
  outreach_readiness: string;
  is_verified: boolean;
  country: string | null;
  city: string | null;
  firm_name: string | null;
  investment_stages: string[];
  investment_sectors: string[];
  created_at: string;
}

// ── Filter configs ──
const INVESTOR_TYPE_OPTIONS = [
  { label: "Venture Capital", value: "venture_capital" },
  { label: "Angel Investor", value: "angel_investor" },
  { label: "Accelerator", value: "accelerator" },
  { label: "Family Office", value: "family_office" },
  { label: "Corporate Venture", value: "corporate_venture" },
  { label: "Micro VC", value: "micro_vc" },
  { label: "Private Equity", value: "private_equity" },
  { label: "Impact Investor", value: "impact_investor" },
  { label: "Strategic Investor", value: "strategic_investor" },
];

const SECTOR_OPTIONS = [
  { label: "AI / ML", value: "ai" },
  { label: "SaaS", value: "saas" },
  { label: "Fintech", value: "fintech" },
  { label: "HealthTech", value: "healthtech" },
  { label: "ClimaTech", value: "climatetech" },
  { label: "Cybersecurity", value: "cybersecurity" },
  { label: "DevTools", value: "devtools" },
  { label: "Web3", value: "web3" },
  { label: "Consumer", value: "consumer" },
  { label: "Enterprise", value: "enterprise" },
  { label: "EdTech", value: "edtech" },
  { label: "Robotics", value: "robotics" },
  { label: "Mobility", value: "mobility" },
  { label: "PropTech", value: "proptech" },
  { label: "AgriTech", value: "agritech" },
  { label: "Energy", value: "energy" },
  { label: "Logistics", value: "logistics" },
  { label: "Marketplace", value: "marketplace" },
  { label: "Media", value: "media" },
  { label: "DeepTech", value: "deeptech" },
];

const COUNTRY_OPTIONS = [
  { label: "United States", value: "United States" },
  { label: "United Kingdom", value: "United Kingdom" },
  { label: "Germany", value: "Germany" },
  { label: "France", value: "France" },
  { label: "India", value: "India" },
  { label: "Israel", value: "Israel" },
  { label: "Singapore", value: "Singapore" },
  { label: "Brazil", value: "Brazil" },
  { label: "Australia", value: "Australia" },
  { label: "Netherlands", value: "Netherlands" },
  { label: "Japan", value: "Japan" },
  { label: "Canada", value: "Canada" },
  { label: "Switzerland", value: "Switzerland" },
  { label: "South Korea", value: "South Korea" },
  { label: "Sweden", value: "Sweden" },
];

const READINESS_OPTIONS = [
  { label: "Ready", value: "ready" },
  { label: "Needs Verification", value: "needs_verification" },
  { label: "Not Ready", value: "not_ready" },
  { label: "Contacted", value: "contacted" },
  { label: "Do Not Contact", value: "do_not_contact" },
];

const SORT_OPTIONS = [
  { label: "Fit Score", value: "fit_score" },
  { label: "Data Quality", value: "data_quality_score" },
  { label: "Recently Added", value: "created_at" },
  { label: "Name A-Z", value: "full_name" },
  { label: "Portfolio Size", value: "portfolio_count" },
];

const QUICK_FILTERS = [
  { label: "VC", key: "type", value: "venture_capital" },
  { label: "Angel", key: "type", value: "angel_investor" },
  { label: "AI", key: "sector", value: "ai" },
  { label: "SaaS", key: "sector", value: "saas" },
  { label: "Fintech", key: "sector", value: "fintech" },
  { label: "Seed", key: "stage", value: "seed" },
  { label: "Series A", key: "stage", value: "series_a" },
  { label: "US", key: "country", value: "United States" },
  { label: "Europe", key: "country", value: "United Kingdom" },
  { label: "Ready", key: "readiness", value: "ready" },
  { label: "Verified", key: "verified", value: "true" },
  { label: "Has Email", key: "hasEmail", value: "true" },
];

const FILTER_CONFIGS: FilterConfig[] = [
  {
    key: "type",
    label: "Investor Type",
    type: "select",
    options: INVESTOR_TYPE_OPTIONS,
  },
  {
    key: "sector",
    label: "Sector",
    type: "select",
    options: SECTOR_OPTIONS,
  },
  {
    key: "stage",
    label: "Investment Stage",
    type: "select",
    options: [
      { label: "Pre-Seed", value: "pre_seed" },
      { label: "Seed", value: "seed" },
      { label: "Series A", value: "series_a" },
      { label: "Series B", value: "series_b" },
      { label: "Series C+", value: "series_c" },
      { label: "Growth", value: "growth" },
      { label: "Late Stage", value: "late_stage" },
    ],
  },
  {
    key: "country",
    label: "Country",
    type: "select",
    options: COUNTRY_OPTIONS,
  },
  {
    key: "city",
    label: "City",
    type: "search",
    placeholder: "e.g. San Francisco, London, Berlin",
    icon: "ri-map-pin-line",
  },
  {
    key: "readiness",
    label: "Outreach Status",
    type: "select",
    options: READINESS_OPTIONS,
  },
  {
    key: "minQuality",
    label: "Min Data Quality",
    type: "select",
    options: [
      { label: "90+ (Excellent)", value: "90" },
      { label: "80+ (Good)", value: "80" },
      { label: "70+ (Fair)", value: "70" },
      { label: "60+ (Basic)", value: "60" },
    ],
  },
  {
    key: "verified",
    label: "Verified Only",
    type: "toggle",
  },
  {
    key: "hasEmail",
    label: "Has Email",
    type: "toggle",
  },
  {
    key: "hasLinkedin",
    label: "Has LinkedIn",
    type: "toggle",
  },
  {
    key: "firmId",
    label: "Firm ID",
    type: "search",
    placeholder: "Paste firm UUID",
    icon: "ri-building-line",
  },
];

const readinessColors: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
  ready: "success",
  needs_verification: "warning",
  not_ready: "default",
  contacted: "info",
  do_not_contact: "danger",
};

// ── Component ──
export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 25;

  // Filter values
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState("fit_score");

  // Facets data
  const [facets, setFacets] = useState<Record<string, Record<string, number>>>({});

  // Saved filters
  const [savedFilters, setSavedFilters] = useState<{ id: string; name: string; filters: Record<string, string>; sortBy?: string }[]>([]);
  const [savingFilter, setSavingFilter] = useState(false);

  // Abort controller for in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  const fetchInvestors = useCallback(async () => {
    // Cancel any in-flight request
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

      // Map filter values to API params
      if (filters.search) params.set("search", filters.search);
      if (filters.type) params.set("type", filters.type);
      if (filters.sector) params.set("sector", filters.sector);
      if (filters.stage) params.set("stage", filters.stage);
      if (filters.country) params.set("country", filters.country);
      if (filters.city) params.set("city", filters.city);
      if (filters.readiness) params.set("readiness", filters.readiness);
      if (filters.verified) params.set("verified", filters.verified);
      if (filters.minQuality) params.set("minQuality", filters.minQuality);
      if (filters.hasEmail) params.set("hasEmail", filters.hasEmail);
      if (filters.hasLinkedin) params.set("hasLinkedin", filters.hasLinkedin);
      if (filters.firmId) params.set("firmId", filters.firmId);

      const response = await fetch(`/api/investors?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (!controller.signal.aborted) {
        setInvestors(data.investors || []);
        setTotal(data.total || 0);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error("Failed to fetch investors:", err);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [filters, sortBy, page, limit]);

  // Fetch facets (counts for filter dropdowns)
  const fetchFacets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.type) params.set("type", filters.type);
      if (filters.sector) params.set("sector", filters.sector);
      if (filters.stage) params.set("stage", filters.stage);
      if (filters.country) params.set("country", filters.country);
      if (filters.city) params.set("city", filters.city);
      if (filters.readiness) params.set("readiness", filters.readiness);
      if (filters.verified) params.set("verified", filters.verified);
      if (filters.minQuality) params.set("minQuality", filters.minQuality);
      if (filters.hasEmail) params.set("hasEmail", filters.hasEmail);
      if (filters.hasLinkedin) params.set("hasLinkedin", filters.hasLinkedin);
      if (filters.firmId) params.set("firmId", filters.firmId);

      const res = await fetch(`/api/investors/facets?${params.toString()}`);
      const data = await res.json();

      setFacets({
        type: Object.fromEntries(data.types?.map((t: any) => [t.value, t.count]) || []),
        sector: Object.fromEntries(data.sectors?.map((s: any) => [s.value, s.count]) || []),
        stage: Object.fromEntries(data.stages?.map((s: any) => [s.value, s.count]) || []),
        country: Object.fromEntries(data.countries?.map((c: any) => [c.value, c.count]) || []),
        readiness: Object.fromEntries(data.readiness?.map((r: any) => [r.value, r.count]) || []),
        email: data.emailStats || { with: 0, without: 0 },
        linkedin: data.linkedinStats || { with: 0, without: 0 },
        verified: data.verifiedStats || { yes: 0, no: 0 },
      });
    } catch {
      // Non-critical
    }
  }, [filters]);

  // Fetch saved filters
  const fetchSavedFilters = useCallback(async () => {
    try {
      const res = await fetch("/api/saved-filters?page=investors");
      const data = await res.json();
      setSavedFilters(data.savedFilters || []);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchInvestors();
    fetchFacets();
    fetchSavedFilters();
    return () => abortRef.current?.abort();
  }, [fetchInvestors, fetchFacets, fetchSavedFilters]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to page 1 on filter change
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
    fetchInvestors();
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  // Save filter
  const handleSaveFilter = async (name: string) => {
    setSavingFilter(true);
    try {
      await fetch("/api/saved-filters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters, sortBy, pageName: "investors" }),
      });
      await fetchSavedFilters();
    } catch (err) {
      console.error("Failed to save filter:", err);
    } finally {
      setSavingFilter(false);
    }
  };

  // Load filter
  const handleLoadFilter = (sf: { filters: Record<string, string>; sortBy?: string }) => {
    setFilters(sf.filters || {});
    if (sf.sortBy) setSortBy(sf.sortBy);
    setPage(1);
  };

  // Delete filter
  const handleDeleteFilter = async (id: string) => {
    try {
      await fetch(`/api/saved-filters?id=${id}`, { method: "DELETE" });
      setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error("Failed to delete filter:", err);
    }
  };

  // Compute stats from facets (full database counts, not just current page)
  const readyCount = facets.readiness?.ready || 0;
  const needsVerificationCount = facets.readiness?.needs_verification || 0;
  const notReadyCount = facets.readiness?.not_ready || 0;
  const verifiedCount = facets.verified?.yes || 0;
  const unverifiedCount = facets.verified?.no || 0;
  const withEmailCount = facets.email?.with || 0;
  const withoutEmailCount = facets.email?.without || 0;
  const withLinkedinCount = facets.linkedin?.with || 0;

  return (
    <div>
      <PageHeader
        title="Investor Database"
        description={`${total.toLocaleString()} investors across your database.`}
        actions={
          <Link href="/dashboard/investors/discover">
            <Button>
              <i className="ri-radar-line text-[16px]"></i>
              AI Discovery
            </Button>
          </Link>
        }
      />

      {/* Stats row — from facets (full database, not just current page) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-[12px] mb-[16px]">
        {[
          { label: "Total Investors", value: total.toLocaleString(), icon: "ri-team-line", color: "text-blue-600" },
          { label: "Ready to Outreach", value: readyCount.toLocaleString(), icon: "ri-check-double-line", color: "text-lime-600", sub: needsVerificationCount > 0 ? `${needsVerificationCount.toLocaleString()} need verification` : undefined },
          { label: "Verified", value: verifiedCount.toLocaleString(), icon: "ri-shield-check-line", color: "text-purple-600", sub: `${unverifiedCount.toLocaleString()} unverified` },
          { label: "Has Email", value: withEmailCount.toLocaleString(), icon: "ri-mail-line", color: "text-emerald-600", sub: `${withoutEmailCount.toLocaleString()} missing` },
          { label: "Has LinkedIn", value: withLinkedinCount.toLocaleString(), icon: "ri-linkedin-box-line", color: "text-sky-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="p-[16px]">
              <div className="flex items-center gap-[8px]">
                <div className={`w-[36px] h-[36px] rounded-[12px] bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center flex-none`}>
                  <i className={`${stat.icon} ${stat.color} text-[18px]`}></i>
                </div>
                <div className="min-w-0">
                  <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-gray-400 !mb-0 truncate">{stat.label}</p>
                  {stat.sub && (
                    <p className="text-[10px] text-gray-300 !mb-0 truncate">{stat.sub}</p>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
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
        quickFilters={QUICK_FILTERS}
        sortOptions={SORT_OPTIONS}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        facetCounts={facets}
        savedFilters={savedFilters}
        onSaveFilter={handleSaveFilter}
        onLoadFilter={handleLoadFilter}
        onDeleteFilter={handleDeleteFilter}
        saving={savingFilter}
      />

      {/* Results Table */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-[20px] space-y-[10px]">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-[12px] p-[16px]">
                  <div className="w-[36px] h-[36px] rounded-full bg-gray-100 dark:bg-gray-800 flex-none"></div>
                  <div className="flex-1">
                    <div className="h-[14px] bg-gray-100 dark:bg-gray-800 rounded w-[150px] mb-[6px]"></div>
                    <div className="h-[10px] bg-gray-100 dark:bg-gray-800 rounded w-[200px]"></div>
                  </div>
                  <div className="h-[14px] bg-gray-100 dark:bg-gray-800 rounded w-[40px]"></div>
                </div>
              ))}
            </div>
          ) : investors.length === 0 ? (
            <div className="text-center py-[60px]">
              <div className="w-[56px] h-[56px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-search-line text-gray-300 text-[24px]"></i>
              </div>
              <p className="text-[14px] font-semibold text-gray-500 !mb-[4px]">No investors found</p>
              <p className="text-[13px] text-gray-400 !mb-[16px]">
                Try adjusting your filters or search terms.
              </p>
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                Clear All Filters
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[16px] py-[10px]">
                        Investor
                      </th>
                      <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[16px] py-[10px] hidden sm:table-cell">
                        Type
                      </th>
                      <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[16px] py-[10px] hidden md:table-cell">
                        Firm
                      </th>
                      <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[16px] py-[10px] hidden lg:table-cell">
                        Location
                      </th>
                      <th className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[16px] py-[10px]">
                        Fit
                      </th>
                      <th className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[16px] py-[10px] hidden lg:table-cell">
                        Quality
                      </th>
                      <th className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[16px] py-[10px] hidden xl:table-cell">
                        Verified
                      </th>
                      <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[16px] py-[10px]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {investors.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        {/* Name + email */}
                        <td className="px-[16px] py-[12px]">
                          <Link
                            href={`/dashboard/investors/${inv.id}`}
                            className="hover:text-lime-600 transition-colors"
                          >
                            <p className="text-[13px] font-semibold text-[#06201b] dark:text-white !mb-0">
                              {inv.full_name}
                            </p>
                            <p className="text-[11px] text-gray-400 !mb-0 truncate max-w-[200px]">
                              {inv.email || inv.job_title || "No details"}
                            </p>
                          </Link>
                        </td>

                        {/* Type */}
                        <td className="px-[16px] py-[12px] hidden sm:table-cell">
                          <Badge variant="default" size="sm">
                            {inv.investor_type.replace(/_/g, " ")}
                          </Badge>
                        </td>

                        {/* Firm */}
                        <td className="px-[16px] py-[12px] hidden md:table-cell">
                          <span className="text-[12px] text-gray-500">
                            {inv.firm_name || "—"}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="px-[16px] py-[12px] hidden lg:table-cell">
                          <span className="text-[12px] text-gray-500">
                            {[inv.city, inv.country].filter(Boolean).join(", ") || "—"}
                          </span>
                        </td>

                        {/* Fit Score */}
                        <td className="px-[16px] py-[12px] text-center">
                          <span
                            className={`text-[13px] font-bold ${
                              inv.fit_score >= 80
                                ? "text-green-600"
                                : inv.fit_score >= 60
                                ? "text-amber-600"
                                : "text-gray-400"
                            }`}
                          >
                            {inv.fit_score}%
                          </span>
                        </td>

                        {/* Quality bar */}
                        <td className="px-[16px] py-[12px] text-center hidden lg:table-cell">
                          <div className="flex items-center gap-[8px] justify-center">
                            <div className="w-[40px] h-[4px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  inv.data_quality_score >= 80
                                    ? "bg-green-500"
                                    : inv.data_quality_score >= 60
                                    ? "bg-amber-500"
                                    : "bg-gray-300"
                                }`}
                                style={{ width: `${inv.data_quality_score}%` }}
                              ></div>
                            </div>
                            <span className="text-[11px] text-gray-400 w-[24px]">
                              {inv.data_quality_score}
                            </span>
                          </div>
                        </td>

                        {/* Verified */}
                        <td className="px-[16px] py-[12px] text-center hidden xl:table-cell">
                          {inv.is_verified ? (
                            <i className="ri-shield-check-line text-green-500 text-[16px]"></i>
                          ) : (
                            <i className="ri-shield-line text-gray-300 text-[16px]"></i>
                          )}
                        </td>

                        {/* Outreach status */}
                        <td className="px-[16px] py-[12px]">
                          <Badge variant={readinessColors[inv.outreach_readiness] || "default"} size="sm">
                            {inv.outreach_readiness.replace(/_/g, " ")}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-[16px] py-[12px] border-t border-gray-100 dark:border-gray-800">
                <p className="text-[12px] text-gray-400 !mb-0">
                  Page {page} of {Math.ceil(total / limit) || 1}
                  <span className="text-gray-300 mx-[6px]">·</span>
                  {total.toLocaleString()} total
                </p>
                <div className="flex items-center gap-[8px]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <i className="ri-arrow-left-s-line text-[16px]"></i>
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!investors.length || investors.length < limit}
                  >
                    Next
                    <i className="ri-arrow-right-s-line text-[16px]"></i>
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
