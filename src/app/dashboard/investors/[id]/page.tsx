"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

// Placeholder data — will be replaced with Supabase query
const INVESTOR_DATA: Record<string, {
  full_name: string;
  email: string;
  linkedin_url: string | null;
  job_title: string;
  company: string;
  location: string;
  bio: string;
  investor_type: string;
  fit_score: number;
  fit_breakdown: { factor: string; score: number; explanation: string }[];
  investment_stages: string[];
  investment_sectors: string[];
  investment_geographies: string[];
  min_check_size: string;
  max_check_size: string;
  portfolio_highlights: { name: string; description: string }[];
  recent_activity: { date: string; description: string }[];
  outreach_readiness: string;
  is_verified: boolean;
}> = {
  "1": {
    full_name: "Sarah Chen",
    email: "sarah@horizonvc.com",
    linkedin_url: "https://linkedin.com/in/sarahchen",
    job_title: "General Partner",
    company: "Horizon Ventures",
    location: "San Francisco, CA",
    bio: "Sarah has led Horizon Ventures' AI practice since 2019, investing in over 30 AI-native companies at seed and Series A. Previously VP Engineering at Google Brain. Passionate about developer tools and AI infrastructure.",
    investor_type: "Venture Capital",
    fit_score: 94,
    fit_breakdown: [
      { factor: "Sector Match", score: 98, explanation: "Horizon Ventures has a dedicated AI infrastructure thesis and has invested in 8 companies in your exact sector." },
      { factor: "Stage Match", score: 95, explanation: "They actively invest at seed stage with typical checks of $500K-$2M, matching your raise target." },
      { factor: "Geography", score: 90, explanation: "US-based with strong Bay Area network. Portfolio companies have gone through YC and Techstars." },
      { factor: "Portfolio Fit", score: 92, explanation: "Their current portfolio includes 3 developer tools companies that could be strategic partners." },
    ],
    investment_stages: ["Seed", "Series A"],
    investment_sectors: ["AI", "Developer Tools", "SaaS", "Infrastructure"],
    investment_geographies: ["US", "Canada", "UK"],
    min_check_size: "$500K",
    max_check_size: "$2M",
    portfolio_highlights: [
      { name: "CodePilot", description: "AI code review tool — Series A, $15M raised" },
      { name: "NeuralAPI", description: "API infrastructure for ML models — Seed, $3M raised" },
      { name: "DataForge", description: "Data pipeline automation — Series A, $12M raised" },
    ],
    recent_activity: [
      { date: "2 weeks ago", description: "Led $8M Series A in DevStream (developer analytics)" },
      { date: "1 month ago", description: "Spoke at AI Infrastructure Summit on 'The Future of Developer Tools'" },
      { date: "3 months ago", description: "Announced new $200M fund focused on AI infrastructure" },
    ],
    outreach_readiness: "ready",
    is_verified: true,
  },
};

// Default fallback for any ID
const DEFAULT_INVESTOR = INVESTOR_DATA["1"];

export default function InvestorDetailPage({ params }: { params: { id: string } }) {
  const investor = INVESTOR_DATA[params.id] || DEFAULT_INVESTOR;

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
                  {investor.full_name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-[8px] mb-[4px]">
                    <h2 className="!text-[20px] !font-bold !mb-0">{investor.full_name}</h2>
                    {investor.is_verified && (
                      <i className="ri-verified-badge-fill text-lime-500 text-[18px]"></i>
                    )}
                  </div>
                  <p className="text-[14px] text-gray-500 !mb-[8px]">
                    {investor.job_title} at <span className="font-medium text-gray-700 dark:text-gray-300">{investor.company}</span>
                  </p>
                  <div className="flex items-center gap-[12px] text-[13px] text-gray-400">
                    <span className="flex items-center gap-[4px]">
                      <i className="ri-map-pin-line"></i> {investor.location}
                    </span>
                    <span className="flex items-center gap-[4px]">
                      <i className="ri-mail-line"></i> {investor.email}
                    </span>
                    {investor.linkedin_url && (
                      <a href={investor.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-[4px] text-lime-600 hover:text-lime-700">
                        <i className="ri-linkedin-box-line"></i> LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-[16px] pt-[16px] border-t border-gray-100 dark:border-gray-800">
                <p className="text-[14px] text-gray-600 dark:text-gray-400 !mb-0">{investor.bio}</p>
              </div>
            </CardBody>
          </Card>

          {/* Fit Score Breakdown */}
          <Card>
            <CardHeader>
              <h3 className="!text-[16px] !font-semibold !mb-0">Fit Score Breakdown</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-[16px]">
                {investor.fit_breakdown.map((item) => (
                  <div key={item.factor}>
                    <div className="flex items-center justify-between mb-[6px]">
                      <span className="text-[14px] font-medium text-gray-700 dark:text-gray-300">{item.factor}</span>
                      <span className="text-[14px] font-bold text-gray-900 dark:text-white">{item.score}%</span>
                    </div>
                    <div className="w-full h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-[6px]">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${item.score}%`,
                          backgroundColor: item.score >= 90 ? "#b1ff84" : item.score >= 75 ? "#ffc107" : "#ff4023",
                        }}
                      />
                    </div>
                    <p className="text-[13px] text-gray-500 !mb-0">{item.explanation}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Portfolio Highlights */}
          <Card>
            <CardHeader>
              <h3 className="!text-[16px] !font-semibold !mb-0">Portfolio Highlights</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-[12px]">
                {investor.portfolio_highlights.map((company) => (
                  <div key={company.name} className="flex items-start gap-[10px] p-[12px] bg-gray-50 dark:bg-gray-800/50 rounded-[8px]">
                    <div className="w-[32px] h-[32px] rounded-[8px] bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[14px] font-bold text-lime-700 dark:text-lime-400 flex-none">
                      {company.name[0]}
                    </div>
                    <div>
                      <span className="text-[14px] font-medium text-gray-900 dark:text-white">{company.name}</span>
                      <p className="text-[12px] text-gray-400 !mb-0">{company.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <h3 className="!text-[16px] !font-semibold !mb-0">Recent Activity</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-[12px]">
                {investor.recent_activity.map((activity, i) => (
                  <div key={i} className="flex items-start gap-[10px]">
                    <div className="w-[8px] h-[8px] rounded-full bg-lime-500 mt-[6px] flex-none"></div>
                    <div>
                      <span className="text-[13px] text-gray-400">{activity.date}</span>
                      <p className="text-[14px] text-gray-700 dark:text-gray-300 !mb-0">{activity.description}</p>
                    </div>
                  </div>
                ))}
              </div>
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

          {/* Investment Preferences */}
          <Card>
            <CardHeader>
              <h3 className="!text-[14px] !font-semibold !mb-0">Investment Preferences</h3>
            </CardHeader>
            <CardBody className="pt-0">
              <div className="space-y-[14px]">
                <div>
                  <span className="text-[12px] text-gray-400 uppercase tracking-wide block mb-[6px]">Stages</span>
                  <div className="flex flex-wrap gap-[6px]">
                    {investor.investment_stages.map((s) => (
                      <Badge key={s} variant="info" size="sm">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[12px] text-gray-400 uppercase tracking-wide block mb-[6px]">Sectors</span>
                  <div className="flex flex-wrap gap-[6px]">
                    {investor.investment_sectors.map((s) => (
                      <Badge key={s} variant="primary" size="sm">{s}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[12px] text-gray-400 uppercase tracking-wide block mb-[6px]">Geographies</span>
                  <div className="flex flex-wrap gap-[6px]">
                    {investor.investment_geographies.map((g) => (
                      <Badge key={g} variant="default" size="sm">{g}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[12px] text-gray-400 uppercase tracking-wide block mb-[6px]">Check Size</span>
                  <span className="text-[14px] font-medium text-gray-700 dark:text-gray-300">
                    {investor.min_check_size} — {investor.max_check_size}
                  </span>
                </div>
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
              <Link href="/dashboard/investors/discover">
                <Button fullWidth variant="ghost">
                  <i className="ri-arrow-left-line text-[16px]"></i>
                  Back to Discovery
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
