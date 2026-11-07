"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "sonner";
import type { AccessLogEntry, DataRoomShare } from "@/lib/actions/data-room";

interface PanelDocument {
  id: string;
  fileName: string;
}

const EXPIRY_OPTIONS = [
  { days: 3, label: "3 days" },
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
];

function statusTone(status: DataRoomShare["status"]): string {
  if (status === "active") return "text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-300";
  if (status === "expired") return "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-300";
  return "text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300";
}

export function DataRoomPanel({ documents }: { documents: PanelDocument[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [expiryDays, setExpiryDays] = useState(7);
  const [label, setLabel] = useState("");
  const [shares, setShares] = useState<DataRoomShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [logFor, setLogFor] = useState<string | null>(null);
  const [log, setLog] = useState<AccessLogEntry[]>([]);

  const loadShares = useCallback(async () => {
    try {
      const { listDataRoomShares } = await import("@/lib/actions/data-room");
      const result = await listDataRoomShares();
      if (!result.ok) throw new Error(result.error);
      setShares(result.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shares.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadShares();
  }, [loadShares]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const create = async () => {
    setCreating(true);
    setError(null);
    setCreatedUrl(null);
    try {
      const { createDataRoomShare } = await import("@/lib/actions/data-room");
      const result = await createDataRoomShare({
        documentIds: selected,
        expiresInDays: expiryDays,
        label: label || null,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setCreatedUrl(result.value.url);
      setSelected([]);
      setLabel("");
      toast.success("Data room link created");
      await loadShares();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create the share.";
      setError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (share: DataRoomShare) => {
    if (!window.confirm("Revoke this link? Anyone holding it will lose access immediately.")) return;
    const { revokeDataRoomShare } = await import("@/lib/actions/data-room");
    const result = await revokeDataRoomShare(share.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Link revoked");
    await loadShares();
  };

  const viewLog = async (shareId: string) => {
    if (logFor === shareId) {
      setLogFor(null);
      return;
    }
    const { getDataRoomAccessLog } = await import("@/lib/actions/data-room");
    const result = await getDataRoomAccessLog(shareId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLog(result.value);
    setLogFor(shareId);
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy — select the link and copy it manually.");
    }
  };

  const input =
    "w-full px-[10px] py-[7px] text-[13px] rounded-[8px] border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#141824] text-[#06201b] dark:text-white";

  return (
    <Card className="mt-[20px]">
      <CardBody>
        <div className="mb-[12px]">
          <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[4px]">
            Data Room
          </h3>
          <p className="text-[12px] text-gray-400 !mb-0">
            Share selected documents with an investor through one revocable link. Every open is
            logged, and the link stops working on its expiry date.
          </p>
        </div>

        {documents.length === 0 ? (
          <p className="text-[13px] text-gray-400 !mb-0">
            Upload at least one document to create a data room link.
          </p>
        ) : (
          <>
            <div className="border border-gray-200 dark:border-gray-800 rounded-[10px] divide-y divide-gray-100 dark:divide-gray-800 mb-[12px]">
              {documents.map((doc) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-[10px] px-[12px] py-[9px] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(doc.id)}
                    onChange={() => toggle(doc.id)}
                    className="accent-lime-600"
                  />
                  <span className="text-[13px] text-[#06201b] dark:text-white truncate">
                    {doc.fileName}
                  </span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-[10px] items-end mb-[12px]">
              <label className="block">
                <span className="text-[11px] text-gray-500">Label (optional)</span>
                <input
                  className={input}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Series A data room"
                  maxLength={120}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-gray-500">Expires after</span>
                <select
                  className={input}
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(Number(e.target.value))}
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.days} value={o.days}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                size="sm"
                loading={creating}
                onClick={create}
                disabled={selected.length === 0}
              >
                Create link
              </Button>
            </div>

            {createdUrl && (
              <div className="mb-[12px] border border-lime-300 dark:border-lime-800 bg-lime-50 dark:bg-lime-900/20 rounded-[10px] p-[12px]">
                <p className="text-[12px] font-semibold text-lime-900 dark:text-lime-200 !mb-[6px]">
                  Link created — anyone with it can open the selected documents until it expires.
                </p>
                <div className="flex items-center gap-[8px]">
                  <input readOnly value={createdUrl} className={input} onFocus={(e) => e.currentTarget.select()} />
                  <Button variant="outline" size="sm" onClick={() => copy(createdUrl)}>
                    Copy
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="text-[12px] text-red-600 !mb-[10px]">{error}</p>}
          </>
        )}

        <div className="mt-[16px]">
          <p className="text-[12px] font-semibold text-gray-600 dark:text-gray-300 !mb-[8px]">
            Existing links
          </p>

          {loading ? (
            <div className="animate-pulse h-[52px] bg-gray-100 dark:bg-gray-800 rounded-[8px]" />
          ) : shares.length === 0 ? (
            <p className="text-[12px] text-gray-400 !mb-0">No data room links yet.</p>
          ) : (
            <div className="space-y-[8px]">
              {shares.map((share) => (
                <div
                  key={share.id}
                  className="border border-gray-200 dark:border-gray-800 rounded-[10px] px-[12px] py-[10px]"
                >
                  <div className="flex items-center justify-between gap-[10px]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-[8px] flex-wrap">
                        <span className="text-[13px] font-medium text-[#06201b] dark:text-white truncate">
                          {share.label || "Untitled share"}
                        </span>
                        <span className={`text-[10px] font-semibold px-[6px] py-[1px] rounded-full ${statusTone(share.status)}`}>
                          {share.status}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {share.documentIds.length} doc{share.documentIds.length === 1 ? "" : "s"} ·{" "}
                          {share.accessCount} open{share.accessCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 !mb-0">
                        Expires {new Date(share.expiresAt).toLocaleString()}
                        {share.lastAccessedAt
                          ? ` · last opened ${new Date(share.lastAccessedAt).toLocaleString()}`
                          : " · never opened"}
                      </p>
                    </div>
                    <div className="flex items-center gap-[6px] flex-none">
                      {share.status === "active" && (
                        <Button variant="outline" size="sm" onClick={() => copy(share.url)}>
                          Copy
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => viewLog(share.id)}>
                        {logFor === share.id ? "Hide log" : "Log"}
                      </Button>
                      {share.status === "active" && (
                        <Button variant="outline" size="sm" onClick={() => revoke(share)}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>

                  {logFor === share.id && (
                    <div className="mt-[8px] border-t border-gray-100 dark:border-gray-800 pt-[8px]">
                      {log.length === 0 ? (
                        <p className="text-[11px] text-gray-400 !mb-0">No opens recorded.</p>
                      ) : (
                        <div className="space-y-[4px]">
                          {log.map((entry) => (
                            <p key={entry.id} className="text-[11px] text-gray-500 !mb-0">
                              {new Date(entry.accessedAt).toLocaleString()} · {entry.ip || "ip unknown"} ·{" "}
                              {entry.documentCount} document{entry.documentCount === 1 ? "" : "s"}
                              {entry.outcome && entry.outcome !== "granted" && (
                                <span className="ml-[6px] text-amber-600 dark:text-amber-400 font-medium">
                                  blocked · {entry.outcome.replace(/_/g, " ")}
                                </span>
                              )}
                              {entry.userAgent ? ` · ${entry.userAgent.slice(0, 60)}` : ""}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
