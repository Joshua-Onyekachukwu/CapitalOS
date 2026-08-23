"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { DataHistory } from "@/components/Dashboard/DataHistory";
import { CommunicationTimeline } from "@/components/Outreach/CommunicationTimeline";

interface InvestorData {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  job_title: string | null;
  bio: string | null;
  location: string | null;
  country: string | null;
  city: string | null;
  investor_type: string;
  fit_score: number;
  data_quality_score: number;
  outreach_readiness: string;
  is_verified: boolean;
  investment_stages: string[];
  investment_sectors: string[];
  investment_geographies: string[];
  min_check_size: number | null;
  max_check_size: number | null;
  portfolio_count: number | null;
  website_url: string | null;
  avatar_url: string | null;
  source: string | null;
  created_at: string;
  firm_name: string | null;
  firm_type: string | null;
  fund_size: number | null;
}

interface ResearchSummary {
  summary: string;
  investmentThesis: string;
  keyStrengths: string[];
  potentialConcerns: string[];
  recommendedApproach: string;
  talkingPoints: string[];
}

const readinessColors: Record<string, "success" | "warning" | "info" | "danger" | "default"> = {
  ready: "success",
  needs_verification: "warning",
  not_ready: "default",
  contacted: "info",
  do_not_contact: "danger",
};

export default function InvestorDetailPage({ params }: { params: { id: string } }) {
  const investorId = params.id;
  const [investor, setInvestor] = useState<InvestorData | null>(null);
  const [research, setResearch] = useState<ResearchSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState("");

  const fetchInvestor = useCallback(async () => {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const { data, error } = await supabase
        .from("investors")
        .select("*")
        .eq("id", investorId)
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Fetch firm data
      let firmName = null;
      let firmType = null;
      let fundSize = null;
      if (data.current_firm_id) {
        const { data: firm } = await supabase
          .from("investor_firms")
          .select("name, firm_type, fund_size")
          .eq("id", data.current_firm_id)
          .single();
        firmName = firm?.name || null;
        firmType = firm?.firm_type || null;
        fundSize = firm?.fund_size || null;
      }

      setInvestor({
        ...data,
        firm_name: firmName,
        firm_type: firmType,
        fund_size: fundSize,
      });

      // Check for existing research
      const { data: profile } = await supabase
        .from("investor_profiles")
        .select("ai_reasoning, ai_summary, recommended_angle, potential_objections")
        .eq("investor_id", investorId)
        .single();

      if (profile?.ai_reasoning) {
        try {
          const parsed = JSON.parse(profile.ai_reasoning);
          setResearch({
            summary: profile.ai_summary || "",
            investmentThesis: parsed.investmentThesis || "",
            keyStrengths: parsed.keyStrengths || [],
            potentialConcerns: parsed.potentialConcerns || [],
            recommendedApproach: profile.recommended_angle || "",
            talkingPoints: parsed.talkingPoints || [],
          });
        } catch {
          setResearch({
            summary: profile.ai_summary || "",
            investmentThesis: "",
            keyStrengths: [],
            potentialConcerns: profile.potential_objections || [],
            recommendedApproach: profile.recommended_angle || "",
            talkingPoints: [],
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch investor:", err);
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => {
    fetchInvestor();
  }, [fetchInvestor]);

  const handleGenerateResearch = async () => {
    setResearchLoading(true);
    setResearchError("");
    try {
      const response = await fetch(`/api/investors/${investorId}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok || !result) {
        setResearchError(result.error || "Could not generate research. Please try again.");
        return;
      }

      setResearch({
        summary: result.summary,
        investmentThesis: result.investmentThesis,
        keyStrengths: result.keyStrengths,
        potentialConcerns: result.potentialConcerns,
        recommendedApproach: result.recommendedApproach,
        talkingPoints: result.talkingPoints,
      });
    } catch (err) {
      setResearchError("AI service unavailable. Please try again later.");
    } finally {
      setResearchLoading(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="" />
        <div className="animate-pulse space-y-[20px]">
          <div className="h-[120px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
          <div className="h-[200px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
        </div>
      </div>
    );
  }

  if (!investor) {
    return (
      <div>
        <PageHeader title="Investor Not Found" />
        <Card>
          <CardBody className="text-center py-[40px]">
            <p className="text-[14px] text-gray-400 !mb-[16px]">This investor could not be found.</p>
            <Link href="/dashboard/investors">
              <Button variant="outline">Back to Database</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const initials = investor.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2);

  return (
    <div>
      <PageHeader
        title=""
        actions={
          <div className="flex items-center gap-[10px]">
            <Button variant="outline">
              <i className="ri-bookmark-line text-[16px]"></i>
              Save
            </Button>
            <Button>
              <i className="ri-mail-send-line text-[16px]"></i>
              Start Outreach
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[20px]">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-[20px]">
          {/* Profile Card */}
          <Card>
            <CardBody className="p-[24px]">
              <div className="flex items-start gap-[16px]">
                <div className="w-[64px] h-[64px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[22px] font-bold text-lime-700 dark:text-lime-400 flex-none">
                  {initials}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-[8px] mb-[4px]">
                    <h2 className="!text-[20px] !font-bold !mb-0">{investor.full_name}</h2>
                    {investor.is_verified && (
                      <i className="ri-verified-badge-fill text-lime-500 text-[18px]"></i>
                    )}
                  </div>
                  <p className="text-[14px] text-gray-500 !mb-[8px]">
                    {investor.job_title || "Investor"}
                    {investor.firm_name && (
                      <> at <span className="font-medium text-gray-700 dark:text-gray-300">{investor.firm_name}</span></>
                    )}
                  </p>
                  <div className="flex items-center gap-[12px] text-[13px] text-gray-400 flex-wrap">
                    {(investor.city || investor.country) && (
                      <span className="flex items-center gap-[4px]">
                        <i className="ri-map-pin-line"></i> {[investor.city, investor.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {investor.email && (
                      <span className="flex items-center gap-[4px]">
                        <i className="ri-mail-line"></i> {investor.email}
                      </span>
                    )}
                    {investor.linkedin_url && (
                      <a href={investor.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-[4px] text-lime-600 hover:text-lime-700">
                        <i className="ri-linkedin-box-line"></i> LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {investor.bio && (
                <div className="mt-[16px] pt-[16px] border-t border-gray-100 dark:border-gray-800">
                  <p className="text-[14px] text-gray-600 dark:text-gray-400 !mb-0">{investor.bio}</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* AI Research Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-[8px]">
                  <i className="ri-sparkling-2-line text-lime-500 text-[18px]"></i>
                  <h3 className="!text-[16px] !font-semibold !mb-0">AI Research Summary</h3>
                </div>
                {!research && !researchLoading && (
                  <Button size="sm" onClick={handleGenerateResearch}>
                    <i className="ri-magic-line text-[14px]"></i>
                    Generate Research
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              {researchLoading ? (
                <div className="text-center py-[20px]">
                  <div className="flex gap-[4px] justify-center mb-[12px]">
                    <div className="w-[6px] h-[6px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-[6px] h-[6px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-[6px] h-[6px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                  <p className="text-[13px] text-gray-400 !mb-0">Generating research summary...</p>
                </div>
              ) : researchError ? (
                <div className="text-center py-[20px]">
                  <p className="text-[13px] text-red-500 !mb-[12px]">{researchError}</p>
                  <Button size="sm" variant="outline" onClick={handleGenerateResearch}>Retry</Button>
                </div>
              ) : research ? (
                <div className="space-y-[16px]">
                  {/* Executive Summary */}
                  <div className="bg-lime-50/50 dark:bg-lime-900/10 rounded-[10px] p-[16px] border border-lime-100 dark:border-lime-800/30">
                    <p className="text-[14px] text-gray-700 dark:text-gray-300 leading-[1.7] !mb-0">{research.summary}</p>
                  </div>

                  {/* Investment Thesis */}
                  {research.investmentThesis && (
                    <div>
                      <h4 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide !mb-[6px]">Investment Thesis</h4>
                      <p className="text-[14px] text-gray-600 dark:text-gray-400 !mb-0">{research.investmentThesis}</p>
                    </div>
                  )}

                  {/* Key Strengths */}
                  {research.keyStrengths.length > 0 && (
                    <div>
                      <h4 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide !mb-[6px]">Key Strengths</h4>
                      <div className="space-y-[6px]">
                        {research.keyStrengths.map((s, i) => (
                          <div key={i} className="flex items-start gap-[8px]">
                            <i className="ri-check-line text-green-500 text-[14px] mt-[2px]"></i>
                            <span className="text-[14px] text-gray-600 dark:text-gray-400">{s}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Potential Concerns */}
                  {research.potentialConcerns.length > 0 && (
                    <div>
                      <h4 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide !mb-[6px]">Potential Concerns</h4>
                      <div className="space-y-[6px]">
                        {research.potentialConcerns.map((c, i) => (
                          <div key={i} className="flex items-start gap-[8px]">
                            <i className="ri-alert-line text-amber-500 text-[14px] mt-[2px]"></i>
                            <span className="text-[14px] text-gray-600 dark:text-gray-400">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Approach */}
                  {research.recommendedApproach && (
                    <div>
                      <h4 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide !mb-[6px]">Recommended Approach</h4>
                      <p className="text-[14px] text-gray-600 dark:text-gray-400 !mb-0">{research.recommendedApproach}</p>
                    </div>
                  )}

                  {/* Talking Points */}
                  {research.talkingPoints.length > 0 && (
                    <div>
                      <h4 className="text-[13px] font-semibold text-gray-500 uppercase tracking-wide !mb-[6px]">Talking Points</h4>
                      <div className="space-y-[6px]">
                        {research.talkingPoints.map((t, i) => (
                          <div key={i} className="flex items-start gap-[8px]">
                            <span className="text-[12px] font-bold text-lime-600 mt-[2px]">{i + 1}.</span>
                            <span className="text-[14px] text-gray-600 dark:text-gray-400">{t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button size="sm" variant="outline" onClick={handleGenerateResearch}>
                    <i className="ri-refresh-line text-[14px]"></i>
                    Regenerate
                  </Button>
                </div>
              ) : (
                <div className="text-center py-[20px]">
                  <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[12px] text-gray-300 text-[20px]">
                    <i className="ri-sparkling-2-line"></i>
                  </div>
                  <p className="text-[14px] text-gray-400 !mb-[4px]">No research summary yet</p>
                  <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-[12px]">
                    Generate an AI research summary to understand this investor better.
                  </p>
                  <Button size="sm" onClick={handleGenerateResearch}>
                    <i className="ri-magic-line text-[14px]"></i>
                    Generate Research
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Investment Preferences */}
          <Card>
            <CardHeader>
              <h3 className="!text-[16px] !font-semibold !mb-0">Investment Preferences</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-[16px]">
                <div>
                  <span className="text-[12px] text-gray-400 uppercase tracking-wide block mb-[6px]">Stages</span>
                  <div className="flex flex-wrap gap-[6px]">
                    {(investor.investment_stages || []).length > 0
                      ? investor.investment_stages.map((s) => <Badge key={s} variant="info" size="sm">{s.replace(/_/g, " ")}</Badge>)
                      : <span className="text-[13px] text-gray-400">Not specified</span>
                    }
                  </div>
                </div>
                <div>
                  <span className="text-[12px] text-gray-400 uppercase tracking-wide block mb-[6px]">Sectors</span>
                  <div className="flex flex-wrap gap-[6px]">
                    {(investor.investment_sectors || []).length > 0
                      ? investor.investment_sectors.map((s) => <Badge key={s} variant="primary" size="sm">{s.replace(/_/g, " ")}</Badge>)
                      : <span className="text-[13px] text-gray-400">Not specified</span>
                    }
                  </div>
                </div>
                <div>
                  <span className="text-[12px] text-gray-400 uppercase tracking-wide block mb-[6px]">Geographies</span>
                  <div className="flex flex-wrap gap-[6px]">
                    {(investor.investment_geographies || []).length > 0
                      ? investor.investment_geographies.map((g) => <Badge key={g} variant="default" size="sm">{g}</Badge>)
                      : <span className="text-[13px] text-gray-400">Not specified</span>
                    }
                  </div>
                </div>
              </div>
              {(investor.min_check_size || investor.max_check_size) && (
                <div className="mt-[14px]">
                  <span className="text-[12px] text-gray-400 uppercase tracking-wide block mb-[6px]">Check Size</span>
                  <span className="text-[14px] font-medium text-gray-700 dark:text-gray-300">
                    {investor.min_check_size ? `$${investor.min_check_size.toLocaleString()}` : "?"} — {investor.max_check_size ? `$${investor.max_check_size.toLocaleString()}` : "?"}
                  </span>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Data History */}
          <Card>
            <CardHeader>
              <h3 className="!text-[16px] !font-semibold !mb-0">Data History</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <DataHistory investorId={investorId} />
            </CardBody>
          </Card>

          {/* Communication Timeline */}
          <Card>
            <CardBody>
              <CommunicationTimeline investorId={investorId} />
            </CardBody>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-[20px]">
          {/* Overall Fit Score */}
          <Card>
            <CardBody className="p-[20px] text-center">
              <div className="w-[80px] h-[80px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center mx-auto mb-[12px]">
                <span className="text-[28px] font-bold text-lime-700 dark:text-lime-400">{investor.fit_score}%</span>
              </div>
              <h3 className="!text-[16px] !font-semibold !mb-[4px]">Fit Score</h3>
              <p className="text-[13px] text-gray-400 !mb-0">
                {investor.fit_score >= 85 ? "Excellent match for your startup" : investor.fit_score >= 70 ? "Good match — worth exploring" : "Partial match — review details"}
              </p>
            </CardBody>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardBody className="p-[16px] space-y-[12px]">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-400">Type</span>
                <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300 capitalize">{investor.investor_type?.replace(/_/g, " ") || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-400">Data Quality</span>
                <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{investor.data_quality_score}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-400">Status</span>
                <Badge variant={readinessColors[investor.outreach_readiness] || "default"} size="sm">
                  {investor.outreach_readiness?.replace(/_/g, " ") || "Unknown"}
                </Badge>
              </div>
              {investor.firm_name && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400">Firm</span>
                  <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{investor.firm_name}</span>
                </div>
              )}
              {investor.fund_size && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400">Fund Size</span>
                  <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">${(investor.fund_size / 1_000_000).toFixed(0)}M</span>
                </div>
              )}
              {investor.portfolio_count && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-400">Portfolio</span>
                  <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">{investor.portfolio_count} companies</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-gray-400">Source</span>
                <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300 capitalize">{investor.source || "Unknown"}</span>
              </div>
            </CardBody>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardBody className="p-[20px] space-y-[10px]">
              <Button fullWidth>
                <i className="ri-mail-send-line text-[16px]"></i>
                Start Personalized Outreach
              </Button>
              <Button fullWidth variant="outline">
                <i className="ri-bookmark-line text-[16px]"></i>
                Save to List
              </Button>
              <Link href="/dashboard/investors">
                <Button fullWidth variant="ghost">
                  <i className="ri-arrow-left-line text-[16px]"></i>
                  Back to Database
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
