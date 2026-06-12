"use client";
import { useState, ReactNode, Fragment } from "react";
import { ChevronUp, ChevronDown, ChevronRight } from "lucide-react";

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
  /** Optional header content rendered above the table inside the same
   *  rounded wrapper. Use for descriptions, download buttons, etc. */
  headerSlot?: ReactNode;
  /** Initial sort column + direction. Falls back to unsorted (original order). */
  initialSort?: { key: string; dir?: "asc" | "desc" };
  /** Smaller padding + font for dense tables. */
  dense?: boolean;
  /** Returns expandable child rows for a row (e.g. the per-structure slices of
   *  a borrower consolidated across tranches). When provided, a narrow chevron
   *  column is added; rows with children toggle open on click. Children render
   *  directly beneath their parent in the order given — column sorting moves
   *  the parent and its children as one block. */
  getSubRows?: (row: T) => T[] | undefined;
}

export default function SortableTable<T>({
  data,
  columns,
  onRowClick,
  rowKey,
  emptyMessage = "No data available",
  stickyHeader = false,
  headerSlot,
  initialSort,
  dense = false,
  getSubRows,
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialSort?.dir ?? "asc");
  // Keys of rows whose children are shown. Keyed by rowKey so state survives
  // re-sorts and filter changes.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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

  const cellPx = dense ? "px-3 py-2" : "px-4 py-3";
  const textSize = dense ? "text-xs" : "text-sm";
  const hdrPx = dense ? "px-3 py-2.5" : "px-4 py-3";

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      {headerSlot && (
        <div className="border-b" style={{ borderColor: "#1e1e2e" }}>
          {headerSlot}
        </div>
      )}
      <div className="overflow-x-auto">
      <table className={`w-full ${textSize}`}>
        <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e", ...(stickyHeader ? { position: "sticky", top: 0, zIndex: 1 } : {}) }}>
          <tr>
            {getSubRows && <th className="w-7" aria-label="Expand" />}
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`${hdrPx} ${dense ? "text-[10px]" : "text-xs"} font-semibold uppercase tracking-wider whitespace-nowrap ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.className ?? ""}`}
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
                colSpan={columns.length + (getSubRows ? 1 : 0)}
                className="px-4 py-8 text-center text-sm"
                style={{ color: "#6b6b88" }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => {
              const key = rowKey(row);
              const kids = getSubRows?.(row) ?? [];
              const isOpen = kids.length > 0 && expanded.has(key);
              const baseBg = i % 2 === 0 ? "#111118" : "#0f0f16";
              return (
                <Fragment key={key}>
                  <tr
                    className={`border-t transition-colors ${onRowClick || kids.length > 0 ? "cursor-pointer" : ""}`}
                    style={{ borderColor: "#1a1a28", background: baseBg }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = "#1a1a28";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLTableRowElement).style.background = baseBg;
                    }}
                    onClick={(e) => {
                      if (onRowClick) {
                        onRowClick(row);
                        return;
                      }
                      // Whole row toggles the breakdown, but let links/buttons
                      // inside cells (borrower links, etc.) do their own thing.
                      if (kids.length === 0) return;
                      if ((e.target as HTMLElement).closest("a,button")) return;
                      toggleExpand(key);
                    }}
                  >
                    {getSubRows && (
                      <td className={`${dense ? "pl-2.5 pr-0 py-2" : "pl-3 pr-0 py-3"} align-middle`}>
                        {kids.length > 0 && (
                          <button
                            aria-expanded={isOpen}
                            aria-label={isOpen ? "Hide position breakdown" : "Show position breakdown"}
                            title={isOpen ? "Hide position breakdown" : "Show each position on its own"}
                            className="flex items-center justify-center rounded transition-colors hover:text-white"
                            style={{ color: isOpen ? "#a5b4fc" : "#6b6b88" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(key);
                            }}
                          >
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        )}
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={String(col.key)}
                        className={`${cellPx} ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.className ?? ""}`}
                        style={{ color: "#d1d5db" }}
                      >
                        {col.render
                          ? col.render(row)
                          : String((row as Record<string, unknown>)[String(col.key)] ?? "")}
                      </td>
                    ))}
                  </tr>
                  {isOpen &&
                    kids.map((kid) => (
                      <tr
                        key={rowKey(kid)}
                        className="border-t transition-colors"
                        style={{ borderColor: "#15151f", background: "#0c0c12" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background = "#15151f";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLTableRowElement).style.background = "#0c0c12";
                        }}
                      >
                        <td />
                        {columns.map((col) => (
                          <td
                            key={String(col.key)}
                            className={`${cellPx} ${col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"} ${col.className ?? ""}`}
                            style={{ color: "#d1d5db" }}
                          >
                            {col.render
                              ? col.render(kid)
                              : String((kid as Record<string, unknown>)[String(col.key)] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
