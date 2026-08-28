"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  email: string | null;
  fit_score_breakdown?: Record<string, unknown>;
}

interface EmailDraft {
  id: string;
  investorId: string;
  investorName: string;
  investorFirm: string;
  investorType: string;
  subject: string;
  body: string;
  html?: string;
  text?: string;
  status: "draft" | "approved" | "sent" | "replied";
  createdAt: string;
  fitScore: number;
  aiAnalysis?: string;
  tone: string;
}

const TONE_OPTIONS = [
  { value: "warm", label: "Warm", icon: "ri-heart-line" },
  { value: "professional", label: "Professional", icon: "ri-briefcase-line" },
  { value: "casual", label: "Casual", icon: "ri-chat-smile-line" },
  { value: "bold", label: "Bold", icon: "ri-fire-line" },
  { value: "referral", label: "Referral", icon: "ri-user-shared-line" },
];

const statusConfig: Record<string, { label: string; variant: "success" | "warning" | "info" | "default" }> = {
  draft: { label: "Needs Review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  sent: { label: "Sent", variant: "info" },
  replied: { label: "Replied", variant: "success" },
};

export default function OutreachPage() {
  const [activeTab, setActiveTab] = useState("drafts");
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);

  // Persist drafts to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("outreach_drafts");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDrafts(parsed);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (drafts.length > 0) {
      localStorage.setItem("outreach_drafts", JSON.stringify(drafts));
    }
  }, [drafts]);
  const [selectedDraft, setSelectedDraft] = useState<EmailDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedTone, setSelectedTone] = useState("warm");
  const [customInstructions, setCustomInstructions] = useState("");
  const [showTonePicker, setShowTonePicker] = useState(false);

  // Bulk generation state
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0 });

  // Email account state
  const [emailConnected, setEmailConnected] = useState<boolean | null>(null);
  const [emailProvider, setEmailProvider] = useState<string | null>(null);

  // Inline editing state
  const [editingDraft, setEditingDraft] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  // Persist drafts to localStorage
  const saveDraftsToStorage = (d: EmailDraft[]) => {
    try {
      const serializable = d.filter((draft) => draft.body); // only save drafts with content
      localStorage.setItem("outreach-drafts", JSON.stringify(serializable));
    } catch { /* ignore */ }
  };

  const loadDraftsFromStorage = (): EmailDraft[] | null => {
    try {
      const stored = localStorage.getItem("outreach-drafts");
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return null;
  };

  // Load top-fit investors for email drafting
  const loadInvestors = useCallback(async () => {
    // First, try to restore persisted drafts
    const stored = loadDraftsFromStorage();
    if (stored && stored.length > 0) {
      setDrafts(stored);
      setSelectedDraft(stored[0]);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/investors?limit=50&minScore=50");
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data = await res.json();

      if (data.investors && data.investors.length > 0) {
        const mappedDrafts: EmailDraft[] = data.investors
          .filter((inv: InvestorRecord) => inv.email)
          .map((inv: InvestorRecord) => ({
            id: `draft-${inv.id}`,
            investorId: inv.id,
            investorName: `${inv.first_name || ""} ${inv.last_name || ""}`.trim() || "Unknown Investor",
            investorFirm: inv.firm_name || "Unknown",
            investorType: inv.investor_type || "investor",
            subject: "",
            body: "",
            status: "draft" as const,
            createdAt: "Ready to draft",
            fitScore: inv.fit_score || 75,
            aiAnalysis: "",
            tone: "warm",
            investorSectors: inv.investment_sectors,
            investorStages: inv.investment_stages,
            checkSize: (inv.min_check_size || inv.max_check_size) ? "$" + (inv.min_check_size || "?") + " - $" + (inv.max_check_size || "?") : undefined,
            fundSize: inv.fund_size ? "$" + Math.round(inv.fund_size / 1000000) + "M" : undefined,
          }));

        setDrafts(mappedDrafts);
        if (mappedDrafts.length > 0) {
          setSelectedDraft(mappedDrafts[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load investors for outreach:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check email account status
  useEffect(() => {
    async function checkEmailAccount() {
      try {
        const { getClientUser } = await import("@/lib/client-auth");
        const user = await getClientUser();
        if (!user) return;

        const { getConnectedEmails } = await import("@/lib/actions/email");
        const result = await getConnectedEmails(user.id);
        if (result.data && result.data.length > 0) {
          const active = result.data.find((a: { is_active: boolean }) => a.is_active);
          setEmailConnected(!!active);
          setEmailProvider(active?.provider || null);
        } else {
          setEmailConnected(false);
        }
      } catch {
        setEmailConnected(false);
      }
    }
    checkEmailAccount();
  }, []);

  useEffect(() => {
    loadInvestors();
  }, [loadInvestors]);

  const tabs = [
    { id: "drafts", label: "Drafts", count: drafts.filter((d) => d.status === "draft").length },
    { id: "approved", label: "Approved", count: drafts.filter((d) => d.status === "approved").length },
    { id: "sent", label: "Sent", count: drafts.filter((d) => d.status === "sent").length },
    { id: "replies", label: "Replies", count: drafts.filter((d) => d.status === "replied").length },
  ];

  const filteredDrafts = activeTab === "replies"
    ? drafts.filter((d) => d.status === "replied")
    : drafts.filter((d) => d.status === activeTab);

  const handleGenerateSingle = async (draft: EmailDraft) => {
    setGenerating(true);
    setSendResult(null);

    try {
      const response = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorName: draft.investorName,
          investorFirm: draft.investorFirm,
          investorType: draft.investorType,
          fitScore: draft.fitScore,
          tone: selectedTone,
          customInstructions: customInstructions || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSendResult({ type: "error", text: data.error || "Draft generation failed" });
        return;
      }

      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draft.id
            ? {
                ...d,
                subject: data.subject || d.subject,
                body: data.body || d.body,
                html: data.html || d.html,
                text: data.text || d.text,
                status: "draft" as const,
                createdAt: new Date().toLocaleTimeString(),
                tone: selectedTone,
                aiAnalysis: data.analysis || `Generated with ${selectedTone} tone`,
              }
            : d
        )
      );

      setSelectedDraft((prev) =>
        prev?.id === draft.id
          ? {
              ...prev,
              subject: data.subject || prev.subject,
              body: data.body || prev.body,
              html: data.html || prev.html,
              text: data.text || prev.text,
              status: "draft" as const,
              createdAt: new Date().toLocaleTimeString(),
              tone: selectedTone,
              aiAnalysis: data.analysis || `Generated with ${selectedTone} tone`,
            }
          : prev
      );

      // Persist updated drafts
      const updated = drafts.map((d) => d.id === draft.id ? { ...d, subject: data.subject || d.subject, body: data.body || d.body, html: data.html || d.html, text: data.text || d.text } : d);
      saveDraftsToStorage(updated);

      setSendResult({ type: "success", text: "Email generated successfully!" });
    } catch {
      setSendResult({ type: "error", text: "AI service unavailable. Please try again." });
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerate = async () => {
    const undrafted = drafts.filter((d) => !d.body && d.status === "draft");
    if (undrafted.length === 0) return;

    setBulkGenerating(true);
    setBulkProgress({ current: 0, total: undrafted.length });

    for (let i = 0; i < undrafted.length; i++) {
      const draft = undrafted[i];
      try {
        const response = await fetch("/api/outreach/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            investorName: draft.investorName,
            investorFirm: draft.investorFirm,
            investorType: draft.investorType,
            fitScore: draft.fitScore,
            tone: selectedTone,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setDrafts((prev) =>
            prev.map((d) =>
              d.id === draft.id
                ? {
                    ...d,
                    subject: data.subject || d.subject,
                    body: data.body || d.body,
                    html: data.html || d.html,
                    text: data.text || d.text,
                    createdAt: new Date().toLocaleTimeString(),
                    aiAnalysis: data.analysis || `Generated with ${selectedTone} tone`,
                  }
                : d
            )
          );
        }
      } catch {
        // Continue with next draft
      }

      setBulkProgress({ current: i + 1, total: undrafted.length });
      await new Promise((r) => setTimeout(r, 500)); // Rate limit
    }

    setBulkGenerating(false);
    setSendResult({ type: "success", text: `Generated ${undrafted.length} emails!` });
  };

  const handleApprove = (draftId: string) => {
    const updated = drafts.map((d) => (d.id === draftId ? { ...d, status: "approved" as const } : d));
    setDrafts(updated);
    setSelectedDraft((prev) =>
      prev?.id === draftId ? { ...prev, status: "approved" as const } : prev
    );
    saveDraftsToStorage(updated);
  };

  const handleSend = async (draft: EmailDraft) => {
    setSending(true);
    setSendResult(null);

    try {
      const { getClientUser } = await import("@/lib/client-auth");
      const user = await getClientUser();

      if (!user) {
        setSendResult({ type: "error", text: "Please sign in to send emails." });
        return;
      }

      const response = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          investorId: draft.investorId,
          subject: draft.subject,
          bodyHtml: draft.html || draft.body.replace(/\n/g, "<br>"),
          bodyText: draft.body,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setDrafts((prev) =>
          prev.map((d) => (d.id === draft.id ? { ...d, status: "sent" as const } : d))
        );
        setSelectedDraft((prev) =>
          prev?.id === draft.id ? { ...prev, status: "sent" as const } : prev
        );
        setSendResult({ type: "success", text: "Email sent successfully!" });
      } else {
        const errorMsg = result.error || "Failed to send email.";
        if (errorMsg.includes("No email account connected")) {
          setEmailConnected(false);
          setSendResult({ type: "error", text: "No email account connected. Please connect Gmail or Outlook in Settings first." });
        } else {
          setSendResult({ type: "error", text: errorMsg });
        }
      }
    } catch (err) {
      setSendResult({ type: "error", text: `Failed to send: ${String(err)}` });
    } finally {
      setSending(false);
    }
  };

  const handleEditDraft = (draftId: string, subject: string, body: string) => {
    setDrafts((prev) =>
      prev.map((d) => (d.id === draftId ? { ...d, subject, body } : d))
    );
    setSelectedDraft((prev) =>
      prev?.id === draftId ? { ...prev, subject, body } : prev
    );
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Outreach" description="AI-powered investor email drafting and management." />
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-[20px]">
          <div className="lg:col-span-2">
            <Card>
              <CardBody className="p-[16px] text-center">
                <div className="animate-spin h-[24px] w-[24px] border-2 border-lime-500 border-t-transparent rounded-full mx-auto mb-[12px]"></div>
                <p className="text-[13px] text-gray-400 !mb-0">Loading investors...</p>
              </CardBody>
            </Card>
          </div>
          <div className="lg:col-span-3">
            <Card>
              <CardBody className="text-center py-[40px]">
                <p className="text-[13px] text-gray-400 !mb-0">Select an investor to draft an email.</p>
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
        description="AI-powered investor email drafting and management."
        actions={
          <div className="flex items-center gap-[8px]">
            <a href="/dashboard/outreach/metrics">
              <Button variant="outline">
                <i className="ri-bar-chart-line text-[16px] mr-[6px]"></i>
                Metrics
              </Button>
            </a>
            <Button
              variant="outline"
              onClick={handleBulkGenerate}
              loading={bulkGenerating}
              disabled={bulkGenerating}
            >
              <i className="ri-sparkling-2-line text-[16px]"></i>
              Generate All Emails
            </Button>
          </div>
        }
      />

      {/* Email Connection Banner */}
      {emailConnected === false && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-[12px] p-[16px] mb-[20px]">
          <div className="flex items-center justify-between flex-wrap gap-[12px]">
            <div className="flex items-center gap-[8px]">
              <div className="w-[36px] h-[36px] rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 text-[18px] flex-none">
                <i className="ri-mail-line"></i>
              </div>
              <div>
                <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                  No email account connected
                </p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 !mb-0">
                  Connect Gmail or Outlook to send AI-generated emails directly to investors.
                </p>
              </div>
            </div>
            <a href="/dashboard/settings" className="no-underline">
              <Button size="sm" variant="outline">
                <i className="ri-settings-3-line text-[14px]"></i>
                Connect Email
              </Button>
            </a>
          </div>
        </div>
      )}
      {emailConnected === true && emailProvider && (
        <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/30 rounded-[12px] p-[16px] mb-[20px] flex items-center gap-[8px]">
          <div className="w-[8px] h-[8px] rounded-full bg-green-500 flex-none"></div>
          <span className="text-[13px] text-green-700 dark:text-green-400">
            Connected via {emailProvider === "google" ? "Gmail" : "Outlook"} — emails will be sent from your account
          </span>
        </div>
      )}

      {/* Bulk Generation Progress */}
      {bulkGenerating && (
        <div className="bg-lime-50 dark:bg-lime-900/10 border border-lime-200 dark:border-lime-800/30 rounded-[12px] p-[16px] mb-[20px]">
          <div className="flex items-center justify-between mb-[8px]">
            <span className="text-[13px] font-medium text-[#06201b] dark:text-white">
              Generating emails...
            </span>
            <span className="text-[13px] text-gray-400">
              {bulkProgress.current} / {bulkProgress.total}
            </span>
          </div>
          <div className="w-full h-[6px] bg-lime-200 dark:bg-lime-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-lime-500 rounded-full transition-all duration-300"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Send Result */}
      {sendResult && (
        <div className={`rounded-[12px] p-[16px] mb-[20px] text-[13px] font-medium flex items-center gap-[8px] ${
          sendResult.type === "success"
            ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800/30"
            : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800/30"
        }`}>
          <i className={`${sendResult.type === "success" ? "ri-check-line" : "ri-error-warning-line"} text-[16px]`}></i>
          {sendResult.text}
          <button
            onClick={() => setSendResult(null)}
            className="ml-auto text-current opacity-50 hover:opacity-100"
          >
            <i className="ri-close-line text-[16px]"></i>
          </button>
        </div>
      )}

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
                    description={
                      activeTab === "drafts"
                        ? "Click 'Generate All Emails' to create personalized outreach for top-fit investors."
                        : activeTab === "sent"
                        ? "Sent emails will appear here."
                        : "No emails in this category."
                    }
                  />
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[600px] overflow-y-auto">
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
                          selectedDraft?.id === draft.id
                            ? "bg-lime-50/50 dark:bg-lime-900/10 border-l-2 border-l-lime-500"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-[4px]">
                          <p className="text-[13px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">
                            {draft.investorName}
                          </p>
                          <Badge variant={config.variant} size="sm">{config.label}</Badge>
                        </div>
                        <p className="text-[12px] text-gray-400 !mb-[4px] truncate">
                          {draft.investorFirm} • {draft.investorType.replace(/_/g, " ")}
                        </p>
                        {draft.body ? (
                          <p className="text-[12px] text-gray-500 dark:text-gray-400 !mb-0 truncate">
                            {draft.subject || "No subject"}
                          </p>
                        ) : (
                          <p className="text-[12px] text-gray-300 dark:text-gray-600 !mb-0 italic">
                            Click to generate email
                          </p>
                        )}
                        <div className="flex items-center gap-[8px] mt-[6px]">
                          <span className={`text-[11px] font-bold ${
                            draft.fitScore >= 90 ? "text-green-600" : draft.fitScore >= 70 ? "text-amber-600" : "text-gray-400"
                          }`}>
                            {draft.fitScore}% fit
                          </span>
                          {draft.body && (
                            <span className="text-[11px] text-gray-300 dark:text-gray-600">
                              {draft.createdAt}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Email Editor / Preview */}
        <div className="lg:col-span-3">
          {selectedDraft ? (
            <Card>
              <CardBody>
                {/* Header */}
                <div className="flex items-center justify-between mb-[16px]">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
                      {selectedDraft.investorName}
                    </h3>
                    <p className="text-[13px] text-gray-400 !mb-0">
                      {selectedDraft.investorFirm} • {selectedDraft.fitScore}% fit • {selectedDraft.investorType.replace(/_/g, " ")}
                    </p>
                  </div>
                  <Badge variant={statusConfig[selectedDraft.status].variant}>
                    {statusConfig[selectedDraft.status].label}
                  </Badge>
                </div>

                {/* Tone Picker */}
                <div className="flex items-center gap-[8px] mb-[16px] flex-wrap">
                  <span className="text-[12px] text-gray-400 mr-[4px]">Tone:</span>
                  {TONE_OPTIONS.map((tone) => (
                    <button
                      key={tone.value}
                      onClick={() => setSelectedTone(tone.value)}
                      className={`flex items-center gap-[4px] px-[10px] py-[4px] rounded-full text-[12px] font-medium transition-all ${
                        selectedTone === tone.value
                          ? "bg-[#06201b] text-white dark:bg-lime-500 dark:text-black"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                    >
                      <i className={`${tone.icon} text-[13px]`}></i>
                      {tone.label}
                    </button>
                  ))}
                </div>

                {/* Custom Instructions */}
                <div className="mb-[16px]">
                  <input
                    type="text"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Optional: add custom instructions for the AI (e.g., mention our recent YC batch, focus on our enterprise traction...)"
                    className="w-full px-[12px] py-[8px] border border-gray-200 dark:border-gray-700 rounded-[8px] text-[13px] bg-gray-50 dark:bg-gray-800/50 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                  />
                </div>

                {/* Email Content */}
                {selectedDraft.body ? (
                  <div className="bg-gray-50 dark:bg-gray-800/30 rounded-[12px] p-[20px] mb-[16px]">
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
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800/30 rounded-[12px] p-[40px] mb-[16px] text-center">
                    <i className="ri-mail-line text-[32px] text-gray-200 dark:text-gray-700 mb-[12px] block"></i>
                    <p className="text-[14px] text-gray-400 !mb-[16px]">
                      No email drafted yet for this investor.
                    </p>
                    <Button onClick={() => handleGenerateSingle(selectedDraft)} loading={generating}>
                      <i className="ri-sparkling-2-line text-[16px]"></i>
                      Generate Email
                    </Button>
                  </div>
                )}

                {/* Inline Editing Mode */}
                {editingDraft === selectedDraft.id && (
                  <div className="bg-white dark:bg-gray-800 border border-lime-300 dark:border-lime-700 rounded-[12px] p-[20px] mb-[16px]">
                    <div className="mb-[12px]">
                      <label className="text-[12px] text-gray-400 block mb-[4px]">Subject</label>
                      <input
                        type="text"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        className="w-full px-[12px] py-[8px] border border-gray-200 dark:border-gray-600 rounded-[8px] text-[14px] bg-gray-50 dark:bg-gray-700 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                      />
                    </div>
                    <div className="mb-[12px]">
                      <label className="text-[12px] text-gray-400 block mb-[4px]">Body</label>
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={8}
                        className="w-full px-[12px] py-[8px] border border-gray-200 dark:border-gray-600 rounded-[8px] text-[14px] bg-gray-50 dark:bg-gray-700 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500 resize-y"
                      />
                    </div>
                    <div className="flex items-center gap-[8px]">
                      <Button size="sm" onClick={() => {
                        handleEditDraft(selectedDraft.id, editSubject, editBody);
                        setEditingDraft(null);
                        // Persist
                        const updated = drafts.map((d) => d.id === selectedDraft.id ? { ...d, subject: editSubject, body: editBody } : d);
                        saveDraftsToStorage(updated);
                      }}>
                        <i className="ri-check-line text-[14px] mr-[4px]"></i>
                        Save Changes
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditingDraft(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* AI Analysis */}
                {selectedDraft.aiAnalysis && (
                  <div className="bg-lime-50/50 dark:bg-lime-900/10 rounded-[12px] p-[16px] mb-[16px] border border-lime-100 dark:border-lime-800/30">
                    <div className="flex items-center gap-[8px] mb-[6px]">
                      <i className="ri-sparkling-2-line text-lime-600 text-[14px]"></i>
                      <span className="text-[12px] font-semibold text-[#06201b] dark:text-white">AI Notes</span>
                    </div>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400 !mb-0 leading-[1.6]">
                      {selectedDraft.aiAnalysis}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-[8px] flex-wrap">
                  {selectedDraft.status === "draft" && selectedDraft.body && (
                    <>
                      <Button onClick={() => handleApprove(selectedDraft.id)}>
                        <i className="ri-check-line text-[16px]"></i>
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleGenerateSingle(selectedDraft)}
                        loading={generating}
                      >
                        <i className="ri-refresh-line text-[16px]"></i>
                        Regenerate
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setEditingDraft(selectedDraft.id);
                        setEditSubject(selectedDraft.subject);
                        setEditBody(selectedDraft.body);
                      }}>
                        <i className="ri-edit-line text-[14px]"></i>
                        Edit
                      </Button>
                    </>
                  )}
                  {selectedDraft.status === "draft" && !selectedDraft.body && (
                    <Button onClick={() => handleGenerateSingle(selectedDraft)} loading={generating}>
                      <i className="ri-sparkling-2-line text-[16px]"></i>
                      Generate Email
                    </Button>
                  )}
                  {selectedDraft.status === "approved" && (
                    <Button
                      onClick={() => handleSend(selectedDraft)}
                      loading={sending}
                      disabled={emailConnected === false}
                      title={emailConnected === false ? "Connect an email account in Settings first" : undefined}
                    >
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
                  {selectedDraft.status === "replied" && (
                    <Button variant="outline" disabled>
                      <i className="ri-reply-line text-[16px]"></i>
                      Reply Received
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
                  title="Select an investor"
                  description="Choose an investor from the list to preview, edit, and send their outreach email."
                />
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
