"use client";

import { cn } from "@/lib/utils";

interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  rowActions?: (row: T) => React.ReactNode;
  emptyMessage?: string;
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  rowActions,
  emptyMessage = "No data available",
  striped = true,
  hoverable = true,
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-charcoal-light/40">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-border-subtle glass", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-charcoal-light/50",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
            {rowActions && (
              <th className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-charcoal-light/50 w-32">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {data.map((row, rowIndex) => (
            <tr
              key={keyExtractor(row)}
              className={cn(
                "transition-colors",
                striped && rowIndex % 2 === 1 && "bg-charcoal/[0.02]",
                hoverable && "hover:bg-charcoal/[0.03]"
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn("px-5 py-3.5 text-sm text-charcoal", col.className)}>
                  {col.render ? col.render(row, rowIndex) : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
              {rowActions && (
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">{rowActions(row)}</div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}