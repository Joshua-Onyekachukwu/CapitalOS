"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

interface UserProfile {
  full_name: string;
  email: string;
}

interface EmailAccount {
  id: string;
  provider: string;
  email_address: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fullName, setFullName] = useState("");

  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [emailLoading, setEmailLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [emailMessage, setEmailMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/dashboard/settings/profile");
        if (res.ok) {
          const data = await res.json();
          setUser(data);
          setFullName(data.full_name || "");
        }
      } catch {
        // Profile may not exist yet
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  useEffect(() => {
    async function loadEmails() {
      try {
        const { getConnectedEmails } = await import("@/lib/actions/email");
        const { getClientUser } = await import("@/lib/client-auth");
        const authUser = await getClientUser();
        if (!authUser) return;

        const result = await getConnectedEmails(authUser.id);
        if (result.data) {
          setEmailAccounts(result.data);
        }
      } catch {
        // ignore
      } finally {
        setEmailLoading(false);
      }
    }
    loadEmails();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("email_connected");
    const error = params.get("email_error");

    if (connected) {
      setEmailMessage({ type: "success", text: `${connected.charAt(0).toUpperCase() + connected.slice(1)} account connected successfully!` });
      window.history.replaceState({}, "", "/dashboard/settings");
      setTimeout(() => window.location.reload(), 1500);
    }
    if (error) {
      setEmailMessage({ type: "error", text: error });
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/dashboard/settings/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSaveError(data.error || "Failed to save changes.");
      } else {
        setSaveSuccess(true);
        setUser((prev) => (prev ? { ...prev, full_name: fullName } : prev));
      }
    } catch {
      setSaveError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (provider: string) => {
    setDisconnecting(provider);
    try {
      const { disconnectEmail } = await import("@/lib/actions/email");
      const { getClientUser } = await import("@/lib/client-auth");
      const authUser = await getClientUser();
      if (!authUser) return;

      const result = await disconnectEmail(authUser.id, provider);
      if (result.success) {
        setEmailAccounts((prev) => prev.filter((a) => a.provider !== provider));
        setEmailMessage({ type: "success", text: `${provider} account disconnected.` });
      } else {
        setEmailMessage({ type: "error", text: result.error || "Failed to disconnect." });
      }
    } catch {
      setEmailMessage({ type: "error", text: "Failed to disconnect email account." });
    } finally {
      setDisconnecting(null);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const { signOut } = await import("@/lib/actions/auth");
      await signOut();
    } catch {
      setSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="mb-[25px] md:mb-[30px]">
          <Skeleton className="h-[28px] w-[150px] mb-[8px]" />
          <Skeleton className="h-[16px] w-[250px]" />
        </div>
        <Card className="mb-[20px]">
          <CardBody className="space-y-[16px]">
            <Skeleton className="h-[44px] w-full" />
            <Skeleton className="h-[44px] w-full" />
            <Skeleton className="h-[36px] w-[100px]" />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-[25px] md:mb-[30px]">
        <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[4px]">Settings</h1>
        <p className="text-[14px] text-gray-500 !mb-0">Manage your account, email, and preferences.</p>
      </div>

      <Card className="mb-[20px]">
        <CardHeader>
          <h3 className="!text-[16px] !font-semibold !mb-0">Profile</h3>
        </CardHeader>
        <CardBody className="space-y-[16px]">
          {saveSuccess && <Alert variant="success" className="mb-0">Profile updated successfully.</Alert>}
          {saveError && <Alert variant="danger" className="mb-0">{saveError}</Alert>}
          <Input label="Full Name" placeholder="Your name" value={fullName} onChange={(e) => { setFullName(e.target.value); setSaveSuccess(false); }} />
          <Input label="Email" type="email" placeholder="Your email" value={user?.email || ""} disabled />
          <Button size="sm" loading={saving} onClick={handleSave}>Save Changes</Button>
        </CardBody>
      </Card>

      <Card className="mb-[20px]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="!text-[16px] !font-semibold !mb-0">Email Accounts</h3>
              <p className="text-[13px] text-gray-400 !mb-0 mt-[4px]">Connect your email to send investor outreach directly from Capital OS.</p>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {emailMessage && (
            <Alert variant={emailMessage.type === "success" ? "success" : "danger"} className="mb-[16px]" onDismiss={() => setEmailMessage(null)} dismissible>
              {emailMessage.text}
            </Alert>
          )}

          {emailLoading ? (
            <div className="space-y-[12px]">
              <Skeleton className="h-[60px] w-full" />
              <Skeleton className="h-[60px] w-full" />
            </div>
          ) : emailAccounts.length === 0 ? (
            <div>
              <p className="text-[14px] text-gray-500 !mb-[16px]">No email accounts connected. Connect one to enable AI-powered investor outreach.</p>
              <div className="flex items-center gap-[12px] flex-wrap">
                <a href="/api/auth/google" className="no-underline">
                  <Button variant="outline" size="sm">
                    <svg className="w-[18px] h-[18px] mr-[8px]" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Connect Google (Gmail)
                  </Button>
                </a>
                <a href="/api/auth/microsoft" className="no-underline">
                  <Button variant="outline" size="sm">
                    <svg className="w-[18px] h-[18px] mr-[8px]" viewBox="0 0 23 23">
                      <rect fill="#F25022" x="1" y="1" width="10" height="10"/>
                      <rect fill="#7FBA00" x="12" y="1" width="10" height="10"/>
                      <rect fill="#00A4EF" x="1" y="12" width="10" height="10"/>
                      <rect fill="#FFB900" x="12" y="12" width="10" height="10"/>
                    </svg>
                    Connect Microsoft (Outlook)
                  </Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-[12px]">
              {emailAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-[14px] rounded-[10px] border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <div className="flex items-center gap-[12px]">
                    {account.provider === "google" ? (
                      <div className="w-[36px] h-[36px] rounded-[8px] bg-red-50 flex items-center justify-center">
                        <svg className="w-[20px] h-[20px]" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
                    ) : (
                      <div className="w-[36px] h-[36px] rounded-[8px] bg-blue-50 flex items-center justify-center">
                        <svg className="w-[20px] h-[20px]" viewBox="0 0 23 23">
                          <rect fill="#F25022" x="1" y="1" width="10" height="10"/>
                          <rect fill="#7FBA00" x="12" y="1" width="10" height="10"/>
                          <rect fill="#00A4EF" x="1" y="12" width="10" height="10"/>
                          <rect fill="#FFB900" x="12" y="12" width="10" height="10"/>
                        </svg>
                      </div>
                    )}
                    <div>
                      <p className="text-[14px] font-medium text-[#06201b] dark:text-white !mb-[2px]">{account.display_name || account.email_address}</p>
                      <p className="text-[12px] text-gray-400 !mb-0">{account.email_address} • {account.provider === "google" ? "Gmail" : "Outlook"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-[8px]">
                    <Badge variant={account.is_active ? "success" : "default"} size="sm">{account.is_active ? "Active" : "Disconnected"}</Badge>
                    {account.is_active && (
                      <Button variant="danger" size="sm" loading={disconnecting === account.provider} onClick={() => handleDisconnect(account.provider)}>
                        Disconnect
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mb-[20px]">
        <CardHeader>
          <h3 className="!text-[16px] !font-semibold !mb-0">Notifications</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-[14px]">
            {[
              { label: "Email replies", description: "Get notified when investors reply" },
              { label: "Meeting requests", description: "Get notified when meetings are requested" },
              { label: "AI task completion", description: "Get notified when AI finishes tasks" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div>
                  <p className="text-[14px] font-medium !mb-[2px]">{item.label}</p>
                  <p className="text-[13px] text-gray-400 !mb-0">{item.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-[40px] h-[22px] bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:bg-lime-500"></div>
                </label>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="!text-[16px] !font-semibold !mb-0 text-danger-600">Account</h3>
        </CardHeader>
        <CardBody className="flex items-center justify-between flex-wrap gap-[15px]">
          <div>
            <p className="text-[14px] font-medium !mb-[2px]">Sign out</p>
            <p className="text-[13px] text-gray-400 !mb-0">Sign out of your account on this device.</p>
          </div>
          <Button variant="danger" size="sm" loading={signingOut} onClick={handleSignOut}>Sign Out</Button>
        </CardBody>
      </Card>
    </div>
  );
}
