import React from "react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  rowKey?: (item: T) => string;
}

function Table<T extends Record<string, unknown>>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No data available",
  className,
  rowKey,
}: TableProps<T>) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-[16px] py-[12px] text-[12px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500",
                  col.headerClassName
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-[16px] py-[40px] text-center text-[14px] text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item, index) => (
              <tr
                key={rowKey ? rowKey(item) : index}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  "border-b border-gray-50 dark:border-gray-800/50 last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-[16px] py-[14px] text-[14px] text-gray-600 dark:text-gray-400",
                      col.className
                    )}
                  >
                    {col.render ? col.render(item) : String(item[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export { Table };
export type { Column, TableProps };
