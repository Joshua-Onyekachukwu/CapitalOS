"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/Dashboard/Sidebar";
import { DashboardHeader } from "@/components/Dashboard/DashboardHeader";

interface DashboardShellProps {
  user: {
    name: string;
    email: string;
    avatar?: string;
  };
  children: React.ReactNode;
}

export function DashboardShell({ user, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e19]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="lg:ml-[280px]">
        <DashboardHeader
          user={user}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="p-[20px] md:p-[30px]">{children}</main>
      </div>
    </div>
  );
}
