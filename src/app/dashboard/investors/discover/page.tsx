"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface FitFactor {
  factor: string;
  score: number;
  weight: number;
  explanation?: string;
}

interface FitBreakdown {
  factors: FitFactor[];
  confidence: number;
  dataQuality: number;
}

interface DiscoverResult {
  id: string;
  full_name: string;
  firm_name: string | null;
  job_title: string | null;
  country: string | null;
  city: string | null;
  fit_score: number;
  fit_score_breakdown: FitBreakdown | null;
  investor_type: string;
  investment_stages: string[];
  investment_sectors: string[];
  email: string | null;
  linkedin_url: string | null;
  outreach_readiness: string;
  bio: string | null;
  is_verified: boolean;
}

interface AnalyzeResult {
  fitScore: number;
  factors: FitFactor[];
  confidence: number;
  dataQuality: number;
  outreachReadiness: string;
  aiAnalysis?: string;
}

const QUICK_FILTERS = [
  { label: "AI / ML", sector: "ai" },
  { label: "SaaS", sector: "saas" },
  { label: "Fintech", sector: "fintech" },
  { label: "HealthTech", sector: "healthtech" },
  { label: "Seed Stage", stage: "seed" },
  { label: "Series A", stage: "series_a" },
  { label: "US-Based", country: "United States" },
  { label: "Europe", country: "Europe" },
];

function getScoreColor(score: number) {
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-gray-500 dark:text-gray-400";
}

function getScoreBg(score: number) {
  if (score >= 80) return "bg-green-100 dark:bg-green-900/30";
  if (score >= 60) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-gray-100 dark:bg-gray-800";
}

function ScoreBar({ score, label }: { score: number; label?: string }) {
  return (
    <div className="flex items-center gap-[8px]">
      {label && <span className="text-[11px] text-gray-400 w-[90px] flex-shrink-0 truncate">{label}</span>}
      <div className="flex-1 h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score >= 80 ? "bg-green-500" : score >= 60 ? "bg-amber-500" : "bg-gray-300"
          }`}
          style={{ width: `${score}%` }}
        ></div>
      </div>
      <span className={`text-[11px] font-bold w-[30px] text-right ${getScoreColor(score)}`}>{score}</span>
    </div>
  );
}

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

  // Analyze state
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [analyzeResults, setAnalyzeResults] = useState<Record<string, AnalyzeResult>>({});
  const [batchAnalyzing, setBatchAnalyzing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

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

  const toggleFilter = (filter: (typeof QUICK_FILTERS)[number]) => {
    const key = filter.sector || filter.stage || filter.country || "";
    setSelectedFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );

    if (filter.sector) setSector(filter.sector);
    if (filter.stage) setStage(filter.stage);
    if (filter.country) setGeography(filter.country);
  };

  // Single investor analysis
  const handleAnalyzeFit = async (investor: DiscoverResult) => {
    setAnalyzingId(investor.id);

    try {
      const response = await fetch("/api/investors/fit-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "individual_score",
          investorId: investor.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const result: AnalyzeResult = {
          fitScore: data.fitScore,
          factors: data.factors,
          confidence: data.confidence,
          dataQuality: data.dataQuality,
          outreachReadiness: data.outreachReadiness,
        };

        setAnalyzeResults((prev) => ({ ...prev, [investor.id]: result }));

        // Update the result in the list
        setResults((prev) =>
          prev.map((r) =>
            r.id === investor.id
              ? { ...r, fit_score: data.fitScore, fit_score_breakdown: { factors: data.factors, confidence: data.confidence, dataQuality: data.dataQuality } }
              : r
          )
        );

        // Auto-expand to show results
        setExpandedId(investor.id);
      }
    } catch (err) {
      console.error("Fit analysis failed:", err);
    } finally {
      setAnalyzingId(null);
    }
  };

  // AI-enhanced analysis
  const handleAIAnalysis = async (investor: DiscoverResult) => {
    setAnalyzingId(investor.id);

    try {
      const response = await fetch("/api/investors/fit-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ai_analysis",
          investorId: investor.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const result: AnalyzeResult = {
          fitScore: data.fitScore,
          factors: data.factors,
          confidence: data.confidence,
          dataQuality: data.dataQuality,
          outreachReadiness: data.outreachReadiness,
          aiAnalysis: data.aiAnalysis,
        };

        setAnalyzeResults((prev) => ({ ...prev, [investor.id]: result }));
        setExpandedId(investor.id);
      }
    } catch (err) {
      console.error("AI analysis failed:", err);
    } finally {
      setAnalyzingId(null);
    }
  };

  // Batch analyze all visible results
  const handleBatchAnalyze = async () => {
    setBatchAnalyzing(true);
    setBatchProgress({ current: 0, total: results.length });

    for (let i = 0; i < results.length; i++) {
      const investor = results[i];
      try {
        const response = await fetch("/api/investors/fit-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "individual_score",
            investorId: investor.id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            const result: AnalyzeResult = {
              fitScore: data.fitScore,
              factors: data.factors,
              confidence: data.confidence,
              dataQuality: data.dataQuality,
              outreachReadiness: data.outreachReadiness,
            };
            setAnalyzeResults((prev) => ({ ...prev, [investor.id]: result }));
            setResults((prev) =>
              prev.map((r) =>
                r.id === investor.id
                  ? { ...r, fit_score: data.fitScore, fit_score_breakdown: { factors: data.factors, confidence: data.confidence, dataQuality: data.dataQuality } }
                  : r
              )
            );
          }
        }
      } catch {
        // Continue
      }

      setBatchProgress({ current: i + 1, total: results.length });
      await new Promise((r) => setTimeout(r, 300)); // Rate limit
    }

    setBatchAnalyzing(false);
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
      if (investor.investment_stages.length > 0)
        reasons.push(`Invests in: ${investor.investment_stages.slice(0, 3).join(", ")}`);
    }

    return reasons.slice(0, 3);
  };

  const analyzedCount = Object.keys(analyzeResults).length;

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

          <div className="flex items-center gap-[10px] flex-wrap">
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <>
                  <i className="ri-loader-4-line animate-spin text-[16px] mr-[6px]"></i> Searching...
                </>
              ) : (
                <>
                  <i className="ri-radar-line text-[16px] mr-[6px]"></i> Discover Investors
                </>
              )}
            </Button>
            {showResults && results.length > 0 && (
              <Button
                variant="outline"
                onClick={handleBatchAnalyze}
                disabled={batchAnalyzing}
                loading={batchAnalyzing}
              >
                <i className="ri-sparkling-2-line text-[16px]"></i>
                {batchAnalyzing
                  ? `Analyzing ${batchProgress.current}/${batchProgress.total}...`
                  : `Analyze All Fit (${results.length})`}
              </Button>
            )}
            {showResults && (
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                }}
                className="py-[9px] px-[14px] text-[13px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
              >
                <option value="fit_score">Best Fit</option>
                <option value="data_quality_score">Data Quality</option>
                <option value="created_at">Recently Added</option>
                <option value="full_name">Name A-Z</option>
              </select>
            )}
            {(sector || stage || geography || query) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSector("");
                  setStage("");
                  setGeography("");
                  setQuery("");
                  setSelectedFilters([]);
                  setShowResults(false);
                  setResults([]);
                  setAnalyzeResults({});
                  setExpandedId(null);
                }}
              >
                Clear All
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Batch Analysis Progress */}
      {batchAnalyzing && (
        <div className="bg-lime-50 dark:bg-lime-900/10 border border-lime-200 dark:border-lime-800/30 rounded-[12px] p-[16px] mb-[20px]">
          <div className="flex items-center justify-between mb-[8px]">
            <span className="text-[13px] font-medium text-[#06201b] dark:text-white flex items-center gap-[8px]">
              <i className="ri-sparkling-2-line text-lime-600 animate-pulse"></i>
              Running fit analysis on all investors...
            </span>
            <span className="text-[13px] text-gray-400">
              {batchProgress.current} / {batchProgress.total}
            </span>
          </div>
          <div className="w-full h-[6px] bg-lime-200 dark:bg-lime-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-lime-500 rounded-full transition-all duration-300"
              style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isSearching && (
        <Card>
          <CardBody className="py-[50px]">
            <div className="text-center">
              <div className="w-[48px] h-[48px] border-4 border-lime-500 border-t-transparent rounded-full animate-spin mx-auto mb-[16px]"></div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">Searching 1M+ investors...</h3>
              <p className="text-[14px] text-gray-500 !mb-0">Matching against your criteria and scoring fit.</p>
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
              {analyzedCount > 0 && (
                <span className="text-[13px] font-normal text-gray-400 ml-[8px]">
                  ({analyzedCount} analyzed)
                </span>
              )}
            </h3>
          </div>

          {results.length === 0 ? (
            <Card>
              <CardBody className="text-center py-[40px]">
                <p className="text-[14px] text-gray-400 !mb-[12px]">No investors match your criteria.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSector("");
                    setStage("");
                    setGeography("");
                    setQuery("");
                  }}
                >
                  Try Broader Search
                </Button>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-[12px] mb-[40px]">
              {results.map((investor) => {
                const reasons = generateMatchReasons(investor);
                const isAnalyzing = analyzingId === investor.id;
                const isExpanded = expandedId === investor.id;
                const analyzeResult = analyzeResults[investor.id];

                return (
                  <Card key={investor.id} className="hover:shadow-md transition-shadow">
                    <CardBody className="p-[18px]">
                      <div className="flex items-start gap-[14px]">
                        {/* Avatar */}
                        <div className="w-[44px] h-[44px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[14px] font-bold text-lime-700 dark:text-lime-400 flex-none">
                          {investor.full_name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)}
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 min-w-0">
                          {/* Name + Score */}
                          <div className="flex items-center gap-[10px] mb-[4px] flex-wrap">
                            <Link
                              href={`/dashboard/investors/${investor.id}`}
                              className="text-[15px] font-semibold text-[#06201b] dark:text-white hover:text-lime-600 transition-colors"
                            >
                              {investor.full_name}
                            </Link>
                            <span
                              className={`text-[13px] font-bold px-[8px] py-[2px] rounded-full ${getScoreBg(
                                analyzeResult?.fitScore || investor.fit_score
                              )} ${getScoreColor(analyzeResult?.fitScore || investor.fit_score)}`}
                            >
                              {analyzeResult?.fitScore || investor.fit_score}% fit
                            </span>
                            {investor.outreach_readiness === "ready" && (
                              <Badge variant="success" size="sm">
                                Ready
                              </Badge>
                            )}
                            {analyzeResult && (
                              <Badge variant="info" size="sm">
                                <i className="ri-check-line mr-[2px]"></i>Analyzed
                              </Badge>
                            )}
                          </div>

                          {/* Subtitle */}
                          <p className="text-[12px] text-gray-400 !mb-[8px]">
                            {investor.job_title || "Investor"}
                            {investor.firm_name ? ` at ${investor.firm_name}` : ""} ·{" "}
                            {investor.city || investor.country || "Global"}
                          </p>

                          {/* Tags */}
                          <div className="flex flex-wrap gap-[4px] mb-[10px]">
                            <Badge variant="default" size="sm">
                              {investor.investor_type.replace(/_/g, " ")}
                            </Badge>
                            {investor.investment_stages.slice(0, 3).map((s) => (
                              <Badge key={s} variant="info" size="sm">
                                {s.replace(/_/g, " ")}
                              </Badge>
                            ))}
                            {investor.investment_sectors.slice(0, 3).map((s) => (
                              <Badge key={s} variant="primary" size="sm">
                                {s}
                              </Badge>
                            ))}
                          </div>

                          {/* Match Reasons (from existing breakdown) */}
                          {!isExpanded && reasons.length > 0 && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[8px] p-[10px]">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-[4px]">
                                Why this match
                              </span>
                              <ul className="space-y-[3px]">
                                {reasons.map((reason, i) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-[6px] text-[12px] text-gray-500 dark:text-gray-400"
                                  >
                                    <i className="ri-check-line text-lime-500 text-[12px] mt-[2px] flex-none"></i>
                                    {reason}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Expanded: Analyze Fit Results */}
                          {isExpanded && analyzeResult && (
                            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[12px] p-[16px] mt-[4px] border border-gray-100 dark:border-gray-800">
                              {/* Overall Score */}
                              <div className="flex items-center gap-[12px] mb-[14px]">
                                <div
                                  className={`w-[48px] h-[48px] rounded-full flex items-center justify-center text-[18px] font-bold ${getScoreBg(
                                    analyzeResult.fitScore
                                  )} ${getScoreColor(analyzeResult.fitScore)}`}
                                >
                                  {analyzeResult.fitScore}
                                </div>
                                <div>
                                  <p className="text-[13px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                                    Fit Score: {analyzeResult.fitScore}%
                                  </p>
                                  <p className="text-[11px] text-gray-400 !mb-0">
                                    Confidence: {analyzeResult.confidence}% · Data Quality: {analyzeResult.dataQuality}%
                                  </p>
                                </div>
                                <Badge
                                  variant={
                                    analyzeResult.outreachReadiness === "ready"
                                      ? "success"
                                      : analyzeResult.outreachReadiness === "needs_verification"
                                      ? "warning"
                                      : "default"
                                  }
                                  size="sm"
                                >
                                  {analyzeResult.outreachReadiness.replace(/_/g, " ")}
                                </Badge>
                              </div>

                              {/* Factor Breakdown */}
                              <div className="space-y-[8px] mb-[14px]">
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                  Score Breakdown
                                </span>
                                {analyzeResult.factors.map((factor, i) => (
                                  <div key={i}>
                                    <ScoreBar score={factor.score} label={factor.factor} />
                                    {factor.explanation && (
                                      <p className="text-[11px] text-gray-400 ml-[98px] !mb-0 mt-[2px]">
                                        {factor.explanation}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>

                              {/* AI Analysis */}
                              {analyzeResult.aiAnalysis && (
                                <div className="bg-lime-50/50 dark:bg-lime-900/10 rounded-[10px] p-[14px] border border-lime-100 dark:border-lime-800/30">
                                  <div className="flex items-center gap-[6px] mb-[8px]">
                                    <i className="ri-sparkling-2-line text-lime-600 text-[14px]"></i>
                                    <span className="text-[12px] font-semibold text-[#06201b] dark:text-white">
                                      AI Analysis
                                    </span>
                                  </div>
                                  <p className="text-[12px] text-gray-600 dark:text-gray-400 !mb-0 leading-[1.7] whitespace-pre-line">
                                    {analyzeResult.aiAnalysis}
                                  </p>
                                </div>
                              )}

                              {/* Collapse */}
                              <button
                                onClick={() => setExpandedId(null)}
                                className="text-[12px] text-gray-400 hover:text-gray-600 mt-[10px] flex items-center gap-[4px]"
                              >
                                <i className="ri-arrow-up-s-line"></i>
                                Collapse
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-[6px] flex-none">
                          {!isExpanded ? (
                            <>
                              <Button
                                size="sm"
                                variant={isAnalyzing ? "primary" : "outline"}
                                onClick={() => handleAnalyzeFit(investor)}
                                loading={isAnalyzing}
                              >
                                <i className="ri-sparkling-2-line text-[14px]"></i>
                                Analyze Fit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAIAnalysis(investor)}
                                disabled={isAnalyzing}
                              >
                                <i className="ri-brain-line text-[14px]"></i>
                                AI Deep Dive
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setExpandedId(null)}
                            >
                              <i className="ri-arrow-up-s-line text-[14px]"></i>
                              Collapse
                            </Button>
                          )}
                          <Link href={`/dashboard/investors/${investor.id}`}>
                            <Button size="sm" variant="ghost" fullWidth>
                              Profile
                            </Button>
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
                Then click <strong>Analyze Fit</strong> to run AI scoring on any investor.
              </p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
