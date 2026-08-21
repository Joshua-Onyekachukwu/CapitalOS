"use client";

import React from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function AdminInvestorsPage() {
  return (
    <div>
      <PageHeader
        title="Investors"
        description="Manage the investor intelligence database."
        actions={
          <Button size="sm">
            <i className="ri-add-line text-[16px]" />
            Add Investor
          </Button>
        }
      />

      {/* Search & Filters */}
      <Card className="mb-[20px]">
        <CardBody className="py-[14px] px-[16px]">
          <div className="flex items-center gap-[12px] flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <i className="ri-search-line absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 text-[18px]" />
              <input
                type="text"
                placeholder="Search investors..."
                className="w-full py-[9px] pl-[38px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500"
              />
            </div>
            <Button variant="outline" size="sm">Type</Button>
            <Button variant="outline" size="sm">Sector</Button>
            <Button variant="outline" size="sm">Stage</Button>
            <Button variant="outline" size="sm">Source</Button>
          </div>
        </CardBody>
      </Card>

      {/* Investors Table */}
      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-user-search-line" />}
            title="No investors in database"
            description="Run a data acquisition job to import investors from your connected providers."
            action={{
              label: "Go to Data Sources",
              onClick: () => {},
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
