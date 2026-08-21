"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/Dashboard/Sidebar";
import { DashboardHeader } from "@/components/Dashboard/DashboardHeader";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e19]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="lg:ml-[280px]">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-[20px] md:p-[30px]">{children}</main>
      </div>
    </div>
  );
}
