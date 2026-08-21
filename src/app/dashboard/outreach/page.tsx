"use client";

import React, { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

const tabContent: Record<string, { icon: string; title: string; description: string }> = {
  drafts: {
    icon: "ri-draft-line",
    title: "No drafts yet",
    description: "AI-generated email drafts will appear here for your review before sending.",
  },
  sent: {
    icon: "ri-mail-send-line",
    title: "No sent emails",
    description: "Once you approve and send outreach emails, they will appear here.",
  },
  replies: {
    icon: "ri-reply-line",
    title: "No replies yet",
    description: "When investors respond to your outreach, their replies will show up here.",
  },
  "follow-ups": {
    icon: "ri-loop-left-line",
    title: "No follow-ups scheduled",
    description: "AI will recommend follow-up actions based on investor engagement.",
  },
};

export default function OutreachPage() {
  const [activeTab, setActiveTab] = useState("drafts");
  const content = tabContent[activeTab] ?? tabContent.drafts;

  return (
    <div>
      <PageHeader
        title="Outreach"
        description="Manage your email drafts, sent messages, and replies."
      />

      <Card>
        <Tabs
          tabs={[
            { id: "drafts", label: "Drafts", count: 0 },
            { id: "sent", label: "Sent", count: 0 },
            { id: "replies", label: "Replies", count: 0 },
            { id: "follow-ups", label: "Follow-ups", count: 0 },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        <CardBody>
          <EmptyState
            icon={<i className={content.icon}></i>}
            title={content.title}
            description={content.description}
          />
        </CardBody>
      </Card>
    </div>
  );
}
