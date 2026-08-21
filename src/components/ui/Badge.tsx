import React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "primary" | "success" | "warning" | "danger" | "info" | "default";
type BadgeSize = "sm" | "md";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: "bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400",
  success: "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400",
  warning: "bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400",
  danger: "bg-danger-50 text-danger-600 dark:bg-danger-900/20 dark:text-danger-400",
  info: "bg-info-50 text-info-700 dark:bg-info-900/20 dark:text-info-400",
  default: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "text-[11px] md:text-[12px] py-[2px] px-[8px] rounded-[4px]",
  md: "text-[12px] md:text-[13px] py-[3px] px-[10px] rounded-[6px]",
};

const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  size = "md",
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export { Badge };
export type { BadgeProps, BadgeVariant, BadgeSize };
