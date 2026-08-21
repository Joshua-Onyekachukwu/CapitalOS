import React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between mb-[25px] md:mb-[30px] flex-wrap gap-[15px]",
        className
      )}
    >
      <div>
        <h1 className="!text-xl md:!text-2xl !font-semibold !mb-[4px]">
          {title}
        </h1>
        {description && (
          <p className="text-[14px] md:text-[15px] text-gray-500 !mb-0">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-[10px] flex-wrap">{actions}</div>}
    </div>
  );
}

export { PageHeader };
