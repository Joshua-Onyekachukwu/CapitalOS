"use client";

import React, { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface CampaignData {
  id: string;
  name: string;
  description: string;
  status: "draft" | "active" | "paused" | "completed";
  investor_count: number;
  emails_sent: number;
  responses: number;
  created_at: string;
  sector?: string;
  stage?: string;
}

interface CampaignInvestor {
  id: string;
  investor_id: string;
  first_name: string;
  last_name: string;
  firm_name: string;
  email: string | null;
  fit_score: number;
  status: "pending" | "drafted" | "approved" | "sent" | "replied" | "bounced";
  subject?: string;
  body?: string;
}

const statusColors: Record<string, { label: string; variant: "success" | "warning" | "info" | "default" | "danger" }> = {
  pending: { label: "Pending", variant: "default" },
  drafted: { label: "Drafted", variant: "info" },
  approved: { label: "Approved", variant: "success" },
  sent: { label: "Sent", variant: "info" },
  replied: { label: "Replied", variant: "success" },
  bounced: { label: "Bounced", variant: "danger" },
};

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [investors, setInvestors] = useState<CampaignInvestor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [selectedInvestor, setSelectedInvestor] = useState<CampaignInvestor | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/campaigns/${id}`);
      const data = await res.json();

      if (data.campaign) {
        setCampaign(data.campaign);
      }
      if (data.investors) {
        setInvestors(data.investors);
      }
    } catch (err) {
      console.error("Failed to load campaign:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (newStatus: "active" | "paused" | "completed") => {
    await fetch(`/api/dashboard/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setCampaign((prev) => (prev ? { ...prev, status: newStatus } : prev));
  };

  const filtered = activeTab === "all" ? investors : investors.filter((i) => i.status === activeTab);

  const stats = {
    total: investors.length,
    drafted: investors.filter((i) => i.status === "drafted").length,
    sent: investors.filter((i) => i.status === "sent").length,
    replied: investors.filter((i) => i.status === "replied").length,
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Campaign" description="Loading..." />
        <Card>
          <CardBody className="text-center py-[40px]">
            <div className="animate-spin h-[24px] w-[24px] border-2 border-lime-500 border-t-transparent rounded-full mx-auto mb-[12px]"></div>
            <p className="text-[13px] text-gray-400 !mb-0">Loading campaign details...</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div>
        <PageHeader title="Campaign Not Found" description="This campaign doesn't exist." />
        <Card>
          <CardBody className="text-center py-[40px]">
            <Button onClick={() => router.push("/dashboard/campaigns")}>
              <i className="ri-arrow-left-line text-[16px]"></i>
              Back to Campaigns
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={campaign.name}
        description={campaign.description || "Campaign details and management."}
        actions={
          <div className="flex items-center gap-[10px]">
            <Button variant="ghost" onClick={() => router.push("/dashboard/campaigns")}>
              <i className="ri-arrow-left-line text-[16px]"></i>
              Back
            </Button>
            {campaign.status === "draft" && (
              <Button onClick={() => handleStatusChange("active")}>
                <i className="ri-play-line text-[16px]"></i>
                Activate
              </Button>
            )}
            {campaign.status === "active" && (
              <>
                <Button variant="outline" onClick={() => handleStatusChange("paused")}>
                  <i className="ri-pause-line text-[16px]"></i>
                  Pause
                </Button>
                <Button onClick={() => handleStatusChange("completed")}>
                  <i className="ri-check-line text-[16px]"></i>
                  Complete
                </Button>
              </>
            )}
            {campaign.status === "paused" && (
              <Button onClick={() => handleStatusChange("active")}>
                <i className="ri-play-line text-[16px]"></i>
                Resume
              </Button>
            )}
          </div>
        }
      />

      {/* Campaign Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-[15px] mb-[25px]">
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[20px] flex-none">
              <i className="ri-team-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Total Investors</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stats.total}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-[20px] flex-none">
              <i className="ri-draft-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Drafted</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stats.drafted}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 text-[20px] flex-none">
              <i className="ri-mail-send-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Sent</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stats.sent}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 text-[20px] flex-none">
              <i className="ri-reply-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Replied</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{stats.replied}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Tabs + Investor Table */}
      <Card>
        <Tabs
          tabs={[
            { id: "all", label: "All", count: stats.total },
            { id: "drafted", label: "Drafted", count: stats.drafted },
            { id: "sent", label: "Sent", count: stats.sent },
            { id: "replied", label: "Replied", count: stats.replied },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        <CardBody className="p-0">
          {filtered.length === 0 ? (
            <div className="p-[40px] text-center">
              <p className="text-[14px] text-gray-400 !mb-0">
                {activeTab === "all"
                  ? "No investors in this campaign yet. Emails will appear here as they are generated."
                  : `No ${activeTab} emails yet.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-[20px] py-[12px] text-[12px] font-medium text-gray-400 uppercase tracking-wider">Investor</th>
                    <th className="text-left px-[20px] py-[12px] text-[12px] font-medium text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="text-left px-[20px] py-[12px] text-[12px] font-medium text-gray-400 uppercase tracking-wider">Fit</th>
                    <th className="text-left px-[20px] py-[12px] text-[12px] font-medium text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-[20px] py-[12px] text-[12px] font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedInvestor(inv)}
                    >
                      <td className="px-[20px] py-[14px]">
                        <div className="flex items-center gap-[10px]">
                          <div className="w-[32px] h-[32px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[12px] font-semibold text-[#06201b] dark:text-white flex-shrink-0">
                            {(inv.first_name?.[0] || "") + (inv.last_name?.[0] || "")}
                          </div>
                          <div>
                            <p className="text-[14px] font-medium text-[#06201b] dark:text-white !mb-0">
                              {inv.first_name} {inv.last_name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-[20px] py-[14px] text-[13px] text-gray-400">{inv.email || "No email"}</td>
                      <td className="px-[20px] py-[14px]">
                        <span className={`text-[13px] font-bold ${
                          inv.fit_score >= 80 ? "text-green-600" : inv.fit_score >= 60 ? "text-amber-600" : "text-gray-400"
                        }`}>
                          {inv.fit_score}%
                        </span>
                      </td>
                      <td className="px-[20px] py-[14px]">
                        <Badge variant={statusColors[inv.status]?.variant || "default"} size="sm">
                          {statusColors[inv.status]?.label || inv.status}
                        </Badge>
                      </td>
                      <td className="px-[20px] py-[14px]">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedInvestor(inv); }}>
                          <i className="ri-eye-line text-[14px]"></i>
                          View
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Email Preview Modal */}
      {selectedInvestor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-[20px]" onClick={() => { setSelectedInvestor(null); setEditingEmail(false); }}>
          <div className="bg-white dark:bg-dark rounded-[20px] w-full max-w-[600px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-[25px]">
              <div className="flex items-center justify-between mb-[20px]">
                <div>
                  <h3 className="text-[18px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
                    Email to {selectedInvestor.first_name} {selectedInvestor.last_name}
                  </h3>
                  <p className="text-[13px] text-gray-400 !mb-0">{selectedInvestor.email}</p>
                </div>
                <button
                  onClick={() => { setSelectedInvestor(null); setEditingEmail(false); }}
                  className="w-[32px] h-[32px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600"
                >
                  <i className="ri-close-line text-[18px]"></i>
                </button>
              </div>

              {selectedInvestor.subject ? (
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-[12px] p-[20px]">
                  <div className="mb-[12px]">
                    <span className="text-[12px] text-gray-400">Subject:</span>
                    {editingEmail ? (
                      <input
                        type="text"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        className="w-full px-[10px] py-[6px] border border-gray-200 dark:border-gray-700 rounded-[6px] text-[14px] font-medium bg-white dark:bg-gray-800 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500"
                      />
                    ) : (
                      <p className="text-[14px] font-medium text-[#06201b] dark:text-white !mb-0">{selectedInvestor.subject}</p>
                    )}
                  </div>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-[12px]">
                    {editingEmail ? (
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={10}
                        className="w-full px-[10px] py-[8px] border border-gray-200 dark:border-gray-700 rounded-[6px] text-[14px] bg-white dark:bg-gray-800 text-[#06201b] dark:text-white focus:outline-none focus:ring-2 focus:ring-lime-500 resize-none leading-[1.7]"
                      />
                    ) : (
                      <p className="text-[14px] text-gray-600 dark:text-gray-300 leading-[1.7] !mb-0 whitespace-pre-line">
                        {selectedInvestor.body}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-[12px] p-[20px] text-center">
                  <p className="text-[14px] text-gray-400 !mb-0">
                    No email drafted yet. Go to Outreach to generate one.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-[10px] mt-[20px]">
                {!editingEmail && selectedInvestor.subject && (
                  <Button variant="outline" size="sm" onClick={() => {
                    setEditSubject(selectedInvestor.subject || "");
                    setEditBody(selectedInvestor.body || "");
                    setEditingEmail(true);
                  }}>
                    <i className="ri-edit-line text-[14px]"></i>
                    Edit Email
                  </Button>
                )}
                {editingEmail && (
                  <Button size="sm" onClick={() => {
                    setSelectedInvestor((prev) => prev ? { ...prev, subject: editSubject, body: editBody } : prev);
                    setEditingEmail(false);
                  }}>
                    <i className="ri-check-line text-[14px]"></i>
                    Save Changes
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => { setSelectedInvestor(null); setEditingEmail(false); }}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
