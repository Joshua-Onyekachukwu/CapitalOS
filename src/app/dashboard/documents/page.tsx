"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Document {
  id: string;
  documentType: string;
  fileName: string;
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
  const [uploadProgress, setUploadProgress] = useState("");
  const [selectedType, setSelectedType] = useState("pitch_deck");
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const { getCompanyDocuments } = await import("@/lib/actions/company");
      const docs = await getCompanyDocuments();
      setDocuments(docs);
    } catch {
      // Table may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress("Uploading file...");

    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload to Supabase Storage
      const filePath = `${user.id}/${Date.now()}-${file.name}`;
      setUploadProgress("Storing file...");

      const { error: uploadError } = await supabase.storage
        .from("company-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("company-documents")
        .getPublicUrl(filePath);

      // Save to database
      setUploadProgress("Saving record...");
      const { addCompanyDocument } = await import("@/lib/actions/company");
      await addCompanyDocument({
        documentType: selectedType,
        fileName: file.name,
        fileUrl: urlData.publicUrl,
        fileSize: file.size,
      });

      // Reload documents
      await loadDocuments();
      setUploadProgress("Upload complete!");
      setTimeout(() => setUploadProgress(""), 2000);
    } catch (err) {
      setUploadProgress(`Upload failed: ${String(err)}`);
      setTimeout(() => setUploadProgress(""), 3000);
    } finally {
      setUploading(false);
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
    if (e.dataTransfer.files?.[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleUpload(e.target.files[0]);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Upload and manage your pitch deck and startup documents."
      />

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
                  className={`flex items-center gap-[6px] px-[12px] py-[6px] rounded-full text-[12px] font-medium transition-all ${
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
              {uploading ? uploadProgress : "Drag & drop a file here, or click to browse"}
            </p>
            <p className="text-[12px] text-gray-300 dark:text-gray-600 !mb-[12px]">
              PDF, PPTX, DOCX — Max 10MB
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.pptx,.ppt,.docx,.doc"
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
              {uploading ? "Uploading..." : "Browse Files"}
            </Button>
          </div>

          {uploadProgress && !uploading && (
            <div className={`mt-[10px] text-[13px] font-medium ${
              uploadProgress.includes("failed") ? "text-red-500" : "text-green-600"
            }`}>
              {uploadProgress}
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
                <div key={i} className="animate-pulse flex items-center gap-[12px] p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px]">
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
                const typeInfo = DOCUMENT_TYPES.find((t) => t.value === doc.documentType) || DOCUMENT_TYPES[4];
                return (
                  <div key={doc.id} className="flex items-center gap-[12px] p-[12px] bg-gray-50 dark:bg-gray-800/30 rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors">
                    <div className="w-[40px] h-[40px] rounded-[8px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-[18px] flex-none">
                      <i className={typeInfo.icon}></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0 truncate">{doc.fileName}</p>
                      <p className="text-[11px] text-gray-400 !mb-0">
                        {typeInfo.label} • {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {doc.fileUrl && (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <i className="ri-external-link-line text-[14px]"></i>
                          Open
                        </Button>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
