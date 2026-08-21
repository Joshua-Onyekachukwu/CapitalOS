"use client";

import React, { useState, useCallback } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

export default function DocumentsPage() {
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  return (
    <div>
      <PageHeader
        title="Documents"
        description="Upload and manage your pitch deck and startup documents."
      />

      {/* Upload Area */}
      <Card className="mb-[20px]">
        <CardBody>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrag}
            className={`border-2 border-dashed rounded-[12px] p-[40px] text-center transition-colors ${
              dragActive
                ? "border-lime-500 bg-lime-50/50 dark:bg-lime-900/10"
                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="w-[56px] h-[56px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-[16px] text-gray-400 text-[26px]">
              <i className="ri-upload-cloud-2-line"></i>
            </div>
            <h3 className="!text-[16px] !font-semibold !mb-[6px] text-[#06201b] dark:text-white">
              Drop your files here
            </h3>
            <p className="text-[14px] text-gray-400 !mb-[16px]">
              or click to browse. Supports PDF, DOCX, TXT, CSV.
            </p>
            <Button variant="outline" size="sm">
              <i className="ri-file-upload-line text-[16px]"></i>
              Choose Files
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Uploaded Documents */}
      <Card>
        <CardBody>
          <EmptyState
            icon={<i className="ri-file-text-line"></i>}
            title="No documents uploaded"
            description="Upload your pitch deck and other materials. AI will analyze them to build your startup profile."
          />
        </CardBody>
      </Card>
    </div>
  );
}
