"use client";

import React, { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import Link from "next/link";

export default function InvestorsPage() {
  const [activeTab, setActiveTab] = useState("all");

  return (
    <div>
      <PageHeader
        title="Investors"
        description="Discover, research, and track investors."
        actions={
          <Link href="/dashboard/investors/discover">
            <Button>
              <i className="ri-radar-line text-[18px]"></i>
              Discover Investors
            </Button>
          </Link>
        }
      />

      {/* Search & Filters */}
      <Card className="mb-[20px]">
        <CardBody className="py-[14px] px-[16px]">
          <div className="flex items-center gap-[12px] flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <i className="ri-search-line absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 text-[18px]"></i>
              <input
                type="text"
                placeholder="Search by name, firm, sector..."
                className="w-full py-[9px] pl-[38px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
              />
            </div>
            <Button variant="outline" size="sm">
              <i className="ri-filter-3-line text-[16px]"></i>
              Stage
            </Button>
            <Button variant="outline" size="sm">
              <i className="ri-map-pin-line text-[16px]"></i>
              Geography
            </Button>
            <Button variant="outline" size="sm">
              <i className="ri-funds-line text-[16px]"></i>
              Check Size
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Tabs + Content */}
      <Card>
        <Tabs
          tabs={[
            { id: "all", label: "All Investors", count: 0 },
            { id: "saved", label: "Saved", count: 0 },
            { id: "contacted", label: "Contacted", count: 0 },
            { id: "qualified", label: "Qualified", count: 0 },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        <CardBody>
          <EmptyState
            icon={<i className="ri-user-search-line"></i>}
            title="No investors yet"
            description="Start discovering investors that match your startup's stage, sector, and geography."
            action={{
              label: "Discover Investors",
              onClick: () => {},
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
