import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-[40px] md:py-[60px] px-[20px] text-center",
        className
      )}
    >
      {icon && (
        <div className="w-[60px] h-[60px] rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-300 dark:text-gray-600 text-[28px] mb-[20px]">
          {icon}
        </div>
      )}
      <h3 className="!text-lg md:!text-xl !font-semibold !mb-[8px] text-[#06201b] dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="text-[14px] md:text-[14px] text-gray-500 max-w-[360px] !mb-0">
          {description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-[20px]">
          {action.label}
        </Button>
      )}
    </div>
  );
};

export { EmptyState };
export type { EmptyStateProps };
