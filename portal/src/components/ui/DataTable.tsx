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
      <div className="text-center py-12 text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border border-gray-200", className)}>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "px-4 py-3 text-left font-semibold text-gray-900 border-b border-gray-200",
                  col.className
                )}
              >
                {col.header}
              </th>
            ))}
            {rowActions && (
              <th className="px-4 py-3 text-left font-semibold text-gray-900 border-b border-gray-200 w-32">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((row, rowIndex) => (
            <tr
              key={keyExtractor(row)}
              className={cn(
                "transition-colors",
                striped && rowIndex % 2 === 1 && "bg-gray-50",
                hoverable && "hover:bg-gray-50"
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn("px-4 py-3 text-gray-700", col.className)}>
                  {col.render ? col.render(row, rowIndex) : String((row as Record<string, unknown>)[col.key] ?? "")}
                </td>
              ))}
              {rowActions && (
                <td className="px-4 py-3">
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