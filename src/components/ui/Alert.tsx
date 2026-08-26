"use client";

import React from "react";
import { cn } from "@/lib/utils";

type AlertVariant = "info" | "success" | "warning" | "danger";

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const variantStyles: Record<AlertVariant, string> = {
  info: "bg-info-50 border-info-200 text-info-800 dark:bg-info-900/20 dark:border-info-800 dark:text-info-300",
  success: "bg-success-50 border-success-200 text-success-800 dark:bg-success-900/20 dark:border-success-800 dark:text-success-300",
  warning: "bg-warning-50 border-warning-200 text-warning-800 dark:bg-warning-900/20 dark:border-warning-800 dark:text-warning-300",
  danger: "bg-danger-50 border-danger-200 text-danger-800 dark:bg-danger-900/20 dark:border-danger-800 dark:text-danger-300",
};

const defaultIcons: Record<AlertVariant, React.ReactNode> = {
  info: <i className="ri-information-line text-[18px]"></i>,
  success: <i className="ri-check-line text-[18px]"></i>,
  warning: <i className="ri-alert-line text-[18px]"></i>,
  danger: <i className="ri-close-circle-line text-[18px]"></i>,
};

const Alert: React.FC<AlertProps> = ({
  variant = "info",
  title,
  icon,
  dismissible,
  onDismiss,
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex items-start gap-[12px] p-[16px] md:p-[16px] rounded-[12px] border text-[14px] md:text-[14px]",
        variantStyles[variant],
        className
      )}
      role="alert"
      {...props}
    >
      <span className="flex-none mt-[1px]">
        {icon || defaultIcons[variant]}
      </span>
      <div className="flex-1">
        {title && (
          <h4 className="font-semibold !mb-[4px] !text-[14px] md:!text-[14px]">{title}</h4>
        )}
        <div className="[&>p]:!mb-0">{children}</div>
      </div>
      {dismissible && (
        <button
          onClick={onDismiss}
          className="flex-none hover:opacity-70 transition-opacity"
          aria-label="Dismiss"
        >
          <i className="ri-close-line text-[18px]"></i>
        </button>
      )}
    </div>
  );
};

export { Alert };
export type { AlertProps, AlertVariant };
