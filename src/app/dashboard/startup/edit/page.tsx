"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface CompanyProfile {
  id: string;
  companyName: string | null;
  websiteUrl: string | null;
  industry: string | null;
  location: string | null;
  companyStage: string | null;
  businessModel: string | null;
  oneLiner: string | null;
  description: string | null;
  differentiator: string | null;
  targetCustomer: string | null;
  currentlyRaising: boolean;
  fundingAmount: number | null;
  roundType: string | null;
  targetInvestorGeographies: string[];
  mrr: number | null;
  arr: number | null;
  customerCount: number | null;
  growthRate: string | null;
  milestones: string[];
  employeeCount: number | null;
}

const stages = ["Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Growth", "Late Stage"];
const businessModels = ["SaaS", "Marketplace", "Hardware", "Services", "Consumer", "Other"];
const industries = [
  "AI/ML", "Fintech", "SaaS", "HealthTech", "ClimateTech", "Consumer",
  "Web3", "DeepTech", "EdTech", "E-commerce", "Cybersecurity", "Other",
];

export default function StartupEditPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [form, setForm] = useState({
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
    roundType: "",
    targetInvestorGeographies: [] as string[],
    mrr: "",
    arr: "",
    customerCount: "",
    growthRate: "",
    milestones: [] as string[],
    employeeCount: "",
  });

  const [newMilestone, setNewMilestone] = useState("");
  const [newGeo, setNewGeo] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const { getOrCreateCompanyProfile } = await import("@/lib/actions/company");
      const data = await getOrCreateCompanyProfile();
      if (data) {
        setProfile(data);
        setForm({
          companyName: data.companyName || "",
          websiteUrl: data.websiteUrl || "",
          industry: data.industry || "",
          location: data.location || "",
          companyStage: data.companyStage || "",
          businessModel: data.businessModel || "",
          oneLiner: data.oneLiner || "",
          description: data.description || "",
          differentiator: data.differentiator || "",
          targetCustomer: data.targetCustomer || "",
          currentlyRaising: data.currentlyRaising,
          fundingAmount: data.fundingAmount ? String(data.fundingAmount) : "",
          roundType: data.roundType || "",
          targetInvestorGeographies: data.targetInvestorGeographies || [],
          mrr: data.mrr ? String(data.mrr) : "",
          arr: data.arr ? String(data.arr) : "",
          customerCount: data.customerCount ? String(data.customerCount) : "",
          growthRate: data.growthRate || "",
          milestones: data.milestones || [],
          employeeCount: data.employeeCount ? String(data.employeeCount) : "",
        });
      }
    } catch {
      // No profile yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  const updateField = (field: string, value: string | boolean | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { updateCompanyProfile } = await import("@/lib/actions/company");
      await updateCompanyProfile({
        companyName: form.companyName || null,
        websiteUrl: form.websiteUrl || null,
        industry: form.industry || null,
        location: form.location || null,
        companyStage: form.companyStage || null,
        businessModel: form.businessModel || null,
        oneLiner: form.oneLiner || null,
        description: form.description || null,
        differentiator: form.differentiator || null,
        targetCustomer: form.targetCustomer || null,
        currentlyRaising: form.currentlyRaising,
        fundingAmount: form.fundingAmount ? Number(form.fundingAmount) : null,
        roundType: form.roundType || null,
        targetInvestorGeographies: form.targetInvestorGeographies,
        mrr: form.mrr ? Number(form.mrr) : null,
        arr: form.arr ? Number(form.arr) : null,
        customerCount: form.customerCount ? Number(form.customerCount) : null,
        growthRate: form.growthRate || null,
        milestones: form.milestones,
        employeeCount: form.employeeCount ? Number(form.employeeCount) : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save:", err);
    } finally {
      setSaving(false);
    }
  };

  const addMilestone = () => {
    if (newMilestone.trim()) {
      updateField("milestones", [...form.milestones, newMilestone.trim()]);
      setNewMilestone("");
    }
  };

  const removeMilestone = (idx: number) => {
    updateField("milestones", form.milestones.filter((_, i) => i !== idx));
  };

  const addGeo = () => {
    if (newGeo.trim()) {
      updateField("targetInvestorGeographies", [...form.targetInvestorGeographies, newGeo.trim()]);
      setNewGeo("");
    }
  };

  const removeGeo = (idx: number) => {
    updateField("targetInvestorGeographies", form.targetInvestorGeographies.filter((_, i) => i !== idx));
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Edit Company Profile" description="Loading..." />
        <div className="animate-pulse space-y-[20px]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] bg-gray-100 dark:bg-gray-800 rounded-[12px]" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <PageHeader title="Edit Company Profile" description="No profile found." />
        <Card>
          <CardBody className="text-center py-[40px]">
            <p className="text-[14px] text-gray-400 !mb-[16px]">Complete onboarding first.</p>
            <Link href="/onboarding"><Button>Start Onboarding</Button></Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const inputClass = "w-full py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30";
  const labelClass = "block text-[13px] font-medium text-gray-500 dark:text-gray-400 !mb-[6px]";

  return (
    <div className="max-w-[800px]">
      <PageHeader
        title="Edit Company Profile"
        description="Update your company information. Changes are reflected in investor matching."
        actions={
          <div className="flex items-center gap-[10px]">
            {saved && <span className="text-[13px] text-green-600">✓ Saved</span>}
            <Link href="/dashboard/startup">
              <Button variant="outline" size="sm">Back</Button>
            </Link>
          </div>
        }
      />

      {/* Company Identity */}
      <Card className="mb-[20px]">
        <CardHeader><h3 className="!text-[16px] !font-semibold !mb-0">Company Identity</h3></CardHeader>
        <CardBody className="pt-0 space-y-[16px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
            <div>
              <label className={labelClass}>Company Name *</label>
              <input className={inputClass} value={form.companyName} onChange={(e) => updateField("companyName", e.target.value)} placeholder="Acme Inc" />
            </div>
            <div>
              <label className={labelClass}>Website</label>
              <input className={inputClass} value={form.websiteUrl} onChange={(e) => updateField("websiteUrl", e.target.value)} placeholder="https://acme.com" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[16px]">
            <div>
              <label className={labelClass}>Industry</label>
              <select className={inputClass} value={form.industry} onChange={(e) => updateField("industry", e.target.value)}>
                <option value="">Select...</option>
                {industries.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Stage</label>
              <select className={inputClass} value={form.companyStage} onChange={(e) => updateField("companyStage", e.target.value)}>
                <option value="">Select...</option>
                {stages.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Business Model</label>
              <select className={inputClass} value={form.businessModel} onChange={(e) => updateField("businessModel", e.target.value)}>
                <option value="">Select...</option>
                {businessModels.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Location</label>
            <input className={inputClass} value={form.location} onChange={(e) => updateField("location", e.target.value)} placeholder="San Francisco, CA" />
          </div>
        </CardBody>
      </Card>

      {/* What You Build */}
      <Card className="mb-[20px]">
        <CardHeader><h3 className="!text-[16px] !font-semibold !mb-0">What You Build</h3></CardHeader>
        <CardBody className="pt-0 space-y-[16px]">
          <div>
            <label className={labelClass}>One-liner *</label>
            <input className={inputClass} value={form.oneLiner} onChange={(e) => updateField("oneLiner", e.target.value)} placeholder="We help..." />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={`${inputClass} min-h-[100px] resize-y`} value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Describe your product..." />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
            <div>
              <label className={labelClass}>Differentiator</label>
              <input className={inputClass} value={form.differentiator} onChange={(e) => updateField("differentiator", e.target.value)} placeholder="What makes you unique?" />
            </div>
            <div>
              <label className={labelClass}>Target Customer</label>
              <input className={inputClass} value={form.targetCustomer} onChange={(e) => updateField("targetCustomer", e.target.value)} placeholder="Who is your customer?" />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Fundraising */}
      <Card className="mb-[20px]">
        <CardHeader><h3 className="!text-[16px] !font-semibold !mb-0">Fundraising</h3></CardHeader>
        <CardBody className="pt-0 space-y-[16px]">
          <label className="flex items-center gap-[10px] cursor-pointer">
            <input type="checkbox" checked={form.currentlyRaising} onChange={(e) => updateField("currentlyRaising", e.target.checked)} className="w-[18px] h-[18px] accent-lime-500 rounded" />
            <span className="text-[14px] text-[#06201b] dark:text-white">Currently raising</span>
          </label>
          {form.currentlyRaising && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[16px]">
              <div>
                <label className={labelClass}>Round Type</label>
                <select className={inputClass} value={form.roundType} onChange={(e) => updateField("roundType", e.target.value)}>
                  <option value="">Select...</option>
                  {stages.filter(s => s !== "Growth" && s !== "Late Stage").map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Funding Amount ($)</label>
                <input className={inputClass} type="number" value={form.fundingAmount} onChange={(e) => updateField("fundingAmount", e.target.value)} placeholder="500000" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Target Investor Geographies</label>
                <div className="flex flex-wrap gap-[6px] mb-[8px]">
                  {form.targetInvestorGeographies.map((g, i) => (
                    <span key={i} className="inline-flex items-center gap-[4px] px-[10px] py-[4px] bg-lime-50 dark:bg-lime-900/20 text-lime-700 dark:text-lime-400 rounded-full text-[12px]">
                      {g}
                      <button onClick={() => removeGeo(i)} className="text-lime-500 hover:text-lime-700">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-[8px]">
                  <input className={`${inputClass} flex-1`} value={newGeo} onChange={(e) => setNewGeo(e.target.value)} placeholder="e.g. US, Europe" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGeo())} />
                  <Button variant="outline" size="sm" onClick={addGeo}>Add</Button>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Traction */}
      <Card className="mb-[20px]">
        <CardHeader><h3 className="!text-[16px] !font-semibold !mb-0">Traction</h3></CardHeader>
        <CardBody className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-[16px]">
            <div>
              <label className={labelClass}>MRR ($)</label>
              <input className={inputClass} type="number" value={form.mrr} onChange={(e) => updateField("mrr", e.target.value)} placeholder="10000" />
            </div>
            <div>
              <label className={labelClass}>ARR ($)</label>
              <input className={inputClass} type="number" value={form.arr} onChange={(e) => updateField("arr", e.target.value)} placeholder="120000" />
            </div>
            <div>
              <label className={labelClass}>Customers</label>
              <input className={inputClass} type="number" value={form.customerCount} onChange={(e) => updateField("customerCount", e.target.value)} placeholder="50" />
            </div>
            <div>
              <label className={labelClass}>Growth Rate</label>
              <input className={inputClass} value={form.growthRate} onChange={(e) => updateField("growthRate", e.target.value)} placeholder="15% MoM" />
            </div>
            <div>
              <label className={labelClass}>Employees</label>
              <input className={inputClass} type="number" value={form.employeeCount} onChange={(e) => updateField("employeeCount", e.target.value)} placeholder="12" />
            </div>
          </div>
          <div className="mt-[16px]">
            <label className={labelClass}>Milestones</label>
            <div className="flex flex-wrap gap-[6px] mb-[8px]">
              {form.milestones.map((m, i) => (
                <span key={i} className="inline-flex items-center gap-[4px] px-[10px] py-[4px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-full text-[12px]">
                  {m}
                  <button onClick={() => removeMilestone(i)} className="text-gray-400 hover:text-gray-600">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-[8px]">
              <input className={`${inputClass} flex-1`} value={newMilestone} onChange={(e) => setNewMilestone(e.target.value)} placeholder="e.g. Launched v2.0" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addMilestone())} />
              <Button variant="outline" size="sm" onClick={addMilestone}>Add</Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-[12px] mb-[40px]">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        <Link href="/dashboard/startup">
          <Button variant="outline">Cancel</Button>
        </Link>
        {saved && <span className="text-[13px] text-green-600">✓ Changes saved successfully</span>}
      </div>
    </div>
  );
}
