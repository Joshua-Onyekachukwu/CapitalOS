"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface SharedDocument {
  id: string;
  name: string;
  type: string;
  size: number | null;
  url: string | null;
}

interface ShareResponse {
  label: string | null;
  expiresAt: string;
  documents: SharedDocument[];
  linkExpiresIn: number;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TYPE_LABEL: Record<string, string> = {
  pitch_deck: "Pitch deck",
  business_plan: "Business plan",
  financial_model: "Financial model",
  one_pager: "One-pager",
  other: "Document",
};

export default function SharedDataRoomPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [data, setData] = useState<ShareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/data-room/${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "This link is not available.");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "This link is not available.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-[#f7f9f8] px-[16px] py-[48px]">
      <div className="max-w-[720px] mx-auto">
        <div className="mb-[24px]">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-400 !mb-[4px]">
            Data room
          </p>
          <h1 className="text-[24px] font-bold text-[#06201b] !mb-[4px]">
            {loading ? "Loading…" : data?.label || "Shared documents"}
          </h1>
          {data && (
            <p className="text-[12px] text-gray-500 !mb-0">
              Shared via Capital OS · link expires{" "}
              {new Date(data.expiresAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        {loading ? (
          <div className="space-y-[8px]">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-[64px] bg-white rounded-[12px]" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-white rounded-[12px] p-[24px] border border-gray-200">
            <p className="text-[14px] font-semibold text-[#06201b] !mb-[4px]">
              This link is not available
            </p>
            <p className="text-[13px] text-gray-500 !mb-0">{error}</p>
          </div>
        ) : !data?.documents.length ? (
          <div className="bg-white rounded-[12px] p-[24px] border border-gray-200">
            <p className="text-[14px] text-gray-500 !mb-0">
              This data room is empty — the sender has not added documents yet.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-[12px] border border-gray-200 divide-y divide-gray-100">
            {data.documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-[12px] px-[16px] py-[14px]">
                <div className="w-[36px] h-[36px] rounded-[8px] bg-lime-50 flex items-center justify-center text-lime-700 flex-none">
                  <i className="ri-file-text-line"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[#06201b] !mb-0 truncate">{doc.name}</p>
                  <p className="text-[11px] text-gray-400 !mb-0">
                    {TYPE_LABEL[doc.type] || "Document"}
                    {doc.size ? ` · ${formatSize(doc.size)}` : ""}
                  </p>
                </div>
                {doc.url ? (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-semibold text-lime-700 hover:text-lime-800 px-[10px] py-[6px] rounded-[8px] bg-lime-50 flex-none"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-[11px] text-amber-600 flex-none">file unavailable</span>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-[11px] text-gray-400 mt-[16px]">
          Download links inside this page expire after{" "}
          {data ? Math.round(data.linkExpiresIn / 60) : 10} minutes. Reopen this page for fresh links.
        </p>
      </div>
    </div>
  );
}
