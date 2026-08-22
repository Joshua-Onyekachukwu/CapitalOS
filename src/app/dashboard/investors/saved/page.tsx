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
  firm_name: string | null;
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
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get saved investor records
      const { data: saved } = await supabase
        .from("saved_investors")
        .select("id, investor_id, created_at")
        .order("created_at", { ascending: false });

      if (!saved || saved.length === 0) {
        setInvestors([]);
        setLoading(false);
        return;
      }

      // Get the investor details
      const investorIds = saved.map((s) => s.investor_id);
      const { data: investorData } = await supabase
        .from("v_investors_with_firms")
        .select("id, full_name, email, firm_name, job_title, investor_type, fit_score, country, city, investment_stages")
        .in("id", investorIds);

      // Merge saved data with investor data
      const merged = saved
        .map((s) => {
          const inv = investorData?.find((i) => i.id === s.investor_id);
          if (!inv) return null;
          return {
            id: s.id,
            investor_id: s.investor_id,
            full_name: inv.full_name,
            email: inv.email,
            firm_name: inv.firm_name,
            job_title: inv.job_title,
            investor_type: inv.investor_type,
            fit_score: inv.fit_score || 0,
            country: inv.country,
            city: inv.city,
            investment_stages: inv.investment_stages || [],
            saved_at: s.created_at,
          };
        })
        .filter(Boolean) as SavedInvestor[];

      setInvestors(merged);
    } catch (err) {
      console.error("Failed to load saved investors:", err);
      // Fallback: try with empty array
      setInvestors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  const handleRemove = async (savedId: string) => {
    setRemoving(savedId);
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from("saved_investors").delete().eq("id", savedId);

      setInvestors((prev) => prev.filter((i) => i.id !== savedId));
    } catch (err) {
      console.error("Failed to remove:", err);
    } finally {
      setRemoving(null);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Saved Investors" description="Loading..." />
        <div className="animate-pulse space-y-[12px]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] bg-gray-100 dark:bg-gray-800 rounded-[12px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Saved Investors"
        description={`${investors.length} investor${investors.length !== 1 ? "s" : ""} saved for review.`}
      />

      {investors.length === 0 ? (
        <Card>
          <CardBody className="py-[60px]">
            <div className="text-center">
              <div className="w-[64px] h-[64px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-bookmark-line text-gray-400 text-[28px]"></i>
              </div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">No saved investors</h3>
              <p className="text-[14px] text-gray-500 !mb-[16px]">
                Bookmark investors during discovery to save them here for later review.
              </p>
              <Link href="/dashboard/investors">
                <Button>
                  <i className="ri-radar-line text-[18px]"></i>
                  Browse Investors
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[12px] mb-[40px]">
          {investors.map((investor) => (
            <Card key={investor.id} className="hover:shadow-md transition-shadow">
              <CardBody className="p-[16px]">
                <div className="flex items-center gap-[12px]">
                  <div className="w-[40px] h-[40px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[14px] font-semibold text-lime-700 dark:text-lime-400 flex-none">
                    {investor.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[8px] flex-wrap">
                      <Link href={`/dashboard/investors/${investor.investor_id}`} className="font-medium text-[14px] text-gray-900 dark:text-white hover:text-lime-600 transition-colors">
                        {investor.full_name}
                      </Link>
                      <Badge variant="default" size="sm">{investor.investor_type.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-[12px] text-gray-400 !mb-0">
                      {investor.job_title || ""}{investor.firm_name ? ` at ${investor.firm_name}` : ""} · {investor.city || investor.country || "Unknown location"} · Saved {formatTimeAgo(investor.saved_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-[8px] flex-none">
                    <div className="text-right">
                      <span className={`text-[14px] font-bold ${investor.fit_score >= 80 ? "text-green-600" : investor.fit_score >= 50 ? "text-amber-600" : "text-gray-400"}`}>
                        {investor.fit_score}%
                      </span>
                      <span className="text-[11px] text-gray-400 block">fit</span>
                    </div>
                    <Link href={`/dashboard/investors/${investor.investor_id}`}>
                      <Button size="sm" variant="outline">View</Button>
                    </Link>
                    <button
                      onClick={() => handleRemove(investor.id)}
                      disabled={removing === investor.id}
                      className="p-[6px] text-gray-300 hover:text-red-500 transition-colors"
                      title="Remove from saved"
                    >
                      <i className="ri-bookmark-fill text-[16px]"></i>
                    </button>
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
