"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

const SAVED_INVESTORS = [
  {
    id: "1",
    full_name: "Sarah Chen",
    company: "Horizon Ventures",
    title: "General Partner",
    location: "San Francisco, CA",
    fit_score: 94,
    investor_type: "VC",
    saved_at: "2 days ago",
  },
  {
    id: "3",
    full_name: "Priya Patel",
    company: "Neural Fund",
    title: "Partner",
    location: "London, UK",
    fit_score: 89,
    investor_type: "VC",
    saved_at: "5 days ago",
  },
];

export default function SavedInvestorsPage() {
  return (
    <div>
      <PageHeader
        title="Saved Investors"
        description="Investors you've bookmarked for later review."
      />

      {SAVED_INVESTORS.length === 0 ? (
        <Card>
          <CardBody className="py-[60px]">
            <div className="text-center">
              <div className="w-[64px] h-[64px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-bookmark-line text-gray-400 text-[28px]"></i>
              </div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">No saved investors</h3>
              <p className="text-[14px] text-gray-500 !mb-[16px]">
                Bookmark investors during discovery to save them here for later review.
              </p>
              <Link href="/dashboard/investors/discover">
                <Button>
                  <i className="ri-radar-line text-[18px]"></i>
                  Discover Investors
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[12px]">
          {SAVED_INVESTORS.map((investor) => (
            <Card key={investor.id} className="hover:shadow-md transition-shadow">
              <CardBody className="p-[16px]">
                <div className="flex items-center gap-[12px]">
                  <div className="w-[40px] h-[40px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[14px] font-semibold text-lime-700 dark:text-lime-400 flex-none">
                    {investor.full_name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[8px]">
                      <span className="font-medium text-[14px] text-gray-900 dark:text-white">{investor.full_name}</span>
                      <Badge variant="default" size="sm">{investor.investor_type}</Badge>
                    </div>
                    <p className="text-[12px] text-gray-400 !mb-0">
                      {investor.title} at {investor.company} · {investor.location}
                    </p>
                  </div>
                  <div className="flex items-center gap-[8px] flex-none">
                    <div className="text-right">
                      <span className="text-[14px] font-bold text-gray-900 dark:text-white">{investor.fit_score}%</span>
                      <span className="text-[11px] text-gray-400 block">fit</span>
                    </div>
                    <Link href={`/dashboard/investors/${investor.id}`}>
                      <Button size="sm" variant="outline">View</Button>
                    </Link>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
