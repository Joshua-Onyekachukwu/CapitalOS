"use client";

import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Skeleton } from "@/components/ui/Skeleton";

interface UserProfile {
  full_name: string;
  email: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();

        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!authUser) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", authUser.id)
          .single();

        setUser({
          full_name: profile?.full_name ?? authUser.user_metadata?.full_name ?? "",
          email: authUser.email ?? "",
        });
        setFullName(profile?.full_name ?? authUser.user_metadata?.full_name ?? "");
      } catch {
        // Profile table may not exist yet
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) return;

      // Update profile
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: authUser.id, full_name: fullName });

      if (error) {
        setSaveError(error.message);
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
        <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[4px]">
          Settings
        </h1>
        <p className="text-[14px] text-gray-500 !mb-0">
          Manage your account and preferences.
        </p>
      </div>

      {/* Profile Settings */}
      <Card className="mb-[20px]">
        <CardHeader>
          <h3 className="!text-[16px] !font-semibold !mb-0">Profile</h3>
        </CardHeader>
        <CardBody className="space-y-[16px]">
          {saveSuccess && (
            <Alert variant="success" className="mb-0">
              Profile updated successfully.
            </Alert>
          )}
          {saveError && (
            <Alert variant="danger" className="mb-0">
              {saveError}
            </Alert>
          )}
          <Input
            label="Full Name"
            placeholder="Your name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              setSaveSuccess(false);
            }}
          />
          <Input
            label="Email"
            type="email"
            placeholder="Your email"
            value={user?.email || ""}
            disabled
          />
          <Button size="sm" loading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        </CardBody>
      </Card>

      {/* Notifications */}
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
                  <div className="w-[40px] h-[22px] bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:bg-primary-500"></div>
                </label>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Danger Zone */}
      <Card>
        <CardHeader>
          <h3 className="!text-[16px] !font-semibold !mb-0 text-danger-600">Account</h3>
        </CardHeader>
        <CardBody className="flex items-center justify-between flex-wrap gap-[15px]">
          <div>
            <p className="text-[14px] font-medium !mb-[2px]">Sign out</p>
            <p className="text-[13px] text-gray-400 !mb-0">Sign out of your account on this device.</p>
          </div>
          <Button
            variant="danger"
            size="sm"
            loading={signingOut}
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
