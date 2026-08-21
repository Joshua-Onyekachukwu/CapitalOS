"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface DiscoverResult {
  id: string;
  full_name: string;
  company: string;
  title: string;
  location: string;
  fit_score: number;
  match_reasons: string[];
  investor_type: string;
  stages: string[];
  sectors: string[];
}

const SAMPLE_RESULTS: DiscoverResult[] = [
  {
    id: "1",
    full_name: "Sarah Chen",
    company: "Horizon Ventures",
    title: "General Partner",
    location: "San Francisco, CA",
    fit_score: 96,
    match_reasons: [
      "Focuses on AI infrastructure startups at seed stage",
      "Recently invested in 3 similar companies in your sector",
      "Active in your geography (US-based)",
    ],
    investor_type: "VC",
    stages: ["Seed", "Series A"],
    sectors: ["AI", "Developer Tools"],
  },
  {
    id: "2",
    full_name: "David Kim",
    company: "Accrete VC",
    title: "Founding Partner",
    location: "Austin, TX",
    fit_score: 94,
    match_reasons: [
      "Specializes in AI infrastructure and developer tools",
      "Check size range matches your raise ($500K-$2M)",
      "Portfolio includes 2 companies in adjacent space",
    ],
    investor_type: "Micro VC",
    stages: ["Pre-Seed", "Seed"],
    sectors: ["AI Infrastructure", "DeepTech"],
  },
  {
    id: "3",
    full_name: "Priya Patel",
    company: "Neural Fund",
    title: "Partner",
    location: "London, UK",
    fit_score: 91,
    match_reasons: [
      "Deep expertise in machine learning investments",
      "Thesis aligns with your AI-powered platform approach",
      "Active in both US and European markets",
    ],
    investor_type: "VC",
    stages: ["Seed", "Series A", "Series B"],
    sectors: ["AI", "Machine Learning", "HealthTech"],
  },
  {
    id: "4",
    full_name: "Marcus Williams",
    company: "Independent",
    title: "Angel Investor",
    location: "New York, NY",
    fit_score: 88,
    match_reasons: [
      "Former founder in the fundraising space",
      "Active angel with 12 portfolio companies",
      "Prefers pre-seed and seed stage investments",
    ],
    investor_type: "Angel",
    stages: ["Pre-Seed", "Seed"],
    sectors: ["SaaS", "FinTech"],
  },
];

const QUICK_FILTERS = [
  { label: "AI / ML", value: "ai" },
  { label: "SaaS", value: "saas" },
  { label: "Seed Stage", value: "seed" },
  { label: "US-Based", value: "us" },
  { label: "$100K-$1M", value: "check_100k_1m" },
];

export default function InvestorDiscoverPage() {
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [geography, setGeography] = useState("");
  const [checkSize, setCheckSize] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<string[]>([]);

  const handleSearch = async () => {
    setIsSearching(true);
    // Simulate AI search — will be replaced with actual NVIDIA AI call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSearching(false);
    setShowResults(true);
  };

  const handleUseMyProfile = () => {
    setSector("AI Infrastructure");
    setStage("Seed");
    setGeography("US");
    setCheckSize("$500K - $2M");
    setSelectedQuickFilters(["ai", "seed", "us"]);
  };

  const toggleQuickFilter = (value: string) => {
    setSelectedQuickFilters((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    );
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
            {QUICK_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => toggleQuickFilter(filter.value)}
                className={`px-[12px] py-[6px] text-[12px] font-medium rounded-full border transition-all ${
                  selectedQuickFilters.includes(filter.value)
                    ? "bg-lime-500 text-black border-lime-500"
                    : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-lime-500"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mb-[16px]">
            <Input
              label="Sector Focus"
              placeholder="e.g. AI, Fintech, SaaS, Climate"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            />
            <Input
              label="Geography"
              placeholder="e.g. US, Europe, Global"
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
            />
            <Input
              label="Stage"
              placeholder="e.g. Pre-Seed, Seed, Series A"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            />
            <Input
              label="Check Size"
              placeholder="e.g. $100k - $1M"
              value={checkSize}
              onChange={(e) => setCheckSize(e.target.value)}
            />
          </div>

          {/* Free text query */}
          <div className="mb-[16px]">
            <label className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 mb-[6px]">
              Describe what you&apos;re looking for
            </label>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Looking for AI-focused VCs who have invested in developer tools and have experience with B2B SaaS companies at the seed stage..."
              rows={3}
              className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-[10px]">
            <Button onClick={handleSearch} loading={isSearching}>
              <i className="ri-radar-line text-[18px]"></i>
              {isSearching ? "Searching..." : "Discover Investors"}
            </Button>
            {(sector || stage || geography || query) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSector("");
                  setStage("");
                  setGeography("");
                  setCheckSize("");
                  setQuery("");
                  setSelectedQuickFilters([]);
                  setShowResults(false);
                }}
              >
                Clear All
              </Button>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Loading State */}
      {isSearching && (
        <Card>
          <CardBody className="py-[60px]">
            <div className="text-center">
              <div className="w-[48px] h-[48px] border-4 border-lime-500 border-t-transparent rounded-full animate-spin mx-auto mb-[16px]"></div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">AI is analyzing investors...</h3>
              <p className="text-[14px] text-gray-500 !mb-0">
                Matching against your criteria, scoring fit, and generating explanations.
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
              {SAMPLE_RESULTS.length} investors found
            </h3>
            <span className="text-[13px] text-gray-400">
              Sorted by fit score
            </span>
          </div>

          <div className="space-y-[16px]">
            {SAMPLE_RESULTS.map((investor) => (
              <Card key={investor.id} className="hover:shadow-md transition-shadow">
                <CardBody className="p-[20px]">
                  <div className="flex items-start justify-between gap-[16px]">
                    <div className="flex items-start gap-[14px] flex-1">
                      {/* Avatar */}
                      <div className="w-[48px] h-[48px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[16px] font-semibold text-lime-700 dark:text-lime-400 flex-none">
                        {investor.full_name.split(" ").map((n) => n[0]).join("")}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Name + Score */}
                        <div className="flex items-center gap-[10px] mb-[4px]">
                          <h4 className="!text-[15px] !font-semibold !mb-0 !leading-tight">
                            {investor.full_name}
                          </h4>
                          <div className="flex items-center gap-[4px] px-[8px] py-[2px] rounded-full bg-lime-100 dark:bg-lime-900/30">
                            <span className="text-[13px] font-bold text-lime-700 dark:text-lime-400">
                              {investor.fit_score}%
                            </span>
                            <span className="text-[11px] text-lime-600 dark:text-lime-500">fit</span>
                          </div>
                        </div>

                        {/* Company + Title */}
                        <p className="text-[13px] text-gray-500 !mb-[8px]">
                          {investor.title} at {investor.company} · {investor.location}
                        </p>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-[6px] mb-[10px]">
                          <Badge variant="default" size="sm">{investor.investor_type}</Badge>
                          {investor.stages.map((s) => (
                            <Badge key={s} variant="info" size="sm">{s}</Badge>
                          ))}
                          {investor.sectors.map((s) => (
                            <Badge key={s} variant="primary" size="sm">{s}</Badge>
                          ))}
                        </div>

                        {/* Match Reasons */}
                        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[8px] p-[12px]">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-[6px]">
                            Why this match
                          </span>
                          <ul className="space-y-[4px]">
                            {investor.match_reasons.map((reason, i) => (
                              <li key={i} className="flex items-start gap-[6px] text-[13px] text-gray-600 dark:text-gray-400">
                                <i className="ri-check-line text-lime-500 text-[14px] mt-[1px] flex-none"></i>
                                {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-[8px] flex-none">
                      <Link href={`/dashboard/investors/${investor.id}`}>
                        <Button size="sm" variant="outline">View Profile</Button>
                      </Link>
                      <Button size="sm" variant="ghost">
                        <i className="ri-bookmark-line text-[14px]"></i>
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State (before search) */}
      {!showResults && !isSearching && (
        <Card>
          <CardBody className="py-[60px]">
            <div className="text-center">
              <div className="w-[64px] h-[64px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-radar-line text-lime-500 text-[28px]"></i>
              </div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">AI-Powered Investor Discovery</h3>
              <p className="text-[14px] text-gray-500 !mb-0 max-w-[400px] mx-auto">
                Set your search criteria or use your startup profile, and our AI will find
                the best-matching investors with detailed fit explanations.
              </p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
