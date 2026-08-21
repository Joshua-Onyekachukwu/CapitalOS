import React from "react";
import { cn } from "@/lib/utils";

type AvatarSize = "sm" | "md" | "lg";

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  showOnline?: boolean;
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: "w-[32px] h-[32px] text-[12px]",
  md: "w-[42px] h-[42px] text-[14px]",
  lg: "w-[56px] h-[56px] text-[18px]",
};

const onlineSizes: Record<AvatarSize, string> = {
  sm: "w-[8px] h-[8px] border",
  md: "w-[10px] h-[10px] border-2",
  lg: "w-[12px] h-[12px] border-2",
};

function getInitials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getColorFromName(name?: string): string {
  if (!name) return "bg-gray-300";
  const colors = [
    "bg-primary-500",
    "bg-secondary-500",
    "bg-success-500",
    "bg-warning-500",
    "bg-danger-500",
    "bg-primary-600",
    "bg-info-500",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  name,
  size = "md",
  showOnline,
  className,
  ...props
}) => {
  return (
    <div className={cn("relative inline-flex", className)} {...props}>
      {src ? (
        <img
          src={src}
          alt={alt || name || "Avatar"}
          className={cn(
            "rounded-full object-cover",
            sizeStyles[size]
          )}
        />
      ) : (
        <div
          className={cn(
            "rounded-full flex items-center justify-center font-medium text-white",
            getColorFromName(name),
            sizeStyles[size]
          )}
        >
          {getInitials(name)}
        </div>
      )}
      {showOnline && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full bg-success-500 border-white dark:border-dark",
            onlineSizes[size]
          )}
        />
      )}
    </div>
  );
};

export { Avatar };
export type { AvatarProps, AvatarSize };
