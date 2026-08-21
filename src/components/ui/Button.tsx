import React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700",
  secondary:
    "bg-[#0f172a] text-white hover:bg-[#1e293b] active:bg-[#0d4f3a] dark:bg-white dark:text-[#0f172a] dark:hover:bg-gray-100",
  outline:
    "border border-[#0f172a] text-[#0f172a] hover:bg-[#0f172a] hover:text-white dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-[#0f172a]",
  ghost:
    "text-[#0f172a] hover:bg-[#f1f5f9] dark:text-white dark:hover:bg-gray-800",
  danger:
    "bg-danger-500 text-white hover:bg-danger-600 active:bg-danger-700",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "py-[7px] px-[14px] text-[13px] md:text-[14px] rounded-[5px]",
  md: "py-[10.5px] md:py-[11.5px] px-[22px] md:px-[25px] text-[14px] md:text-base rounded-[7px]",
  lg: "py-[12px] md:py-[14px] px-[28px] md:px-[32px] text-base md:text-[18px] rounded-[8px]",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      icon,
      iconPosition = "left",
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-[8px] font-medium transition-all",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-[16px] w-[16px]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {!loading && icon && iconPosition === "left" && icon}
        {children}
        {!loading && icon && iconPosition === "right" && icon}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };
