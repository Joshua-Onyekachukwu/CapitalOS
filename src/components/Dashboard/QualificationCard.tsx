"use client";

import React, { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function QualificationCard() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ scored: number; ready: number; needsReview: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState({
    sector: "SaaS",
    stage: "seed",
    geography: "United States",
  });

  const runQualification = async () => {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/qualify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startup: {
            name: "My Startup",
            sector: config.sector,
            stage: config.stage,
            geography: config.geography,
            description: "B2B SaaS platform",
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Qualification failed");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <div className="flex items-center gap-[8px] mb-[16px]">
          <div className="w-[40px] h-[40px] rounded-[12px] bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 text-[18px]">
            <i className="ri-scoreboard-line"></i>
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0">Batch Qualification</h3>
            <p className="text-[12px] text-gray-400 !mb-0">Score all investors against your startup profile</p>
          </div>
        </div>

        <p className="text-[12px] text-gray-400 !mb-[12px]">
          Runs deterministic scoring on every active investor: sector match, stage match, geography, check size, data completeness, and outreach readiness.
        </p>

        {/* Config */}
        <div className="grid grid-cols-3 gap-[8px] mb-[16px]">
          <div>
            <label className="block text-[11px] text-gray-400 mb-[4px]">Sector</label>
            <input
              type="text"
              value={config.sector}
              onChange={(e) => setConfig((c) => ({ ...c, sector: e.target.value }))}
              className="w-full py-[6px] px-[10px] text-[13px] border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800"
            />
          </div>
          <div>
            <label className="block text-[11px] text-gray-400 mb-[4px]">Stage</label>
            <select
              value={config.stage}
              onChange={(e) => setConfig((c) => ({ ...c, stage: e.target.value }))}
              className="w-full py-[6px] px-[10px] text-[13px] border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800"
            >
              <option value="pre_seed">Pre-Seed</option>
              <option value="seed">Seed</option>
              <option value="series_a">Series A</option>
              <option value="series_b">Series B</option>
              <option value="series_c">Series C+</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-gray-400 mb-[4px]">Geography</label>
            <input
              type="text"
              value={config.geography}
              onChange={(e) => setConfig((c) => ({ ...c, geography: e.target.value }))}
              className="w-full py-[6px] px-[10px] text-[13px] border border-gray-200 dark:border-gray-700 rounded-[6px] bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <Button onClick={runQualification} disabled={running}>
          {running ? (
            <>
              <svg className="animate-spin h-[14px] w-[14px]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 8.5824 3 7.938l3-2.647z"></path>
              </svg>
              Scoring...
            </>
          ) : (
            <>
              <i className="ri-play-line text-[16px]"></i>
              Run Qualification
            </>
          )}
        </Button>

        {error && (
          <div className="mt-[12px] p-[8px] bg-red-50 dark:bg-red-900/10 rounded-[8px] text-[12px] text-red-600">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-[16px] p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
            <div className="grid grid-cols-3 gap-[8px] text-center">
              <div>
                <p className="text-[18px] font-bold text-[#06201b] dark:text-white !mb-0">{result.scored}</p>
                <p className="text-[10px] text-gray-400 !mb-0">Scored</p>
              </div>
              <div>
                <p className="text-[18px] font-bold text-green-600 !mb-0">{result.ready}</p>
                <p className="text-[10px] text-gray-400 !mb-0">Ready</p>
              </div>
              <div>
                <p className="text-[18px] font-bold text-amber-600 !mb-0">{result.needsReview}</p>
                <p className="text-[10px] text-gray-400 !mb-0">Needs Review</p>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
