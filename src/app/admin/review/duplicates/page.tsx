"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface DuplicateCandidate {
  id: string;
  confidence: number;
  match_signals: Record<string, number>;
  status: string;
  created_at: string;
  investor_a_name: string;
  investor_a_email: string | null;
  investor_b_name: string;
  investor_b_email: string | null;
  firm_a_name: string | null;
  firm_b_name: string | null;
}

const confidenceColor = (c: number) =>
  c >= 0.95 ? "text-green-600" : c >= 0.70 ? "text-amber-600" : "text-gray-500";

const confidenceLabel = (c: number) =>
  c >= 0.95 ? "High" : c >= 0.70 ? "Medium" : "Low";

export default function DuplicatesReviewPage() {
  const [candidates, setCandidates] = useState<DuplicateCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data } = await supabase
        .from("v_pending_duplicates")
        .select("*")
        .order("confidence", { ascending: false });
      setCandidates(data || []);
    } catch {
      console.error("Failed to fetch duplicates");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: "approved_merge" | "rejected") => {
    setActionLoading(id);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      await supabase
        .from("duplicate_candidates")
        .update({
          status: action,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      setCandidates((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Duplicate Review Queue"
        description={`${candidates.length} potential duplicates need review.`}
      />

      {loading ? (
        <div className="space-y-[12px]">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody className="animate-pulse">
                <div className="h-[20px] bg-gray-100 dark:bg-gray-800 rounded w-[200px] mb-[10px]"></div>
                <div className="h-[14px] bg-gray-100 dark:bg-gray-800 rounded w-[300px]"></div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <Card>
          <CardBody className="text-center py-[40px]">
            <div className="w-[56px] h-[56px] rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-[16px] text-green-600 text-[24px]">
              <i className="ri-check-double-line"></i>
            </div>
            <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[8px]">
              All clear!
            </h3>
            <p className="text-[14px] text-gray-400 !mb-0">
              No pending duplicates to review.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[12px]">
          {candidates.map((candidate) => (
            <Card key={candidate.id} className="hover:shadow-md transition-shadow">
              <CardBody>
                <div className="flex flex-col lg:flex-row lg:items-center gap-[16px]">
                  {/* Confidence */}
                  <div className="flex-shrink-0 text-center lg:w-[80px]">
                    <p className={`text-[24px] font-bold ${confidenceColor(candidate.confidence)} !mb-0`}>
                      {Math.round(candidate.confidence * 100)}%
                    </p>
                    <Badge
                      variant={candidate.confidence >= 0.95 ? "success" : candidate.confidence >= 0.70 ? "warning" : "default"}
                      size="sm"
                    >
                      {confidenceLabel(candidate.confidence)}
                    </Badge>
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
                    {/* Person A */}
                    <div className="bg-gray-50 dark:bg-gray-800/30 rounded-[8px] p-[16px]">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider !mb-[6px]">Person A</p>
                      <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                        {candidate.investor_a_name}
                      </p>
                      <p className="text-[13px] text-gray-400 !mb-0">{candidate.investor_a_email || "No email"}</p>
                      {candidate.firm_a_name && (
                        <p className="text-[12px] text-gray-400 !mb-0 mt-[4px]">
                          <i className="ri-building-line mr-[4px]"></i>{candidate.firm_a_name}
                        </p>
                      )}
                    </div>

                    {/* Person B */}
                    <div className="bg-gray-50 dark:bg-gray-800/30 rounded-[8px] p-[16px]">
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider !mb-[6px]">Person B</p>
                      <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px]">
                        {candidate.investor_b_name}
                      </p>
                      <p className="text-[13px] text-gray-400 !mb-0">{candidate.investor_b_email || "No email"}</p>
                      {candidate.firm_b_name && (
                        <p className="text-[12px] text-gray-400 !mb-0 mt-[4px]">
                          <i className="ri-building-line mr-[4px]"></i>{candidate.firm_b_name}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Match Signals */}
                  <div className="flex-shrink-0 lg:w-[140px]">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider !mb-[6px]">Signals</p>
                    <div className="space-y-[4px]">
                      {Object.entries(candidate.match_signals).map(([signal, score]) => (
                        <div key={signal} className="flex items-center gap-[8px]">
                          <div className="flex-1 h-[4px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${score >= 0.9 ? "bg-green-500" : score >= 0.5 ? "bg-amber-500" : "bg-gray-300"}`}
                              style={{ width: `${(score as number) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-[11px] text-gray-400 w-[60px] capitalize">{signal.replace(/([A-Z])/g, " $1")}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-[8px] flex-shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleAction(candidate.id, "approved_merge")}
                      disabled={actionLoading === candidate.id}
                    >
                      <i className="ri-git-merge-line text-[14px]"></i>
                      Merge
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction(candidate.id, "rejected")}
                      disabled={actionLoading === candidate.id}
                    >
                      <i className="ri-close-line text-[14px]"></i>
                      Keep Separate
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
