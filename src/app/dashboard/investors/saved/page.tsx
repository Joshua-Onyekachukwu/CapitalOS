"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function SavedInvestorsPage() {
  return (
    <div>
      <PageHeader
        title="Saved Investors"
        description="Investors you've bookmarked for later review."
      />

      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-bookmark-line"></i>}
            title="No saved investors"
            description="Bookmark investors during discovery to save them here for later review."
          />
        </CardBody>
      </Card>
    </div>
  );
}
