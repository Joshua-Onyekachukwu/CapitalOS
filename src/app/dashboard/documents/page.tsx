"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/Dashboard/PageHeader";
import { DataRoomPanel } from "@/components/Documents/DataRoomPanel";

interface Document {
  id: string;
  documentType: string;
  fileName: string;
  /** Object path, or null when the file never reached storage. */
  fileUrl: string | null;
  fileSize: number | null;
  createdAt: string;
}

const DOCUMENT_TYPES = [
  { value: "pitch_deck", label: "Pitch Deck", icon: "ri-file-ppt-2-line" },
  { value: "business_plan", label: "Business Plan", icon: "ri-file-text-line" },
  { value: "financial_model", label: "Financial Model", icon: "ri-file-chart-line" },
  { value: "one_pager", label: "One-Pager", icon: "ri-file-list-2-line" },
  { value: "other", label: "Other", icon: "ri-file-line" },
];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(
    null
  );
  const [selectedType, setSelectedType] = useState("pitch_deck");
  const [dragActive, setDragActive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const { getCompanyDocuments } = await import("@/lib/actions/company");
      const docs = await getCompanyDocuments();
      setDocuments(docs);
    } catch (err) {
      setStatus({
        tone: "error",
        text: `Could not load your documents: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Check the bucket once on mount so a broken storage config is visible
  // immediately instead of only after a failed upload.
  useEffect(() => {
    (async () => {
      try {
        const { getDocumentStorageHealth } = await import("@/lib/actions/documents");
        const health = await getDocumentStorageHealth();
        setStorageWarning(health.configured ? null : health.message);
      } catch {
        // Health probe is advisory; upload errors will report themselves.
      }
    })();
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setStatus({ tone: "info", text: `Uploading ${file.name}…` });

    try {
      const { uploadCompanyDocument } = await import("@/lib/actions/documents");
      const result = await uploadCompanyDocument({
        file,
        documentType: selectedType,
        fileName: file.name,
      });

      if (!result.ok) {
        setStatus({ tone: "error", text: result.error });
        return;
      }

      await loadDocuments();
      setStatus({ tone: "ok", text: `${result.document.fileName} uploaded.` });
    } catch (err) {
      setStatus({
        tone: "error",
        text: `Upload failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleOpen = async (doc: Document) => {
    setBusyId(doc.id);
    try {
      const { getDocumentDownloadUrl } = await import("@/lib/actions/documents");
      const result = await getDocumentDownloadUrl(doc.id);
      if (!result.ok) {
        setStatus({ tone: "error", text: result.error });
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
      setStatus(
        result.expiresIn
          ? {
              tone: "info",
              text: `Download link created. It expires in ${result.expiresIn} seconds.`,
            }
          : { tone: "info", text: "Opened document." }
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!window.confirm(`Delete "${doc.fileName}"? This cannot be undone.`)) return;
    setBusyId(doc.id);
    try {
      const { deleteCompanyDocument } = await import("@/lib/actions/documents");
      const result = await deleteCompanyDocument(doc.id);
      if (!result.ok) {
        setStatus({ tone: "error", text: result.error });
        return;
      }
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      setStatus({ tone: "ok", text: `${doc.fileName} deleted.` });
    } finally {
      setBusyId(null);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !uploading) handleUpload(file);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const toneClass = (tone: "ok" | "error" | "info") =>
    tone === "error"
      ? "text-red-600 dark:text-red-400"
      : tone === "ok"
        ? "text-green-600 dark:text-green-400"
        : "text-gray-500";

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Upload and manage your pitch deck and startup documents."
      />

      {storageWarning && (
        <div className="mb-[16px] rounded-[8px] border border-amber-300 bg-amber-50 px-[14px] py-[10px] text-[13px] text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <i className="ri-error-warning-line mr-[6px]"></i>
          {storageWarning}
        </div>
      )}

      {/* Upload Area */}
      <Card className="mb-[20px]">
        <CardBody>
          <div className="mb-[12px]">
            <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-400 mb-[6px]">
              Document Type
            </label>
            <div className="flex flex-wrap gap-[8px]">
              {DOCUMENT_TYPES.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  disabled={uploading}
                  className={`flex items-center gap-[8px] px-[12px] py-[6px] rounded-full text-[12px] font-medium transition-all disabled:opacity-60 ${
                    selectedType === type.value
                      ? "bg-[#06201b] text-white dark:bg-lime-500 dark:text-black"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  <i className={`${type.icon} text-[14px]`}></i>
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`border-2 border-dashed rounded-[12px] p-[30px] text-center transition-all ${
              dragActive
                ? "border-lime-500 bg-lime-50/50 dark:bg-lime-900/10"
                : "border-gray-200 dark:border-gray-700"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[12px] text-gray-300 text-[18px]">
              <i className="ri-upload-cloud-2-line"></i>
            </div>
            <p className="text-[14px] text-gray-400 !mb-[4px]">
              {uploading ? "Uploading…" : "Drag & drop a file here, or click to browse"}
            </p>
            <p className="text-[12px] text-gray-300 dark:text-gray-600 !mb-[12px]">
              PDF, PPTX, DOCX, XLSX — Max 25MB
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.pptx,.ppt,.docx,.doc,.xlsx"
              className="hidden"
              onChange={handleChange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <i className="ri-file-upload-line text-[16px]"></i>
              {uploading ? "Uploading…" : "Browse Files"}
            </Button>
          </div>

          {status && (
            <div className={`mt-[10px] text-[13px] font-medium ${toneClass(status.tone)}`}>
              {status.text}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Document List */}
      <Card>
        <CardBody>
          <h3 className="text-[16px] font-semibold text-[#06201b] dark:text-white !mb-[16px]">
            Uploaded Documents ({documents.length})
          </h3>

          {loading ? (
            <div className="space-y-[10px]">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse flex items-center gap-[12px] p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]"
                >
                  <div className="w-[40px] h-[40px] rounded-[8px] bg-gray-200 dark:bg-gray-700"></div>
                  <div className="flex-1">
                    <div className="h-[14px] bg-gray-200 dark:bg-gray-700 rounded w-[200px] mb-[6px]"></div>
                    <div className="h-[10px] bg-gray-200 dark:bg-gray-700 rounded w-[100px]"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-[30px]">
              <div className="w-[48px] h-[48px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px] text-gray-300 text-[24px]">
                <i className="ri-file-text-line"></i>
              </div>
              <p className="text-[14px] text-gray-400 !mb-[4px]">No documents uploaded yet</p>
              <p className="text-[13px] text-gray-300 dark:text-gray-600 !mb-0">
                Upload your pitch deck, business plan, or other materials.
              </p>
            </div>
          ) : (
            <div className="space-y-[8px]">
              {documents.map((doc) => {
                const typeInfo =
                  DOCUMENT_TYPES.find((t) => t.value === doc.documentType) || DOCUMENT_TYPES[4];
                const missingFile = !doc.fileUrl;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center gap-[12px] p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="w-[40px] h-[40px] rounded-[8px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-[18px] flex-none">
                      <i className={typeInfo.icon}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0 truncate">
                        {doc.fileName}
                      </p>
                      <p className="text-[11px] text-gray-400 !mb-0">
                        {typeInfo.label} • {formatFileSize(doc.fileSize)} •{" "}
                        {new Date(doc.createdAt).toLocaleDateString()}
                        {missingFile && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {" "}
                            • file missing, re-upload
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpen(doc)}
                      disabled={busyId === doc.id}
                    >
                      <i className="ri-external-link-line text-[14px]"></i>
                      {busyId === doc.id ? "Opening…" : "Open"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(doc)}
                      disabled={busyId === doc.id}
                    >
                      <i className="ri-delete-bin-line text-[14px]"></i>
                      Delete
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <DataRoomPanel documents={documents.map((d) => ({ id: d.id, fileName: d.fileName }))} />
    </div>
  );
}
