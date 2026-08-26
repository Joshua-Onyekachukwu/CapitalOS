"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface FitInvestor {
  id: string;
  full_name: string;
  email: string | null;
  firm_name: string | null;
  investor_type: string;
  fit_score: number;
  fit_score_breakdown: {
    factors: Array<{
      factor: string;
      score: number;
      weight: number;
      explanation: string;
    }>;
    confidence: number;
    dataQuality: number;
  } | null;
  outreach_readiness: string;
  investment_stages: string[];
  investment_sectors: string[];
  country: string | null;
}

interface CompanyProfile {
  companyName: string | null;
  industry: string | null;
  companyStage: string | null;
  location: string | null;
  oneLiner: string | null;
  currentlyRaising: boolean;
  readinessScore: number;
}

export default function FitDashboardPage() {
  const [investors, setInvestors] = useState<FitInvestor[]>([]);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [scoredCount, setScoredCount] = useState(0);
  const [selectedInvestor, setSelectedInvestor] = useState<FitInvestor | null>(null);
  const [filter, setFilter] = useState<"all" | "high" | "medium" | "low">("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load company profile
      const { getOrCreateCompanyProfile } = await import("@/lib/actions/company");
      const profileData = await getOrCreateCompanyProfile();
      if (profileData) setProfile(profileData);

      // Load investors with fit scores — fetch in batches
      const batchSize = 500;
      let allInvestors: any[] = [];
      let offset = 0;
      let hasMore = true;
      let totalCount = 0;

      while (hasMore) {
        const params = new URLSearchParams({
          sortBy: "fit_score", sortDirection: "desc",
          limit: String(batchSize), offset: String(offset),
        });
        const res = await fetch(`/api/investors?${params}`);
        const data = await res.json();
        const batch = data.investors || [];
        totalCount = data.total || totalCount;
        allInvestors = [...allInvestors, ...batch];
        if (batch.length < batchSize) hasMore = false;
        else offset += batchSize;
        // Limit to 2000 to avoid memory issues
        if (allInvestors.length >= 2000) break;
      }

      setInvestors(allInvestors);
      setTotal(totalCount);
    } catch (err) {
      console.error("Failed to load fit data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const runBatchScoring = async () => {
    setScoring(true);
    setScoredCount(0);
    try {
      const res = await fetch("/api/investors/fit-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "batch_score" }),
      });
      const data = await res.json();
      setScoredCount(data.scored || 0);
      // Reload data
      await loadData();
    } catch (err) {
      console.error("Batch scoring failed:", err);
    } finally {
      setScoring(false);
    }
  };

  const filtered = investors.filter((inv) => {
    if (filter === "high") return inv.fit_score >= 80;
    if (filter === "medium") return inv.fit_score >= 50 && inv.fit_score < 80;
    if (filter === "low") return inv.fit_score < 50;
    return true;
  });

  const highFit = investors.filter((i) => i.fit_score >= 80).length;
  const mediumFit = investors.filter((i) => i.fit_score >= 50 && i.fit_score < 80).length;
  const lowFit = investors.filter((i) => i.fit_score < 50).length;
  const avgScore = investors.length > 0 ? Math.round(investors.reduce((sum, i) => sum + i.fit_score, 0) / investors.length) : 0;

  if (loading) {
    return (
      <div>
        <PageHeader title="Investor Fit Analysis" description="Loading..." />
        <div className="animate-pulse space-y-[20px]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] bg-gray-100 dark:bg-gray-800 rounded-[12px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Investor Fit Analysis"
        description={profile?.companyName ? `Fit analysis for ${profile.companyName}` : "Analyze how well investors match your company."}
        actions={
          <Button onClick={runBatchScoring} disabled={scoring} variant={scoring ? "outline" : "primary"}>
            {scoring ? (
              <><i className="ri-loader-4-line animate-spin text-[16px] mr-[6px]"></i> Scoring...</>
            ) : (
              <><i className="ri-radar-line text-[16px] mr-[6px]"></i> Run Fit Analysis</>
            )}
          </Button>
        }
      />

      {scoredCount > 0 && (
        <div className="mb-[16px] p-[12px] bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-[8px] text-[13px] text-green-700 dark:text-green-400">
          ✓ Fit analysis complete. {scoredCount} investors scored.
        </div>
      )}

      {/* Company Context */}
      {profile && (
        <Card className="mb-[20px]">
          <CardBody className="p-[16px]">
            <div className="flex items-center gap-[12px] flex-wrap">
              <Badge variant="info" size="sm">{profile.industry || "No industry"}</Badge>
              <Badge variant="default" size="sm">{profile.companyStage || "No stage"}</Badge>
              <Badge variant="default" size="sm">{profile.location || "No location"}</Badge>
              {profile.currentlyRaising && <Badge variant="success" size="sm">Currently Raising</Badge>}
              {profile.oneLiner && <span className="text-[12px] text-gray-400 ml-[8px]">{profile.oneLiner}</span>}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[12px] mb-[20px]">
        {[
          { label: "Avg Fit Score", value: `${avgScore}%`, icon: "ri-percent-line", color: "text-lime-600" },
          { label: "High Fit (80+)", value: highFit, icon: "ri-star-line", color: "text-green-600" },
          { label: "Medium Fit (50-79)", value: mediumFit, icon: "ri-subtract-line", color: "text-amber-600" },
          { label: "Low Fit (<50)", value: lowFit, icon: "ri-arrow-down-line", color: "text-red-400" },
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

      {/* Filter Tabs */}
      <div className="flex items-center gap-[8px] mb-[16px]">
        {(["all", "high", "medium", "low"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-[14px] py-[7px] rounded-full text-[13px] font-medium transition-colors ${
              filter === f
                ? "bg-lime-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {f === "all" ? "All" : f === "high" ? "High Fit" : f === "medium" ? "Medium" : "Low Fit"}
          </button>
        ))}
        <span className="text-[12px] text-gray-400 ml-[8px]">{filtered.length} investors</span>
      </div>

      {/* Investor List */}
      <div className="grid grid-cols-1 gap-[12px] mb-[40px]">
        {filtered.length === 0 ? (
          <Card>
            <CardBody className="text-center py-[40px]">
              <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 text-[24px]">
                <i className="ri-radar-line"></i>
              </div>
              <p className="text-[14px] text-gray-400 !mb-[4px]">No investors with fit scores yet</p>
              <p className="text-[13px] text-gray-300 !mb-[16px]">Run the fit analysis to score your investors.</p>
              <Button onClick={runBatchScoring} disabled={scoring}>Run Fit Analysis</Button>
            </CardBody>
          </Card>
        ) : (
          filtered.map((inv) => (
            <Card key={inv.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedInvestor(selectedInvestor?.id === inv.id ? null : inv)}>
              <CardBody className="p-[16px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-[12px] min-w-0">
                    <div className="w-[40px] h-[40px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[14px] font-bold text-lime-700 dark:text-lime-400 flex-none">
                      {inv.fit_score}
                    </div>
                    <div className="min-w-0">
                      <Link href={`/dashboard/investors/${inv.id}`} onClick={(e) => e.stopPropagation()} className="text-[14px] font-semibold text-[#06201b] dark:text-white hover:text-lime-600 transition-colors block truncate">
                        {inv.full_name}
                      </Link>
                      <p className="text-[12px] text-gray-400 !mb-0 truncate">{inv.firm_name || inv.email || inv.investor_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-[8px] flex-none">
                    <Badge variant={inv.fit_score >= 80 ? "success" : inv.fit_score >= 50 ? "warning" : "default"} size="sm">
                      {inv.fit_score >= 80 ? "High" : inv.fit_score >= 50 ? "Medium" : "Low"}
                    </Badge>
                    <Badge variant={inv.outreach_readiness === "ready" ? "success" : "default"} size="sm">
                      {inv.outreach_readiness.replace(/_/g, " ")}
                    </Badge>
                    <i className={`ri-arrow-${selectedInvestor?.id === inv.id ? "up" : "down"}-s-line text-gray-400 text-[16px]`}></i>
                  </div>
                </div>

                {/* Expanded breakdown */}
                {selectedInvestor?.id === inv.id && inv.fit_score_breakdown && (
                  <div className="mt-[16px] pt-[16px] border-t border-gray-100 dark:border-gray-800">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-[12px]">
                      {inv.fit_score_breakdown.factors.map((factor, idx) => (
                        <div key={idx} className="p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
                          <div className="flex items-center justify-between !mb-[4px]">
                            <span className="text-[12px] font-medium text-gray-500">{factor.factor}</span>
                            <span className={`text-[12px] font-bold ${factor.score >= 80 ? "text-green-600" : factor.score >= 50 ? "text-amber-600" : "text-gray-400"}`}>
                              {factor.score}%
                            </span>
                          </div>
                          <div className="w-full h-[3px] bg-gray-200 dark:bg-gray-700 rounded-full !mb-[6px] overflow-hidden">
                            <div className={`h-full rounded-full ${factor.score >= 80 ? "bg-green-500" : factor.score >= 50 ? "bg-amber-500" : "bg-gray-300"}`} style={{ width: `${factor.score}%` }} />
                          </div>
                          <p className="text-[11px] text-gray-400 !mb-0 leading-relaxed">{factor.explanation}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-[12px] flex items-center gap-[16px] text-[12px] text-gray-400">
                      <span>Confidence: <strong>{inv.fit_score_breakdown.confidence}%</strong></span>
                      <span>Data Quality: <strong>{inv.fit_score_breakdown.dataQuality}%</strong></span>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
