"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } catch {
      setLoading(false);
    }
  };

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
          <Input label="Full Name" placeholder="Your name" defaultValue="" />
          <Input label="Email" type="email" placeholder="Your email" defaultValue="" disabled />
          <Button size="sm">Save Changes</Button>
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
                  <div className="w-[40px] h-[22px] bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:bg-lime-500"></div>
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
          <Button variant="danger" size="sm" loading={loading} onClick={handleSignOut}>
            Sign Out
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
