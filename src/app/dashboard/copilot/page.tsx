"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const suggestedQuestions = [
  "Who are my highest-fit investors?",
  "How should I prioritize my outreach?",
  "What sectors should I focus on?",
  "Help me draft a fundraising strategy",
  "Which investors should I contact first?",
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hi! I'm your AI Fundraising Copilot. I can help you with investor strategy, outreach planning, and fundraising decisions. Ask me anything about your pipeline or investors.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const content = text || input.trim();
    if (!content || loading) return;

    const userMessage: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error. Please check your connection and try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <PageHeader
        title="AI Copilot"
        description="Your AI fundraising assistant — ask anything about investors, strategy, or outreach."
      />

      {/* Chat Messages */}
      <Card className="flex-1 flex flex-col min-h-0 mb-[16px]">
        <CardBody className="flex-1 overflow-y-auto p-[20px]">
          <div className="space-y-[16px] max-w-[800px] mx-auto">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-[12px] px-[16px] py-[12px] ${
                    msg.role === "user"
                      ? "bg-[#06201b] text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-[6px] mb-[6px]">
                      <i className="ri-sparkling-2-line text-lime-500 text-[14px]"></i>
                      <span className="text-[11px] font-semibold text-lime-600 uppercase tracking-wider">AI Copilot</span>
                    </div>
                  )}
                  <p className="text-[14px] leading-[1.7] !mb-0 whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-[12px] px-[16px] py-[12px]">
                  <div className="flex items-center gap-[6px] mb-[6px]">
                    <i className="ri-sparkling-2-line text-lime-500 text-[14px]"></i>
                    <span className="text-[11px] font-semibold text-lime-600 uppercase tracking-wider">AI Copilot</span>
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
      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-[8px] mb-[16px]">
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="text-[13px] px-[14px] py-[8px] rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-lime-50 hover:text-lime-700 dark:hover:bg-lime-900/20 transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-[10px]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
          placeholder="Ask about your investors, strategy, or outreach..."
          className="flex-1 py-[12px] px-[16px] text-[14px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500"
          disabled={loading}
        />
        <Button onClick={() => sendMessage()} disabled={loading || !input.trim()}>
          <i className="ri-send-plane-line text-[18px]"></i>
        </Button>
      </div>
    </div>
  );
}
