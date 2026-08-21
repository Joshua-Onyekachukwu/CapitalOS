import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div>
      {/* Welcome */}
      <div className="mb-[25px] md:mb-[30px]">
        <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[4px]">
          Welcome back 👋
        </h1>
        <p className="text-[14px] md:text-[15px] text-gray-500 !mb-0">
          Here&apos;s an overview of your fundraising progress.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px] md:gap-[20px] mb-[25px] md:mb-[30px]">
        {[
          { label: "Investors Discovered", value: "0", icon: "ri-radar-line", color: "text-primary-500" },
          { label: "Emails Sent", value: "0", icon: "ri-mail-send-line", color: "text-lime-600" },
          { label: "Meetings", value: "0", icon: "ri-calendar-check-line", color: "text-secondary-500" },
          { label: "Interested", value: "0", icon: "ri-heart-3-line", color: "text-danger-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[15px]">
              <div className={`w-[44px] h-[44px] rounded-[10px] bg-gray-50 dark:bg-gray-800 flex items-center justify-center ${stat.color} text-[22px] flex-none`}>
                <i className={stat.icon}></i>
              </div>
              <div>
                <p className="text-[12px] md:text-[13px] text-gray-400 !mb-[2px]">{stat.label}</p>
                <p className="text-[20px] md:text-[24px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[15px] md:gap-[20px] mb-[25px] md:mb-[30px]">
        <Card>
          <CardBody>
            <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-[12px]">
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-[10px]">
              <Link href="/dashboard/startup">
                <Button variant="secondary" size="sm">
                  <i className="ri-rocket-2-line text-[16px]"></i>
                  Set Up Startup
                </Button>
              </Link>
              <Link href="/dashboard/investors">
                <Button variant="outline" size="sm">
                  <i className="ri-radar-line text-[16px]"></i>
                  Find Investors
                </Button>
              </Link>
              <Link href="/dashboard/campaigns">
                <Button variant="outline" size="sm">
                  <i className="ri-megaphone-line text-[16px]"></i>
                  Create Campaign
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-[12px]">
              Getting Started
            </h3>
            <div className="space-y-[10px]">
              {[
                { step: "Set up your startup profile", done: false },
                { step: "Upload your pitch deck", done: false },
                { step: "Discover your first investors", done: false },
                { step: "Create your first campaign", done: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-[10px] text-[14px]">
                  <div className="w-[20px] h-[20px] rounded-full border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center flex-none">
                    {item.done && <i className="ri-check-line text-[12px] text-lime-600"></i>}
                  </div>
                  <span className="text-gray-600 dark:text-gray-400">{item.step}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Activity / Empty State */}
      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-time-line"></i>}
            title="No activity yet"
            description="Start by setting up your startup profile and discovering investors."
            action={{
              label: "Set Up Startup",
              onClick: () => {},
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
