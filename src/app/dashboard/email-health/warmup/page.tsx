"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface WarmupData {
  accountId: string;
  email: string;
  provider: string;
  warmup: {
    id: string;
    status: string;
    currentStage: number;
    dailyTarget: number;
    dailySent: number;
    dayNumber: number;
    stageLabel: string;
    healthAtStart: number;
    healthCurrent: number;
  } | null;
}

export default function WarmupPage() {
  const [warmups, setWarmups] = useState<WarmupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchWarmups = async () => {
    try {
      const resp = await fetch("/api/email/warmup");
      if (resp.ok) {
        const data = await resp.json();
        setWarmups(data.warmups || []);
      }
    } catch (err) {
      console.error("Failed to fetch warmups:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarmups();
  }, []);

  const handleAction = async (accountId: string, action: string) => {
    setActionLoading(accountId);
    try {
      await fetch("/api/email/warmup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, accountId }),
      });
      await fetchWarmups();
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-48"></div>
          <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="mb-6">
        <Link href="/dashboard/email-health" className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1">
          <i className="ri-arrow-left-line"></i> Back to Email Health
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Email Warm-Up</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gradually build your sending reputation with a controlled warm-up sequence
        </p>
      </div>

      {/* How it works */}
      <div className="bg-gradient-to-r from-lime-50 to-green-50 dark:from-lime-900/10 dark:to-green-900/10 rounded-xl border border-lime-200 dark:border-lime-800 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
          <i className="ri-fire-line text-lime-500 mr-2"></i>
          How Warm-Up Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 rounded-full bg-lime-500 text-black text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
            <p>Start with 5 emails/day. The system monitors delivery signals and adjusts volume automatically.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 rounded-full bg-lime-500 text-black text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
            <p>If health stays good, volume increases through 10 stages up to 120 emails/day over ~30 days.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="w-6 h-6 rounded-full bg-lime-500 text-black text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
            <p>If health drops, warm-up pauses automatically to protect your sending reputation.</p>
          </div>
        </div>
      </div>

      {/* Account Warm-Up Cards */}
      <div className="space-y-4">
        {warmups.map((item) => (
          <div key={item.accountId} className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{item.email}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{item.provider}</p>
              </div>
              <div className="flex gap-2">
                {!item.warmup || item.warmup.status === "not_started" ? (
                  <button
                    onClick={() => handleAction(item.accountId, "start")}
                    disabled={actionLoading === item.accountId}
                    className="px-4 py-2 text-sm font-medium bg-lime-500 text-black rounded-lg hover:bg-lime-600 disabled:opacity-50"
                  >
                    Start Warm-Up
                  </button>
                ) : item.warmup.status === "active" ? (
                  <>
                    <span className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg">
                      <i className="ri-fire-line mr-1"></i>Active — Day {item.warmup.dayNumber}
                    </span>
                    <button
                      onClick={() => handleAction(item.accountId, "pause")}
                      disabled={actionLoading === item.accountId}
                      className="px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Pause
                    </button>
                  </>
                ) : item.warmup.status === "paused" ? (
                  <>
                    <span className="px-3 py-1.5 text-sm bg-amber-100 text-amber-700 rounded-lg">
                      Paused — Day {item.warmup.dayNumber}
                    </span>
                    <button
                      onClick={() => handleAction(item.accountId, "resume")}
                      disabled={actionLoading === item.accountId}
                      className="px-3 py-1.5 text-sm font-medium bg-lime-500 text-black rounded-lg hover:bg-lime-600 disabled:opacity-50"
                    >
                      Resume
                    </button>
                  </>
                ) : item.warmup.status === "completed" ? (
                  <span className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg">
                    <i className="ri-check-line mr-1"></i>Completed
                  </span>
                ) : (
                  <button
                    onClick={() => handleAction(item.accountId, "start")}
                    disabled={actionLoading === item.accountId}
                    className="px-4 py-2 text-sm font-medium bg-lime-500 text-black rounded-lg hover:bg-lime-600"
                  >
                    Restart Warm-Up
                  </button>
                )}
              </div>
            </div>

            {item.warmup && item.warmup.status !== "not_started" && (
              <div>
                {/* Progress */}
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{item.warmup.currentStage}</p>
                    <p className="text-xs text-gray-500">Stage / 10</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{item.warmup.dayNumber}</p>
                    <p className="text-xs text-gray-500">Day</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-lime-600">{item.warmup.dailyTarget}</p>
                    <p className="text-xs text-gray-500">Target / Day</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{item.warmup.dailySent}</p>
                    <p className="text-xs text-gray-500">Sent Today</p>
                  </div>
                </div>

                {/* Stage Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Stage {item.warmup.currentStage}: {item.warmup.stageLabel}</span>
                    <span>{item.warmup.dailyTarget} emails/day</span>
                  </div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-lime-500 rounded-full transition-all"
                      style={{ width: `${(item.warmup.currentStage / 10) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Health comparison */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">Health at start: {item.warmup.healthAtStart}/100</span>
                  <i className="ri-arrow-right-line text-gray-300"></i>
                  <span className={`font-medium ${
                    item.warmup.healthCurrent > item.warmup.healthAtStart ? "text-green-600" :
                    item.warmup.healthCurrent < item.warmup.healthAtStart ? "text-red-500" :
                    "text-gray-600"
                  }`}>
                    Current: {item.warmup.healthCurrent}/100
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}

        {warmups.length === 0 && (
          <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-8 text-center">
            <i className="ri-fire-line text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
            <p className="text-gray-500 dark:text-gray-400">
              No email accounts connected.{" "}
              <Link href="/dashboard/settings" className="text-lime-500 hover:underline">
                Connect an account in Settings
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
