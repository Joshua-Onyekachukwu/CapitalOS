"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface DiscoverResult {
  id: string;
  full_name: string;
  firm_name: string | null;
  job_title: string | null;
  country: string | null;
  city: string | null;
  fit_score: number;
  fit_score_breakdown: {
    factors: Array<{ factor: string; score: number; weight: number; explanation?: string }>;
    confidence: number;
    dataQuality: number;
  } | null;
  investor_type: string;
  investment_stages: string[];
  investment_sectors: string[];
  email: string | null;
  outreach_readiness: string;
}

const QUICK_FILTERS = [
  { label: "AI / ML", sector: "ai" },
  { label: "SaaS", sector: "saas" },
  {label: "Fintech", sector: "fintech" },
  { label: "HealthTech", sector: "healthtech" },
  { label: "Seed Stage", stage: "seed" },
  { label: "Series A", stage: "series_a" },
  { label: "US-Based", country: "United States" },
  { label: "Europe", country: "Europe" },
];

export default function InvestorDiscoverPage() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [geography, setGeography] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DiscoverResult[]>([]);
  const [total, setTotal] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("fit_score");

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    setShowResults(true);

    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      if (sector) params.set("sectors", sector);
      if (stage) params.set("stages", stage);
      if (geography) params.set("country", geography);
      params.set("sortBy", sortBy);
      params.set("sortDirection", "desc");
      params.set("limit", "50");

      const response = await fetch(`/api/investors?${params.toString()}`);
      const data = await response.json();

      setResults(data.investors || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, sector, stage, geography, sortBy]);

  const handleUseMyProfile = async () => {
    try {
      const { getOrCreateCompanyProfile } = await import("@/lib/actions/company");
      const profile = await getOrCreateCompanyProfile();
      if (profile) {
        if (profile.industry) setSector(profile.industry);
        if (profile.companyStage) setStage(profile.companyStage);
        if (profile.location) setGeography(profile.location);
      }
    } catch {
      // No profile
    }
  };

  const toggleFilter = (filter: any) => {
    const key = filter.sector || filter.stage || filter.country || "";
    setSelectedFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );

    if (filter.sector) setSector(filter.sector);
    if (filter.stage) setStage(filter.stage);
    if (filter.country) setGeography(filter.country);
  };

  const generateMatchReasons = (investor: DiscoverResult): string[] => {
    const reasons: string[] = [];

    if (investor.fit_score_breakdown?.factors) {
      for (const factor of investor.fit_score_breakdown.factors) {
        if (factor.score >= 80 && factor.explanation) {
          reasons.push(factor.explanation);
        }
      }
    }

    if (reasons.length === 0) {
      if (investor.fit_score >= 80) reasons.push("Strong overall fit score");
      if (investor.email) reasons.push("Has contact email available");
      if (investor.outreach_readiness === "ready") reasons.push("Ready for outreach");
      if (investor.investment_stages.length > 0) reasons.push(`Invests in: ${investor.investment_stages.slice(0, 3).join(", ")}`);
    }

    return reasons.slice(0, 3);
  };

  return (
    <div>
      <PageHeader
        title="Discover Investors"
        description="AI-powered search to find investors that match your startup's profile."
      />

      {/* Search Criteria */}
      <Card className="mb-[20px]">
        <CardBody>
          <div className="flex items-center justify-between mb-[16px]">
            <h3 className="!text-[16px] !font-semibold !mb-0">Search Criteria</h3>
            <Button variant="ghost" size="sm" onClick={handleUseMyProfile}>
              <i className="ri-magic-line text-[16px]"></i>
              Use My Startup Profile
            </Button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap gap-[8px] mb-[16px]">
            {QUICK_FILTERS.map((filter, i) => {
              const key = filter.sector || filter.stage || filter.country || "";
              return (
                <button
                  key={i}
                  onClick={() => toggleFilter(filter)}
                  className={`px-[12px] py-[6px] text-[12px] font-medium rounded-full border transition-all ${
                    selectedFilters.includes(key)
                      ? "bg-lime-500 text-black border-lime-500"
                      : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-lime-500"
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-[14px] mb-[16px]">
            <div>
              <label className="block text-[13px] font-medium text-gray-500 !mb-[6px]">Sector</label>
              <input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="e.g. AI, SaaS, Fintech"
                className="w-full py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-500 !mb-[6px]">Stage</label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className="w-full py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
              >
                <option value="">All Stages</option>
                <option value="pre_seed">Pre-Seed</option>
                <option value="seed">Seed</option>
                <option value="series_a">Series A</option>
                <option value="series_b">Series B</option>
                <option value="series_c">Series C+</option>
              </select>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-gray-500 !mb-[6px]">Geography</label>
              <input
                value={geography}
                onChange={(e) => setGeography(e.target.value)}
                placeholder="e.g. US, Europe, Global"
                className="w-full py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
              />
            </div>
          </div>

          {/* Free text */}
          <div className="mb-[16px]">
            <label className="block text-[13px] font-medium text-gray-500 !mb-[6px]">Describe what you need</label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. AI-focused VCs who invest in developer tools at seed stage..."
              rows={2}
              className="w-full py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 resize-none"
            />
          </div>

          <div className="flex items-center gap-[10px]">
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <><i className="ri-loader-4-line animate-spin text-[16px] mr-[6px]"></i> Searching...</>
              ) : (
                <><i className="ri-radar-line text-[16px] mr-[6px]"></i> Discover Investors</>
              )}
            </Button>
            {showResults && (
              <select
                value={sortBy}
                onChange={(e) => { setSortBy(e.target.value); }}
                className="py-[9px] px-[14px] text-[13px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
              >
                <option value="fit_score">Best Fit</option>
                <option value="data_quality_score">Data Quality</option>
                <option value="created_at">Recently Added</option>
                <option value="full_name">Name A-Z</option>
              </select>
            )}
            {(sector || stage || geography || query) && (
              <Button variant="ghost" size="sm" onClick={() => {
                setSector(""); setStage(""); setGeography(""); setQuery("");
                setSelectedFilters([]); setShowResults(false); setResults([]);
              }}>
                Clear All
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Loading */}
      {isSearching && (
        <Card>
          <CardBody className="py-[50px]">
            <div className="text-center">
              <div className="w-[48px] h-[48px] border-4 border-lime-500 border-t-transparent rounded-full animate-spin mx-auto mb-[16px]"></div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">Searching 1M+ investors...</h3>
              <p className="text-[14px] text-gray-500 !mb-0">
                Matching against your criteria and scoring fit.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Results */}
      {showResults && !isSearching && (
        <div>
          <div className="flex items-center justify-between mb-[16px]">
            <h3 className="!text-[16px] !font-semibold !mb-0">
              {total.toLocaleString()} investor{total !== 1 ? "s" : ""} found
            </h3>
            <span className="text-[13px] text-gray-400">Sorted by {sortBy.replace(/_/g, " ")}</span>
          </div>

          {results.length === 0 ? (
            <Card>
              <CardBody className="text-center py-[40px]">
                <p className="text-[14px] text-gray-400 !mb-[12px]">No investors match your criteria.</p>
                <Button variant="outline" size="sm" onClick={() => { setSector(""); setStage(""); setGeography(""); setQuery(""); }}>
                  Try Broader Search
                </Button>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-[12px] mb-[40px]">
              {results.map((investor) => {
                const reasons = generateMatchReasons(investor);
                return (
                  <Card key={investor.id} className="hover:shadow-md transition-shadow">
                    <CardBody className="p-[18px]">
                      <div className="flex items-start gap-[14px]">
                        <div className="w-[44px] h-[44px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[14px] font-bold text-lime-700 dark:text-lime-400 flex-none">
                          {investor.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[10px] mb-[4px] flex-wrap">
                            <Link href={`/dashboard/investors/${investor.id}`} className="text-[15px] font-semibold text-[#06201b] dark:text-white hover:text-lime-600 transition-colors">
                              {investor.full_name}
                            </Link>
                            <span className={`text-[13px] font-bold px-[8px] py-[2px] rounded-full ${
                              investor.fit_score >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : investor.fit_score >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                            }`}>
                              {investor.fit_score}% fit
                            </span>
                            {investor.outreach_readiness === "ready" && (
                              <Badge variant="success" size="sm">Ready</Badge>
                            )}
                          </div>

                          <p className="text-[12px] text-gray-400 !mb-[8px]">
                            {investor.job_title || "Investor"}{investor.firm_name ? ` at ${investor.firm_name}` : ""} · {investor.city || investor.country || "Global"}
                          </p>

                          <div className="flex flex-wrap gap-[4px] mb-[10px]">
                            <Badge variant="default" size="sm">{investor.investor_type.replace(/_/g, " ")}</Badge>
                            {investor.investment_stages.slice(0, 3).map((s) => (
                              <Badge key={s} variant="info" size="sm">{s.replace(/_/g, " ")}</Badge>
                            ))}
                            {investor.investment_sectors.slice(0, 3).map((s) => (
                              <Badge key={s} variant="primary" size="sm">{s}</Badge>
                            ))}
                          </div>

                          {reasons.length > 0 && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[8px] p-[10px]">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-[4px]">Why this match</span>
                              <ul className="space-y-[3px]">
                                {reasons.map((reason, i) => (
                                  <li key={i} className="flex items-start gap-[6px] text-[12px] text-gray-500 dark:text-gray-400">
                                    <i className="ri-check-line text-lime-500 text-[12px] mt-[2px] flex-none"></i>
                                    {reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-[6px] flex-none">
                          <Link href={`/dashboard/investors/${investor.id}`}>
                            <Button size="sm" variant="outline">View</Button>
                          </Link>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!showResults && !isSearching && (
        <Card>
          <CardBody className="py-[60px]">
            <div className="text-center">
              <div className="w-[64px] h-[64px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-radar-line text-lime-500 text-[28px]"></i>
              </div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">AI-Powered Investor Discovery</h3>
              <p className="text-[14px] text-gray-500 !mb-0 max-w-[400px] mx-auto">
                Search across 1M+ investors. Set criteria or use your startup profile to find the best matches.
              </p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
