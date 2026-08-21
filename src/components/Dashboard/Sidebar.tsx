"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "ri-dashboard-3-line" },
  { label: "My Startup", href: "/dashboard/startup", icon: "ri-rocket-2-line" },
  { label: "Investors", href: "/dashboard/investors", icon: "ri-user-search-line" },
  { label: "Campaigns", href: "/dashboard/campaigns", icon: "ri-megaphone-line" },
  { label: "Outreach", href: "/dashboard/outreach", icon: "ri-mail-send-line" },
  { label: "Analytics", href: "/dashboard/analytics", icon: "ri-line-chart-line" },
  { label: "Settings", href: "/dashboard/settings", icon: "ri-settings-3-line" },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[998] lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-white dark:bg-[#0a0e19] border-r border-gray-100 dark:border-gray-800 z-[999] transition-transform duration-300",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-[20px] py-[20px] border-b border-gray-100 dark:border-gray-800">
            <Link href="/dashboard" className="inline-block">
              <span className="text-xl font-bold text-[#06201b] dark:text-white">
                Capital<span className="text-lime-500">OS</span>
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-[12px] py-[16px] overflow-y-auto">
            <ul className="space-y-[4px]">
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-[12px] px-[14px] py-[10px] md:py-[12px] rounded-[8px] text-[14px] md:text-[15px] font-medium transition-all",
                        isActive
                          ? "bg-lime-50 dark:bg-lime-900/20 text-[#06201b] dark:text-white"
                          : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-[#06201b] dark:hover:text-white"
                      )}
                    >
                      <i
                        className={cn(
                          "text-[20px]",
                          isActive ? "text-lime-600" : "text-gray-400"
                        )}
                      ></i>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Upgrade card */}
          <div className="px-[12px] pb-[16px]">
            <div className="bg-[#06201b] rounded-[12px] p-[18px]">
              <h4 className="!text-[14px] !font-semibold !text-white !mb-[6px]">
                Need help?
              </h4>
              <p className="text-[13px] text-gray-400 !mb-[12px]">
                Check our documentation or contact support.
              </p>
              <a
                href="#"
                className="inline-block text-[13px] font-medium text-lime-500 hover:text-lime-400"
              >
                View Docs →
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export { Sidebar };
