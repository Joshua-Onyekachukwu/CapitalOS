"use client";

import React, { useState, useEffect } from "react";

interface DeckPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  deckUrl: string;
  deckName: string;
}

export function DeckPreview({ isOpen, onClose, deckUrl, deckName }: DeckPreviewProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setCurrentSlide(0);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setCurrentSlide((s) => Math.min(s + 1, totalSlides - 1));
      }
      if (e.key === "ArrowLeft") {
        setCurrentSlide((s) => Math.max(s - 1, 0));
      }
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose, totalSlides]);

  if (!isOpen) return null;

  const isPdf = deckUrl?.toLowerCase().endsWith(".pdf");

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-[#1a1f2e] rounded-[16px] shadow-2xl max-w-[95vw] max-h-[95vh] w-full h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-[20px] py-[12px] border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#1a1f2e]">
          <div className="flex items-center gap-[10px]">
            <div className="w-[32px] h-[32px] rounded-[8px] bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <i className="ri-file-ppt-2-line text-red-500 text-[16px]"></i>
            </div>
            <div>
              <p className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0">{deckName}</p>
              <p className="text-[11px] text-gray-400 !mb-0">
                {isPdf ? "PDF Deck" : "PPTX Deck"}
                {totalSlides > 0 && ` • Slide ${currentSlide + 1} of ${totalSlides}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-[8px]">
            {/* Navigation */}
            {totalSlides > 1 && (
              <div className="flex items-center gap-[4px] mr-[8px]">
                <button
                  onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))}
                  disabled={currentSlide === 0}
                  className="w-[28px] h-[28px] flex items-center justify-center rounded-[6px] hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
                >
                  <i className="ri-arrow-left-s-line text-[16px]"></i>
                </button>
                <span className="text-[12px] text-gray-500 min-w-[60px] text-center">
                  {currentSlide + 1} / {totalSlides}
                </span>
                <button
                  onClick={() => setCurrentSlide((s) => Math.min(totalSlides - 1, s + 1))}
                  disabled={currentSlide === totalSlides - 1}
                  className="w-[28px] h-[28px] flex items-center justify-center rounded-[6px] hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
                >
                  <i className="ri-arrow-right-s-line text-[16px]"></i>
                </button>
              </div>
            )}
            <a href={deckUrl} download target="_blank" rel="noopener noreferrer"
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
        <div className="flex-1 bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
          {isPdf ? (
            <iframe
              src={`${deckUrl}#page=${currentSlide + 1}`}
              className="w-full h-full border-0"
              title={deckName}
              onLoad={(e) => {
                // Try to get total pages from PDF
                try {
                  const iframe = e.target as HTMLIFrameElement;
                  if (iframe.contentDocument) {
                    // PDF.js might be available
                  }
                } catch {}
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-[40px] text-center">
              <div className="w-[80px] h-[80px] rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mb-[16px]">
                <i className="ri-file-ppt-2-line text-gray-400 text-[36px]"></i>
              </div>
              <p className="text-[16px] text-gray-500 !mb-[8px]">PPTX Preview</p>
              <p className="text-[13px] text-gray-400 !mb-[16px] max-w-[400px]">
                PowerPoint files can&apos;t be previewed in the browser. Download the file to view it in PowerPoint or Google Slides.
              </p>
              <a href={deckUrl} download target="_blank" rel="noopener noreferrer">
                <button className="flex items-center gap-[6px] px-[16px] py-[10px] bg-lime-500 text-black rounded-[8px] text-[14px] font-medium hover:bg-lime-600 transition-colors">
                  <i className="ri-download-line text-[16px]"></i> Download Deck
                </button>
              </a>
            </div>
          )}
        </div>

        {/* Slide thumbnails for PDF */}
        {isPdf && totalSlides > 1 && (
          <div className="flex items-center justify-center gap-[8px] px-[20px] py-[10px] bg-white dark:bg-[#1a1f2e] border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
            {Array.from({ length: Math.min(totalSlides, 20) }, (_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-[40px] h-[30px] rounded-[4px] border-2 flex items-center justify-center text-[10px] font-medium transition-all flex-none ${
                  currentSlide === i
                    ? "border-lime-500 bg-lime-50 dark:bg-lime-900/20 text-lime-600"
                    : "border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
