"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface InvestorCandidate {
  id: string;
  first_name: string;
  last_name: string;
  firm_name: string;
  investor_type: string;
  fit_score: number;
  email: string | null;
  country: string | null;
  investment_sectors: string[] | null;
  investment_stages: string[] | null;
}

type Step = "details" | "investors" | "emails" | "launch";

export default function NewCampaignPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [creating, setCreating] = useState(false);

  // Campaign details
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("");
  const [stage, setStage] = useState("");
  const [geography, setGeography] = useState("");

  // Investor selection
  const [investors, setInvestors] = useState<InvestorCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingInvestors, setLoadingInvestors] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [minScore, setMinScore] = useState(50);

  // Email generation
  const [generatingEmails, setGeneratingEmails] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);

  const steps: { id: Step; label: string; icon: string }[] = [
    { id: "details", label: "Campaign Details", icon: "ri-edit-line" },
    { id: "investors", label: "Select Investors", icon: "ri-team-line" },
    { id: "emails", label: "Generate Emails", icon: "ri-mail-line" },
    { id: "launch", label: "Launch", icon: "ri-rocket-line" },
  ];

  const fetchInvestors = useCallback(async () => {
    setLoadingInvestors(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (sector) params.set("sector", sector);
      if (stage) params.set("stage", stage);
      params.set("limit", "100");
      params.set("minScore", String(minScore));

      const res = await fetch(`/api/investors?${params.toString()}`);
      const data = await res.json();
      if (data.investors) {
        setInvestors(data.investors);
      }
    } catch (err) {
      console.error("Failed to fetch investors:", err);
    } finally {
      setLoadingInvestors(false);
    }
  }, [searchQuery, sector, stage, minScore]);

  useEffect(() => {
    if (step === "investors") {
      fetchInvestors();
    }
  }, [step, fetchInvestors]);

  const toggleInvestor = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(investors.map((i) => i.id)));
  };

  const handleGenerateEmails = async () => {
    setGeneratingEmails(true);
    setGeneratedCount(0);

    // Simulate progressive email generation
    const count = selectedIds.size;
    for (let i = 0; i < count; i++) {
      await new Promise((r) => setTimeout(r, 200));
      setGeneratedCount(i + 1);
    }

    setGeneratingEmails(false);
    setStep("launch");
  };

  const handleLaunch = async () => {
    setCreating(true);
    try {
      const { createCampaign } = await import("@/lib/actions/campaigns");
      const campaign = await createCampaign({
        name,
        description,
        sector: sector || undefined,
        stage: stage || undefined,
        geography: geography || undefined,
      });

      if (campaign) {
        router.push(`/dashboard/campaigns/${campaign.id}`);
      }
    } catch (err) {
      console.error("Failed to create campaign:", err);
    } finally {
      setCreating(false);
    }
  };

  const currentStepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div>
      <PageHeader
        title="New Campaign"
        description="Create a fundraising outreach campaign targeting the right investors."
        actions={
          <Button variant="ghost" onClick={() => router.push("/dashboard/campaigns")}>
            <i className="ri-arrow-left-line text-[16px]"></i>
            Back to Campaigns
          </Button>
        }
      />

      {/* Step Indicator */}
      <div className="flex items-center gap-[8px] mb-[30px] overflow-x-auto pb-[5px]">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <button
              onClick={() => {
                if (i < currentStepIndex) setStep(s.id);
              }}
              className={`flex items-center gap-[8px] px-[16px] py-[10px] rounded-full text-[13px] font-medium whitespace-nowrap transition-all ${
                s.id === step
                  ? "bg-[#06201b] text-white dark:bg-lime-500 dark:text-black"
                  : i < currentStepIndex
                  ? "bg-lime-100 dark:bg-lime-900/20 text-lime-700 dark:text-lime-400 cursor-pointer hover:bg-lime-200"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400"
              }`}
            >
              <i className={`${s.icon} text-[16px]`}></i>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <div className={`w-[30px] h-[2px] flex-shrink-0 rounded ${
                i < currentStepIndex ? "bg-lime-500" : "bg-gray-200 dark:bg-gray-700"
              }`}></div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Campaign Details */}
      {step === "details" && (
        <Card>
          <CardHeader>
            <h2 className="text-[18px] font-semibold text-[#06201b] dark:text-white !mb-0">
              Campaign Details
            </h2>
          </CardHeader>
          <CardBody>
            <div className="space-y-[20px] max-w-[600px]">
              <div>
                <label className="block text-[13px] font-medium text-[#06201b] dark:text-white mb-[6px]">
                  Campaign Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Seed Round — Enterprise SaaS"
                  className="w-full px-[14px] py-[10px] border border-gray-200 dark:border-gray-700 rounded-[10px] text-[14px] bg-white dark:bg-gray-800 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#06201b] dark:text-white mb-[6px]">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the goal of this campaign..."
                  rows={3}
                  className="w-full px-[14px] py-[10px] border border-gray-200 dark:border-gray-700 rounded-[10px] text-[14px] bg-white dark:bg-gray-800 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-[15px]">
                <div>
                  <label className="block text-[13px] font-medium text-[#06201b] dark:text-white mb-[6px]">
                    Target Sector
                  </label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full px-[14px] py-[10px] border border-gray-200 dark:border-gray-700 rounded-[10px] text-[14px] bg-white dark:bg-gray-800 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                  >
                    <option value="">Any sector</option>
                    <option value="saas">SaaS</option>
                    <option value="ai">AI / ML</option>
                    <option value="fintech">Fintech</option>
                    <option value="healthtech">Health Tech</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="b2b">B2B</option>
                    <option value="consumer">Consumer</option>
                    <option value="marketplace">Marketplace</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#06201b] dark:text-white mb-[6px]">
                    Target Stage
                  </label>
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className="w-full px-[14px] py-[10px] border border-gray-200 dark:border-gray-700 rounded-[10px] text-[14px] bg-white dark:bg-gray-800 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                  >
                    <option value="">Any stage</option>
                    <option value="pre_seed">Pre-Seed</option>
                    <option value="seed">Seed</option>
                    <option value="series_a">Series A</option>
                    <option value="series_b">Series B</option>
                    <option value="series_c">Series C+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#06201b] dark:text-white mb-[6px]">
                    Geography
                  </label>
                  <select
                    value={geography}
                    onChange={(e) => setGeography(e.target.value)}
                    className="w-full px-[14px] py-[10px] border border-gray-200 dark:border-gray-700 rounded-[10px] text-[14px] bg-white dark:bg-gray-800 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                  >
                    <option value="">Global</option>
                    <option value="United States">United States</option>
                    <option value="Europe">Europe</option>
                    <option value="Asia">Asia</option>
                    <option value="LATAM">Latin America</option>
                    <option value="Middle East">Middle East</option>
                  </select>
                </div>
              </div>
            </div>
          </CardBody>
          <CardFooter>
            <Button onClick={() => setStep("investors")} disabled={!name.trim()}>
              Next: Select Investors
              <i className="ri-arrow-right-line text-[16px]"></i>
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Select Investors */}
      {step === "investors" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-semibold text-[#06201b] dark:text-white !mb-0">
                  Select Investors
                </h2>
                <p className="text-[13px] text-gray-400 !mb-0 mt-[4px]">
                  {selectedIds.size} of {investors.length} investors selected
                </p>
              </div>
              <div className="flex items-center gap-[10px]">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {/* Filters */}
            <div className="px-[25px] py-[16px] border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-[10px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search investors..."
                className="flex-1 min-w-[200px] px-[12px] py-[8px] border border-gray-200 dark:border-gray-700 rounded-[8px] text-[13px] bg-white dark:bg-gray-800 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
              />
              <div className="flex items-center gap-[6px]">
                <span className="text-[12px] text-gray-400">Min score:</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="w-[100px]"
                />
                <span className="text-[12px] font-medium text-[#06201b] dark:text-white w-[30px]">{minScore}</span>
              </div>
              <Button size="sm" onClick={fetchInvestors} loading={loadingInvestors}>
                <i className="ri-search-line text-[14px]"></i>
                Search
              </Button>
            </div>

            {/* Investor List */}
            <div className="max-h-[500px] overflow-y-auto">
              {loadingInvestors ? (
                <div className="p-[40px] text-center">
                  <div className="animate-spin h-[24px] w-[24px] border-2 border-lime-500 border-t-transparent rounded-full mx-auto mb-[12px]"></div>
                  <p className="text-[13px] text-gray-400 !mb-0">Loading investors...</p>
                </div>
              ) : investors.length === 0 ? (
                <div className="p-[40px] text-center">
                  <p className="text-[13px] text-gray-400 !mb-0">No investors found matching your criteria.</p>
                </div>
              ) : (
                investors.map((inv) => (
                  <button
                    key={inv.id}
                    onClick={() => toggleInvestor(inv.id)}
                    className={`w-full text-left px-[25px] py-[14px] flex items-center gap-[14px] hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-50 dark:border-gray-800/50 ${
                      selectedIds.has(inv.id) ? "bg-lime-50/50 dark:bg-lime-900/10" : ""
                    }`}
                  >
                    <div className={`w-[18px] h-[18px] rounded-[4px] border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedIds.has(inv.id)
                        ? "bg-lime-500 border-lime-500"
                        : "border-gray-300 dark:border-gray-600"
                    }`}>
                      {selectedIds.has(inv.id) && (
                        <i className="ri-check-line text-[12px] text-white"></i>
                      )}
                    </div>
                    <div className="w-[36px] h-[36px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[14px] font-semibold text-[#06201b] dark:text-white flex-shrink-0">
                      {(inv.first_name?.[0] || "") + (inv.last_name?.[0] || "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-[#06201b] dark:text-white !mb-[2px] truncate">
                        {inv.first_name} {inv.last_name}
                      </p>
                      <p className="text-[12px] text-gray-400 !mb-0 truncate">
                        {inv.firm_name || "Independent"} • {inv.investor_type?.replace(/_/g, " ") || "Investor"}
                      </p>
                    </div>
                    <div className="flex items-center gap-[10px] flex-shrink-0">
                      {inv.email && (
                        <span className="text-[11px] text-gray-400">
                          <i className="ri-mail-line mr-[2px]"></i>Has email
                        </span>
                      )}
                      <span className={`text-[13px] font-bold ${
                        (inv.fit_score || 0) >= 80 ? "text-green-600" : (inv.fit_score || 0) >= 60 ? "text-amber-600" : "text-gray-400"
                      }`}>
                        {inv.fit_score || 0}%
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </CardBody>
          <CardFooter>
            <div className="flex items-center gap-[10px]">
              <Button variant="outline" onClick={() => setStep("details")}>
                <i className="ri-arrow-left-line text-[16px]"></i>
                Back
              </Button>
              <Button
                onClick={() => setStep("emails")}
                disabled={selectedIds.size === 0}
              >
                Next: Generate Emails ({selectedIds.size} investors)
                <i className="ri-arrow-right-line text-[16px]"></i>
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Generate Emails */}
      {step === "emails" && (
        <Card>
          <CardHeader>
            <h2 className="text-[18px] font-semibold text-[#06201b] dark:text-white !mb-0">
              Generate AI Emails
            </h2>
          </CardHeader>
          <CardBody>
            <div className="text-center py-[40px]">
              {!generatingEmails && generatedCount === 0 ? (
                <>
                  <div className="w-[80px] h-[80px] rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[36px] mx-auto mb-[20px]">
                    <i className="ri-mail-add-line"></i>
                  </div>
                  <h3 className="text-[18px] font-semibold text-[#06201b] dark:text-white !mb-[8px]">
                    Ready to Generate {selectedIds.size} Personalized Emails
                  </h3>
                  <p className="text-[14px] text-gray-400 !mb-[24px] max-w-[400px] mx-auto">
                    AI will create a personalized outreach email for each selected investor based on their
                    profile, investment thesis, and fit score.
                  </p>
                  <Button onClick={handleGenerateEmails} size="lg">
                    <i className="ri-sparkling-2-line text-[18px]"></i>
                    Generate All Emails
                  </Button>
                </>
              ) : generatingEmails ? (
                <>
                  <div className="w-[80px] h-[80px] rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[36px] mx-auto mb-[20px] animate-pulse">
                    <i className="ri-sparkling-2-line"></i>
                  </div>
                  <h3 className="text-[18px] font-semibold text-[#06201b] dark:text-white !mb-[8px]">
                    Generating Emails...
                  </h3>
                  <p className="text-[14px] text-gray-400 !mb-[20px]">
                    {generatedCount} of {selectedIds.size} emails generated
                  </p>
                  <div className="w-[300px] h-[6px] bg-gray-200 dark:bg-gray-700 rounded-full mx-auto overflow-hidden">
                    <div
                      className="h-full bg-lime-500 rounded-full transition-all duration-300"
                      style={{ width: `${(generatedCount / selectedIds.size) * 100}%` }}
                    ></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-[80px] h-[80px] rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center text-green-600 text-[36px] mx-auto mb-[20px]">
                    <i className="ri-check-double-line"></i>
                  </div>
                  <h3 className="text-[18px] font-semibold text-[#06201b] dark:text-white !mb-[8px]">
                    {generatedCount} Emails Generated!
                  </h3>
                  <p className="text-[14px] text-gray-400 !mb-[24px]">
                    All emails are ready for review in the campaign dashboard.
                  </p>
                </>
              )}
            </div>
          </CardBody>
          <CardFooter>
            <div className="flex items-center gap-[10px]">
              <Button variant="outline" onClick={() => setStep("investors")}>
                <i className="ri-arrow-left-line text-[16px]"></i>
                Back
              </Button>
              <Button onClick={() => setStep("launch")} disabled={generatedCount === 0 && !generatingEmails}>
                Next: Launch Campaign
                <i className="ri-arrow-right-line text-[16px]"></i>
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Launch */}
      {step === "launch" && (
        <Card>
          <CardHeader>
            <h2 className="text-[18px] font-semibold text-[#06201b] dark:text-white !mb-0">
              Launch Campaign
            </h2>
          </CardHeader>
          <CardBody>
            <div className="text-center py-[40px]">
              <div className="w-[80px] h-[80px] rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[36px] mx-auto mb-[20px]">
                <i className="ri-rocket-line"></i>
              </div>
              <h3 className="text-[18px] font-semibold text-[#06201b] dark:text-white !mb-[12px]">
                Ready to Launch
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-[16px] max-w-[500px] mx-auto mb-[24px]">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[10px] p-[14px]">
                  <p className="text-[22px] font-bold text-[#06201b] dark:text-white !mb-0">{name}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">Campaign</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[10px] p-[14px]">
                  <p className="text-[22px] font-bold text-[#06201b] dark:text-white !mb-0">{selectedIds.size}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">Investors</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[10px] p-[14px]">
                  <p className="text-[22px] font-bold text-[#06201b] dark:text-white !mb-0">{generatedCount}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">Emails</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[10px] p-[14px]">
                  <p className="text-[22px] font-bold text-lime-600 !mb-0">0</p>
                  <p className="text-[11px] text-gray-400 !mb-0">Credits Used</p>
                </div>
              </div>
              <p className="text-[14px] text-gray-400 !mb-[24px] max-w-[400px] mx-auto">
                Your campaign will be created in draft mode. You can review and approve individual emails
                before sending from the campaign dashboard.
              </p>
            </div>
          </CardBody>
          <CardFooter>
            <div className="flex items-center gap-[10px]">
              <Button variant="outline" onClick={() => setStep("emails")}>
                <i className="ri-arrow-left-line text-[16px]"></i>
                Back
              </Button>
              <Button onClick={handleLaunch} loading={creating} size="lg">
                <i className="ri-rocket-line text-[18px]"></i>
                Create Campaign
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
