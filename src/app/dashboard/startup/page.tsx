"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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
  hasPitchDeck: boolean;
  mrr: number | null;
  arr: number | null;
  customerCount: number | null;
  growthRate: string | null;
  milestones: string[];
  employeeCount: number | null;
  onboardingCompleted: boolean;
  readinessScore: number;
}

interface TeamMember {
  id: string;
  name: string;
  title: string | null;
  linkedinUrl: string | null;
  isFounder: boolean;
}

interface CompanyDocument {
  id: string;
  documentType: string;
  fileName: string;
  fileSize: number | null;
  createdAt: string;
}

const stageColors: Record<string, string> = {
  "Pre-Seed": "bg-gray-100 text-gray-600",
  "Seed": "bg-blue-50 text-blue-600",
  "Series A": "bg-purple-50 text-purple-600",
  "Series B": "bg-amber-50 text-amber-600",
  "Series C": "bg-red-50 text-red-600",
  "Growth": "bg-green-50 text-green-600",
};

export default function StartupPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { getOrCreateCompanyProfile, getTeamMembers, getCompanyDocuments } = await import("@/lib/actions/company");
      const [profileData, teamData, docsData] = await Promise.all([
        getOrCreateCompanyProfile(),
        getTeamMembers(),
        getCompanyDocuments(),
      ]);
      if (profileData) setProfile(profileData);
      setTeam(teamData);
      setDocuments(docsData);
    } catch {
      // Data may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div>
        <PageHeader title="My Startup" description="Loading your company profile..." />
        <div className="animate-pulse space-y-[20px]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[120px] bg-gray-100 dark:bg-gray-800 rounded-[12px]"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <PageHeader title="My Startup" description="Set up your company profile to improve investor matching." />
        <Card>
          <CardBody className="text-center py-[40px]">
            <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 text-[24px]">
              <i className="ri-building-line"></i>
            </div>
            <p className="text-[14px] text-gray-400 !mb-[16px]">No company profile yet.</p>
            <Link href="/onboarding">
              <Button>Complete Onboarding</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const readinessColor = profile.readinessScore >= 80 ? "text-green-600" : profile.readinessScore >= 50 ? "text-amber-600" : "text-red-500";

  return (
    <div>
      <PageHeader
        title={profile.companyName || "My Startup"}
        description={profile.oneLiner || "Manage your company profile and investment information."}
        actions={
          <Link href="/onboarding">
            <Button variant="outline" size="sm">
              <i className="ri-edit-line text-[16px]"></i>
              Edit Profile
            </Button>
          </Link>
        }
      />

      {/* Readiness Score */}
      <Card className="mb-[20px]">
        <CardBody className="p-[20px]">
          <div className="flex items-center gap-[16px]">
            <div className="w-[56px] h-[56px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center flex-none">
              <span className={`text-[20px] font-bold ${readinessColor}`}>{profile.readinessScore}%</span>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                Fundraising Readiness
              </p>
              <p className="text-[12px] text-gray-400 !mb-0">
                {profile.readinessScore >= 80
                  ? "Your profile is strong. Start discovering investors."
                  : profile.readinessScore >= 50
                  ? "Good progress. Complete more fields to strengthen your profile."
                  : "Complete your profile to improve investor matching."}
              </p>
            </div>
            <div className="w-[120px] h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex-none">
              <div
                className="h-full bg-lime-500 rounded-full transition-all"
                style={{ width: `${profile.readinessScore}%` }}
              ></div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Pitch Deck CTA */}
      {!profile.hasPitchDeck && (
        <Card className="mb-[20px]">
          <CardBody className="p-[20px]">
            <div className="flex items-center gap-[16px]">
              <div className="w-[48px] h-[48px] rounded-[12px] bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center flex-none">
                <i className="ri-magic-line text-lime-600 text-[22px]"></i>
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                  Generate Your Pitch Deck
                </p>
                <p className="text-[12px] text-gray-400 !mb-0">
                  AI creates a complete investor pitch deck from your company profile in under 30 seconds.
                </p>
              </div>
              <Link href="/dashboard/decks/new">
                <Button size="sm">
                  <i className="ri-magic-line text-[14px] mr-[4px]"></i>
                  Generate Deck
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px]">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <h3 className="!text-[16px] !font-semibold !mb-0">Company Information</h3>
          </CardHeader>
          <CardBody className="pt-0 space-y-[12px]">
            {[
              { label: "Industry", value: profile.industry },
              { label: "Stage", value: profile.companyStage, badge: profile.companyStage ? stageColors[profile.companyStage] : undefined },
              { label: "Business Model", value: profile.businessModel },
              { label: "Location", value: profile.location },
              { label: "Website", value: profile.websiteUrl, link: true },
              { label: "Differentiator", value: profile.differentiator },
              { label: "Target Customer", value: profile.targetCustomer },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-[6px] border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                <span className="text-[13px] text-gray-400">{item.label}</span>
                {item.badge ? (
                  <Badge className={item.badge} size="sm">{item.value}</Badge>
                ) : item.link && item.value ? (
                  <a href={item.value} target="_blank" rel="noopener noreferrer" className="text-[13px] font-medium text-lime-600 hover:text-lime-700 truncate max-w-[60%]">
                    {item.value.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="text-[13px] font-medium text-[#06201b] dark:text-white text-right max-w-[60%] truncate">
                    {item.value || "—"}
                  </span>
                )}
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Fundraising */}
        <Card>
          <CardHeader>
            <h3 className="!text-[16px] !font-semibold !mb-0">Fundraising</h3>
          </CardHeader>
          <CardBody className="pt-0 space-y-[12px]">
            <div className="flex items-center justify-between py-[6px] border-b border-gray-50 dark:border-gray-800/50">
              <span className="text-[13px] text-gray-400">Currently Raising</span>
              <Badge variant={profile.currentlyRaising ? "success" : "default"} size="sm">
                {profile.currentlyRaising ? "Yes" : "No"}
              </Badge>
            </div>
            {profile.currentlyRaising && (
              <>
                <div className="flex items-center justify-between py-[6px] border-b border-gray-50 dark:border-gray-800/50">
                  <span className="text-[13px] text-gray-400">Round Type</span>
                  <span className="text-[13px] font-medium text-[#06201b] dark:text-white">{profile.roundType || "—"}</span>
                </div>
                <div className="flex items-center justify-between py-[6px] border-b border-gray-50 dark:border-gray-800/50">
                  <span className="text-[13px] text-gray-400">Funding Amount</span>
                  <span className="text-[13px] font-medium text-[#06201b] dark:text-white">
                    {profile.fundingAmount ? `$${profile.fundingAmount.toLocaleString()}` : "—"}
                  </span>
                </div>
                {profile.targetInvestorGeographies.length > 0 && (
                  <div className="py-[6px] border-b border-gray-50 dark:border-gray-800/50">
                    <span className="text-[13px] text-gray-400 block mb-[6px]">Target Geographies</span>
                    <div className="flex flex-wrap gap-[4px]">
                      {profile.targetInvestorGeographies.map((g) => (
                        <Badge key={g} variant="default" size="sm">{g}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="flex items-center justify-between py-[6px] border-b border-gray-50 dark:border-gray-800/50">
              <span className="text-[13px] text-gray-400">Pitch Deck</span>
              <Badge variant={profile.hasPitchDeck ? "success" : "warning"} size="sm">
                {profile.hasPitchDeck ? "Uploaded" : "Not uploaded"}
              </Badge>
            </div>
          </CardBody>
        </Card>

        {/* Traction */}
        <Card>
          <CardHeader>
            <h3 className="!text-[16px] !font-semibold !mb-0">Traction</h3>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="grid grid-cols-2 gap-[16px]">
              {[
                { label: "MRR", value: profile.mrr ? `$${profile.mrr.toLocaleString()}` : "—" },
                { label: "ARR", value: profile.arr ? `$${profile.arr.toLocaleString()}` : "—" },
                { label: "Customers", value: profile.customerCount ? profile.customerCount.toLocaleString() : "—" },
                { label: "Growth", value: profile.growthRate || "—" },
                { label: "Employees", value: profile.employeeCount ? String(profile.employeeCount) : "—" },
                { label: "Milestones", value: profile.milestones.length > 0 ? profile.milestones.length + " listed" : "—" },
              ].map((item) => (
                <div key={item.label} className="text-center p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
                  <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{item.value}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">{item.label}</p>
                </div>
              ))}
            </div>
            {profile.milestones.length > 0 && (
              <div className="mt-[14px]">
                <span className="text-[12px] text-gray-400 uppercase tracking-wide block mb-[6px]">Key Milestones</span>
                <div className="flex flex-wrap gap-[6px]">
                  {profile.milestones.map((m, i) => (
                    <Badge key={i} variant="info" size="sm">{m}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Team */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="!text-[16px] !font-semibold !mb-0">Team</h3>
              <span className="text-[12px] text-gray-400">{team.length} member{team.length !== 1 ? "s" : ""}</span>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            {team.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center !mb-0 py-[20px]">
                No team members added yet.
              </p>
            ) : (
              <div className="space-y-[10px]">
                {team.map((member) => (
                  <div key={member.id} className="flex items-center gap-[12px] p-[10px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
                    <div className="w-[36px] h-[36px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[13px] font-semibold text-lime-700 dark:text-lime-400 flex-none">
                      {member.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">{member.name}</p>
                      <p className="text-[11px] text-gray-400 !mb-0">{member.title || "Team Member"}</p>
                    </div>
                    {member.isFounder && (
                      <Badge variant="success" size="sm">Founder</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Documents */}
      {documents.length > 0 && (
        <Card className="mt-[20px]">
          <CardHeader>
            <h3 className="!text-[16px] !font-semibold !mb-0">Documents</h3>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-[8px]">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-[12px] p-[10px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
                  <div className="w-[36px] h-[36px] rounded-[8px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-[16px] flex-none">
                    <i className="ri-file-text-line"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0 truncate">{doc.fileName}</p>
                    <p className="text-[11px] text-gray-400 !mb-0">{doc.documentType} • {doc.fileSize ? `${(doc.fileSize / 1024).toFixed(0)} KB` : "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
