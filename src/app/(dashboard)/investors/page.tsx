"use client";

import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function InvestorsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-[25px] md:mb-[30px] flex-wrap gap-[15px]">
        <div>
          <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[4px]">
            Investors
          </h1>
          <p className="text-[14px] text-gray-500 !mb-0">
            Discover, research, and track investors.
          </p>
        </div>
        <Button>
          <i className="ri-radar-line text-[18px]"></i>
          Discover Investors
        </Button>
      </div>

      {/* Search & Filters placeholder */}
      <Card className="mb-[20px]">
        <CardBody className="flex items-center gap-[12px] flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <i className="ri-search-line absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 text-[18px]"></i>
            <input
              type="text"
              placeholder="Search investors..."
              className="w-full py-[9px] pl-[38px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500"
            />
          </div>
          <Button variant="outline" size="sm">
            <i className="ri-filter-3-line text-[16px]"></i>
            Filters
          </Button>
        </CardBody>
      </Card>

      {/* Empty State */}
      <Card>
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
