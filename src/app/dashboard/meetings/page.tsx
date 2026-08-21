"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function MeetingsPage() {
  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Schedule and track investor meetings."
      />

      {/* Upcoming Meetings */}
      <Card className="mb-[20px]">
        <CardBody>
          <h3 className="!text-[16px] !font-semibold !mb-[16px]">
            Upcoming
          </h3>
          <div className="text-center py-[20px]">
            <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 dark:text-gray-600 text-[24px]">
              <i className="ri-calendar-line"></i>
            </div>
            <p className="text-[14px] text-gray-400 !mb-0">No upcoming meetings</p>
          </div>
        </CardBody>
      </Card>

      {/* Past Meetings */}
      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-calendar-check-line"></i>}
            title="No meetings yet"
            description="When investors express interest, you can schedule meetings. AI will prepare meeting briefs for you."
          />
        </CardBody>
      </Card>
    </div>
  );
}
