"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function ApolloPage() {
  const [healthChecking, setHealthChecking] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleHealthCheck = async () => {
    setHealthChecking(true);
    // TODO: Call server action
    setTimeout(() => setHealthChecking(false), 2000);
  };

  const handleSync = async () => {
    setSyncing(true);
    // TODO: Call server action
    setTimeout(() => setSyncing(false), 2000);
  };

  return (
    <div>
      <PageHeader
        title="Apollo Connection"
        description="Manage Apollo as a backend data provider."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[20px] mb-[25px]">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <h3 className="!text-[16px] !font-semibold !mb-0">Connection</h3>
          </CardHeader>
          <CardBody className="space-y-[16px]">
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-500">Status</span>
              <Badge variant="success">
                <span className="flex items-center gap-[6px]">
                  <span className="w-[6px] h-[6px] rounded-full bg-green-500" />
                  Connected
                </span>
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-500">Last successful connection</span>
              <span className="text-[14px] font-medium text-[#06201b] dark:text-white">
                21 Aug 2026, 13:20
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-500">API Status</span>
              <span className="text-[14px] font-medium text-green-600">Healthy</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[14px] text-gray-500">Authentication</span>
              <span className="text-[14px] font-medium text-green-600">Configured</span>
            </div>

            <div className="flex gap-[10px] pt-[8px]">
              <Button variant="outline" size="sm" loading={healthChecking} onClick={handleHealthCheck}>
                <i className="ri-heart-pulse-line text-[16px]" />
                Run Health Check
              </Button>
              <Button size="sm" loading={syncing} onClick={handleSync}>
                <i className="ri-refresh-line text-[16px]" />
                Sync Data
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* API Key */}
        <Card>
          <CardHeader>
            <h3 className="!text-[16px] !font-semibold !mb-0">Authentication</h3>
          </CardHeader>
          <CardBody className="space-y-[16px]">
            <div>
              <label className="text-[13px] text-gray-500 block mb-[6px]">API Key</label>
              <div className="flex items-center gap-[10px]">
                <div className="flex-1 py-[9px] px-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] text-[14px] text-gray-400 font-mono">
                  ••••••••••••••••••••
                </div>
                <Button variant="outline" size="sm">
                  Replace Key
                </Button>
              </div>
              <p className="text-[12px] text-gray-400 mt-[6px] !mb-0">
                API keys are stored securely server-side and never exposed to the browser.
              </p>
            </div>

            <div>
              <label className="text-[13px] text-gray-500 block mb-[6px]">Base URL</label>
              <div className="py-[9px] px-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] text-[14px] text-gray-600 dark:text-gray-400 font-mono">
                https://api.apollo.io/v1
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Usage */}
      <Card className="mb-[25px]">
        <CardHeader>
          <h3 className="!text-[16px] !font-semibold !mb-0">Usage</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[20px] mb-[24px]">
            <div>
              <p className="text-[12px] text-gray-400 !mb-[4px]">Annual Allocation</p>
              <p className="text-[24px] font-bold text-[#06201b] dark:text-white !mb-0">48,000</p>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[4px]">Used</p>
              <p className="text-[24px] font-bold text-[#06201b] dark:text-white !mb-0">8,430</p>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[4px]">Remaining</p>
              <p className="text-[24px] font-bold text-lime-600 !mb-0">39,570</p>
            </div>
          </div>

          <div className="w-full h-[6px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-[24px]">
            <div className="h-full bg-lime-500 rounded-full" style={{ width: "17.5%" }} />
          </div>

          <h4 className="!text-[14px] !font-semibold !mb-[12px]">Today&apos;s Usage</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-[16px]">
            {[
              { label: "Investor searches", value: "320" },
              { label: "Contact enrichments", value: "182" },
              { label: "Company enrichments", value: "76" },
              { label: "Email data", value: "42" },
              { label: "Total credits", value: "620" },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-[2px]">
                  {item.value}
                </p>
                <p className="text-[11px] text-gray-400 !mb-0">{item.label}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Acquisition Form */}
      <Card>
        <CardHeader>
          <h3 className="!text-[16px] !font-semibold !mb-0">New Data Acquisition</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px] mb-[20px]">
            <div>
              <label className="text-[13px] text-gray-500 block mb-[6px]">Target</label>
              <select className="w-full py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]">
                <option>Investors</option>
                <option>Companies</option>
              </select>
            </div>
            <div>
              <label className="text-[13px] text-gray-500 block mb-[6px]">Sector</label>
              <select className="w-full py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]">
                <option>AI Infrastructure</option>
                <option>FinTech</option>
                <option>HealthTech</option>
                <option>SaaS</option>
                <option>All Sectors</option>
              </select>
            </div>
            <div>
              <label className="text-[13px] text-gray-500 block mb-[6px]">Stage</label>
              <select className="w-full py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]">
                <option>Pre-Seed + Seed</option>
                <option>Seed + Series A</option>
                <option>All Stages</option>
              </select>
            </div>
            <div>
              <label className="text-[13px] text-gray-500 block mb-[6px]">Geography</label>
              <select className="w-full py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]">
                <option>Europe + US</option>
                <option>US Only</option>
                <option>Europe Only</option>
                <option>Global</option>
              </select>
            </div>
            <div>
              <label className="text-[13px] text-gray-500 block mb-[6px]">Check Size</label>
              <div className="flex gap-[8px]">
                <input
                  type="text"
                  placeholder="Min"
                  defaultValue="250000"
                  className="flex-1 py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
                />
                <input
                  type="text"
                  placeholder="Max"
                  defaultValue="2000000"
                  className="flex-1 py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
                />
              </div>
            </div>
            <div>
              <label className="text-[13px] text-gray-500 block mb-[6px]">Maximum Records</label>
              <input
                type="number"
                defaultValue={500}
                className="w-full py-[9px] px-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-[8px] border-t border-gray-100 dark:border-gray-800">
            <p className="text-[13px] text-gray-400 !mb-0">
              Estimated: ~420 credits | Monthly limit: 5,000 | Remaining: 2,160
            </p>
            <Button>
              <i className="ri-search-line text-[16px]" />
              Start Acquisition
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
