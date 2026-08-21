"use client";

import React, { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function InvestorDiscoverPage() {
  const [query, setQuery] = useState("");

  return (
    <div>
      <PageHeader
        title="Discover Investors"
        description="AI-powered search to find investors that match your startup."
      />

      {/* Search Card */}
      <Card className="mb-[20px]">
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">
            Search Criteria
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mb-[16px]">
            <Input
              label="Sector Focus"
              placeholder="e.g. AI, Fintech, SaaS, Climate"
            />
            <Input
              label="Geography"
              placeholder="e.g. US, Europe, Global"
            />
            <Input
              label="Stage"
              placeholder="e.g. Pre-Seed, Seed, Series A"
            />
            <Input
              label="Check Size"
              placeholder="e.g. $100k - $1M"
            />
          </div>
          <div className="flex items-center gap-[10px]">
            <Button>
              <i className="ri-radar-line text-[18px]"></i>
              Discover Investors
            </Button>
            <Button variant="ghost" size="sm">
              Use My Startup Profile
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Results */}
      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-radar-line"></i>}
            title="No investors discovered yet"
            description="Set your search criteria and let AI find the best matching investors for your startup."
            action={{
              label: "Run Discovery",
              onClick: () => {},
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
