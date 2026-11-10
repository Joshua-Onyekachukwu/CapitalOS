"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Notifications are saved-search alerts, not invented events. Opening the
 * panel asks the server to evaluate every saved investor filter (throttled to
 * once per five minutes) and shows what it found. With no saved filters there
 * is nothing to alert on, and the empty state says that rather than pretending
 * something happened.
 */

interface SearchAlert {
  id: string;
  savedFilterId: string | null;
  filterName: string;
  filters: Record<string, unknown>;
  matchedCount: number;
  sampleInvestorIds: string[];
  createdAt: string;
  readAt: string | null;
}

/** Rebuild a database URL from the filter snapshot stored with an alert. */
function alertHref(filters: Record<string, unknown>): string {
  const keys = [
    "search",
    "type",
    "sector",
    "stage",
    "country",
    "city",
    "readiness",
    "evidence",
    "minQuality",
    "hasEmail",
    "hasLinkedin",
    "firm",
    "minCheque",
    "hasThesis",
  ];
  const params = new URLSearchParams();
  for (const key of keys) {
    const value = filters[key];
    if (typeof value === "string" && value) params.set(key, value);
    else if (typeof value === "number") params.set(key, String(value));
    else if (value === true) params.set(key, "true");
  }
  const qs = params.toString();
  return qs ? `/dashboard/investors?${qs}` : "/dashboard/investors";
}

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [checking, setChecking] = useState(false);
  const [checkedAtLeastOnce, setCheckedAtLeastOnce] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  // Unread badge before the panel is ever opened.
  const loadAlerts = useCallback(async () => {
    try {
      const res = await fetch("/api/saved-filters/alerts");
      if (!res.ok) return;
      const data = await res.json();
      setAlerts(data.alerts || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      /* badge simply stays as it was */
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  // Opening the panel runs one check (the server throttles it).
  useEffect(() => {
    if (!isOpen || checkedAtLeastOnce) return;
    setCheckedAtLeastOnce(true);
    setChecking(true);
    fetch("/api/saved-filters/alerts", { method: "POST" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setAlerts(data.alerts || []);
        setUnreadCount(data.unreadCount || 0);
      })
      .catch(() => {
        /* the GET above already showed whatever alerts exist */
      })
      .finally(() => setChecking(false));
  }, [isOpen, checkedAtLeastOnce]);

  const markAsRead = async (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, readAt: new Date().toISOString() } : a))
    );
    setUnreadCount((n) => Math.max(0, n - 1));
    try {
      const res = await fetch("/api/saved-filters/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      /* optimistic state is enough; the next load reconciles */
    }
  };

  const markAllRead = async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, readAt: a.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    try {
      const res = await fetch("/api/saved-filters/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      /* keep the optimistic state */
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-[36px] h-[36px] rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Saved-search alerts"
      >
        <i className="ri-notification-3-line text-[18px] text-gray-500"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-[2px] -right-[2px] w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-[8px] w-[360px] max-h-[480px] bg-white dark:bg-[#1a1f2e] border border-gray-200 dark:border-gray-700 rounded-[12px] shadow-xl overflow-hidden z-[60]">
          <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-[14px] font-semibold !mb-0">Alerts</h3>
            <div className="flex items-center gap-[8px]">
              {checking && (
                <span className="text-[11px] text-gray-400">
                  <i className="ri-loader-4-line animate-spin mr-[3px]"></i>
                  Checking
                </span>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] text-lime-600 hover:text-lime-700"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto max-h-[400px]">
            {alerts.length === 0 ? (
              <div className="text-center py-[32px] px-[20px]">
                <div className="w-[40px] h-[40px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[12px]">
                  <i className="ri-notification-3-line text-gray-300 text-[18px]"></i>
                </div>
                <p className="text-[13px] text-gray-500 !mb-[4px]">No new matches yet</p>
                <p className="text-[12px] text-gray-400 !mb-0">
                  Save a filter on the investor database and new records matching it will be
                  reported here.
                </p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => !alert.readAt && markAsRead(alert.id)}
                  className={`flex items-start gap-[10px] px-[16px] py-[12px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-50 dark:border-gray-800/50 ${
                    !alert.readAt ? "bg-lime-50/50 dark:bg-lime-900/5" : ""
                  }`}
                >
                  <div className="w-[32px] h-[32px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-none mt-[2px]">
                    <i className="ri-user-star-line text-amber-500 text-[14px]"></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[13px] !mb-[2px] ${!alert.readAt ? "font-semibold" : "font-medium"} text-[#06201b] dark:text-white`}
                    >
                      {alert.matchedCount} new investor{alert.matchedCount === 1 ? "" : "s"} match
                      &ldquo;{alert.filterName}&rdquo;
                    </p>
                    <p className="text-[12px] text-gray-400 !mb-[4px]">
                      Found since this filter was last checked.
                    </p>
                    <div className="flex items-center gap-[8px]">
                      <span className="text-[11px] text-gray-300">
                        {getTimeAgo(alert.createdAt)}
                      </span>
                      <Link
                        href={alertHref(alert.filters)}
                        onClick={() => setIsOpen(false)}
                        className="text-[11px] text-lime-600 hover:underline"
                      >
                        View matches →
                      </Link>
                    </div>
                  </div>
                  {!alert.readAt && (
                    <div className="w-[8px] h-[8px] rounded-full bg-lime-500 flex-none mt-[6px]"></div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
