"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";

interface DashboardHeaderProps {
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
  onMenuClick: () => void;
}

export function DashboardHeader({ user, onMenuClick }: DashboardHeaderProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [menuOpen]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { signOut } = await import("@/lib/actions/auth");
      await signOut();
    } catch {
      setSigningOut(false);
    }
  };

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

          {/* User menu dropdown */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-[10px] pl-[12px] border-l border-gray-200 dark:border-gray-700 hover:opacity-80 transition-opacity"
            >
              <Avatar
                name={user?.name}
                src={user?.avatar}
                size="sm"
                showOnline
              />
              <div className="hidden md:block text-left">
                <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0 leading-tight">
                  {user?.name || "User"}
                </p>
                <p className="text-[12px] text-gray-400 !mb-0 leading-tight">
                  {user?.email || ""}
                </p>
              </div>
              <i
                className={`ri-arrow-down-s-line text-[16px] text-gray-400 transition-transform hidden md:block ${
                  menuOpen ? "rotate-180" : ""
                }`}
              ></i>
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-[8px] w-[200px] bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700 rounded-[10px] shadow-lg py-[6px] z-[60]">
                <div className="px-[14px] py-[8px] border-b border-gray-100 dark:border-gray-700 mb-[4px]">
                  <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0">
                    {user?.name || "User"}
                  </p>
                  <p className="text-[12px] text-gray-400 !mb-0 truncate">
                    {user?.email || ""}
                  </p>
                </div>

                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-[10px] px-[14px] py-[8px] text-[14px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <i className="ri-settings-3-line text-[16px]"></i>
                  Settings
                </Link>

                <Link
                  href="/"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-[10px] px-[14px] py-[8px] text-[14px] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <i className="ri-home-4-line text-[16px]"></i>
                  Home
                </Link>

                <div className="border-t border-gray-100 dark:border-gray-700 mt-[4px] pt-[4px]">
                  <button
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex items-center gap-[10px] px-[14px] py-[8px] text-[14px] text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/10 transition-colors w-full text-left disabled:opacity-50"
                  >
                    <i className="ri-logout-box-r-line text-[16px]"></i>
                    {signingOut ? "Signing out..." : "Sign Out"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
