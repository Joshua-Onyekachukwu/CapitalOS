"use client";

import React, { useState, useEffect } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Firm {
  id: string;
  name: string;
  type: string;
  website: string;
  location: string;
  investor_count: number;
  avg_fit_score: number;
}

export default function AdminFirmsPage() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchFirms();
  }, []);

  const fetchFirms = async () => {
    try {
      const res = await fetch("/api/admin/firms");
      if (res.ok) {
        const data = await res.json();
        setFirms(data.firms || []);
      }
    } catch {}
    setLoading(false);
  };

  const filtered = search
    ? firms.filter((f) => f.name?.toLowerCase().includes(search.toLowerCase()))
    : firms;

  return (
    <div>
      <PageHeader
        title="Investor Firms"
        description={`Manage venture capital firms and investment organizations — ${firms.length} firms.`}
      />

      {/* Search */}
      <Card className="mb-[16px]">
        <CardBody className="py-[14px] px-[16px]">
          <div className="relative">
            <i className="ri-search-line absolute left-[12px] top-1/2 -translate-y-1/2 text-gray-400 text-[18px]" />
            <input
              type="text"
              placeholder="Search firms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-[9px] pl-[38px] pr-[14px] text-[14px] bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-[8px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
            />
          </div>
        </CardBody>
      </Card>

      {/* Firms Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px]">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardBody className="animate-pulse">
                <div className="h-[20px] bg-gray-100 dark:bg-gray-800 rounded w-[150px] mb-[10px]"></div>
                <div className="h-[14px] bg-gray-100 dark:bg-gray-800 rounded w-[100px]"></div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody className="text-center py-[40px]">
            <i className="ri-building-2-line text-[32px] text-gray-300 mb-[12px] block" />
            <p className="font-medium text-[#06201b] dark:text-white !mb-[4px]">
              {search ? "No firms match your search" : "No firms in database"}
            </p>
            <p className="text-[13px] text-gray-400">
              Firms are automatically extracted from investor data sources.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[16px]">
          {filtered.map((firm) => (
            <Card key={firm.id} className="hover:shadow-md transition-shadow">
              <CardBody>
                <div className="flex items-start justify-between mb-[12px]">
                  <div>
                    <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
                      {firm.name}
                    </h3>
                    <p className="text-[12px] text-gray-400 !mb-0">{firm.type || "Investment Firm"}</p>
                  </div>
                  <Badge variant="default">{firm.investor_count || 0} investors</Badge>
                </div>
                {firm.location && (
                  <p className="text-[12px] text-gray-400 !mb-[8px]">
                    <i className="ri-map-pin-line mr-[4px]"></i>{firm.location}
                  </p>
                )}
                {firm.avg_fit_score > 0 && (
                  <div className="flex items-center gap-[8px]">
                    <div className="flex-1 h-[4px] bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-lime-500 rounded-full"
                        style={{ width: `${firm.avg_fit_score}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-gray-400">{firm.avg_fit_score}% avg fit</span>
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
