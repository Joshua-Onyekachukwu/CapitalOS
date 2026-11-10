"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/deliverability", label: "Overview", icon: "ri-heart-pulse-line" },
  { href: "/dashboard/deliverability/analytics", label: "Analytics", icon: "ri-bar-chart-line" },
  { href: "/dashboard/deliverability/domain", label: "Domain", icon: "ri-global-line" },
  { href: "/dashboard/deliverability/warmup", label: "Warm-up", icon: "ri-fire-line" },
];

export default function DeliverabilityTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-[4px] mb-[20px] border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`inline-flex items-center gap-[6px] whitespace-nowrap px-[14px] py-[10px] text-[13px] font-medium border-b-2 -mb-[1px] transition-colors ${
              active
                ? "border-lime-500 text-[#06201b] dark:text-white"
                : "border-transparent text-gray-500 hover:text-[#06201b] dark:hover:text-white"
            }`}
          >
            <i className={tab.icon}></i>
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
