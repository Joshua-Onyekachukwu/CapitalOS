"use client";

import React, { useState, useEffect } from "react";

interface ChangeLogEntry {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  source_type: string | null;
  source_provider: string | null;
  confidence: number | null;
  change_type: string;
  detected_by: string | null;
  created_at: string;
}

const changeTypeColors: Record<string, string> = {
  create: "bg-green-500",
  update: "bg-blue-500",
  merge: "bg-purple-500",
  delete: "bg-red-500",
  revert: "bg-amber-500",
};

const changeTypeLabels: Record<string, string> = {
  create: "Created",
  update: "Updated",
  merge: "Merged",
  delete: "Deleted",
  revert: "Reverted",
};

export function DataHistory({ investorId }: { investorId: string }) {
  const [entries, setEntries] = useState<ChangeLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase
          .from("data_change_log")
          .select("*")
          .eq("investor_id", investorId)
          .order("created_at", { ascending: false })
          .limit(20);

        setEntries(data || []);
      } catch {
        console.error("Failed to fetch history");
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [investorId]);

  if (loading) {
    return (
      <div className="space-y-[12px]">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex gap-[10px]">
            <div className="w-[8px] h-[8px] rounded-full bg-gray-200 mt-[6px]"></div>
            <div className="flex-1">
              <div className="h-[12px] bg-gray-100 dark:bg-gray-800 rounded w-[120px] mb-[4px]"></div>
              <div className="h-[10px] bg-gray-100 dark:bg-gray-800 rounded w-[200px]"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-[20px]">
        <p className="text-[13px] text-gray-400 !mb-0">No change history recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-[14px]">
      {entries.map((entry) => (
        <div key={entry.id} className="flex gap-[10px]">
          <div className={`w-[8px] h-[8px] rounded-full mt-[6px] flex-none ${changeTypeColors[entry.change_type] || "bg-gray-400"}`}></div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-[6px] mb-[2px]">
              <span className="text-[12px] font-medium text-[#06201b] dark:text-white capitalize">
                {entry.field_name.replace(/_/g, " ")}
              </span>
              <span className={`text-[10px] px-[4px] py-[1px] rounded-full font-medium ${
                entry.change_type === "create" ? "bg-green-100 text-green-700" :
                entry.change_type === "update" ? "bg-blue-100 text-blue-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {changeTypeLabels[entry.change_type] || entry.change_type}
              </span>
            </div>
            {entry.old_value && entry.new_value && (
              <p className="text-[12px] text-gray-400 !mb-0">
                <span className="line-through">{entry.old_value}</span>
                {" → "}
                <span className="text-gray-600 dark:text-gray-300 font-medium">{entry.new_value}</span>
              </p>
            )}
            {!entry.old_value && entry.new_value && (
              <p className="text-[12px] text-gray-400 !mb-0">
                Set to <span className="text-gray-600 dark:text-gray-300 font-medium">{entry.new_value}</span>
              </p>
            )}
            <div className="flex items-center gap-[8px] mt-[4px]">
              <span className="text-[11px] text-gray-300 dark:text-gray-600">
                {new Date(entry.created_at).toLocaleDateString()} {new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {entry.source_provider && (
                <span className="text-[11px] text-gray-300 dark:text-gray-600">
                  via {entry.source_provider}
                </span>
              )}
              {entry.confidence !== null && entry.confidence < 1 && (
                <span className="text-[11px] text-amber-500">
                  {Math.round(entry.confidence * 100)}% confident
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
