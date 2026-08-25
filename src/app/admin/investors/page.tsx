"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Investor {
  id: string;
  full_name: string;
  company_name: string;
  investor_type: string;
  email: string;
  fit_score: number;
  investment_sectors: string[];
  investment_stages: string[];
  location: string;
  source: string;
  created_at: string;
}

export default function AdminInvestorsPage() {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const PAGE_SIZE = 50;

  const fetchInvestors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);
      if (typeFilter) params.set("type", typeFilter);

      const res = await fetch(`/api/admin/investors?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInvestors(data.investors || []);
        setTotal(data.total || 0);
      }
    } catch {
      // silent
    }
    setLoading(false);
  }, [page, search, typeFilter]);

  useEffect(() => {
    fetchInvestors();
  }, [fetchInvestors]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Investors"
        description={`Manage the investor intelligence database — ${total.toLocaleString()} records.`}
        actions={
          <Link href="/admin/data-sources/import">
            <Button size="sm">
              <i className="ri-add-line text-[16px]" />
              Import CSV
            </Button>
          </Link>
        }
      />

      {/* Search & Filters */}
      <Card className="mb-[20px]">
        <CardBody className="py-[14px] px-[16px]">
          <div className="flex items-center gap-[12px] flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <i className="ri-search-line absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 text-[18px]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name, company, email..."
                className="w-full py-[9px] pl-[38px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
              className="py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
            >
              <option value="">All Types</option>
              <option value="angel_investor">Angel Investor</option>
              <option value="venture_capital">Venture Capital</option>
              <option value="private_equity">Private Equity</option>
              <option value="accelerator">Accelerator</option>
              <option value="corporate_venture">Corporate VC</option>
              <option value="family_office">Family Office</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {/* Investors Table */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-[40px] text-center text-gray-400">
              <div className="animate-spin h-[24px] w-[24px] border-2 border-lime-500 border-t-transparent rounded-full mx-auto mb-[12px]" />
              Loading investors...
            </div>
          ) : investors.length === 0 ? (
            <div className="p-[40px] text-center text-gray-400">
              <i className="ri-user-search-line text-[32px] mb-[12px] block" />
              <p className="font-medium text-[#06201b] dark:text-white !mb-[4px]">No investors found</p>
              <p className="text-[13px]">{search ? "Try a different search term" : "Import investors from CSV or data sources"}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Name</th>
                      <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Type</th>
                      <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Email</th>
                      <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Fit Score</th>
                      <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Source</th>
                      <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investors.map((inv) => (
                      <tr key={inv.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                        <td className="py-[12px] px-[16px]">
                          <div>
                            <p className="font-medium text-[#06201b] dark:text-white !mb-0">{inv.full_name || "Unknown"}</p>
                            {inv.company_name && (
                              <p className="text-[11px] text-gray-400 !mb-0">{inv.company_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-[12px] px-[16px]">
                          <Badge variant={inv.investor_type === "venture_capital" ? "success" : inv.investor_type === "angel_investor" ? "info" : "default"}>
                            {inv.investor_type?.replace(/_/g, " ") || "Unknown"}
                          </Badge>
                        </td>
                        <td className="py-[12px] px-[16px] text-gray-500">
                          {inv.email || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-[12px] px-[16px]">
                          {inv.fit_score > 0 ? (
                            <span className={`font-semibold ${inv.fit_score >= 80 ? "text-green-600" : inv.fit_score >= 50 ? "text-amber-600" : "text-gray-500"}`}>
                              {inv.fit_score}%
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-[12px] px-[16px] text-gray-400 text-[12px]">
                          {inv.source || "—"}
                        </td>
                        <td className="py-[12px] px-[16px]">
                          <Link
                            href={`/dashboard/investors/${inv.id}`}
                            className="text-lime-600 hover:text-lime-700 font-medium text-[12px]"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between py-[12px] px-[16px] border-t border-gray-200 dark:border-gray-700">
                <p className="text-[13px] text-gray-400 !mb-0">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total.toLocaleString()}
                </p>
                <div className="flex gap-[8px]">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    ← Prev
                  </Button>
                  <span className="text-[13px] text-gray-400 py-[6px]">
                    Page {page + 1} / {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                  >
                    Next →
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
