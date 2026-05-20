"use client";

import { Download } from "lucide-react";

interface Props {
  /** File name without extension. */
  filename: string;
  /** Header row. */
  columns: string[];
  /** Body rows. Each cell becomes one CSV column. null/undefined → empty. */
  rows: Array<Array<string | number | null | undefined>>;
  /** Optional override label (defaults to "CSV"). */
  label?: string;
}

function escapeCsvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(v) : v;
  // Quote if value contains comma, double-quote, or newline.
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function buildCsv(columns: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const headerLine = columns.map(escapeCsvCell).join(",");
  const bodyLines = rows.map((r) => r.map(escapeCsvCell).join(","));
  return [headerLine, ...bodyLines].join("\n");
}

export default function CsvDownloadButton({ filename, columns, rows, label = "CSV" }: Props) {
  const handleClick = () => {
    const csv = buildCsv(columns, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border hover:text-white transition-colors"
      style={{
        color: "#9ca3af",
        background: "rgba(99,102,241,0.06)",
        borderColor: "#2d2d50",
      }}
      title={`Download ${filename}.csv`}
    >
      <Download size={12} />
      {label}
    </button>
  );
}
