"use client";

import React, { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";

const suggestedCommands = [
  "Find 50 AI investors for my startup",
  "Research this investor",
  "Draft an outreach email",
  "Who should I follow up with?",
  "Show my strongest investor matches",
  "Give me a fundraising report",
];

export default function CopilotPage() {
  const [input, setInput] = useState("");

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <PageHeader
        title="Fundraising Copilot"
        description="Ask your AI assistant anything about fundraising."
      />

      {/* Chat Area */}
      <Card className="flex-1 flex flex-col mb-0">
        <CardBody className="flex-1 flex flex-col">
          {/* Messages area */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-[400px]">
              <div className="w-[56px] h-[56px] rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-[16px] text-primary-600 text-[26px]">
                <i className="ri-sparkling-2-line"></i>
              </div>
              <h3 className="!text-lg !font-semibold !mb-[6px] text-[#0f172a] dark:text-white">
                How can I help you fundraise?
              </h3>
              <p className="text-[14px] text-gray-400 !mb-[20px]">
                I can research investors, draft emails, analyze your pipeline, and more.
              </p>

              {/* Suggested commands */}
              <div className="flex flex-wrap justify-center gap-[8px]">
                {suggestedCommands.map((cmd) => (
                  <button
                    key={cmd}
                    onClick={() => setInput(cmd)}
                    className="text-[13px] px-[12px] py-[6px] rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Input area */}
          <div className="mt-[16px] pt-[16px] border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-[10px]">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about investors, outreach, campaigns..."
                className="flex-1 py-[11px] px-[16px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[10px] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input.trim()) {
                    // TODO: Send message
                    setInput("");
                  }
                }}
              />
              <Button disabled={!input.trim()}>
                <i className="ri-send-plane-fill text-[16px]"></i>
              </Button>
            </div>
            <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-[8px] text-center !mb-0">
              AI responses are based on your startup data and public investor information.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
