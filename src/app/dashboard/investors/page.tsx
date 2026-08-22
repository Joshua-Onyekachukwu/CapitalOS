"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

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

const readinessColors: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
  ready: "success",
  needs_verification: "warning",
  not_ready: "default",
  contacted: "info",
  do_not_contact: "danger",
};

export default function InvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [readinessFilter, setReadinessFilter] = useState("");
  const [sortBy, setSortBy] = useState("fit_score");
  const [page, setPage] = useState(0);
  const limit = 25;

  const fetchInvestors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (typeFilter) params.set("investorType", typeFilter);
      if (readinessFilter) params.set("outreachReadiness", readinessFilter);
      params.set("sortBy", sortBy);
      params.set("sortDirection", "desc");
      params.set("limit", String(limit));
      params.set("offset", String(page * limit));

      const response = await fetch(`/api/investors?${params.toString()}`);
      const data = await response.json();

      setInvestors(data.investors || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to fetch investors:", err);
    } finally {
      setLoading(false);
    }
  }, [query, typeFilter, readinessFilter, sortBy, page]);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchInvestors();
  };

  return (
    <div>
      <PageHeader
        title="Investor Database"
        description={`${total.toLocaleString()} investors in your database.`}
        actions={
          <Link href="/dashboard/investors/discover">
            <Button>
              <i className="ri-radar-line text-[16px]"></i>
              AI Discovery
            </Button>
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[12px] mb-[20px]">
        {[
          { label: "Total", value: total, icon: "ri-team-line", color: "text-blue-600" },
          { label: "High Fit", value: investors.filter((i) => i.fit_score >= 80).length, icon: "ri-star-line", color: "text-green-600" },
          { label: "Ready", value: investors.filter((i) => i.outreach_readiness === "ready").length, icon: "ri-check-line", color: "text-lime-600" },
          { label: "Verified", value: investors.filter((i) => i.is_verified).length, icon: "ri-shield-check-line", color: "text-purple-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="p-[14px]">
              <div className="flex items-center gap-[10px]">
                <i className={`${stat.icon} ${stat.color} text-[18px]`}></i>
                <div>
                  <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">{stat.label}</p>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <Card className="mb-[20px]">
        <CardBody className="p-[14px]">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-[10px]">
            <div className="flex-1 relative">
              <i className="ri-search-line absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 text-[16px]"></i>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, email, firm, or title..."
                className="w-full py-[9px] pl-[36px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
              className="py-[9px] px-[14px] text-[13px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
            >
              <option value="">All Types</option>
              <option value="venture_capital">VC</option>
              <option value="angel_investor">Angel</option>
              <option value="accelerator">Accelerator</option>
              <option value="family_office">Family Office</option>
              <option value="corporate_venture">CVC</option>
            </select>
            <select
              value={readinessFilter}
              onChange={(e) => { setReadinessFilter(e.target.value); setPage(0); }}
              className="py-[9px] px-[14px] text-[13px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
            >
              <option value="">All Status</option>
              <option value="ready">Ready</option>
              <option value="needs_verification">Needs Verification</option>
              <option value="contacted">Contacted</option>
              <option value="not_ready">Not Ready</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="py-[9px] px-[14px] text-[13px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
            >
              <option value="fit_score">Fit Score</option>
              <option value="data_quality_score">Data Quality</option>
              <option value="created_at">Recently Added</option>
              <option value="full_name">Name</option>
            </select>
          </form>
        </CardBody>
      </Card>

      {/* Results */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-[20px] space-y-[10px]">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse flex items-center gap-[12px] p-[14px]">
                  <div className="w-[36px] h-[36px] rounded-full bg-gray-100 dark:bg-gray-800"></div>
                  <div className="flex-1">
                    <div className="h-[14px] bg-gray-100 dark:bg-gray-800 rounded w-[150px] mb-[6px]"></div>
                    <div className="h-[10px] bg-gray-100 dark:bg-gray-800 rounded w-[200px]"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : investors.length === 0 ? (
            <div className="text-center py-[40px]">
              <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 text-[24px]">
                <i className="ri-team-line"></i>
              </div>
              <p className="text-[14px] text-gray-400 !mb-[4px]">No investors found</p>
              <p className="text-[13px] text-gray-300 !mb-0">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800">
                      <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[14px] py-[10px]">Investor</th>
                      <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[14px] py-[10px] hidden sm:table-cell">Type</th>
                      <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[14px] py-[10px] hidden md:table-cell">Firm</th>
                      <th className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[14px] py-[10px]">Fit</th>
                      <th className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[14px] py-[10px] hidden lg:table-cell">Quality</th>
                      <th className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-[14px] py-[10px]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investors.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="px-[14px] py-[12px]">
                          <Link href={`/dashboard/investors/${inv.id}`} className="hover:text-lime-600 transition-colors">
                            <p className="text-[13px] font-semibold text-[#06201b] dark:text-white !mb-0">{inv.full_name}</p>
                            <p className="text-[11px] text-gray-400 !mb-0">{inv.email || inv.job_title || "No details"}</p>
                          </Link>
                        </td>
                        <td className="px-[14px] py-[12px] hidden sm:table-cell">
                          <span className="text-[12px] text-gray-500 capitalize">{inv.investor_type.replace(/_/g, " ")}</span>
                        </td>
                        <td className="px-[14px] py-[12px] hidden md:table-cell">
                          <span className="text-[12px] text-gray-500">{inv.firm_name || "—"}</span>
                        </td>
                        <td className="px-[14px] py-[12px] text-center">
                          <span className={`text-[13px] font-bold ${inv.fit_score >= 80 ? "text-green-600" : inv.fit_score >= 60 ? "text-amber-600" : "text-gray-400"}`}>
                            {inv.fit_score}%
                          </span>
                        </td>
                        <td className="px-[14px] py-[12px] text-center hidden lg:table-cell">
                          <div className="w-[40px] h-[4px] bg-gray-100 dark:bg-gray-800 rounded-full mx-auto overflow-hidden">
                            <div
                              className="h-full rounded-full bg-lime-500"
                              style={{ width: `${inv.data_quality_score}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="px-[14px] py-[12px]">
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
              <div className="flex items-center justify-between px-[14px] py-[12px] border-t border-gray-100 dark:border-gray-800">
                <p className="text-[12px] text-gray-400 !mb-0">
                  Showing {page * limit + 1}—{Math.min((page + 1) * limit, total)} of {total.toLocaleString()}
                </p>
                <div className="flex items-center gap-[8px]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!investors.length || investors.length < limit}
                  >
                    Next
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
