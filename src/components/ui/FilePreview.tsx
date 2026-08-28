"use client";

import React, { useEffect } from "react";

interface FilePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  fileUrl: string;
  fileType?: string;
}

export function FilePreview({ isOpen, onClose, fileName, fileUrl, fileType }: FilePreviewProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const ext = fileType || fileName.split(".").pop()?.toLowerCase() || "";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const isPDF = ext === "pdf";
  const isVideo = ["mp4", "webm", "ogg"].includes(ext);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#1a1f2e] rounded-[16px] shadow-2xl max-w-[90vw] max-h-[90vh] w-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-[20px] py-[14px] border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-[10px] min-w-0">
            <div className="w-[32px] h-[32px] rounded-[8px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-none">
              <i className={`${getFileIcon(ext)} text-blue-500 text-[16px]`}></i>
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">{fileName}</p>
              <p className="text-[11px] text-gray-400 !mb-0 uppercase">{ext}</p>
            </div>
          </div>
          <div className="flex items-center gap-[8px]">
            <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-[6px] px-[12px] py-[6px] text-[13px] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-[8px] transition-colors">
              <i className="ri-download-line text-[14px]"></i> Download
            </a>
            <button onClick={onClose}
              className="w-[32px] h-[32px] flex items-center justify-center rounded-[8px] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <i className="ri-close-line text-[18px] text-gray-500"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto min-h-[400px] max-h-[calc(90vh-60px)]">
          {isImage ? (
            <div className="flex items-center justify-center p-[20px]">
              <img src={fileUrl} alt={fileName} className="max-w-full max-h-[70vh] object-contain rounded-[8px]" />
            </div>
          ) : isPDF ? (
            <iframe src={fileUrl} className="w-full h-full min-h-[600px] border-0" title={fileName} />
          ) : isVideo ? (
            <div className="flex items-center justify-center p-[20px]">
              <video src={fileUrl} controls className="max-w-full max-h-[70vh] rounded-[8px]">
                Your browser does not support video preview.
              </video>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-[60px] text-center">
              <div className="w-[64px] h-[64px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-[16px]">
                <i className={`${getFileIcon(ext)} text-gray-400 text-[28px]`}></i>
              </div>
              <p className="text-[14px] text-gray-500 !mb-[4px]">Preview not available for .{ext} files</p>
              <p className="text-[12px] text-gray-400 !mb-[16px]">Download the file to view it.</p>
              <a href={fileUrl} download={fileName} target="_blank" rel="noopener noreferrer">
                <button className="flex items-center gap-[6px] px-[16px] py-[8px] bg-lime-500 text-black rounded-[8px] text-[13px] font-medium hover:bg-lime-600 transition-colors">
                  <i className="ri-download-line text-[14px]"></i> Download File
                </button>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getFileIcon(ext: string): string {
  switch (ext) {
    case "pdf": return "ri-file-pdf-2-line";
    case "pptx":
    case "ppt": return "ri-file-ppt-2-line";
    case "docx":
    case "doc": return "ri-file-word-2-line";
    case "xlsx":
    case "xls": return "ri-file-excel-2-line";
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp": return "ri-image-line";
    case "mp4":
    case "webm": return "ri-video-line";
    default: return "ri-file-line";
  }
}
