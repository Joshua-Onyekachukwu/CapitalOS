"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
  adminOnly?: boolean;
}  // Admin-only hrefs — hidden from non-admins in sidebar AND blocked by layout
  const ADMIN_HREFS = ["/dashboard/admin"];

  function isAdminItem(href: string): boolean {
    return ADMIN_HREFS.some((adminHref) => href === adminHref || href.startsWith(adminHref + "/"));
  }

  const navSections: NavSection[] = [
    {
      items: [
        { label: "Dashboard", href: "/dashboard", icon: "ri-dashboard-3-line" },
        { label: "Fundraising Copilot", href: "/dashboard/copilot", icon: "ri-sparkling-2-line", badge: "AI" },
      ],
    },
    {
      title: "Startup",
      items: [
        { label: "My Startup", href: "/dashboard/startup", icon: "ri-rocket-2-line" },
        { label: "Edit Profile", href: "/dashboard/startup/edit", icon: "ri-edit-line" },
        { label: "Onboarding", href: "/onboarding", icon: "ri-flask-line" },
        { label: "Documents", href: "/dashboard/documents", icon: "ri-file-text-line" },
        { label: "Pitch Decks", href: "/dashboard/decks", icon: "ri-file-ppt-2-line" },
      ],
    },
    {
      title: "Investors",
      items: [
        { label: "Discover", href: "/dashboard/investors/discover", icon: "ri-radar-line" },
        { label: "Investor Database", href: "/dashboard/investors", icon: "ri-database-2-line" },
        { label: "Saved Investors", href: "/dashboard/investors/saved", icon: "ri-bookmark-line" },
        { label: "Fit Analysis", href: "/dashboard/investors/fit", icon: "ri-pie-chart-line" },
      ],
    },
    {
      title: "Pipeline",
      items: [
        { label: "Fundraising Pipeline", href: "/dashboard/pipeline", icon: "ri-kanban-view" },
        { label: "Campaigns", href: "/dashboard/campaigns", icon: "ri-megaphone-line" },
      ],
    },
    {
      title: "Outreach",
      items: [
        { label: "Outreach", href: "/dashboard/outreach", icon: "ri-mail-send-line" },
        { label: "Email Health", href: "/dashboard/email-health", icon: "ri-heart-pulse-line", badge: "New" },
        { label: "Metrics", href: "/dashboard/outreach/metrics", icon: "ri-bar-chart-line" },
        { label: "Meetings", href: "/dashboard/meetings", icon: "ri-calendar-check-line" },
      ],
    },
    {
      title: "Insights",
      items: [
        { label: "Analytics", href: "/dashboard/analytics", icon: "ri-line-chart-line" },
        { label: "AI Activity", href: "/dashboard/ai-activity", icon: "ri-robot-2-line" },
      ],
    },
    // Admin-only section — only rendered for admins
    {
      title: "Admin",
      items: [
        { label: "Data Health", href: "/dashboard/admin", icon: "ri-heart-pulse-line" },
        { label: "Email Monitor", href: "/dashboard/admin/email-monitor", icon: "ri-mail-check-line" },
        { label: "Waitlist", href: "/dashboard/admin/waitlist", icon: "ri-user-star-line" },
      ],
      adminOnly: true,
    },
    {
      items: [
        { label: "Settings", href: "/dashboard/settings", icon: "ri-settings-3-line" },
      ],
    },
  ];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}

function SidebarNavItem({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-[12px] px-[16px] py-[8px] rounded-[8px] text-[14px] font-medium transition-all duration-150",
        isActive
          ? "bg-lime-50 dark:bg-lime-900/20 text-[#06201b] dark:text-white"
          : "text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-[#06201b] dark:hover:text-white"
      )}
    >
      <i
        className={cn(
          "text-[18px] flex-shrink-0 transition-colors",
          isActive ? "text-lime-600" : "text-gray-400 group-hover:text-gray-500"
        )}
      ></i>
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <span className="text-[10px] font-bold px-[6px] py-[1px] rounded-full bg-lime-500 text-black">
          {item.badge}
        </span>
      )}
    </Link>
  );
}

function Sidebar({ isOpen, onClose, isAdmin }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    // Exact match for non-dashboard routes to avoid false positives
    // e.g., /dashboard/investors should not match /dashboard/investors/discover
    if (pathname === href) return true;
    // Check if pathname starts with href followed by / or ?
    if (pathname.startsWith(href + "/") || pathname.startsWith(href + "?")) return true;
    return false;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[998] lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[270px] bg-white dark:bg-[#0a0e19] border-r border-gray-100 dark:border-gray-800 z-[999] transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="px-[20px] py-[16px] border-b border-gray-100 dark:border-gray-800">
            <Link href="/dashboard" className="inline-flex items-center gap-[4px]">
              <span className="text-[20px] font-bold text-[#06201b] dark:text-white">
                Capital<span className="text-lime-500">OS</span>
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-[10px] py-[12px]">            {navSections
              .filter((section) => {
                // Hide admin-only sections entirely from non-admins
                if (!isAdmin && section.adminOnly) return false;
                return true;
              })
              .map((section, sectionIndex) => {
                // Filter items within section
                const visibleItems = section.items.filter((item) => {
                  if (!isAdmin && isAdminItem(item.href)) return false;
                  return true;
                });
                // Don't render section if all items are hidden
                if (visibleItems.length === 0) return null;
                return (
                  <div key={sectionIndex} className={section.title ? "mt-[16px]" : sectionIndex > 0 ? "mt-[4px]" : ""}>
                    {section.title && (
                      <p className="px-[16px] mb-[6px] text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {section.title}
                      </p>
                    )}
                    <ul className="space-y-[2px]">
                      {visibleItems.map((item) => (
                        <li key={item.href}>
                          <SidebarNavItem
                            item={item}
                            isActive={isActive(item.href)}
                            onClick={onClose}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </nav>

          {/* Admin Link (visible only to admins) */}
          {isAdmin && (
            <div className="px-[10px] mt-[8px]">
              <Link
                href="/admin"
                onClick={onClose}
                className="flex items-center gap-[12px] px-[16px] py-[8px] rounded-[8px] text-[14px] font-medium transition-all duration-150 text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400 border border-dashed border-gray-200 dark:border-gray-700"
              >
                <i className="ri-admin-line text-[18px] flex-shrink-0 text-gray-400 group-hover:text-red-500"></i>
                <span className="flex-1 truncate">Admin Panel</span>
                <span className="text-[10px] font-bold px-[4px] py-[1px] rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                  ADMIN
                </span>
              </Link>
            </div>
          )}

          {/* Bottom help card */}
          <div className="px-[10px] pb-[14px]">
            <div className="bg-[#06201b] rounded-[12px] p-[16px]">
              <div className="flex items-center gap-[8px] mb-[6px]">
                <i className="ri-sparkling-2-line text-lime-500 text-[18px]"></i>
                <h4 className="!text-[13px] !font-semibold !text-white !mb-0">
                  AI Copilot
                </h4>
              </div>
              <p className="text-[12px] text-gray-400 !mb-[12px] leading-relaxed">
                Ask your AI fundraising assistant anything.
              </p>
              <Link
                href="/dashboard/copilot"
                onClick={onClose}
                className="inline-flex items-center gap-[8px] text-[12px] font-medium text-lime-500 hover:text-lime-400 transition-colors"
              >
                Open Copilot
                <i className="ri-arrow-right-line text-[14px]"></i>
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export { Sidebar };
