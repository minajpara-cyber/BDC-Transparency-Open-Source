"use client";
import { useState, ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

interface SortableTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  emptyMessage?: string;
  stickyHeader?: boolean;
}

export default function SortableTable<T>({
  data,
  columns,
  onRowClick,
  rowKey,
  emptyMessage = "No data available",
  stickyHeader = false,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = [...data].sort((a, b) => {
    if (!sortKey) return 0;
    const aVal = (a as Record<string, unknown>)[sortKey];
    const bVal = (b as Record<string, unknown>)[sortKey];
    if (aVal === undefined || bVal === undefined) return 0;
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
    if (aStr > bStr) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "#1e1e2e" }}>
      <table className="w-full text-sm">
        <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.className ?? ""}`}
                style={{ color: "#8b8ba8" }}
              >
                {col.sortable !== false ? (
                  <button
                    className="flex items-center gap-1 hover:text-white transition-colors"
                    style={{ color: sortKey === String(col.key) ? "#a5b4fc" : "#8b8ba8", margin: col.align === "right" ? "0 0 0 auto" : undefined }}
                    onClick={() => handleSort(String(col.key))}
                  >
                    {col.label}
                    {sortKey === String(col.key) ? (
                      sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    ) : (
                      <ChevronUp size={12} className="opacity-20" />
                    )}
                  </button>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm"
                style={{ color: "#6b6b88" }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr
                key={rowKey(row)}
                className={`border-t transition-colors ${onRowClick ? "cursor-pointer" : ""}`}
                style={{
                  borderColor: "#1a1a28",
                  background: i % 2 === 0 ? "#111118" : "#0f0f16",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = "#1a1a28";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 0 ? "#111118" : "#0f0f16";
                }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.className ?? ""}`}
                    style={{ color: "#d1d5db" }}
                  >
                    {col.render
                      ? col.render(row)
                      : String((row as Record<string, unknown>)[String(col.key)] ?? "")}
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
