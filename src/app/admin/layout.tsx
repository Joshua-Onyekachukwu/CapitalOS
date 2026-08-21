"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const adminNav = [
  { label: "Overview", href: "/admin", icon: "ri-dashboard-3-line" },
  { label: "Users", href: "/admin/users", icon: "ri-team-line" },
  { label: "Investors", href: "/admin/investors", icon: "ri-user-search-line" },
  { label: "Investor Firms", href: "/admin/investor-firms", icon: "ri-building-2-line" },
  { divider: true },
  { label: "Data Sources", href: "/admin/data-sources", icon: "ri-database-2-line" },
  { label: "Apollo", href: "/admin/data-sources/apollo", icon: "ri-plug-line", indent: true },
  { label: "Sync Jobs", href: "/admin/data-sources/jobs", icon: "ri-refresh-line", indent: true },
  { divider: true },
  { label: "AI", href: "/admin/ai", icon: "ri-robot-2-line" },
  { label: "Finance", href: "/admin/finance", icon: "ri-funds-line" },
  { label: "Audit Logs", href: "/admin/audit-logs", icon: "ri-file-list-3-line" },
  { label: "System", href: "/admin/system", icon: "ri-settings-3-line" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e19]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[998] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[260px] bg-white dark:bg-[#0a0e19] border-r border-gray-100 dark:border-gray-800 z-[999] transition-transform duration-300",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="px-[20px] py-[18px] border-b border-gray-100 dark:border-gray-800">
            <Link href="/admin" className="inline-flex items-center gap-[8px]">
              <span className="text-[19px] font-bold text-[#06201b] dark:text-white">
                Capital<span className="text-lime-500">OS</span>
              </span>
              <span className="text-[11px] font-semibold px-[6px] py-[2px] rounded bg-gray-100 dark:bg-gray-800 text-gray-500">
                ADMIN
              </span>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto px-[10px] py-[12px]">
            {adminNav.map((item, index) => {
              if ("divider" in item && item.divider) {
                return (
                  <div
                    key={index}
                    className="my-[12px] border-t border-gray-100 dark:border-gray-800"
                  />
                );
              }

              const navItem = item as { label: string; href: string; icon: string; indent?: boolean };
              const active = isActive(navItem.href);

              return (
                <Link
                  key={navItem.href}
                  href={navItem.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "flex items-center gap-[10px] px-[12px] py-[9px] rounded-[7px] text-[13px] font-medium transition-all",
                    navItem.indent && "pl-[28px]",
                    active
                      ? "bg-lime-50 dark:bg-lime-900/20 text-[#06201b] dark:text-white"
                      : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-[#06201b] dark:hover:text-white"
                  )}
                >
                  <i className={cn("text-[18px]", active ? "text-lime-600" : "text-gray-400")} />
                  {navItem.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-[260px]">
        {/* Header */}
        <header className="sticky top-0 z-[50] bg-white/80 dark:bg-[#0a0e19]/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between px-[20px] md:px-[30px] py-[14px]">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden flex items-center justify-center w-[36px] h-[36px] rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Toggle menu"
            >
              <i className="ri-menu-line text-[22px] text-[#06201b] dark:text-white" />
            </button>
            <h1 className="!text-[15px] !font-semibold !mb-0 !text-gray-800 dark:!text-white">
              Admin Dashboard
            </h1>
            <Link
              href="/dashboard"
              className="text-[13px] text-gray-500 hover:text-lime-600 font-medium"
            >
              ← Back to App
            </Link>
          </div>
        </header>

        <main className="p-[20px] md:p-[30px]">{children}</main>
      </div>
    </div>
  );
}
