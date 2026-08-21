"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";

export default function OutreachPage() {
  return (
    <div>
      <div className="mb-[25px] md:mb-[30px]">
        <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[4px]">
          Outreach
        </h1>
        <p className="text-[14px] text-gray-500 !mb-0">
          Manage your email drafts, sent messages, and replies.
        </p>
      </div>

      <Card>
        <Tabs
          tabs={[
            { id: "drafts", label: "Drafts", count: 0 },
            { id: "sent", label: "Sent", count: 0 },
            { id: "replies", label: "Replies", count: 0 },
            { id: "follow-ups", label: "Follow-ups", count: 0 },
          ]}
          onChange={() => {}}
        />
        <CardBody>
          <EmptyState
            icon={<i className="ri-mail-send-line"></i>}
            title="No outreach yet"
            description="When you generate and send investor emails, they will appear here."
          />
        </CardBody>
      </Card>
    </div>
  );
}
