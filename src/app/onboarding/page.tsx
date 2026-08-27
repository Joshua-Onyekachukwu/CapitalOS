"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

// =============================================
// Types
// =============================================

interface OnboardingData {
  // Step 1 — Company Identity
  companyName: string;
  websiteUrl: string;
  industry: string;
  location: string;
  companyStage: string;
  businessModel: string;
  // Step 2 — What You Build
  oneLiner: string;
  description: string;
  differentiator: string;
  targetCustomer: string;
  // Step 3 — Fundraising
  currentlyRaising: boolean;
  fundingAmount: string;
  fundingUnit: string; // K, M, B
  roundType: string;
  targetInvestorGeographies: string[];
  hasPitchDeck: boolean;
  pitchDeckStyle: string;
  pitchDeckNeeds: string; // what they want in their deck if they dont have one
  // Step 4 — Traction
  tractionStage: string;
  mrr: string;
  arr: string;
  customerCount: string;
  growthRate: string;
  milestones: string;
  employeeCount: string;
  // Step 5 — Team
  teamMembers: Array<{ name: string; title: string; linkedinUrl: string; isFounder: boolean }>;
}

const STEPS = [
  { id: 1, title: "Company Identity", icon: "ri-building-line" },
  { id: 2, title: "What You Build", icon: "ri-lightbulb-line" },
  { id: 3, title: "Fundraising", icon: "ri-funds-line" },
  { id: 4, title: "Traction", icon: "ri-line-chart-line" },
  { id: 5, title: "Team", icon: "ri-team-line" },
  { id: 6, title: "Documents", icon: "ri-file-text-line" },
  { id: 7, title: "Review & Launch", icon: "ri-check-double-line" },
];

const INDUSTRIES = [
  "AI / Machine Learning", "FinTech", "HealthTech", "ClimateTech", "CleanTech",
  "EdTech", "Cybersecurity", "SaaS", "Enterprise Software", "Consumer",
  "Marketplace", "DeepTech", "Robotics", "SpaceTech", "PropTech",
  "AgriTech", "Logistics", "Mobility", "Energy", "Media", "Web3",
];

const STAGES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Growth"];
const BUSINESS_MODELS = ["SaaS", "Marketplace", "Hardware", "Services", "Consumer", "Other"];
const ROUND_TYPES = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Growth"];
const GEOGRAPHIES = ["United States", "Europe", "United Kingdom", "Asia", "Africa", "Latin America", "Middle East", "Global"];

// =============================================
// Funding Amount Parser
// =============================================
// Parses formats like "1.2M", "1200K", "500000", "$1.2M", etc.
// Returns { amount: number | null, unit: string, display: string, error: string | null }

function parseFundingAmount(raw: string): {
  amount: number | null;
  unit: string;
  display: string;
  error: string | null;
} {
  const cleaned = raw.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return { amount: null, unit: "M", display: "", error: null };

  // Match: optional number (with optional decimal) + optional suffix (K/M/B)
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)\s*([kKmMbB]?)$/);
  if (!match) {
    return { amount: null, unit: "M", display: "", error: "Invalid format. Use 1.2M, 1200K, or 500000" };
  }

  const num = parseFloat(match[1]);
  const suffix = (match[2] || "").toUpperCase();

  if (isNaN(num) || num < 0) {
    return { amount: null, unit: "M", display: "", error: "Please enter a valid number" };
  }

  if (num === 0) {
    return { amount: 0, unit: "M", display: "$0", error: null };
  }

  let multiplier = 1;
  let unit = "";
  if (suffix === "K") { multiplier = 1_000; unit = "K"; }
  else if (suffix === "M") { multiplier = 1_000_000; unit = "M"; }
  else if (suffix === "B") { multiplier = 1_000_000_000; unit = "B"; }
  else {
    // No suffix — treat raw number as dollars
    // If < 1000, ambiguous. Default to dollars.
    if (num >= 1_000_000_000) { multiplier = 1; unit = ""; }
    else if (num >= 1_000_000) { multiplier = 1; unit = ""; }
    else if (num >= 1_000) { multiplier = 1; unit = ""; }
    else { multiplier = 1; unit = ""; }
  }

  const total = num * multiplier;

  // Format display
  let display: string;
  if (unit === "K") display = `$${num}K`;
  else if (unit === "M") display = `$${num}M`;
  else if (unit === "B") display = `$${num}B`;
  else display = `$${total.toLocaleString()}`;

  // Warn if amount seems unreasonable for fundraising
  if (total < 10_000) {
    return { amount: total, unit, display, error: "Amount seems very low for fundraising. Did you mean $" + num.toLocaleString() + "K?" };
  }

  return { amount: total, unit: unit || "", display, error: null };
}

function formatFundingPreview(total: number): string {
  if (total >= 1_000_000_000) return `$${(total / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (total >= 1_000_000) return `$${(total / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (total >= 1_000) return `$${(total / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `$${total.toLocaleString()}`;
}

// Workspace initialization stages
const LAUNCH_STAGES = [
  { msg: "Preparing your workspace", icon: "ri-building-line" },
  { msg: "Loading company profile", icon: "ri-file-user-line" },
  { msg: "Preparing fundraising information", icon: "ri-funds-line" },
  { msg: "Loading investor intelligence", icon: "ri-radar-line" },
  { msg: "Setting up your dashboard", icon: "ri-dashboard-line" },
  { msg: "Almost ready...", icon: "ri-check-double-line" },
];

const TRACTION_STAGES = [
  { id: "idea", name: "Idea Phase", desc: "Just an idea, no product yet" },
  { id: "pre_product", name: "Pre-Product", desc: "Building MVP, no users yet" },
  { id: "mvp", name: "MVP / Beta", desc: "Early users testing the product" },
  { id: "pre_revenue", name: "Pre-Revenue", desc: "Users but not monetizing yet" },
  { id: "early_revenue", name: "Early Revenue", desc: "First paying customers" },
  { id: "growth", name: "Growth", desc: "Growing revenue and users" },
  { id: "scale", name: "Scale", desc: "Proven model, scaling fast" },
];

const PITCH_DECK_STYLES = [
  { id: "minimal", name: "Minimal", desc: "Clean lines, lots of white space, focused content", preview: "bg-white border-2 border-gray-200", icon: "ri-layout-line" },
  { id: "bold", name: "Bold", desc: "Strong colors, large type, high contrast", preview: "bg-[#06201b] text-white", icon: "ri-fire-line" },
  { id: "corporate", name: "Corporate", desc: "Professional, structured, trustworthy", preview: "bg-blue-50 border border-blue-200", icon: "ri-briefline" },
  { id: "modern", name: "Modern", desc: "Gradient accents, smooth transitions", preview: "bg-gradient-to-br from-purple-50 to-blue-50", icon: "ri-sparkling-2-line" },
  { id: "investor", name: "Investor-First", desc: "Data-heavy, metrics-focused, no fluff", preview: "bg-gray-50 border border-gray-300", icon: "ri-line-chart-line" },
];

// =============================================
// Onboarding Page
// =============================================

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [launchStage, setLaunchStage] = useState(-1);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const [data, setData] = useState<OnboardingData>({
    companyName: "",
    websiteUrl: "",
    industry: "",
    location: "",
    companyStage: "",
    businessModel: "",
    oneLiner: "",
    description: "",
    differentiator: "",
    targetCustomer: "",
    currentlyRaising: false,
    fundingAmount: "",
    fundingUnit: "M",
    roundType: "",
    targetInvestorGeographies: [],
    hasPitchDeck: false,
    pitchDeckStyle: "investor",
    pitchDeckNeeds: "",
    tractionStage: "",
    mrr: "",
    arr: "",
    customerCount: "",
    growthRate: "",
    milestones: "",
    employeeCount: "",
    teamMembers: [{ name: "", title: "Founder & CEO", linkedinUrl: "", isFounder: true }],
  });

  // Load existing profile on mount
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      try {
        const { getOrCreateCompanyProfile, getTeamMembers } = await import("@/lib/actions/company");
        const [profile, teamMembers] = await Promise.all([
          getOrCreateCompanyProfile(),
          getTeamMembers(),
        ]);
        if (profile) {
          const mappedTeam = teamMembers.length > 0
            ? teamMembers.map((m) => ({
                name: m.name,
                title: m.title || "",
                linkedinUrl: m.linkedinUrl || "",
                isFounder: m.isFounder,
              }))
            : [{ name: "", title: "Founder & CEO", linkedinUrl: "", isFounder: true }];

          setData({
            companyName: profile.companyName || "",
            websiteUrl: profile.websiteUrl || "",
            industry: profile.industry || "",
            location: profile.location || "",
            companyStage: profile.companyStage || "",
            businessModel: profile.businessModel || "",
            oneLiner: profile.oneLiner || "",
            description: profile.description || "",
            differentiator: profile.differentiator || "",
            targetCustomer: profile.targetCustomer || "",
            currentlyRaising: profile.currentlyRaising,
            fundingAmount: profile.fundingAmount ? String(profile.fundingAmount) : "",
            roundType: profile.roundType || "",
            targetInvestorGeographies: profile.targetInvestorGeographies || [],
            hasPitchDeck: profile.hasPitchDeck,
            pitchDeckStyle: "investor",
            pitchDeckNeeds: "",
            tractionStage: "",
            mrr: profile.mrr ? String(profile.mrr) : "",
            arr: profile.arr ? String(profile.arr) : "",
            customerCount: profile.customerCount ? String(profile.customerCount) : "",
            growthRate: profile.growthRate || "",
            milestones: (profile.milestones || []).join(", "),
            employeeCount: profile.employeeCount ? String(profile.employeeCount) : "",
            fundingUnit: "M",
            teamMembers: mappedTeam,
          });
          if (profile.onboardingStep > 0) {
            setStep(Math.min(profile.onboardingStep + 1, 7));
          }
          if (profile.onboardingCompleted) {
            router.push("/dashboard");
            return;
          }
        }
      } catch {
        // Profile doesn't exist yet, start fresh
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router]);

  const update = useCallback((field: keyof OnboardingData, value: unknown) => {
    setData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const getFundingAmountTotal = useCallback((): number | null => {
    if (!data.fundingAmount) return null;
    const parsed = parseFundingAmount(data.fundingAmount + data.fundingUnit);
    return parsed.amount;
  }, [data.fundingAmount, data.fundingUnit]);

  const saveProgress = useCallback(async (currentStep: number) => {
    setSaving(true);
    try {
      const { updateCompanyProfile } = await import("@/lib/actions/company");
      const fundingTotal = getFundingAmountTotal();
      await updateCompanyProfile({
        companyName: data.companyName || undefined,
        websiteUrl: data.websiteUrl || undefined,
        industry: data.industry || undefined,
        location: data.location || undefined,
        companyStage: data.companyStage || undefined,
        businessModel: data.businessModel || undefined,
        oneLiner: data.oneLiner || undefined,
        description: data.description || undefined,
        differentiator: data.differentiator || undefined,
        targetCustomer: data.targetCustomer || undefined,
        currentlyRaising: data.currentlyRaising,
        fundingAmount: fundingTotal ?? undefined,
        roundType: data.roundType || undefined,
        targetInvestorGeographies: data.targetInvestorGeographies,
        hasPitchDeck: data.hasPitchDeck,
        mrr: data.mrr ? Number(data.mrr) : undefined,
        arr: data.arr ? Number(data.arr) : undefined,
        customerCount: data.customerCount ? Number(data.customerCount) : undefined,
        growthRate: data.growthRate || undefined,
        milestones: data.milestones ? data.milestones.split(",").map((s) => s.trim()).filter(Boolean) : [],
        employeeCount: data.employeeCount ? Number(data.employeeCount) : undefined,
        onboardingStep: currentStep,
      });
    } catch (err) {
      console.error("[Onboarding] saveProgress error:", err);
    } finally {
      setSaving(false);
    }
  }, [data, getFundingAmountTotal]);

  const saveTeamMembers = useCallback(async () => {
    try {
      const { addTeamMember, getTeamMembers, removeTeamMember } = await import("@/lib/actions/company");
      // Get existing team members
      const existing = await getTeamMembers();
      const existingIds = existing.map((m) => m.id);

      // Remove old team members that are no longer in the list
      for (const id of existingIds) {
        await removeTeamMember(id);
      }

      // Add all current team members
      for (const member of data.teamMembers) {
        if (member.name.trim()) {
          await addTeamMember({
            name: member.name.trim(),
            title: member.title.trim() || undefined,
            linkedinUrl: member.linkedinUrl.trim() || undefined,
            isFounder: member.isFounder,
          });
        }
      }
    } catch (err) {
      console.error("[Onboarding] saveTeamMembers error:", err);
    }
  }, [data.teamMembers]);

  const handleNext = async () => {
    await saveProgress(step);
    if (step === 5) {
      // Save team members when leaving the Team step
      await saveTeamMembers();
    }
    if (step < 7) {
      setStep(step + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setLaunchError(null);
    try {
      // Step 1: Save team members
      setLaunchStage(0);
      await saveTeamMembers();
      await new Promise((r) => setTimeout(r, 400));

      // Step 2: Save company profile
      setLaunchStage(1);
      const { updateCompanyProfile } = await import("@/lib/actions/company");
      const fundingTotal = getFundingAmountTotal();
      await updateCompanyProfile({
        companyName: data.companyName || undefined,
        websiteUrl: data.websiteUrl || undefined,
        industry: data.industry || undefined,
        location: data.location || undefined,
        companyStage: data.companyStage || undefined,
        businessModel: data.businessModel || undefined,
        oneLiner: data.oneLiner || undefined,
        description: data.description || undefined,
        differentiator: data.differentiator || undefined,
        targetCustomer: data.targetCustomer || undefined,
        currentlyRaising: data.currentlyRaising,
        fundingAmount: fundingTotal ?? undefined,
        roundType: data.roundType || undefined,
        targetInvestorGeographies: data.targetInvestorGeographies,
        hasPitchDeck: data.hasPitchDeck,
        mrr: data.mrr ? Number(data.mrr) : undefined,
        arr: data.arr ? Number(data.arr) : undefined,
        customerCount: data.customerCount ? Number(data.customerCount) : undefined,
        growthRate: data.growthRate || undefined,
        milestones: data.milestones ? data.milestones.split(",").map((s) => s.trim()).filter(Boolean) : [],
        employeeCount: data.employeeCount ? Number(data.employeeCount) : undefined,
        onboardingCompleted: true,
        onboardingStep: 7,
      });
      await new Promise((r) => setTimeout(r, 300));

      // Step 3: Prepare fundraising info
      setLaunchStage(2);
      await new Promise((r) => setTimeout(r, 400));

      // Step 4: Load investor intelligence
      setLaunchStage(3);
      try {
        await fetch("/api/dashboard/cockpit");
      } catch {
        // Non-critical — dashboard will load this on its own
      }
      await new Promise((r) => setTimeout(r, 300));

      // Step 5: Setting up dashboard
      setLaunchStage(4);
      await new Promise((r) => setTimeout(r, 300));

      // Step 6: Done
      setLaunchStage(5);
      await new Promise((r) => setTimeout(r, 500));

      // Navigate to dashboard
      router.push("/dashboard");
    } catch (err) {
      setLaunchStage(-1);
      setSaving(false);
      setLaunchError(
        err instanceof Error
          ? err.message
          : "Could not initialize your workspace. Please try again."
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0e19]">
        <div className="text-center">
          <div className="flex gap-[4px] justify-center mb-[12px]">
            <div className="w-[6px] h-[6px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
            <div className="w-[6px] h-[6px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
            <div className="w-[6px] h-[6px] rounded-full bg-lime-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
          </div>
          <p className="text-[14px] text-gray-400">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const progress = Math.round((step / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e19]">
      {/* Header */}
      <div className="bg-white dark:bg-[#111827] border-b border-gray-200 dark:border-gray-800 px-[20px] py-[16px]">
        <div className="max-w-[700px] mx-auto">
          <div className="flex items-center justify-between mb-[12px]">
            <div className="flex items-center gap-[8px]">
              <span className="text-[18px] font-bold text-[#06201b] dark:text-white">
                Capital<span className="text-lime-500">OS</span>
              </span>
            </div>
            <span className="text-[13px] text-gray-400">
              Step {step} of {STEPS.length}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-[4px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-lime-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex items-center justify-between mt-[8px]">
            {STEPS.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-[4px] text-[11px] ${
                  s.id === step
                    ? "text-lime-600 font-semibold"
                    : s.id < step
                    ? "text-lime-500"
                    : "text-gray-300 dark:text-gray-600"
                }`}
              >
                <i className={`${s.icon} text-[12px]`}></i>
                <span className="hidden sm:inline">{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[700px] mx-auto px-[20px] py-[30px]">
        <Card>
          <CardBody className="p-[24px] md:p-[32px]">
            {/* Step Title */}
            <div className="mb-[24px]">
              <div className="flex items-center gap-[8px] mb-[6px]">
                <div className="w-[36px] h-[36px] rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[16px]">
                  <i className={STEPS[step - 1].icon}></i>
                </div>
                <h2 className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">
                  {STEPS[step - 1].title}
                </h2>
              </div>
              <p className="text-[14px] text-gray-400 !mb-0 ml-[46px]">
                {step === 1 && "Tell us about your company."}
                {step === 2 && "What does your company do?"}
                {step === 3 && "Tell us about your fundraising plans."}
                {step === 4 && "Share your traction metrics (optional but recommended)."}
                {step === 5 && "Who is behind this company?"}
                {step === 6 && "Upload any existing materials (optional)."}
                {step === 7 && "Review your company profile before launching."}
              </p>
            </div>

            {/* Step 1 — Company Identity */}
            {step === 1 && (
              <div className="space-y-[20px]">
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Company Name *</label>
                  <input
                    type="text"
                    value={data.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                    placeholder="e.g., Acme Inc."
                    className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Website URL</label>
                  <input
                    type="url"
                    value={data.websiteUrl}
                    onChange={(e) => update("websiteUrl", e.target.value)}
                    placeholder="https://yourcompany.com"
                    className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Industry / Sector *</label>
                  <select
                    value={data.industry}
                    onChange={(e) => update("industry", e.target.value)}
                    className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
                  >
                    <option value="">Select industry</option>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-[16px]">
                  <div>
                    <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Location</label>
                    <input
                      type="text"
                      value={data.location}
                      onChange={(e) => update("location", e.target.value)}
                      placeholder="e.g., San Francisco, CA"
                      className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Company Stage *</label>
                    <select
                      value={data.companyStage}
                      onChange={(e) => update("companyStage", e.target.value)}
                      className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
                    >
                      <option value="">Select stage</option>
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Business Model</label>
                  <div className="flex flex-wrap gap-[8px]">
                    {BUSINESS_MODELS.map((m) => (
                      <button
                        key={m}
                        onClick={() => update("businessModel", m)}
                        className={`px-[14px] py-[6px] rounded-full text-[13px] font-medium transition-all ${
                          data.businessModel === m
                            ? "bg-[#06201b] text-white dark:bg-lime-500 dark:text-black"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — What You Build */}
            {step === 2 && (
              <div className="space-y-[20px]">
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">One-liner Description *</label>
                  <input
                    type="text"
                    value={data.oneLiner}
                    onChange={(e) => update("oneLiner", e.target.value)}
                    placeholder="e.g., We help startups raise faster with AI-powered investor matching"
                    className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Detailed Description</label>
                  <textarea
                    value={data.description}
                    onChange={(e) => update("description", e.target.value)}
                    placeholder="Tell us more about what your company does, the problem you solve, and how you solve it..."
                    rows={4}
                    className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Key Differentiator *</label>
                  <input
                    type="text"
                    value={data.differentiator}
                    onChange={(e) => update("differentiator", e.target.value)}
                    placeholder="What makes you different from competitors?"
                    className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Target Customer *</label>
                  <input
                    type="text"
                    value={data.targetCustomer}
                    onChange={(e) => update("targetCustomer", e.target.value)}
                    placeholder="Who specifically uses/buys your product?"
                    className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                  />
                </div>
              </div>
            )}

            {/* Step 3 — Fundraising + Pitch Deck Style */}
            {step === 3 && (
              <div className="space-y-[20px]">
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Are you currently raising?</label>
                  <div className="flex gap-[8px]">
                    {["Yes", "No", "Planning to"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => update("currentlyRaising", opt === "Yes")}
                        className={`px-[16px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all ${
                          (opt === "Yes" && data.currentlyRaising) || (opt === "No" && !data.currentlyRaising)
                            ? "bg-[#06201b] text-white dark:bg-lime-500 dark:text-black"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                {data.currentlyRaising && (
                  <>
                    <div>
                      <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Funding Amount</label>
                      <div className="flex gap-[8px]">
                        <div className="relative flex-1">
                          <span className="absolute left-[12px] top-1/2 -translate-y-1/2 text-[14px] text-gray-400">$</span>
                          <input
                            type="text"
                            value={data.fundingAmount}
                            onChange={(e) => {
                              // Allow numbers, dots, and K/M/B suffixes
                              const val = e.target.value.replace(/[^0-9.kKmMbB]/g, "");
                              update("fundingAmount", val);
                              // Auto-detect unit from suffix
                              const suffix = val.match(/[kKmMbB]$/)?.[0]?.toUpperCase();
                              if (suffix && ["K", "M", "B"].includes(suffix)) {
                                update("fundingUnit", suffix);
                              }
                            }}
                            placeholder="e.g., 1.2M, 500K, or 1200000"
                            className="w-full py-[10px] pl-[24px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                          />
                        </div>
                        <select
                          value={data.fundingUnit}
                          onChange={(e) => update("fundingUnit", e.target.value)}
                          className="py-[10px] px-[12px] text-[14px] font-medium bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 min-w-[70px]"
                        >
                          <option value="K">K (thousand)</option>
                          <option value="M">M (million)</option>
                          <option value="B">B (billion)</option>
                        </select>
                      </div>
                      {(() => {
                        const inputHasSuffix = /[kKmMbB]$/.test(data.fundingAmount);
                        const raw = inputHasSuffix ? data.fundingAmount : data.fundingAmount + data.fundingUnit;
                        const parsed = parseFundingAmount(raw);
                        if (parsed.amount !== null && parsed.amount > 0) {
                          return (
                            <p className={`text-[12px] mt-[4px] !mb-0 ${parsed.error ? "text-amber-500" : "text-gray-400"}`}>
                              {parsed.error
                                ? `⚠ ${parsed.error}`
                                : `= ${formatFundingPreview(parsed.amount)}`}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Round Type</label>
                      <select
                        value={data.roundType}
                        onChange={(e) => update("roundType", e.target.value)}
                        className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
                      >
                        <option value="">Select round</option>
                        {ROUND_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Target Investor Geographies</label>
                      <div className="flex flex-wrap gap-[8px]">
                        {GEOGRAPHIES.map((g) => (
                          <button
                            key={g}
                            onClick={() => {
                              const current = data.targetInvestorGeographies;
                              update(
                                "targetInvestorGeographies",
                                current.includes(g) ? current.filter((x) => x !== g) : [...current, g]
                              );
                            }}
                            className={`px-[12px] py-[5px] rounded-full text-[12px] font-medium transition-all ${
                              data.targetInvestorGeographies.includes(g)
                                ? "bg-lime-500 text-black"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Pitch Deck Section */}
                <div className="border-t border-gray-100 dark:border-gray-800 pt-[20px]">
                  <div className="mb-[12px]">
                    <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Do you have a pitch deck?</label>
                    <div className="flex gap-[8px]">
                      {["Yes", "No"].map((opt) => (
                        <button
                          key={opt}
                          onClick={() => update("hasPitchDeck", opt === "Yes")}
                          className={`px-[16px] py-[8px] rounded-[8px] text-[13px] font-medium transition-all ${
                            (opt === "Yes" && data.hasPitchDeck) || (opt === "No" && !data.hasPitchDeck)
                              ? "bg-[#06201b] text-white dark:bg-lime-500 dark:text-black"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* If NO pitch deck — show what they want in one */}
                  {!data.hasPitchDeck && (
                    <div className="space-y-[16px]">
                      <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-[8px] p-[16px] border border-blue-100 dark:border-blue-800/30">
                        <p className="text-[13px] text-gray-600 dark:text-gray-400 !mb-[8px]">
                          <i className="ri-magic-line text-blue-500 mr-[4px]"></i>
                          <strong>No problem!</strong> We can help you create a pitch deck after onboarding.
                        </p>
                        <p className="text-[12px] text-gray-400 !mb-0">Tell us what you want your deck to cover:</p>
                      </div>
                      <div>
                        <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">What should your pitch deck include?</label>
                        <textarea
                          value={data.pitchDeckNeeds}
                          onChange={(e) => update("pitchDeckNeeds", e.target.value)}
                          placeholder="e.g., Problem, Solution, Market Size, Business Model, Traction, Team, Financials, Ask..."
                          rows={3}
                          className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Pitch Deck Style Picker — always visible */}
                  <div>
                    <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[8px]">
                      <i className="ri-sparkling-2-line text-lime-500 mr-[4px]"></i>
                      Choose a pitch deck style
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-[8px]">
                      {PITCH_DECK_STYLES.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => update("pitchDeckStyle", style.id)}
                          className={`text-left p-[16px] rounded-[8px] border-2 transition-all ${
                            data.pitchDeckStyle === style.id
                              ? "border-lime-500 bg-lime-50/50 dark:bg-lime-900/10"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                          }`}
                        >
                          <div className="flex items-center gap-[8px] mb-[6px]">
                            <div className={`w-[32px] h-[24px] rounded-[6px] ${style.preview} flex items-center justify-center`}>
                              <i className={`${style.icon} text-[12px] ${style.id === "bold" ? "text-white" : "text-gray-500"}`}></i>
                            </div>
                            <span className="text-[13px] font-semibold text-[#06201b] dark:text-white">{style.name}</span>
                            {data.pitchDeckStyle === style.id && (
                              <i className="ri-check-line text-lime-500 text-[14px] ml-auto"></i>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 !mb-0">{style.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4 — Traction */}
            {step === 4 && (
              <div className="space-y-[20px]">
                <p className="text-[13px] text-gray-400 !mb-0">
                  This information helps us match you with the right investors. All fields are optional.
                </p>
                <div>
                  <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Traction Stage</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-[8px]">
                    {TRACTION_STAGES.map((stage) => (
                      <button
                        key={stage.id}
                        onClick={() => update("tractionStage", stage.id)}
                        className={`text-left p-[8px] rounded-[8px] border-2 transition-all ${
                          data.tractionStage === stage.id
                            ? "border-lime-500 bg-lime-50/50 dark:bg-lime-900/10"
                            : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                        }`}
                      >
                        <span className="text-[12px] font-semibold text-[#06201b] dark:text-white block">{stage.name}</span>
                        <span className="text-[10px] text-gray-400 block mt-[2px]">{stage.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-[16px]">
                  <div>
                    <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Monthly Revenue (MRR)</label>
                    <input
                      type="text"
                      value={data.mrr}
                      onChange={(e) => update("mrr", e.target.value)}
                      placeholder="e.g., 50000"
                      className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Annual Revenue (ARR)</label>
                    <input
                      type="text"
                      value={data.arr}
                      onChange={(e) => update("arr", e.target.value)}
                      placeholder="e.g., 600000"
                      className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-[16px]">
                  <div>
                    <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Customer Count</label>
                    <input
                      type="text"
                      value={data.customerCount}
                      onChange={(e) => update("customerCount", e.target.value)}
                      placeholder="e.g., 150"
                      className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Growth Rate</label>
                    <input
                      type="text"
                      value={data.growthRate}
                      onChange={(e) => update("growthRate", e.target.value)}
                      placeholder="e.g., 20% MoM"
                      className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-[16px]">
                  <div>
                    <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Employee Count</label>
                    <input
                      type="text"
                      value={data.employeeCount}
                      onChange={(e) => update("employeeCount", e.target.value)}
                      placeholder="e.g., 12"
                      className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">Key Milestones</label>
                    <input
                      type="text"
                      value={data.milestones}
                      onChange={(e) => update("milestones", e.target.value)}
                      placeholder="Comma-separated, e.g., YC W24, 100 customers"
                      className="w-full py-[10px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 5 — Team */}
            {step === 5 && (
              <div className="space-y-[20px]">
                <p className="text-[13px] text-gray-400 !mb-0">
                  Add your founding team. This helps investors understand who is behind the company.
                </p>
                {data.teamMembers.map((member, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-800/30 rounded-[8px] p-[16px] space-y-[12px]">
                    <div className="flex items-center justify-between">
                      <Badge variant={member.isFounder ? "success" : "default"} size="sm">
                        {member.isFounder ? "Founder" : "Team Member"}
                      </Badge>
                      {idx > 0 && (
                        <button
                          onClick={() => {
                            const updated = [...data.teamMembers];
                            updated.splice(idx, 1);
                            update("teamMembers", updated);
                          }}
                          className="text-[12px] text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-[12px]">
                      <input
                        type="text"
                        value={member.name}
                        onChange={(e) => {
                          const updated = [...data.teamMembers];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          update("teamMembers", updated);
                        }}
                        placeholder="Full name"
                        className="py-[9px] px-[12px] text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                      />
                      <input
                        type="text"
                        value={member.title}
                        onChange={(e) => {
                          const updated = [...data.teamMembers];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          update("teamMembers", updated);
                        }}
                        placeholder="Title"
                        className="py-[9px] px-[12px] text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                      />
                    </div>
                    <input
                      type="url"
                      value={member.linkedinUrl}
                      onChange={(e) => {
                        const updated = [...data.teamMembers];
                        updated[idx] = { ...updated[idx], linkedinUrl: e.target.value };
                        update("teamMembers", updated);
                      }}
                      placeholder="LinkedIn URL (optional)"
                      className="w-full py-[9px] px-[12px] text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                    />
                  </div>
                ))}
                <button
                  onClick={() =>
                    update("teamMembers", [
                      ...data.teamMembers,
                      { name: "", title: "", linkedinUrl: "", isFounder: false },
                    ])
                  }
                  className="w-full py-[10px] border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[8px] text-[13px] text-gray-400 hover:border-lime-400 hover:text-lime-600 transition-all"
                >
                  + Add Team Member
                </button>
              </div>
            )}

            {/* Step 6 — Documents */}
            {step === 6 && (
              <div className="space-y-[20px]">
                <p className="text-[13px] text-gray-400 !mb-0">
                  Upload any existing materials. This is optional — you can always add documents later.
                </p>
                <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[12px] p-[30px] text-center">
                  <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[12px] text-gray-300 text-[20px]">
                    <i className="ri-upload-cloud-2-line"></i>
                  </div>
                  <p className="text-[14px] text-gray-400 !mb-[4px]">Drag & drop files here</p>
                  <p className="text-[12px] text-gray-300 dark:text-gray-600 !mb-[12px]">
                    PDF, PPTX, DOCX — Pitch decks, business plans, financial models
                  </p>
                  <Button variant="outline" size="sm">
                    <i className="ri-file-upload-line text-[16px]"></i>
                    Browse Files
                  </Button>
                </div>
                <div className="bg-lime-50/50 dark:bg-lime-900/10 rounded-[8px] p-[16px] border border-lime-100 dark:border-lime-800/30">
                  <p className="text-[13px] text-gray-600 dark:text-gray-400 !mb-0">
                    <i className="ri-sparkling-2-line text-lime-500 mr-[4px]"></i>
                    {data.hasPitchDeck
                      ? "You mentioned you have a pitch deck. Upload it here for AI analysis."
                      : "Don't have a pitch deck yet? We can help you create one after onboarding."}
                  </p>
                </div>
              </div>
            )}

            {/* Step 7 — Review & Launch */}
            {step === 7 && (
              <div className="space-y-[20px]">
                <div className="bg-lime-50/50 dark:bg-lime-900/10 rounded-[12px] p-[20px] border border-lime-100 dark:border-lime-800/30 text-center">
                  <div className="w-[56px] h-[56px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center mx-auto mb-[12px] text-lime-600 text-[24px]">
                    <i className="ri-check-double-line"></i>
                  </div>
                  <h3 className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-[4px]">
                    Your workspace is ready
                  </h3>
                  <p className="text-[14px] text-gray-400 !mb-0">
                    Here is a summary of what you have told us about your company.
                  </p>
                </div>

                {/* Summary */}
                <div className="space-y-[12px]">
                  {[
                    { label: "Company", value: data.companyName || "Not set" },
                    { label: "Industry", value: data.industry || "Not set" },
                    { label: "Stage", value: data.companyStage || "Not set" },
                    { label: "Description", value: data.oneLiner || "Not set" },
                    { label: "Differentiator", value: data.differentiator || "Not set" },
                    { label: "Target Customer", value: data.targetCustomer || "Not set" },
                    { label: "Raising", value: (() => {
                      if (!data.currentlyRaising) return "Not currently raising";
                      const inputHasSuffix = /[kKmMbB]$/.test(data.fundingAmount);
                      const raw = inputHasSuffix ? data.fundingAmount : data.fundingAmount + data.fundingUnit;
                      const parsed = parseFundingAmount(raw);
                      return `Yes — ${data.roundType || "Round"} ${parsed.display || "$" + (data.fundingAmount || "?")}`;
                    })() },
                    { label: "Traction", value: TRACTION_STAGES.find((s) => s.id === data.tractionStage)?.name || "Not set" },
                    { label: "MRR", value: data.mrr ? `$${Number(data.mrr).toLocaleString()}` : "Not set" },
                    { label: "Customers", value: data.customerCount || "Not set" },
                    { label: "Team", value: data.teamMembers.filter((m) => m.name.trim()).map((m) => m.name).join(", ") || "Not set" },
                    { label: "Deck Style", value: PITCH_DECK_STYLES.find((s) => s.id === data.pitchDeckStyle)?.name || "Investor-First" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-[8px] border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <span className="text-[13px] text-gray-400">{item.label}</span>
                      <span className="text-[13px] font-medium text-[#06201b] dark:text-white text-right max-w-[60%] truncate">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>

                {!data.hasPitchDeck && (
                  <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-[8px] p-[16px] border border-blue-100 dark:border-blue-800/30">
                    <p className="text-[13px] text-gray-600 dark:text-gray-400 !mb-0">
                      <i className="ri-magic-line text-blue-500 mr-[4px]"></i>
                      <strong>Next step:</strong> After launching, go to <strong>Pitch Decks</strong> to generate your {PITCH_DECK_STYLES.find((s) => s.id === data.pitchDeckStyle)?.name || "Investor-First"} style deck with one click.
                    </p>
                  </div>
                )}

                <div className="bg-amber-50/50 dark:bg-amber-900/10 rounded-[8px] p-[16px] border border-amber-100 dark:border-amber-800/30">
                  <p className="text-[13px] text-gray-600 dark:text-gray-400 !mb-0">
                    <i className="ri-information-line text-amber-500 mr-[4px]"></i>
                    You can edit your company profile anytime from the dashboard.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-[28px] pt-[20px] border-t border-gray-100 dark:border-gray-800">
              {step > 1 ? (
                <Button variant="outline" onClick={handleBack}>
                  <i className="ri-arrow-left-line text-[16px]"></i>
                  Back
                </Button>
              ) : (
                <div></div>
              )}

              {step < 7 ? (
                <Button onClick={handleNext} disabled={saving}>
                  {saving ? "Saving..." : "Continue"}
                  <i className="ri-arrow-right-line text-[16px]"></i>
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={saving}>
                  {saving ? "Launching..." : "Launch Workspace"}
                  <i className="ri-rocket-2-line text-[16px]"></i>
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Skip */}
        {step < 7 && (
          <div className="text-center mt-[16px]">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-[13px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip for now →
            </button>
          </div>
        )}
      </div>

      {/* Workspace Loading Overlay */}
      {launchStage >= 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-[#0a0e19]/90 backdrop-blur-sm">
          <div className="text-center max-w-[360px] px-[20px]">
            {/* Rocket icon with pulse */}
            <div className="relative mb-[24px]">
              <div className="w-[72px] h-[72px] rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center mx-auto">
                <i className="ri-rocket-2-line text-[32px] text-lime-600 animate-bounce"></i>
              </div>
              <div className="absolute -top-[4px] -right-[4px] w-[20px] h-[20px] rounded-full bg-lime-500 flex items-center justify-center">
                <i className="ri-check-line text-white text-[12px]"></i>
              </div>
            </div>

            <h2 className="text-[20px] font-bold text-[#06201b] dark:text-white mb-[8px]">
              Launching your workspace...
            </h2>

            {/* Progress steps */}
            <div className="space-y-[10px] mt-[24px]">
              {LAUNCH_STAGES.map((stage, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-[8px] px-[14px] py-[8px] rounded-[8px] transition-all duration-300 ${
                    i < launchStage
                      ? "bg-lime-50/80 dark:bg-lime-900/10"
                      : i === launchStage
                      ? "bg-lime-100/80 dark:bg-lime-900/20 ring-2 ring-lime-500/30"
                      : "bg-transparent"
                  }`}
                >
                  <div className={`w-[24px] h-[24px] rounded-full flex items-center justify-center flex-none ${
                    i < launchStage
                      ? "bg-lime-500 text-white"
                      : i === launchStage
                      ? "bg-lime-200 dark:bg-lime-800 text-lime-600"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-300"
                  }`}>
                    {i < launchStage ? (
                      <i className="ri-check-line text-[12px]"></i>
                    ) : i === launchStage ? (
                      <div className="w-[6px] h-[6px] rounded-full bg-lime-500 animate-pulse"></div>
                    ) : (
                      <div className="w-[6px] h-[6px] rounded-full bg-gray-300 dark:bg-gray-600"></div>
                    )}
                  </div>
                  <span className={`text-[13px] ${
                    i <= launchStage ? "text-[#06201b] dark:text-white font-medium" : "text-gray-400"
                  }`}>
                    {stage.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {launchError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 dark:bg-[#0a0e19]/90 backdrop-blur-sm">
          <div className="text-center max-w-[380px] px-[20px]">
            <div className="w-[64px] h-[64px] rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-[16px]">
              <i className="ri-error-warning-line text-[28px] text-red-500"></i>
            </div>
            <h3 className="text-[18px] font-bold text-[#06201b] dark:text-white mb-[8px]">
              Workspace Initialization Failed
            </h3>
            <p className="text-[14px] text-gray-500 mb-[20px]">
              {launchError}
            </p>
            <div className="flex gap-[8px] justify-center">
              <Button onClick={handleComplete}>
                <i className="ri-refresh-line text-[16px] mr-[4px]"></i>
                Retry
              </Button>
              <Button variant="outline" onClick={() => { setLaunchError(null); setLaunchStage(-1); }}>
                Go Back
              </Button>
            </div>
            <p className="text-[12px] text-gray-400 mt-[12px]">
              Your onboarding data has been saved and will not be lost.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
