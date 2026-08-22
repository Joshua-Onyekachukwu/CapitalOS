"use client";

import React, { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface EmailDraft {
  id: string;
  investorName: string;
  investorFirm: string;
  subject: string;
  preview: string;
  status: "pending" | "approved" | "sent" | "replied";
  createdAt: string;
  fitScore: number;
}

const sampleDrafts: EmailDraft[] = [
  {
    id: "1",
    investorName: "Sarah Chen",
    investorFirm: "Sequoia Capital",
    subject: "Capital OS — AI-powered fundraising for B2B SaaS",
    preview: "Hi Sarah, I noticed your recent investment in Developer Tools startups. Our platform helps founders like me discover the right investors...",
    status: "pending",
    createdAt: "2h ago",
    fitScore: 94,
  },
  {
    id: "2",
    investorName: "Marcus Williams",
    investorFirm: "a16z",
    subject: "Re: Your thesis on AI infrastructure",
    preview: "Hi Marcus, Your recent talk on AI infrastructure resonated with our approach. We're building the operating system for startup fundraising...",
    status: "approved",
    createdAt: "5h ago",
    fitScore: 91,
  },
  {
    id: "3",
    investorName: "Priya Patel",
    investorFirm: "Y Combinator",
    subject: "Founder seeking Seed round — AI/SaaS",
    preview: "Hi Priya, We're raising a $2M seed round for Capital OS, an AI-powered platform that helps founders manage the entire fundraising process...",
    status: "sent",
    createdAt: "1d ago",
    fitScore: 88,
  },
];

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "info" | "default" }> = {
  pending: { label: "Needs Review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  sent: { label: "Sent", variant: "info" },
  replied: { label: "Replied", variant: "success" },
};

export default function OutreachPage() {
  const [activeTab, setActiveTab] = useState("drafts");
  const [selectedDraft, setSelectedDraft] = useState<EmailDraft | null>(sampleDrafts[0]);

  const tabs = [
    { id: "drafts", label: "Drafts", count: sampleDrafts.filter((d) => d.status === "pending").length },
    { id: "approved", label: "Approved", count: sampleDrafts.filter((d) => d.status === "approved").length },
    { id: "sent", label: "Sent", count: sampleDrafts.filter((d) => d.status === "sent").length },
    { id: "replies", label: "Replies", count: 0 },
  ];

  const filteredDrafts = activeTab === "drafts"
    ? sampleDrafts.filter((d) => d.status === "pending")
    : activeTab === "approved"
    ? sampleDrafts.filter((d) => d.status === "approved")
    : activeTab === "sent"
    ? sampleDrafts.filter((d) => d.status === "sent")
    : [];

  return (
    <div>
      <PageHeader
        title="Outreach"
        description="Review AI-generated emails and manage your outreach."
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-[20px]">
        {/* Email List */}
        <div className="lg:col-span-2">
          <Card>
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
            <CardBody className="p-0">
              {filteredDrafts.length === 0 ? (
                <div className="p-[20px]">
                  <EmptyState
                    icon={<i className="ri-mail-line"></i>}
                    title="No emails here"
                    description="AI-generated drafts will appear here for your review."
                  />
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredDrafts.map((draft) => {
                    const config = statusConfig[draft.status];
                    return (
                      <button
                        key={draft.id}
                        onClick={() => setSelectedDraft(draft)}
                        className={`w-full text-left p-[16px] hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                          selectedDraft?.id === draft.id ? "bg-lime-50/50 dark:bg-lime-900/10 border-l-2 border-l-lime-500" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-[4px]">
                          <p className="text-[13px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">
                            {draft.investorName}
                          </p>
                          <Badge variant={config.variant} size="sm">{config.label}</Badge>
                        </div>
                        <p className="text-[12px] text-gray-400 !mb-[4px] truncate">{draft.investorFirm}</p>
                        <p className="text-[12px] text-gray-500 dark:text-gray-400 !mb-0 truncate">{draft.subject}</p>
                        <div className="flex items-center gap-[8px] mt-[6px]">
                          <span className="text-[11px] text-gray-300 dark:text-gray-600">{draft.createdAt}</span>
                          <span className={`text-[11px] font-bold ${draft.fitScore >= 90 ? "text-green-600" : "text-amber-600"}`}>
                            {draft.fitScore}% fit
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Email Preview */}
        <div className="lg:col-span-3">
          {selectedDraft ? (
            <Card>
              <CardBody>
                <div className="flex items-center justify-between mb-[16px]">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
                      Email to {selectedDraft.investorName}
                    </h3>
                    <p className="text-[13px] text-gray-400 !mb-0">
                      {selectedDraft.investorFirm} • {selectedDraft.fitScore}% fit match
                    </p>
                  </div>
                  <Badge variant={statusConfig[selectedDraft.status].variant}>
                    {statusConfig[selectedDraft.status].label}
                  </Badge>
                </div>

                {/* Email Content */}
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-[10px] p-[20px] mb-[16px]">
                  <div className="mb-[12px]">
                    <span className="text-[12px] text-gray-400">Subject:</span>
                    <p className="text-[14px] font-medium text-[#06201b] dark:text-white !mb-0">
                      {selectedDraft.subject}
                    </p>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-[12px]">
                    <p className="text-[14px] text-gray-600 dark:text-gray-300 leading-[1.7] !mb-0">
                      {selectedDraft.preview}
                    </p>
                  </div>
                </div>

                {/* AI Analysis */}
                <div className="bg-lime-50/50 dark:bg-lime-900/10 rounded-[10px] p-[16px] mb-[16px] border border-lime-100 dark:border-lime-800/30">
                  <div className="flex items-center gap-[8px] mb-[8px]">
                    <i className="ri-sparkling-2-line text-lime-600 text-[16px]"></i>
                    <span className="text-[13px] font-semibold text-[#06201b] dark:text-white">AI Analysis</span>
                  </div>
                  <p className="text-[13px] text-gray-500 dark:text-gray-400 !mb-0 leading-[1.6]">
                    This email references {selectedDraft.investorFirm}&apos;s recent investments in B2B SaaS and aligns with their thesis on developer productivity tools.
                    Personalization score: <span className="font-bold text-lime-600">High</span>
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-[10px]">
                  {selectedDraft.status === "pending" && (
                    <>
                      <Button>
                        <i className="ri-check-line text-[16px]"></i>
                        Approve & Send
                      </Button>
                      <Button variant="outline">
                        <i className="ri-edit-line text-[16px]"></i>
                        Edit
                      </Button>
                      <Button variant="outline">
                        <i className="ri-refresh-line text-[16px]"></i>
                        Regenerate
                      </Button>
                    </>
                  )}
                  {selectedDraft.status === "approved" && (
                    <Button>
                      <i className="ri-send-plane-line text-[16px]"></i>
                      Send Now
                    </Button>
                  )}
                  {selectedDraft.status === "sent" && (
                    <Button variant="outline" disabled>
                      <i className="ri-check-double-line text-[16px]"></i>
                      Sent
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<i className="ri-mail-open-line"></i>}
                  title="Select an email"
                  description="Choose an email from the list to preview and take action."
                />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
