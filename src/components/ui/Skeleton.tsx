import React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[8px] bg-gray-200 dark:bg-gray-800",
        className
      )}
      {...props}
    />
  );
};

const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className,
}) => {
  return (
    <div className={cn("space-y-[10px]", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-[14px]",
            i === lines - 1 ? "w-[60%]" : "w-full"
          )}
        />
      ))}
    </div>
  );
};

const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        "rounded-[16px] md:rounded-[20px] border border-gray-200 dark:border-gray-800 p-[20px] md:p-[24px]",
        className
      )}
    >
      <Skeleton className="h-[20px] w-[40%] mb-[16px]" />
      <SkeletonText lines={2} />
      <div className="mt-[20px] flex gap-[8px]">
        <Skeleton className="h-[32px] w-[80px] rounded-full" />
        <Skeleton className="h-[32px] w-[80px] rounded-full" />
      </div>
    </div>
  );
};

const SkeletonTable: React.FC<{ rows?: number; className?: string }> = ({
  rows = 5,
  className,
}) => {
  return (
    <div className={cn("space-y-[12px]", className)}>
      <Skeleton className="h-[40px] w-full rounded-[8px]" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-[48px] w-full rounded-[8px]" />
      ))}
    </div>
  );
};

const SkeletonAvatar: React.FC<{ size?: "sm" | "md" | "lg"; className?: string }> = ({
  size = "md",
  className,
}) => {
  const sizes = { sm: "w-[32px] h-[32px]", md: "w-[42px] h-[42px]", lg: "w-[56px] h-[56px]" };
  return <Skeleton className={cn("rounded-full", sizes[size], className)} />;
};

export { Skeleton, SkeletonText, SkeletonCard, SkeletonTable, SkeletonAvatar };
