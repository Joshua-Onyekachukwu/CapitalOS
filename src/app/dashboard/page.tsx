import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Welcome back 👋"
        description="Here's an overview of your fundraising progress."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[15px] md:gap-[20px] mb-[25px] md:mb-[30px]">
        {[
          { label: "Investors Discovered", value: "0", icon: "ri-radar-line", color: "bg-lime-100 dark:bg-lime-900/20", iconColor: "text-lime-600" },
          { label: "Emails Sent", value: "0", icon: "ri-mail-send-line", color: "bg-blue-50 dark:bg-blue-900/20", iconColor: "text-blue-600" },
          { label: "Meetings", value: "0", icon: "ri-calendar-check-line", color: "bg-purple-50 dark:bg-purple-900/20", iconColor: "text-purple-600" },
          { label: "Interested", value: "0", icon: "ri-heart-3-line", color: "bg-rose-50 dark:bg-rose-900/20", iconColor: "text-rose-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[15px]">
              <div className={`w-[44px] h-[44px] rounded-[10px] ${stat.color} flex items-center justify-center ${stat.iconColor} text-[22px] flex-none`}>
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

      {/* Quick Actions + Getting Started */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[15px] md:gap-[20px] mb-[25px] md:mb-[30px]">
        {/* Quick Actions */}
        <Card>
          <CardBody>
            <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-[16px]">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <Link href="/dashboard/startup">
                <div className="flex items-center gap-[12px] p-[14px] rounded-[10px] border border-gray-200 dark:border-gray-700 hover:border-lime-500 dark:hover:border-lime-500 hover:bg-lime-50/50 dark:hover:bg-lime-900/10 transition-all cursor-pointer group">
                  <div className="w-[36px] h-[36px] rounded-[8px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[18px] flex-none">
                    <i className="ri-rocket-2-line"></i>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0">Set Up Startup</p>
                    <p className="text-[11px] text-gray-400 !mb-0">Complete your profile</p>
                  </div>
                </div>
              </Link>
              <Link href="/dashboard/investors/discover">
                <div className="flex items-center gap-[12px] p-[14px] rounded-[10px] border border-gray-200 dark:border-gray-700 hover:border-lime-500 dark:hover:border-lime-500 hover:bg-lime-50/50 dark:hover:bg-lime-900/10 transition-all cursor-pointer group">
                  <div className="w-[36px] h-[36px] rounded-[8px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-[18px] flex-none">
                    <i className="ri-radar-line"></i>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0">Find Investors</p>
                    <p className="text-[11px] text-gray-400 !mb-0">AI-powered discovery</p>
                  </div>
                </div>
              </Link>
              <Link href="/dashboard/campaigns">
                <div className="flex items-center gap-[12px] p-[14px] rounded-[10px] border border-gray-200 dark:border-gray-700 hover:border-lime-500 dark:hover:border-lime-500 hover:bg-lime-50/50 dark:hover:bg-lime-900/10 transition-all cursor-pointer group">
                  <div className="w-[36px] h-[36px] rounded-[8px] bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 text-[18px] flex-none">
                    <i className="ri-megaphone-line"></i>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0">Create Campaign</p>
                    <p className="text-[11px] text-gray-400 !mb-0">Start outreach</p>
                  </div>
                </div>
              </Link>
              <Link href="/dashboard/copilot">
                <div className="flex items-center gap-[12px] p-[14px] rounded-[10px] border border-gray-200 dark:border-gray-700 hover:border-lime-500 dark:hover:border-lime-500 hover:bg-lime-50/50 dark:hover:bg-lime-900/10 transition-all cursor-pointer group">
                  <div className="w-[36px] h-[36px] rounded-[8px] bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 text-[18px] flex-none">
                    <i className="ri-sparkling-2-line"></i>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0">AI Copilot</p>
                    <p className="text-[11px] text-gray-400 !mb-0">Ask anything</p>
                  </div>
                </div>
              </Link>
            </div>
          </CardBody>
        </Card>

        {/* Getting Started Checklist */}
        <Card>
          <CardBody>
            <div className="flex items-center justify-between mb-[16px]">
              <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-0">
                Getting Started
              </h3>
              <Badge variant="warning" size="sm">0 / 4</Badge>
            </div>
            <div className="space-y-[12px]">
              {[
                { step: "Set up your startup profile", href: "/dashboard/startup", done: false },
                { step: "Upload your pitch deck", href: "/dashboard/documents", done: false },
                { step: "Discover your first investors", href: "/dashboard/investors/discover", done: false },
                { step: "Create your first campaign", href: "/dashboard/campaigns", done: false },
              ].map((item, i) => (
                <Link
                  key={i}
                  href={item.href}
                  className="flex items-center gap-[12px] p-[12px] rounded-[8px] hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
                >
                  <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-none transition-colors ${
                    item.done
                      ? "bg-lime-500 border-lime-500"
                      : "border-gray-200 dark:border-gray-700 group-hover:border-lime-500"
                  }`}>
                    {item.done && <i className="ri-check-line text-[12px] text-white"></i>}
                  </div>
                  <span className={`text-[14px] ${item.done ? "text-gray-400 line-through" : "text-gray-600 dark:text-gray-400"}`}>
                    {item.step}
                  </span>
                  {!item.done && (
                    <i className="ri-arrow-right-s-line text-[16px] text-gray-300 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"></i>
                  )}
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-[16px]">
            <h3 className="!text-[16px] md:!text-lg !font-semibold !mb-0">
              Recent Activity
            </h3>
          </div>
          <div className="text-center py-[30px]">
            <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[14px] text-gray-300 dark:text-gray-600 text-[24px]">
              <i className="ri-time-line"></i>
            </div>
            <p className="text-[14px] text-gray-400 !mb-[4px]">No activity yet</p>
            <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-0">
              Start by setting up your startup profile.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
