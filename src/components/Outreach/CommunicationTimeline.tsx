"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

interface TimelineEvent {
  id: string;
  type: "email_sent" | "email_replied" | "email_bounced" | "email_opened" | "note_added" | "status_change" | "fit_scored";
  subject?: string;
  body?: string;
  fromAddress?: string;
  toAddress?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface CommunicationTimelineProps {
  investorId: string;
  onRefresh?: () => void;
}

const EVENT_CONFIG: Record<string, { icon: string; color: string; bgColor: string; label: string }> = {
  email_sent: { icon: "ri-send-plane-line", color: "text-blue-600", bgColor: "bg-blue-100 dark:bg-blue-900/30", label: "Email Sent" },
  email_replied: { icon: "ri-reply-line", color: "text-green-600", bgColor: "bg-green-100 dark:bg-green-900/30", label: "Reply Received" },
  email_bounced: { icon: "ri-error-warning-line", color: "text-red-600", bgColor: "bg-red-100 dark:bg-red-900/30", label: "Email Bounced" },
  email_opened: { icon: "ri-eye-line", color: "text-cyan-600", bgColor: "bg-cyan-100 dark:bg-cyan-900/30", label: "Email Opened" },
  note_added: { icon: "ri-sticky-note-line", color: "text-amber-600", bgColor: "bg-amber-100 dark:bg-amber-900/30", label: "Note Added" },
  status_change: { icon: "ri-arrow-left-right-line", color: "text-purple-600", bgColor: "bg-purple-100 dark:bg-purple-900/30", label: "Status Changed" },
  fit_scored: { icon: "ri-bar-chart-line", color: "text-lime-600", bgColor: "bg-lime-100 dark:bg-lime-900/30", label: "Fit Scored" },
};

export function CommunicationTimeline({ investorId, onRefresh }: CommunicationTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState("");

  const loadTimeline = useCallback(async () => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Fetch email messages for this investor
      const { data: emails } = await supabase
        .from("email_messages")
        .select("id, subject, body_text, body_html, direction, status, to_address, from_address, sent_at, created_at, ai_generated")
        .eq("investor_id", investorId)
        .order("created_at", { ascending: false });

      // Fetch data change log for this investor
      const { data: changes } = await supabase
        .from("data_change_log")
        .select("id, field_name, old_value, new_value, change_type, created_at")
        .eq("investor_id", investorId)
        .order("created_at", { ascending: false })
        .limit(20);

      const timelineEvents: TimelineEvent[] = [];

      // Map emails to timeline events
      (emails || []).forEach((email) => {
        const isOutbound = email.direction === "outbound";
        const eventType = email.status === "bounced"
          ? "email_bounced"
          : email.status === "opened"
          ? "email_opened"
          : isOutbound
          ? "email_sent"
          : "email_replied";

        timelineEvents.push({
          id: email.id,
          type: eventType,
          subject: email.subject,
          body: email.body_text,
          fromAddress: email.from_address,
          toAddress: email.to_address,
          timestamp: email.sent_at || email.created_at,
          metadata: { ai_generated: email.ai_generated },
        });
      });

      // Map data changes to timeline events
      (changes || []).forEach((change) => {
        timelineEvents.push({
          id: `change-${change.id}`,
          type: "status_change",
          subject: `${change.field_name} updated`,
          body: change.old_value && change.new_value
            ? `${change.old_value} → ${change.new_value}`
            : change.new_value || "Updated",
          timestamp: change.created_at,
        });
      });

      // Sort by timestamp descending
      timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setEvents(timelineEvents);
    } catch {
      // Timeline may not be available
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    // Notes are stored in data_change_log
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.from("data_change_log").insert({
        investor_id: investorId,
        field_name: "note",
        new_value: noteText.trim(),
        change_type: "note",
      });
      setNoteText("");
      setAddingNote(false);
      loadTimeline();
      onRefresh?.();
    } catch {
      // Non-critical
    }
  };

  if (loading) {
    return (
      <div className="space-y-[12px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex items-center gap-[12px]">
            <div className="w-[36px] h-[36px] rounded-full bg-gray-100 dark:bg-gray-800 flex-none"></div>
            <div className="flex-1">
              <div className="h-[12px] bg-gray-100 dark:bg-gray-800 rounded w-[200px] mb-[6px]"></div>
              <div className="h-[10px] bg-gray-100 dark:bg-gray-800 rounded w-[120px]"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-[16px]">
        <h3 className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0">
          <i className="ri-time-line text-lime-500 mr-[6px]"></i>
          Communication Timeline
          {events.length > 0 && (
            <span className="text-[12px] text-gray-400 font-normal ml-[6px]">({events.length})</span>
          )}
        </h3>
        <button
          onClick={() => setAddingNote(!addingNote)}
          className="text-[12px] text-lime-600 hover:text-lime-700 font-medium"
        >
          <i className="ri-add-line mr-[2px]"></i>
          Add Note
        </button>
      </div>

      {/* Add Note */}
      {addingNote && (
        <div className="mb-[16px] p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[10px]">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note about this investor..."
            rows={3}
            className="w-full px-[10px] py-[8px] text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 resize-none"
          />
          <div className="flex gap-[8px] mt-[8px]">
            <Button size="sm" onClick={handleAddNote} disabled={!noteText.trim()}>Save Note</Button>
            <Button size="sm" variant="outline" onClick={() => { setAddingNote(false); setNoteText(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      {events.length === 0 ? (
        <div className="text-center py-[30px]">
          <div className="w-[40px] h-[40px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[10px]">
            <i className="ri-time-line text-gray-300 text-[18px]"></i>
          </div>
          <p className="text-[13px] text-gray-400 !mb-0">No communication history yet.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[18px] top-[20px] bottom-0 w-[2px] bg-gray-100 dark:bg-gray-800"></div>

          <div className="space-y-[16px]">
            {events.map((event) => {
              const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.status_change;
              return (
                <div key={event.id} className="relative pl-[48px]">
                  {/* Icon */}
                  <div className={`absolute left-0 top-0 w-[36px] h-[36px] rounded-full ${config.bgColor} flex items-center justify-center z-10`}>
                    <i className={`${config.icon} ${config.color} text-[16px]`}></i>
                  </div>

                  {/* Content */}
                  <div className="bg-gray-50 dark:bg-gray-800/30 rounded-[10px] p-[12px]">
                    <div className="flex items-center justify-between mb-[4px]">
                      <div className="flex items-center gap-[8px]">
                        <span className={`text-[12px] font-semibold ${config.color}`}>{config.label}</span>
                        {Boolean(event.metadata?.ai_generated) && (
                          <Badge variant="info" size="sm">AI</Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400">{formatTime(event.timestamp)}</span>
                    </div>

                    {event.subject && (
                      <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-[4px]">
                        {event.subject}
                      </p>
                    )}

                    {event.body && (
                      <button
                        onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                        className="text-left w-full"
                      >
                        <p className={`text-[12px] text-gray-500 dark:text-gray-400 !mb-0 ${
                          expandedId === event.id ? "" : "line-clamp-2"
                        }`}>
                          {event.body}
                        </p>
                        {event.body.length > 100 && (
                          <span className="text-[11px] text-lime-600 hover:text-lime-700">
                            {expandedId === event.id ? "Show less" : "Show more"}
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
