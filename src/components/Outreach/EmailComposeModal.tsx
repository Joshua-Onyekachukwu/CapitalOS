"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";

interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  investorId: string;
  investorName: string;
  investorFirm?: string;
  investorEmail?: string;
  investorType?: string;
  fitScore?: number;
  aiAnalysis?: string;
  onSent?: () => void;
}

export function EmailComposeModal({
  isOpen,
  onClose,
  investorId,
  investorName,
  investorFirm,
  investorEmail,
  investorType,
  fitScore,
  aiAnalysis,
  onSent,
}: EmailComposeModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [tone, setTone] = useState("warm, professional");

  if (!isOpen) return null;

  const handleDraftWithAI = async () => {
    setDrafting(true);
    setError("");
    try {
      const res = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorName,
          investorFirm,
          investorType,
          fitScore,
          aiAnalysis,
          tone,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to generate draft");
        return;
      }

      setSubject(data.subject || "");
      setBody(data.body || "");
    } catch {
      setError("AI service unavailable. Please try again.");
    } finally {
      setDrafting(false);
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required");
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId,
          subject: subject.trim(),
          bodyHtml: `<p>${body.replace(/\n/g, "</p><p>")}</p>`,
          bodyText: body.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send email");
        return;
      }

      setSent(true);
      onSent?.();
    } catch {
      setError("Failed to send email. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setSubject("");
    setBody("");
    setSent(false);
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-[16px]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#0a1f1a] rounded-[16px] shadow-2xl w-full max-w-[600px] max-h-[85vh] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-[20px] border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="!text-[18px] !font-bold !mb-0">
              {sent ? "Email Sent ✓" : "Start Outreach"}
            </h2>
            <p className="text-[13px] text-gray-400 !mb-0 mt-[2px]">
              To: {investorName}
              {investorFirm && <> at {investorFirm}</>}
              {investorEmail && <> ({investorEmail})</>}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-[32px] h-[32px] rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-400 transition-colors"
          >
            <i className="ri-close-line text-[20px]"></i>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-[20px] space-y-[16px]">
          {sent ? (
            <div className="text-center py-[40px]">
              <div className="w-[64px] h-[64px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-check-line text-lime-600 text-[28px]"></i>
              </div>
              <h3 className="!text-[18px] !font-bold !mb-[8px]">Email Sent Successfully!</h3>
              <p className="text-[14px] text-gray-400 !mb-[20px]">
                Your outreach email has been sent to {investorName}.
              </p>
              <Button onClick={handleClose}>Done</Button>
            </div>
          ) : (
            <>
              {/* AI Draft Button */}
              {!body && (
                <div className="bg-lime-50/50 dark:bg-lime-900/10 rounded-[12px] p-[16px] border border-lime-100 dark:border-lime-800/30">
                  <div className="flex items-center gap-[8px] mb-[8px]">
                    <i className="ri-sparkling-2-line text-lime-500 text-[18px]"></i>
                    <h3 className="!text-[14px] !font-semibold !mb-0">AI Email Draft</h3>
                  </div>
                  <p className="text-[13px] text-gray-500 !mb-[12px]">
                    Let AI draft a personalized email based on this investor&apos;s profile and your startup.
                  </p>
                  <div className="flex items-center gap-[8px] mb-[12px]">
                    <label className="text-[12px] text-gray-400">Tone:</label>
                    <select
                      value={tone}
                      onChange={(e) => setTone(e.target.value)}
                      className="text-[12px] px-[8px] py-[4px] rounded-[6px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                    >
                      <option value="warm, professional">Warm & Professional</option>
                      <option value="casual, friendly">Casual & Friendly</option>
                      <option value="formal, direct">Formal & Direct</option>
                      <option value="enthusiastic, bold">Enthusiastic & Bold</option>
                    </select>
                  </div>
                  <Button size="sm" onClick={handleDraftWithAI} disabled={drafting}>
                    {drafting ? (
                      <>
                        <div className="w-[14px] h-[14px] border-2 border-white/30 border-t-white rounded-full animate-spin mr-[6px]"></div>
                        Drafting...
                      </>
                    ) : (
                      <>
                        <i className="ri-magic-line text-[14px]"></i>
                        Generate AI Draft
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Partnership opportunity — [Your Startup]"
                  className="w-full px-[14px] py-[10px] rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[14px] focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
                />
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-[6px]">
                  <label className="text-[13px] font-medium text-gray-600 dark:text-gray-400">
                    Email Body
                  </label>
                  {body && (
                    <button
                      onClick={handleDraftWithAI}
                      className="text-[12px] text-lime-600 hover:text-lime-700 flex items-center gap-[4px]"
                      disabled={drafting}
                    >
                      <i className="ri-refresh-line"></i>
                      Regenerate
                    </button>
                  )}
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your outreach email here, or use AI to generate a draft..."
                  rows={12}
                  className="w-full px-[14px] py-[10px] rounded-[10px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[14px] leading-relaxed resize-none focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
                />
                <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-[4px] !mb-0">
                  {body.split(/\s+/).filter(Boolean).length} words
                </p>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-[10px] p-[12px]">
              <p className="text-[13px] text-red-600 dark:text-red-400 !mb-0">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div className="flex items-center justify-end gap-[10px] p-[16px] border-t border-gray-100 dark:border-gray-800">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim()}
            >
              {sending ? (
                <>
                  <div className="w-[14px] h-[14px] border-2 border-white/30 border-t-white rounded-full animate-spin mr-[6px]"></div>
                  Sending...
                </>
              ) : (
                <>
                  <i className="ri-send-plane-line text-[14px]"></i>
                  Send Email
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
