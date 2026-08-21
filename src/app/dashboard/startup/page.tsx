"use client";

import React from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

const profileSections = [
  { label: "Company Overview", description: "Name, description, category", done: false, icon: "ri-building-line", href: "#company" },
  { label: "Product & Market", description: "Product, market size, competition", done: false, icon: "ri-lightbulb-line", href: "#product" },
  { label: "Traction & Revenue", description: "Revenue, growth, users", done: false, icon: "ri-line-chart-line", href: "#traction" },
  { label: "Team & Founders", description: "Founder backgrounds, team size", done: false, icon: "ri-team-line", href: "#team" },
  { label: "Fundraising Details", description: "Stage, amount, use of funds", done: false, icon: "ri-funds-line", href: "#fundraising" },
  { label: "Pitch Deck", description: "Upload and analyze your deck", done: false, icon: "ri-file-ppt-2-line", href: "/dashboard/documents" },
];

const completedCount = profileSections.filter((s) => s.done).length;
const completionPercent = Math.round((completedCount / profileSections.length) * 100);

export default function StartupPage() {
  return (
    <div>
      <PageHeader
        title="My Startup"
        description="Manage your startup profile and investment information."
        actions={
          <Link href="/dashboard/documents">
            <Button variant="outline" size="sm">
              <i className="ri-upload-2-line text-[16px]"></i>
              Upload Deck
            </Button>
          </Link>
        }
      />

      {/* Profile Completeness Banner */}
      <Card className="mb-[20px]">
        <CardBody>
          <div className="flex items-center justify-between flex-wrap gap-[15px]">
            <div className="flex items-center gap-[15px]">
              <div className="w-[48px] h-[48px] rounded-full bg-primary-100 dark:bg-primary-900/20 flex items-center justify-center">
                <i className="ri-rocket-2-line text-primary-600 text-[24px]"></i>
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
              <Badge variant={completionPercent === 100 ? "success" : "warning"}>
                {completionPercent}% Complete
              </Badge>
              <Button size="sm">Edit Profile</Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-[18px]">
            <div className="w-full h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Profile Sections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[15px] md:gap-[20px] mb-[25px]">
        {profileSections.map((section) => (
          <Link key={section.label} href={section.href}>
            <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
              <CardBody>
                <div className="flex items-start gap-[14px]">
                  <div className={`w-[40px] h-[40px] rounded-[10px] flex items-center justify-center flex-none text-[20px] ${
                    section.done
                      ? "bg-primary-100 dark:bg-primary-900/20 text-primary-600"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 group-hover:text-primary-600 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20"
                  } transition-colors`}>
                    <i className={section.icon}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[8px] mb-[4px]">
                      <h4 className="!text-[14px] !font-semibold !mb-0 text-[#0f172a] dark:text-white">
                        {section.label}
                      </h4>
                      {section.done && (
                        <i className="ri-check-line text-[14px] text-primary-600"></i>
                      )}
                    </div>
                    <p className="text-[13px] text-gray-400 !mb-0">
                      {section.description}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      {/* Startup Preview Card */}
      <Card>
        <CardBody>
          <div className="text-center py-[20px]">
            <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 dark:text-gray-600 text-[24px]">
              <i className="ri-rocket-2-line"></i>
            </div>
            <p className="text-[14px] text-gray-400 !mb-[4px]">No startup profile yet</p>
            <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-[16px]">
              Complete your profile to begin discovering relevant investors.
            </p>
            <Button size="sm">
              <i className="ri-add-line text-[16px]"></i>
              Create Startup Profile
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
