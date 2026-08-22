"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface InvestorRecord {
  id: string;
  first_name: string;
  last_name: string;
  firm_name: string;
  investor_type: string;
  fit_score: number;
  email_address: string | null;
}

interface EmailDraft {
  id: string;
  investorId: string;
  investorName: string;
  investorFirm: string;
  subject: string;
  body: string;
  status: "draft" | "approved" | "sent" | "replied";
  createdAt: string;
  fitScore: number;
  aiAnalysis?: string;
}

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "info" | "default" }> = {
  draft: { label: "Needs Review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  sent: { label: "Sent", variant: "info" },
  replied: { label: "Replied", variant: "success" },
};

export default function OutreachPage() {
  const [activeTab, setActiveTab] = useState("drafts");
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load investors from database for email drafting
  useEffect(() => {
    async function loadInvestors() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const { data } = await supabase
          .from("v_investors_with_firms")
          .select("id, first_name, last_name, firm_name, investor_type, fit_score, email")
          .not("email", "is", null)
          .order("fit_score", { ascending: false })
          .limit(50);

        if (data && data.length > 0) {
          const mappedDrafts: EmailDraft[] = data.map((inv: any) => ({
            id: `draft-${inv.id}`,
            investorId: inv.id,
            investorName: `${inv.first_name || ""} ${inv.last_name || ""}`.trim() || "Unknown Investor",
            investorFirm: inv.firm_name || "Unknown",
            subject: `Partnership opportunity — ${inv.firm_name || "your firm"}`,
            body: `Hi ${inv.first_name || "there"},\n\nI came across ${inv.firm_name || "your firm"}'s portfolio and believe Capital OS could be a strong fit for your investment thesis.\n\nWe're building the AI-powered operating system for startup fundraising, and I'd love to share how we can help streamline your deal flow.\n\nWould you be open to a brief conversation?\n\nBest regards`,
            status: "draft",
            createdAt: "Just now",
            fitScore: inv.fit_score || 75,
            aiAnalysis: `Investor type: ${(inv.investor_type || "Unknown").replace(/_/g, " ")}. Score: ${inv.fit_score || 75}%`,
          }));

          setDrafts(mappedDrafts);
          if (mappedDrafts.length > 0) {
            setSelectedDraft(mappedDrafts[0]);
          }
        }
      } catch {
        // Table may not have data yet
      } finally {
        setLoading(false);
      }
    }
    loadInvestors();
  }, []);

  const tabs = [
    { id: "drafts", label: "Drafts", count: drafts.filter((d) => d.status === "draft").length },
    { id: "approved", label: "Approved", count: drafts.filter((d) => d.status === "approved").length },
    { id: "sent", label: "Sent", count: drafts.filter((d) => d.status === "sent").length },
    { id: "replies", label: "Replies", count: 0 },
  ];

  const filteredDrafts = activeTab === "drafts"
    ? drafts.filter((d) => d.status === "draft")
    : activeTab === "approved"
    ? drafts.filter((d) => d.status === "approved")
    : activeTab === "sent"
    ? drafts.filter((d) => d.status === "sent")
    : [];

  const handleRegenerate = async () => {
    if (!selectedDraft) return;
    setGenerating(true);

    try {
      // Call the API route for AI email drafting
      const response = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorName: selectedDraft.investorName,
          investorFirm: selectedDraft.investorFirm,
          fitScore: selectedDraft.fitScore,
          aiAnalysis: selectedDraft.aiAnalysis,
          tone: "warm",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Draft generation failed:", data.error);
        return;
      }

      setDrafts((prev) =>
        prev.map((d) =>
          d.id === selectedDraft.id
            ? { ...d, subject: data.subject || d.subject, body: data.body || d.body, status: "draft" as const }
            : d
        )
      );
      setSelectedDraft((prev) =>
        prev
          ? { ...prev, subject: data.subject || prev.subject, body: data.body || prev.body, status: "draft" as const }
          : prev
      );
    } catch {
      // AI may not be available
    } finally {
      setGenerating(false);
    }
  };

  const handleApprove = () => {
    if (!selectedDraft) return;
    setDrafts((prev) =>
      prev.map((d) => (d.id === selectedDraft.id ? { ...d, status: "approved" as const } : d))
    );
    setSelectedDraft((prev) => (prev ? { ...prev, status: "approved" as const } : prev));
  };

  const handleSend = async () => {
    if (!selectedDraft) return;
    setSending(true);
    setSendResult(null);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setSendResult({ type: "error", text: "Please sign in to send emails." });
        return;
      }

      const response = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          investorId: selectedDraft.investorId,
          subject: selectedDraft.subject,
          bodyHtml: selectedDraft.body.replace(/\n/g, "<br>"),
          bodyText: selectedDraft.body,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setDrafts((prev) =>
          prev.map((d) => (d.id === selectedDraft.id ? { ...d, status: "sent" as const } : d))
        );
        setSelectedDraft((prev) => (prev ? { ...prev, status: "sent" as const } : prev));
        setSendResult({ type: "success", text: "Email sent successfully!" });
      } else {
        setSendResult({ type: "error", text: result.error || "Failed to send email." });
      }
    } catch (err) {
      setSendResult({ type: "error", text: `Failed to send: ${String(err)}` });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Outreach" description="Review AI-generated emails and manage your outreach." />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-[20px]">
          <div className="lg:col-span-2">
            <Card>
              <CardBody className="p-[16px]">
                <p className="text-[13px] text-gray-400 text-center !mb-0">Loading investors...</p>
              </CardBody>
            </Card>
          </div>
          <div className="lg:col-span-3">
            <Card>
              <CardBody>
                <p className="text-[13px] text-gray-400 text-center !mb-0">Select an investor to draft an email.</p>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    );
  }

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
                    description={activeTab === "drafts"
                      ? "Investor emails with matching profiles will appear here for your review."
                      : activeTab === "sent"
                      ? "Sent emails will appear here."
                      : "No emails in this category."}
                  />
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[500px] overflow-y-auto">
                  {filteredDrafts.map((draft) => {
                    const config = statusConfig[draft.status];
                    return (
                      <button
                        key={draft.id}
                        onClick={() => {
                          setSelectedDraft(draft);
                          setSendResult(null);
                        }}
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

                {sendResult && (
                  <div className={`rounded-[10px] p-[12px] mb-[16px] text-[13px] font-medium ${
                    sendResult.type === "success"
                      ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                      : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  }`}>
                    {sendResult.text}
                  </div>
                )}

                {/* Email Content */}
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-[10px] p-[20px] mb-[16px]">
                  <div className="mb-[12px]">
                    <span className="text-[12px] text-gray-400">Subject:</span>
                    <p className="text-[14px] font-medium text-[#06201b] dark:text-white !mb-0">
                      {selectedDraft.subject}
                    </p>
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-[12px]">
                    <p className="text-[14px] text-gray-600 dark:text-gray-300 leading-[1.7] !mb-0 whitespace-pre-line">
                      {selectedDraft.body}
                    </p>
                  </div>
                </div>

                {/* AI Analysis */}
                {selectedDraft.aiAnalysis && (
                  <div className="bg-lime-50/50 dark:bg-lime-900/10 rounded-[10px] p-[16px] mb-[16px] border border-lime-100 dark:border-lime-800/30">
                    <div className="flex items-center gap-[8px] mb-[8px]">
                      <i className="ri-sparkling-2-line text-lime-600 text-[16px]"></i>
                      <span className="text-[13px] font-semibold text-[#06201b] dark:text-white">AI Analysis</span>
                    </div>
                    <p className="text-[13px] text-gray-500 dark:text-gray-400 !mb-0 leading-[1.6]">
                      {selectedDraft.aiAnalysis}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-[10px] flex-wrap">
                  {selectedDraft.status === "draft" && (
                    <>
                      <Button onClick={handleApprove}>
                        <i className="ri-check-line text-[16px]"></i>
                        Approve
                      </Button>
                      <Button variant="outline" onClick={handleRegenerate} loading={generating}>
                        <i className="ri-refresh-line text-[16px]"></i>
                        Regenerate with AI
                      </Button>
                    </>
                  )}
                  {selectedDraft.status === "approved" && (
                    <Button onClick={handleSend} loading={sending}>
                      <i className="ri-send-plane-line text-[16px]"></i>
                      Send Now
                    </Button>
                  )}
                  {selectedDraft.status === "sent" && (
                    <Button variant="outline" disabled>
                      <i className="ri-check-double-line text-[16px]"></i>
                      Sent ✓
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
