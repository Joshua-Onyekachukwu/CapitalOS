"use client";

import React from "react";
import { Avatar } from "@/components/ui/Avatar";

interface DashboardHeaderProps {
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
  onMenuClick: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  user,
  onMenuClick,
}) => {
  return (
    <header className="sticky top-0 z-[50] bg-white/80 dark:bg-[#0a0e19]/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between px-[20px] md:px-[30px] py-[14px] md:py-[16px]">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden flex items-center justify-center w-[36px] h-[36px] rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Toggle menu"
        >
          <i className="ri-menu-line text-[22px] text-[#06201b] dark:text-white"></i>
        </button>

        {/* Search placeholder */}
        <div className="hidden md:flex items-center flex-1 max-w-[400px] mx-[20px]">
          <div className="relative w-full">
            <i className="ri-search-line absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 text-[18px]"></i>
            <input
              type="text"
              placeholder="Search investors, campaigns..."
              className="w-full py-[9px] pl-[38px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-[12px]">
          {/* Notifications */}
          <button className="relative flex items-center justify-center w-[36px] h-[36px] rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <i className="ri-notification-3-line text-[20px] text-gray-500"></i>
            <span className="absolute top-[6px] right-[6px] w-[8px] h-[8px] bg-danger-500 rounded-full border-2 border-white dark:border-[#0a0e19]"></span>
          </button>

          {/* User menu */}
          <div className="flex items-center gap-[10px] pl-[12px] border-l border-gray-200 dark:border-gray-700">
            <Avatar
              name={user?.name}
              src={user?.avatar}
              size="sm"
              showOnline
            />
            <div className="hidden md:block">
              <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0 leading-tight">
                {user?.name || "User"}
              </p>
              <p className="text-[12px] text-gray-400 !mb-0 leading-tight">
                {user?.email || ""}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export { DashboardHeader };
