"use client";

import React, { useEffect, useCallback, useId, useRef } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "max-w-[400px]",
  md: "max-w-[560px]",
  lg: "max-w-[720px]",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  className,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  // Focus trap: keep Tab cycling within the dialog.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (focusable.length === 0) {
      e.preventDefault();
      dialog.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const inside = active instanceof Node && dialog.contains(active);
    if (e.shiftKey) {
      if (!inside || active === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (!inside || active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    // Initial focus: first focusable element, else the dialog itself.
    const raf = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const target =
        focusable.length > 0 ? focusable[0] : (dialog as HTMLElement);
      target.focus();
    });
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
      cancelAnimationFrame(raf);
      // Focus return to the trigger on close.
      previouslyFocused.current?.focus?.();
      previouslyFocused.current = null;
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-3">
      {/* Backdrop: click-to-close convenience; Escape and focus trap are the keyboard paths */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="absolute inset-0 bg-black/60 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      {/* Focus trap lives on the dialog: keydown must be captured here to cycle Tab */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className={cn(
          "relative w-full bg-white dark:bg-[#0a0e19] rounded-[16px] md:rounded-[20px] shadow-xl",
          sizeStyles[size],
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        {(title || description) && (
          <div className="px-[20px] md:px-[25px] pt-[20px] md:pt-[25px]">
            {title && (
              <h3
                id={titleId}
                className="!text-lg md:!text-xl !font-semibold !mb-[4px]"
              >
                {title}
              </h3>
            )}
            {description && (
              <p id={descriptionId} className="text-[14px] text-gray-500">
                {description}
              </p>
            )}
          </div>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-[16px] right-[15px] w-[32px] h-[32px] flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400"
          aria-label="Close"
        >
          <i className="ri-close-line text-[18px]"></i>
        </button>

        {/* Content */}
        <div className="px-[20px] md:px-[25px] py-[20px]">{children}</div>
      </div>
    </div>
  );
};

export { Modal };
export type { ModalProps };
