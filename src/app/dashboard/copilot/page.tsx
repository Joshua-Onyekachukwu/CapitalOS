"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Message {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  actions?: SuggestedAction[];
}

interface SuggestedAction {
  label: string;
  prompt: string;
  icon: string;
}

const INITIAL_SUGGESTIONS: SuggestedAction[] = [
  {
    label: "Who should I contact first?",
    prompt: "Based on my fit scores and investor data, who are the top 3 investors I should reach out to first and why?",
    icon: "ri-user-star-line",
  },
  {
    label: "Build my outreach strategy",
    prompt: "Create a fundraising outreach strategy for me — what's the best approach, email timing, and follow-up sequence?",
    icon: "ri-mail-send-line",
  },
  {
    label: "Analyze my pipeline",
    prompt: "How is my investor pipeline looking? What should I focus on to improve my chances of raising?",
    icon: "ri-pie-chart-line",
  },
  {
    label: "Help me plan my pitch",
    prompt: "I want to improve my pitch. What should I focus on in my pitch deck to resonate with investors in my industry?",
    icon: "ri-slideshow-line",
  },
];

const FOLLOW_UP_SUGGESTIONS: Record<string, SuggestedAction[]> = {
  default: [
    {
      label: "Tell me more about this",
      prompt: "Can you go deeper on this? I'd like more detail and specific action items.",
      icon: "ri-arrow-down-line",
    },
    {
      label: "What's the next step?",
      prompt: "What should I do next based on what you just told me?",
      icon: "ri-arrow-right-line",
    },
  ],
  investor: [
    {
      label: "Draft an email to them",
      prompt: "Draft a personalized outreach email for the investor you just recommended.",
      icon: "ri-quill-pen-line",
    },
    {
      label: "Show more like this",
      prompt: "Show me more investors similar to the ones you just mentioned, with the same fit criteria.",
      icon: "ri-search-line",
    },
  ],
  strategy: [
    {
      label: "Start an outreach campaign",
      prompt: "I want to start an outreach campaign now. Walk me through the steps.",
      icon: "ri-rocket-line",
    },
    {
      label: "Generate my pitch deck",
      prompt: "How do I generate my pitch deck? Guide me through it.",
      icon: "ri-file-ppt-2-line",
    },
  ],
  deck: [
    {
      label: "Go to deck generator",
      prompt: "[NAVIGATE:/dashboard/decks/new]",
      icon: "ri-external-link-line",
    },
    {
      label: "What slides should my deck have?",
      prompt: "What slides should my pitch deck include for my stage and industry? Give me a slide-by-slide breakdown.",
      icon: "ri-list-check",
    },
  ],
};

function detectContextCategory(text: string): string {
  const lower = text.toLowerCase();
  if (
    lower.includes("email") ||
    lower.includes("contact") ||
    lower.includes("reach out") ||
    lower.includes("investor")
  )
    return "investor";
  if (
    lower.includes("deck") ||
    lower.includes("pitch") ||
    lower.includes("slide") ||
    lower.includes("presentation")
  )
    return "deck";
  if (
    lower.includes("strategy") ||
    lower.includes("plan") ||
    lower.includes("approach") ||
    lower.includes("campaign")
  )
    return "strategy";
  return "default";
}

// Strip markdown formatting from AI responses
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/\*([^*]+?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '• ');
}


export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "",
      isStreaming: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist conversation to localStorage
  useEffect(() => {
    const saved = localStorage.getItem("copilot_messages");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Restore messages but mark all as not streaming
          setMessages(parsed.map((m: Message) => ({ ...m, isStreaming: false })));
          setShowSuggestions(false);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (messages.length > 1 || (messages.length === 1 && !messages[0].isStreaming && messages[0].content)) {
      // Don't persist the initial empty streaming message
      const toSave = messages.filter(m => m.content || m.role === "user");
      if (toSave.length > 0) {
        localStorage.setItem("copilot_messages", JSON.stringify(toSave));
      }
    }
  }, [messages]);

  const GREETING =
    "Hey! I'm your AI fundraising copilot. I can see your investor database, pipeline, and startup profile.\n\nI can help you figure out who to contact first, plan your outreach strategy, analyze your pipeline, or prep for your pitch.\n\nWhat are you working on?";

  // Typewriter effect for initial greeting
  useEffect(() => {
    if (messages.length === 1 && messages[0].isStreaming) {
      let idx = 0;
      const timer = setInterval(() => {
        idx += 2; // 2 chars per tick for speed
        if (idx >= GREETING.length) {
          idx = GREETING.length;
          clearInterval(timer);
          setMessages((prev) => [
            { role: "assistant", content: GREETING, isStreaming: false },
          ]);
        } else {
          setMessages((prev) => [
            { role: "assistant", content: GREETING.slice(0, idx), isStreaming: true },
          ]);
        }
      }, 20);
      return () => clearInterval(timer);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Typewriter effect for assistant responses
  const streamResponse = useCallback(
    async (fullText: string, actions: SuggestedAction[]) => {
      let idx = 0;
      const speed = Math.max(8, Math.min(20, 3000 / fullText.length)); // adaptive speed

      const timer = setInterval(() => {
        idx += 3; // 3 chars per tick
        if (idx >= fullText.length) {
          idx = fullText.length;
          clearInterval(timer);
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              last.content = fullText;
              last.isStreaming = false;
              last.actions = actions;
            }
            return updated;
          });
          setLoading(false);
        } else {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              last.content = fullText.slice(0, idx);
              last.isStreaming = true;
            }
            return updated;
          });
        }
      }, speed);

      return () => clearInterval(timer);
    },
    []
  );

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || loading) return;

    // Handle navigation commands
    if (content.startsWith("[NAVIGATE:")) {
      const url = content.replace("[NAVIGATE:", "").replace("]", "");
      window.location.href = url;
      return;
    }

    const userMessage: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setShowSuggestions(false);

    // Add streaming placeholder
    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage]
            .filter((m) => !m.isStreaming)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, something went wrong. Please try again.",
            isStreaming: false,
          };
          return updated;
        });
        setLoading(false);
        return;
      }

      // Detect context for follow-up suggestions
      const category = detectContextCategory(content + " " + data.reply);
      const followUps = FOLLOW_UP_SUGGESTIONS[category] || FOLLOW_UP_SUGGESTIONS.default;

      await streamResponse(data.reply, followUps);
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Network error. Please check your connection and try again.",
          isStreaming: false,
        };
        return updated;
      });
      setLoading(false);
    }
  };

  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && !m.isStreaming);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex items-center justify-between mb-[16px]">
        <PageHeader
          title="AI Copilot"
          description="Your intelligent fundraising advisor. Ask anything about investors, strategy, or your pipeline."
        />
        <button
          onClick={() => {
            setMessages([{ role: "assistant", content: GREETING, isStreaming: false }]);
            localStorage.removeItem("copilot_messages");
            setShowSuggestions(true);
          }}
          className="flex items-center gap-[6px] px-[12px] py-[6px] text-[13px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <i className="ri-refresh-line text-[14px]"></i>
          New Chat
        </button>
      </div>

      {/* Chat Messages */}
      <Card className="flex-1 flex flex-col min-h-0 mb-[16px]">
        <CardBody className="flex-1 overflow-y-auto p-[20px]">
          <div className="space-y-[20px] max-w-[800px] mx-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-[12px] px-[16px] py-[12px] ${
                    msg.role === "user"
                      ? "bg-[#06201b] text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-[8px] mb-[6px]">
                      <div className="w-[20px] h-[20px] rounded-full bg-lime-500/20 flex items-center justify-center">
                        <i className="ri-sparkling-2-line text-lime-500 text-[12px]"></i>
                      </div>
                      <span className="text-[11px] font-semibold text-lime-600 uppercase tracking-wider">
                        AI Copilot
                      </span>
                    </div>
                  )}
                  <p className="text-[14px] leading-[1.7] !mb-0 whitespace-pre-wrap">
                    {cleanMarkdown(msg.content)}
                    {msg.isStreaming && (
                      <span className="inline-block w-[2px] h-[14px] bg-lime-500 ml-[2px] animate-pulse align-middle" />
                    )}
                  </p>

                  {/* Action buttons after response */}
                  {msg.actions && msg.actions.length > 0 && !loading && i === messages.length - 1 && (
                    <div className="flex flex-wrap gap-[6px] mt-[12px] pt-[12px] border-t border-gray-200 dark:border-gray-700">
                      {msg.actions.map((action, j) => (
                        <button
                          key={j}
                          onClick={() => sendMessage(action.prompt)}
                          className="text-[12px] px-[12px] py-[6px] rounded-[8px] bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-lime-50 hover:text-lime-700 hover:border-lime-300 dark:hover:bg-lime-900/20 dark:hover:text-lime-400 transition-all flex items-center gap-[4px]"
                        >
                          <i className={`${action.icon} text-[13px]`}></i>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-[12px] px-[16px] py-[12px]">
                  <div className="flex items-center gap-[8px] mb-[6px]">
                    <div className="w-[20px] h-[20px] rounded-full bg-lime-500/20 flex items-center justify-center">
                      <i className="ri-sparkling-2-line text-lime-500 text-[12px]"></i>
                    </div>
                    <span className="text-[11px] font-semibold text-lime-600 uppercase tracking-wider">
                      Thinking...
                    </span>
                  </div>
                  <div className="flex gap-[4px]">
                    <div className="w-[6px] h-[6px] rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-[6px] h-[6px] rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-[6px] h-[6px] rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </CardBody>
      </Card>

      {/* Suggested Questions (show only at start) */}
      {showSuggestions && messages.length <= 1 && (
        <div className="mb-[16px]">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-[8px]">
            Quick actions
          </p>
          <div className="grid grid-cols-2 gap-[8px]">
            {INITIAL_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendMessage(s.prompt)}
                className="text-left text-[13px] px-[14px] py-[10px] rounded-[10px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-lime-50 hover:text-lime-700 hover:border-lime-300 dark:hover:bg-lime-900/20 transition-all flex items-center gap-[8px]"
              >
                <i className={`${s.icon} text-lime-500 text-[15px]`}></i>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-[8px]">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask about investors, strategy, pitch, outreach..."
          className="flex-1 py-[12px] px-[16px] text-[14px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500"
          disabled={loading}
        />
        <Button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="px-[20px]"
        >
          <i className="ri-send-plane-line text-[18px]"></i>
        </Button>
      </div>
    </div>
  );
}
