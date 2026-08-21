"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function CampaignsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-[25px] md:mb-[30px] flex-wrap gap-[15px]">
        <div>
          <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[4px]">
            Campaigns
          </h1>
          <p className="text-[14px] text-gray-500 !mb-0">
            Manage your fundraising campaigns and pipeline.
          </p>
        </div>
        <Button>
          <i className="ri-add-line text-[18px]"></i>
          New Campaign
        </Button>
      </div>

      {/* Empty State */}
      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-megaphone-line"></i>}
            title="No campaigns yet"
            description="Create your first fundraising campaign to start tracking investors and outreach."
            action={{
              label: "Create Campaign",
              onClick: () => {},
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
