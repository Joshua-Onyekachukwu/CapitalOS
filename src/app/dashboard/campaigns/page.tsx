"use client";

import React from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function CampaignsPage() {
  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Manage your fundraising campaigns and pipeline."
        actions={
          <Button>
            <i className="ri-add-line text-[18px]"></i>
            New Campaign
          </Button>
        }
      />

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[15px] md:gap-[20px] mb-[25px]">
        {[
          { label: "Active Campaigns", value: "0", icon: "ri-megaphone-line", color: "bg-lime-100 dark:bg-lime-900/20 text-lime-600" },
          { label: "Total Investors", value: "0", icon: "ri-team-line", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
          { label: "Emails Generated", value: "0", icon: "ri-mail-line", color: "bg-purple-50 dark:bg-purple-900/20 text-purple-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[14px]">
              <div className={`w-[40px] h-[40px] rounded-[10px] ${stat.color} flex items-center justify-center text-[20px] flex-none`}>
                <i className={stat.icon}></i>
              </div>
              <div>
                <p className="text-[12px] text-gray-400 !mb-[2px]">{stat.label}</p>
                <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
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
