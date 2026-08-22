"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface MeetingInvestor {
  id: string;
  full_name: string;
  firm_name: string | null;
  investor_type: string;
  fit_score: number;
  outreach_readiness: string;
  email: string | null;
}

export default function MeetingsPage() {
  const [investors, setInvestors] = useState<MeetingInvestor[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      // Get investors in "meeting" or "interested" pipeline stage
      const { data } = await supabase
        .from("v_investors_with_firms")
        .select("id, full_name, firm_name, investor_type, fit_score, outreach_readiness, email")
        .in("outreach_readiness", ["contacted", "ready"])
        .order("fit_score", { ascending: false })
        .limit(50);

      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setInvestors(data.map((inv: any) => ({
          id: inv.id,
          full_name: inv.full_name,
          firm_name: inv.firm_name,
          investor_type: inv.investor_type,
          fit_score: inv.fit_score,
          outreach_readiness: inv.outreach_readiness,
          email: inv.email,
        })));
      }
    } catch {
      // Data may not be available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Track your investor meetings and follow-ups."
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
          <CardBody>
            <EmptyState
              icon={<i className="ri-calendar-check-line"></i>}
              title="No meetings yet"
              description="When investors respond positively to your outreach, they will appear here for meeting scheduling."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[15px]">
          {investors.map((inv) => {
            const initials = inv.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
            return (
              <Card key={inv.id} className="hover:shadow-md transition-shadow">
                <CardBody>
                  <div className="flex items-center gap-[16px]">
                    <div className="w-[48px] h-[48px] rounded-full bg-lime-100 dark:bg-lime-900/30 flex items-center justify-center text-[16px] font-bold text-lime-700 dark:text-lime-400 flex-none">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-[8px] mb-[4px]">
                        <Link href={`/dashboard/investors/${inv.id}`} className="text-[15px] font-semibold text-[#06201b] dark:text-white hover:text-lime-600 transition-colors">
                          {inv.full_name}
                        </Link>
                        <Badge variant={inv.outreach_readiness === "contacted" ? "info" : "success"} size="sm">
                          {inv.outreach_readiness.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-[13px] text-gray-400 !mb-0">
                        {inv.firm_name || "Independent"} • {inv.investor_type.replace(/_/g, " ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-[12px] flex-none">
                      <div className="text-center">
                        <p className="text-[16px] font-bold text-[#06201b] dark:text-white !mb-0">{inv.fit_score}%</p>
                        <p className="text-[10px] text-gray-400 !mb-0">Fit</p>
                      </div>
                      {inv.email && (
                        <a href={`mailto:${inv.email}?subject=Meeting follow-up — Capital OS`} target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm">
                            <i className="ri-mail-line text-[14px]"></i>
                            Email
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
