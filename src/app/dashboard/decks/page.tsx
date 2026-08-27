"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface DeckDocument {
  id: string;
  fileName: string;
  fileSize: number | null;
  createdAt: string;
  fileUrl: string | null;
}

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDecks = useCallback(async () => {
    try {
      const { getCompanyDocuments } = await import("@/lib/actions/company");
      const docs = await getCompanyDocuments();
      const pitchDecks = docs
        .filter((d: any) => d.documentType === "pitch_deck")
        .map((d: any) => ({
          id: d.id,
          fileName: d.fileName,
          fileSize: d.fileSize,
          createdAt: d.createdAt,
          fileUrl: d.fileUrl,
        }));
      // Sort newest first
      pitchDecks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDecks(pitchDecks);
    } catch {
      setDecks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDecks(); }, [loadDecks]);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const startRename = (deck: DeckDocument) => {
    setRenamingId(deck.id);
    setRenameValue(deck.fileName.replace(/\.(pptx|pdf)$/, ""));
  };

  const saveRename = async (deckId: string) => {
    try {
      const { renameCompanyDocument } = await import("@/lib/actions/company");
      const ext = decks.find((d) => d.id === deckId)?.fileName.endsWith(".pdf") ? ".pdf" : ".pptx";
      await renameCompanyDocument(deckId, `${renameValue}${ext}`);
      setDecks((prev) => prev.map((d) => d.id === deckId ? { ...d, fileName: `${renameValue}${ext}` } : d));
    } catch { /* non-critical */ }
    setRenamingId(null);
  };

  const deleteDeck = async (deckId: string) => {
    try {
      const { deleteCompanyDocument } = await import("@/lib/actions/company");
      await deleteCompanyDocument(deckId);
      setDecks((prev) => prev.filter((d) => d.id !== deckId));
    } catch { /* non-critical */ }
    setDeletingId(null);
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Pitch Decks" description="Loading..." />
        <div className="animate-pulse space-y-[16px]">
          {[1, 2, 3].map((i) => <div key={i} className="h-[80px] bg-gray-100 dark:bg-gray-800 rounded-[12px]" />)}
        </div>
      </div>
    );
  }

  // Group decks into pairs (PPTX + PDF)
  const deckGroups: Array<{ name: string; pptx: DeckDocument | null; pdf: DeckDocument | null; created: string }> = [];
  const seen = new Set<string>();
  for (const deck of decks) {
    if (seen.has(deck.id)) continue;
    const baseName = deck.fileName.replace(/\.(pptx|pdf)$/, "");
    const isPptx = deck.fileName.endsWith(".pptx");
    const pair = decks.find((d) => d.id !== deck.id && d.fileName.replace(/\.(pptx|pdf)$/, "") === baseName);
    deckGroups.push({
      name: baseName,
      pptx: isPptx ? deck : (pair?.fileName.endsWith(".pptx") ? pair : null),
      pdf: !isPptx ? deck : (pair?.fileName.endsWith(".pdf") ? pair : null),
      created: deck.createdAt,
    });
    seen.add(deck.id);
    if (pair) seen.add(pair.id);
  }

  return (
    <div>
      <PageHeader
        title="Pitch Decks"
        description={`${deckGroups.length} deck${deckGroups.length !== 1 ? "s" : ""} generated.`}
        actions={
          <Link href="/dashboard/decks/new">
            <Button><i className="ri-magic-line text-[16px] mr-[6px]"></i> Generate New Deck</Button>
          </Link>
        }
      />

      {deckGroups.length === 0 ? (
        <Card>
          <CardBody className="py-[60px]">
            <div className="text-center">
              <div className="w-[64px] h-[64px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-file-ppt-2-line text-gray-400 text-[28px]"></i>
              </div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">No pitch decks yet</h3>
              <p className="text-[14px] text-gray-500 !mb-[20px] max-w-[400px] mx-auto">
                Generate an AI-powered investor pitch deck from your company profile.
              </p>
              <Link href="/dashboard/decks/new">
                <Button><i className="ri-magic-line text-[16px] mr-[6px]"></i> Generate Your First Deck</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[12px] mb-[40px]">
          {deckGroups.map((group) => {
            const primaryDeck = group.pptx || group.pdf;
            if (!primaryDeck) return null;
            return (
              <Card key={primaryDeck.id} className="hover:shadow-md transition-shadow">
                <CardBody className="p-[16px]">
                  <div className="flex items-center gap-[16px]">
                    <div className="w-[44px] h-[44px] rounded-[12px] bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-none">
                      <i className="ri-file-ppt-2-line text-red-500 text-[18px]"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      {renamingId === primaryDeck.id ? (
                        <div className="flex items-center gap-[8px]">
                          <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") saveRename(primaryDeck.id); if (e.key === "Escape") setRenamingId(null); }}
                            className="flex-1 py-[4px] px-[8px] text-[13px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-[6px] focus:outline-none focus:ring-2 focus:ring-lime-500/30"
                            autoFocus />
                          <button onClick={() => saveRename(primaryDeck.id)} className="text-[12px] text-lime-600 hover:text-lime-700">Save</button>
                          <button onClick={() => setRenamingId(null)} className="text-[12px] text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <>
                          <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px] truncate">
                            {group.name}
                          </p>
                          <p className="text-[12px] text-gray-400 !mb-0">
                            {formatDate(primaryDeck.createdAt)} at {formatTime(primaryDeck.createdAt)}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-[8px] flex-none">
                      {group.pptx && (
                        <a href={group.pptx.fileUrl || undefined} download target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" title="Download PPTX">
                            <i className="ri-file-ppt-2-line text-[14px]"></i>
                          </Button>
                        </a>
                      )}
                      {group.pdf && (
                        <a href={group.pdf.fileUrl || undefined} download target="_blank" rel="noopener noreferrer">
                          <Button variant="outline" size="sm" title="Download PDF">
                            <i className="ri-file-pdf-2-line text-[14px]"></i>
                          </Button>
                        </a>
                      )}
                      <button onClick={() => startRename(primaryDeck)} className="text-[12px] text-gray-400 hover:text-gray-600" title="Rename">
                        <i className="ri-edit-line"></i>
                      </button>
                      {deletingId === primaryDeck.id ? (
                        <div className="flex items-center gap-[8px]">
                          <button onClick={() => deleteDeck(primaryDeck.id)} className="text-[11px] text-red-500 hover:text-red-600 font-semibold">Delete</button>
                          <button onClick={() => setDeletingId(null)} className="text-[11px] text-gray-400">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeletingId(primaryDeck.id)} className="text-[12px] text-gray-400 hover:text-red-500" title="Delete">
                          <i className="ri-delete-bin-line"></i>
                        </button>
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
