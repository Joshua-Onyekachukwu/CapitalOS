"use client";

import React from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function JobsPage() {
  return (
    <div>
      <PageHeader
        title="Acquisition Jobs"
        description="Track data import and enrichment job history."
      />

      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-refresh-line" />}
            title="No acquisition jobs yet"
            description="Jobs will appear here when data acquisition is initiated from the provider pages."
          />
        </CardBody>
      </Card>
    </div>
  );
}
