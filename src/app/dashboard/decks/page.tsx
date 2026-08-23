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

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Pitch Decks" description="Loading..." />
        <div className="animate-pulse space-y-[16px]">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[80px] bg-gray-100 dark:bg-gray-800 rounded-[12px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pitch Decks"
        description={`${decks.length} deck${decks.length !== 1 ? "s" : ""} generated.`}
        actions={
          <Link href="/dashboard/decks/new">
            <Button>
              <i className="ri-magic-line text-[16px] mr-[6px]"></i>
              Generate New Deck
            </Button>
          </Link>
        }
      />

      {decks.length === 0 ? (
        <Card>
          <CardBody className="py-[60px]">
            <div className="text-center">
              <div className="w-[64px] h-[64px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px]">
                <i className="ri-file-ppt-2-line text-gray-400 text-[28px]"></i>
              </div>
              <h3 className="!text-[16px] !font-semibold !mb-[6px]">No pitch decks yet</h3>
              <p className="text-[14px] text-gray-500 !mb-[20px] max-w-[400px] mx-auto">
                Generate an AI-powered investor pitch deck from your company profile.
                It only takes a minute.
              </p>
              <Link href="/dashboard/decks/new">
                <Button>
                  <i className="ri-magic-line text-[16px] mr-[6px]"></i>
                  Generate Your First Deck
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[12px] mb-[40px]">
          {decks.map((deck) => (
            <Card key={deck.id} className="hover:shadow-md transition-shadow">
              <CardBody className="p-[16px]">
                <div className="flex items-center gap-[14px]">
                  <div className="w-[44px] h-[44px] rounded-[10px] bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-none">
                    <i className="ri-file-ppt-2-line text-red-500 text-[20px]"></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-[2px] truncate">
                      {deck.fileName}
                    </p>
                    <p className="text-[12px] text-gray-400 !mb-0">
                      {formatFileSize(deck.fileSize)} · {formatDate(deck.createdAt)} at {formatTime(deck.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-[8px] flex-none">
                    <Badge variant="success" size="sm">Generated</Badge>
                    {deck.fileUrl && (
                      <a href={deck.fileUrl} download target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <i className="ri-download-line text-[14px]"></i>
                        </Button>
                      </a>
                    )}
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
