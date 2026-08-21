"use client";

import React from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function AuditLogsPage() {
  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Track all admin actions and system events."
      />

      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-file-list-3-line" />}
            title="No audit logs yet"
            description="Admin actions and system events will appear here as they occur."
          />
        </CardBody>
      </Card>
    </div>
  );
}
