"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onChange: (tabId: string) => void;
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className }) => {
  const [active, setActive] = useState(activeTab || tabs[0]?.id);

  const handleChange = (tabId: string) => {
    setActive(tabId);
    onChange(tabId);
  };

  return (
    <div className={cn("border-b border-gray-200 dark:border-gray-800", className)}>
      <div className="flex gap-[4px] md:gap-[10px] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            className={cn(
              "flex items-center gap-[8px] px-[16px] md:px-[16px] py-[12px] md:py-[16px] text-[14px] md:text-[14px] font-medium whitespace-nowrap transition-all relative",
              active === tab.id
                ? "text-[#06201b] dark:text-white"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  "text-[11px] md:text-[12px] px-[6px] py-[1px] rounded-full font-medium",
                  active === tab.id
                    ? "bg-lime-500 text-black"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                )}
              >
                {tab.count}
              </span>
            )}
            {active === tab.id && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#06201b] dark:bg-white rounded-full" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export { Tabs };
export type { TabsProps, Tab };
