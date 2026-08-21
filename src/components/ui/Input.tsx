import React from "react";
import { cn } from "@/lib/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, iconPosition = "left", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[14px] md:text-[15px] font-medium text-[#06201b] dark:text-white mb-[8px]"
          >
            {label}
            {props.required && <span className="text-danger-500 ml-[2px]">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && iconPosition === "left" && (
            <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-gray-400">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full py-[10px] md:py-[12px] px-[14px] text-[14px] md:text-[15px] rounded-[8px] border transition-all",
              "bg-white dark:bg-dark text-[#06201b] dark:text-white",
              "placeholder:text-gray-400",
              "focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500",
              error
                ? "border-danger-500"
                : "border-gray-200 dark:border-gray-700",
              icon && iconPosition === "left" && "pl-[42px]",
              icon && iconPosition === "right" && "pr-[42px]",
              className
            )}
            {...props}
          />
          {icon && iconPosition === "right" && (
            <span className="absolute right-[14px] top-1/2 -translate-y-1/2 text-gray-400">
              {icon}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-[6px] text-[13px] text-danger-500">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-[6px] text-[13px] text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
export type { InputProps };
