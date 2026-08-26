"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface SavedInvestor {
  id: string;
  investor_id: string;
  full_name: string;
  email: string | null;
  job_title: string | null;
  investor_type: string;
  fit_score: number;
  country: string | null;
  city: string | null;
  investment_stages: string[];
  saved_at: string;
}

export default function SavedInvestorsPage() {
  const [investors, setInvestors] = useState<SavedInvestor[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    try {
      const res = await fetch("/api/investors/saved");
      if (!res.ok) throw new Error("Failed to load saved investors");
      const data = await res.json();
      setInvestors(data.investors || []);
    } catch (err) {
      console.error("Failed to load saved investors:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const handleRemove = async (savedId: string) => {
    setRemoving(savedId);
    try {
      const res = await fetch("/api/investors/saved", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ savedId }),
      });

      if (res.ok) {
        setInvestors((prev) => prev.filter((i) => i.id !== savedId));
      }
    } catch (err) {
      console.error("Failed to remove:", err);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Saved Investors"
        description="Your bookmarked investors for quick access."
      />

      {loading ? (
        <div className="space-y-[15px]">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody>
                <div className="animate-pulse flex items-center gap-[16px]">
                  <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800"></div>
                  <div className="flex-1">
                    <div className="h-[16px] bg-gray-100 dark:bg-gray-800 rounded w-[200px] mb-[8px]"></div>
                    <div className="h-[12px] bg-gray-100 dark:bg-gray-800 rounded w-[300px]"></div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : investors.length === 0 ? (
        <Card>
          <CardBody className="text-center py-[40px]">
            <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[12px] text-gray-300 text-[18px]">
              <i className="ri-bookmark-line"></i>
            </div>
            <p className="text-[14px] text-gray-400 !mb-[16px]">No saved investors yet</p>
            <Link href="/dashboard/investors">
              <Button variant="outline" size="sm">Browse Investors</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[15px]">
          {investors.map((investor) => (
            <Card key={investor.id} className="hover:shadow-md transition-shadow">
              <CardBody>
                <div className="flex flex-col sm:flex-row sm:items-center gap-[16px]">
                  <div className="w-[48px] h-[48px] rounded-full bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-[18px] font-bold text-lime-700 dark:text-lime-400 flex-none">
                    {investor.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[8px] mb-[4px]">
                      <h3 className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">
                        {investor.full_name}
                      </h3>
                      <Badge variant="info" size="sm">{investor.investor_type?.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-[13px] text-gray-400 !mb-0 truncate">
                      {investor.job_title || "Investor"}
                      {investor.email && <> • {investor.email}</>}
                      {investor.country && <> • {investor.country}</>}
                    </p>
                  </div>

                  <div className="flex items-center gap-[12px] sm:flex-shrink-0">
                    <div className="text-center">
                      <p className="text-[18px] font-bold text-lime-600 !mb-0">{investor.fit_score}%</p>
                      <p className="text-[11px] text-gray-400 !mb-0">Fit</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-[8px] sm:flex-shrink-0">
                    <Link href={`/dashboard/investors/${investor.investor_id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(investor.id)}
                      loading={removing === investor.id}
                    >
                      <i className="ri-bookmark-fill text-lime-500 text-[14px]"></i>
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
