"use client";

import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export default function StartupPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-[25px] md:mb-[30px]">
        <div>
          <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[4px]">
            My Startup
          </h1>
          <p className="text-[14px] text-gray-500 !mb-0">
            Manage your startup profile and investment information.
          </p>
        </div>
      </div>

      {/* Profile Completeness */}
      <Card className="mb-[20px]">
        <CardBody className="flex items-center justify-between flex-wrap gap-[15px]">
          <div className="flex items-center gap-[15px]">
            <div className="w-[48px] h-[48px] rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center">
              <i className="ri-rocket-2-line text-lime-600 text-[24px]"></i>
            </div>
            <div>
              <h3 className="!text-[16px] !font-semibold !mb-[2px]">
                Startup Profile
              </h3>
              <p className="text-[13px] text-gray-400 !mb-0">
                Complete your profile to get better investor matches.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-[12px]">
            <Badge variant="warning">0% Complete</Badge>
            <Button size="sm">Complete Profile</Button>
          </div>
        </CardBody>
      </Card>

      {/* Empty State */}
      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-rocket-2-line"></i>}
            title="No startup profile yet"
            description="Create your startup profile to begin discovering relevant investors."
            action={{
              label: "Create Startup Profile",
              onClick: () => {},
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
