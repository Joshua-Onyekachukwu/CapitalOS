"use client";

import React from "react";
import { Button } from "@/components/ui/Button";

interface BulkSelectProps {
  selectedIds: Set<string>;
  totalItems: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onAction: (action: string) => void;
  actions?: Array<{ id: string; label: string; icon: string; variant?: string }>;
}

export function BulkSelect({
  selectedIds,
  totalItems,
  onSelectAll,
  onDeselectAll,
  onAction,
  actions = [
    { id: "save", label: "Save Selected", icon: "ri-bookmark-line" },
    { id: "outreach", label: "Start Outreach", icon: "ri-mail-send-line" },
    { id: "export", label: "Export CSV", icon: "ri-download-line" },
  ],
}: BulkSelectProps) {
  if (selectedIds.size === 0) return null;

  return (
    <div className="fixed bottom-[20px] left-1/2 -translate-x-1/2 z-[100] bg-[#06201b] dark:bg-[#1a1f2e] border border-gray-700 rounded-[12px] shadow-2xl px-[20px] py-[12px] flex items-center gap-[16px] animate-in slide-in-from-bottom-4">
      <div className="flex items-center gap-[8px]">
        <span className="text-[14px] font-semibold text-white">
          {selectedIds.size} selected
        </span>
        <button
          onClick={onDeselectAll}
          className="text-[12px] text-gray-400 hover:text-white transition-colors"
        >
          Clear
        </button>
      </div>
      <div className="w-[1px] h-[24px] bg-gray-700" />
      <div className="flex items-center gap-[8px]">
        {actions.map((action) => (
          <Button
            key={action.id}
            variant={action.variant === "primary" ? "primary" : "ghost"}
            size="sm"
            onClick={() => onAction(action.id)}
            className="!text-white !border-gray-600 hover:!bg-gray-700"
          >
            <i className={`${action.icon} text-[14px] mr-[6px]`}></i>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  className = "",
}: {
  checked: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <label className={`relative inline-flex items-center cursor-pointer ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="w-[18px] h-[18px] border-2 border-gray-300 dark:border-gray-600 rounded-[4px] peer-checked:bg-lime-500 peer-checked:border-lime-500 transition-all flex items-center justify-center">
        {checked && (
          <svg className="w-[12px] h-[12px] text-white" viewBox="0 0 12 12" fill="none">
            <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
    </label>
  );
}
