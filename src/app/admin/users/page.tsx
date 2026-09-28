"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  last_sign_in: string;
  provider: string;
  signup_source: string | null;
  confirmed: boolean;
}

const SIGNUP_SOURCE_LABELS: Record<string, string> = {
  app_autoconfirm: "Auto-confirmed",
  email_activation: "Email activation",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState<{ user: User; action: "promote" | "demote" } | null>(null);
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const [roleMessage, setRoleMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {}
    setLoading(false);
  };

  const filtered = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Users"
        description={`Manage platform users — ${users.length} total accounts.`}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-[16px] mb-[25px]">
        {[
          { label: "Total Users", value: users.length, icon: "ri-team-line", color: "bg-blue-50 text-blue-600" },
          { label: "Admins", value: users.filter((u) => u.role === "admin").length, icon: "ri-shield-user-line", color: "bg-red-50 text-red-600" },
          { label: "Google Auth", value: users.filter((u) => u.provider === "google").length, icon: "ri-google-line", color: "bg-green-50 text-green-600" },
          { label: "Email Auth", value: users.filter((u) => u.provider === "email").length, icon: "ri-mail-line", color: "bg-purple-50 text-purple-600" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardBody className="flex items-center gap-[16px]">
              <div className={`w-[44px] h-[44px] rounded-[8px] ${stat.color} flex items-center justify-center text-[20px] flex-none`}>
                <i className={stat.icon} />
              </div>
              <div>
                <p className="text-[12px] text-gray-400 !mb-[2px]">{stat.label}</p>
                <p className="text-[24px] font-bold text-[#06201b] dark:text-white !mb-0">{stat.value}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card className="mb-[16px]">
        <CardBody className="py-[14px] px-[16px]">
          <div className="relative">
            <i className="ri-search-line absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 text-[18px]" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-[9px] pl-[38px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
            />
          </div>
        </CardBody>
      </Card>

      {/* Users Table */}
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-[40px] text-center text-gray-400">
              <div className="animate-spin h-[24px] w-[24px] border-2 border-lime-500 border-t-transparent rounded-full mx-auto mb-[12px]" />
              Loading users...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-[40px] text-center text-gray-400">
              <i className="ri-user-line text-[32px] mb-[12px] block" />
              <p className="font-medium text-[#06201b] dark:text-white !mb-[4px]">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">User</th>
                    <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Role</th>
                    <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Signup</th>
                    <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Auth Provider</th>
                    <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Joined</th>
                    <th className="text-left py-[12px] px-[16px] font-semibold text-gray-500">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.id} className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="py-[12px] px-[16px]">
                        <p className="font-medium text-[#06201b] dark:text-white !mb-0">{user.full_name || "Unnamed"}</p>
                        <p className="text-[11px] text-gray-400 !mb-0">{user.email}</p>
                      </td>
                      <td className="py-[12px] px-[16px]">
                        <Badge variant={user.role === "admin" ? "danger" : "default"}>
                          {user.role || "user"}
                        </Badge>
                        {user.role === "admin" ? (
                          <button
                            className="block text-[11px] text-gray-400 hover:text-red-500 mt-[4px]"
                            onClick={() => setConfirming({ user, action: "demote" })}
                            disabled={roleLoading === user.id}
                          >
                            Demote
                          </button>
                        ) : (
                          <button
                            className="block text-[11px] text-gray-400 hover:text-lime-600 mt-[4px]"
                            onClick={() => setConfirming({ user, action: "promote" })
                            }
                            disabled={roleLoading === user.id}
                          >
                            Promote
                          </button>
                        )}
                      </td>
                      <td className="py-[12px] px-[16px]">
                        <Badge variant={user.signup_source === "email_activation" ? "success" : "default"}>
                          {SIGNUP_SOURCE_LABELS[user.signup_source || ""] ||
                            (user.confirmed ? "Confirmed" : "Legacy/Unconfirmed")}
                        </Badge>
                      </td>
                      <td className="py-[12px] px-[16px] text-gray-500 capitalize">
                        {user.provider || "email"}
                      </td>
                      <td className="py-[12px] px-[16px] text-gray-400 text-[12px]">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="py-[12px] px-[16px] text-gray-400 text-[12px]">
                        {user.last_sign_in ? new Date(user.last_sign_in).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Role change confirmation */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-gray-900 rounded-[12px] p-[24px] max-w-[440px] w-full mx-[16px] shadow-xl">
            <h4 className="text-[16px] font-semibold !mb-[8px]">
              {confirming.action === "promote" ? "Promote to admin?" : "Demote admin?"}
            </h4>
            <p className="text-[13px] text-gray-500 !mb-[16px]">
              {confirming.action === "promote"
                ? `${confirming.user.email} will gain full admin access: user management, data imports, merges, and all /admin surfaces.`
                : `${confirming.user.email} will lose admin access immediately. This cannot be undone from this page (another admin must re-promote).`}
            </p>
            {roleMessage && (
              <Alert variant={roleMessage.type} className="mb-[12px]">{roleMessage.text}</Alert>
            )}
            <div className="flex justify-end gap-[8px]">
              <Button variant="ghost" size="sm" onClick={() => { setConfirming(null); setRoleMessage(null); }}>
                Cancel
              </Button>
              <Button
                variant={confirming.action === "promote" ? "primary" : "danger"}
                size="sm"
                loading={roleLoading === confirming.user.id}
                onClick={async () => {
                  setRoleLoading(confirming.user.id);
                  try {
                    const res = await fetch("/api/admin/users/role", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        userId: confirming.user.id,
                        action: confirming.action,
                        confirmToken: confirming.user.id,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                      setUsers((prev) =>
                        prev.map((u) =>
                          u.id === confirming.user.id
                            ? { ...u, role: confirming.action === "promote" ? "admin" : "user" }
                            : u
                        )
                      );
                      setConfirming(null);
                      setRoleMessage(null);
                    } else {
                      setRoleMessage({ type: "danger", text: data.error || "Role change failed" });
                    }
                  } catch {
                    setRoleMessage({ type: "danger", text: "Network error" });
                  } finally {
                    setRoleLoading(null);
                  }
                }}
              >
                {confirming.action === "promote" ? "Yes, promote" : "Yes, demote"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
