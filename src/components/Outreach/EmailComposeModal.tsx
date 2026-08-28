"use client";

import React, { useState, useRef } from "react";
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

interface Attachment {
  file: File;
  preview?: string;
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
  const [tone, setTone] = useState("warm");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [ctaText, setCtaText] = useState("Let's Connect");
  const [ctaUrl, setCtaUrl] = useState("");
  const [showCta, setShowCta] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Auto-fill CTA from branding if empty
      if (!ctaUrl && data.html) {
        // Try to extract CTA from the branded HTML
        const ctaMatch = data.html.match(/href="([^"]+)"[^>]*>\s*(?:Schedule|Let's|Send|View|Book|Discuss)/i);
        if (ctaMatch) setCtaUrl(ctaMatch[1]);
      }
    } catch {
      setError("AI service unavailable. Please try again.");
    } finally {
      setDrafting(false);
    }
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is too large (max 10MB)`);
        continue;
      }
      newAttachments.push({ file });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError("Subject and body are required");
      return;
    }

    setSending(true);
    setError("");
    try {
      // Build body with CTA if configured
      let bodyHtml = `<p>${body.replace(/\n/g, "</p><p>")}</p>`;
      if (showCta && ctaText && ctaUrl) {
        bodyHtml += `<div style="margin-top:24px;text-align:center;"><a href="${ctaUrl}" style="display:inline-block;background:#84cc16;color:#0f172a;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;text-decoration:none;">${ctaText} →</a></div>`;
      }

      // Upload attachments if any
      let attachmentData: Array<{ name: string; content: string; mimeType: string }> = [];
      if (attachments.length > 0) {
        for (const att of attachments) {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1] || "");
            };
            reader.readAsDataURL(att.file);
          });
          attachmentData.push({
            name: att.file.name,
            content: base64,
            mimeType: att.file.type || "application/octet-stream",
          });
        }
      }

      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId,
          subject: subject.trim(),
          bodyHtml,
          bodyText: body.trim(),
          attachments: attachmentData.length > 0 ? attachmentData : undefined,
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
    setAttachments([]);
    setShowCta(false);
    setCtaText("Let's Connect");
    setCtaUrl("");
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
                      <option value="warm">Warm</option>
                      <option value="professional">Professional</option>
                      <option value="casual">Casual</option>
                      <option value="bold">Bold</option>
                      <option value="referral">Referral</option>
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
                  className="w-full px-[14px] py-[10px] rounded-[8px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[14px] focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
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
                  className="w-full px-[14px] py-[10px] rounded-[8px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[14px] leading-relaxed resize-none focus:outline-none focus:border-lime-500 focus:ring-1 focus:ring-lime-500/30 transition-colors"
                />
                <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-[4px] !mb-0">
                  {body.split(/\s+/).filter(Boolean).length} words
                </p>
              </div>

              {/* CTA Button Config */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-[10px] p-[14px]">
                <button
                  onClick={() => setShowCta(!showCta)}
                  className="flex items-center gap-[6px] text-[13px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  <i className={`ri-arrow-${showCta ? "down" : "right"}-s-line text-[14px]`}></i>
                  <i className="ri-cursor-line text-[14px] text-lime-500"></i>
                  Add CTA Button
                </button>
                {showCta && (
                  <div className="mt-[12px] space-y-[10px]">
                    <input
                      type="text"
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      placeholder="Button text (e.g., Schedule a Call)"
                      className="w-full px-[12px] py-[8px] rounded-[6px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[13px] focus:outline-none focus:border-lime-500"
                    />
                    <input
                      type="url"
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                      placeholder="Button URL (e.g., https://calendly.com/you)"
                      className="w-full px-[12px] py-[8px] rounded-[6px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-[13px] focus:outline-none focus:border-lime-500"
                    />
                    {ctaText && ctaUrl && (
                      <div className="text-center mt-[8px]">
                        <span className="inline-block bg-lime-500 text-[#0f172a] px-[24px] py-[8px] rounded-[8px] text-[13px] font-semibold">
                          {ctaText} →
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">
                  Attachments
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-[8px] p-[16px] text-center cursor-pointer hover:border-lime-400 dark:hover:border-lime-600 transition-colors"
                >
                  <i className="ri-attachment-2 text-[20px] text-gray-300 dark:text-gray-600 mb-[4px]"></i>
                  <p className="text-[13px] text-gray-400 !mb-0">
                    Click to attach files (PDF, PPTX, images — max 10MB each)
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.pptx,.docx,.doc,.png,.jpg,.jpeg,.gif,.csv,.xlsx"
                  onChange={handleFileAdd}
                  className="hidden"
                />

                {/* Attached files list */}
                {attachments.length > 0 && (
                  <div className="mt-[10px] space-y-[6px]">
                    {attachments.map((att, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-[6px] px-[12px] py-[8px]"
                      >
                        <div className="flex items-center gap-[8px] min-w-0">
                          <i className="ri-file-text-line text-[14px] text-gray-400 flex-none"></i>
                          <span className="text-[13px] text-gray-600 dark:text-gray-300 truncate">
                            {att.file.name}
                          </span>
                          <span className="text-[11px] text-gray-300 dark:text-gray-600 flex-none">
                            ({Math.round(att.file.size / 1024)}KB)
                          </span>
                        </div>
                        <button
                          onClick={() => handleRemoveAttachment(i)}
                          className="text-gray-300 hover:text-red-500 transition-colors flex-none"
                        >
                          <i className="ri-close-line text-[14px]"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-[8px] p-[12px]">
              <p className="text-[13px] text-red-600 dark:text-red-400 !mb-0">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div className="flex items-center justify-end gap-[8px] p-[16px] border-t border-gray-100 dark:border-gray-800">
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
