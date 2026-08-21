"use client";

import React from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function AdminFirmsPage() {
  return (
    <div>
      <PageHeader
        title="Investor Firms"
        description="Manage venture capital firms, angel syndicates, and other investment organizations."
        actions={
          <Button size="sm">
            <i className="ri-add-line text-[16px]" />
            Add Firm
          </Button>
        }
      />

      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-building-2-line" />}
            title="No firms in database"
            description="Firms are automatically added when investor data is acquired from providers."
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
