"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  type: "email_reply" | "meeting_request" | "ai_task" | "system" | "investor_match";
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

export function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
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

  // Load notifications from localStorage (in-memory for now)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("notifications_list");
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed);
        setUnreadCount(parsed.filter((n: Notification) => !n.read).length);
      }
    } catch { /* ignore */ }
  }, [isOpen]);

  const markAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => n.id === id ? { ...n, read: true } : n);
      localStorage.setItem("notifications_list", JSON.stringify(updated));
      setUnreadCount(updated.filter((n) => !n.read).length);
      return updated;
    });
  };

  const markAllRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      localStorage.setItem("notifications_list", JSON.stringify(updated));
      setUnreadCount(0);
      return updated;
    });
  };

  const clearAll = () => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem("notifications_list");
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "email_reply": return "ri-reply-line text-green-500";
      case "meeting_request": return "ri-calendar-line text-blue-500";
      case "ai_task": return "ri-magic-line text-purple-500";
      case "investor_match": return "ri-user-star-line text-amber-500";
      default: return "ri-information-line text-gray-500";
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
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
          {/* Header */}
          <div className="flex items-center justify-between px-[16px] py-[12px] border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-[14px] font-semibold !mb-0">Notifications</h3>
            <div className="flex items-center gap-[8px]">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-[11px] text-lime-600 hover:text-lime-700">
                  Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button onClick={clearAll} className="text-[11px] text-gray-400 hover:text-gray-600">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[400px]">
            {notifications.length === 0 ? (
              <div className="text-center py-[40px]">
                <div className="w-[40px] h-[40px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[12px]">
                  <i className="ri-notification-3-line text-gray-300 text-[18px]"></i>
                </div>
                <p className="text-[13px] text-gray-400 !mb-0">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`flex items-start gap-[10px] px-[16px] py-[12px] cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors border-b border-gray-50 dark:border-gray-800/50 ${
                    !notif.read ? "bg-lime-50/50 dark:bg-lime-900/5" : ""
                  }`}
                >
                  <div className="w-[32px] h-[32px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-none mt-[2px]">
                    <i className={`${getIcon(notif.type)} text-[14px]`}></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] !mb-[2px] ${!notif.read ? "font-semibold" : "font-medium"} text-[#06201b] dark:text-white`}>
                      {notif.title}
                    </p>
                    <p className="text-[12px] text-gray-400 !mb-[4px] line-clamp-2">{notif.message}</p>
                    <div className="flex items-center gap-[8px]">
                      <span className="text-[11px] text-gray-300">{getTimeAgo(notif.createdAt)}</span>
                      {notif.link && (
                        <Link href={notif.link} onClick={() => setIsOpen(false)} className="text-[11px] text-lime-600 hover:underline">
                          View →
                        </Link>
                      )}
                    </div>
                  </div>
                  {!notif.read && (
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

// Helper to add notifications from other parts of the app
export function addNotification(notification: Omit<Notification, "id" | "read" | "createdAt">) {
  try {
    const stored = localStorage.getItem("notifications_list");
    const existing: Notification[] = stored ? JSON.parse(stored) : [];
    const newNotif: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    existing.unshift(newNotif);
    // Keep last 50
    localStorage.setItem("notifications_list", JSON.stringify(existing.slice(0, 50)));
  } catch { /* ignore */ }
}
