"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  referral_code: string;
  referred_by: string | null;
  position: number;
  created_at: string;
}

export default function AdminWaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  useEffect(() => {
    fetchEntries();
  }, [page, search]);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/waitlist?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
        setTotal(data.total || 0);
      }
    } catch {
      // silent
    }
    setLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/admin"
          className="text-sm text-gray-500 hover:text-gray-700 mb-1 inline-flex items-center gap-1"
        >
          <i className="ri-arrow-left-line"></i> Back to Admin
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Waitlist
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {total.toLocaleString()} people signed up for early access
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <p className="text-sm text-gray-500 mb-1">Total Signups</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {total.toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <p className="text-sm text-gray-500 mb-1">With Name</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {entries.filter((e) => e.name).length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <p className="text-sm text-gray-500 mb-1">Referred</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {entries.filter((e) => e.referred_by).length}
          </p>
        </div>
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-5">
          <p className="text-sm text-gray-500 mb-1">Today</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {
              entries.filter(
                (e) =>
                  new Date(e.created_at).toDateString() ===
                  new Date().toDateString()
              ).length
            }
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 p-4 mb-4">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#111827] rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin h-6 w-6 border-2 border-lime-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-sm text-gray-400">Loading waitlist...</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center">
            <i className="ri-user-star-line text-4xl text-gray-300 mb-3 block"></i>
            <p className="text-sm text-gray-400">
              {search ? "No results found" : "No waitlist signups yet"}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                      #
                    </th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                      Email
                    </th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                      Referral Code
                    </th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                      Referred By
                    </th>
                    <th className="text-left py-3 px-4 text-gray-500 font-medium">
                      Signed Up
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-gray-50 dark:border-gray-800/50 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                    >
                      <td className="py-3 px-4 text-gray-400 font-mono text-xs">
                        {entry.position || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {entry.email}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {entry.name || (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
                          {entry.referral_code}
                        </code>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">
                        {entry.referred_by || (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">
                        {new Date(entry.created_at).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between py-3 px-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-xs text-gray-400">
                Showing {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1.5 text-xs text-gray-400">
                  {page + 1} / {totalPages || 1}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
