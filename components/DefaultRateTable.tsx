"use client";

// Latest trailing-twelve-month default rate per BDC, split into the events that
// make up the "shadow" rate: new non-accruals, restructurings, PIK amendments
// and distressed exits.
import { useMemo, useState } from "react";
import Link from "next/link";
import type { DefaultRateRow } from "@/data/default_rate";
import CsvDownloadButton from "./CsvDownloadButton";

type Key = "ticker" | "default_rate" | "hard_rate" | "rate_non_accrual" | "rate_restructuring"
  | "rate_pik_amendment" | "rate_distressed_exit" | "count_rate" | "na_stock_pct";

const pct = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)}%`);

function heat(v: number | null | undefined, hi: number): string {
  if (v == null || !Number.isFinite(v)) return "transparent";
  const t = Math.max(0, Math.min(1, v / hi));
  return `rgba(239,68,68,${(0.05 + 0.35 * t).toFixed(2)})`;
}

export default function DefaultRateTable({ rows }: { rows: DefaultRateRow[] }) {
  const [sortKey, setSortKey] = useState<Key>("default_rate");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = a[sortKey] as number | string, bv = b[sortKey] as number | string;
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [rows, sortKey, dir]);
  const head: [Key, string][] = [
    ["ticker", "BDC"], ["default_rate", "Shadow rate"], ["hard_rate", "Hard rate"],
    ["rate_non_accrual", "New non-accrual"], ["rate_restructuring", "Restructuring"],
    ["rate_pik_amendment", "PIK amendment"], ["rate_distressed_exit", "Distressed exit"],
    ["count_rate", "By borrower count"], ["na_stock_pct", "NA stock now"],
  ];
  const csvCols = ["ticker", "twelve_months_to", "shadow_rate_pct", "hard_rate_pct", "new_non_accrual_pct",
    "restructuring_pct", "pik_amendment_pct", "distressed_exit_pct", "shadow_rate_by_count_pct",
    "non_accrual_stock_pct", "defaulted_borrowers", "cohort_borrowers", "partial"];
  const csvRows = sorted.map((r) => [r.ticker, r.period_end, r.default_rate, r.hard_rate, r.rate_non_accrual,
    r.rate_restructuring, r.rate_pik_amendment, r.rate_distressed_exit, r.count_rate, r.na_stock_pct,
    r.n_default, r.n_cohort, r.partial ? "yes" : ""]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b flex items-start justify-between gap-3 flex-wrap" style={{ borderColor: "#1e1e2e" }}>
        <div className="max-w-4xl">
          <h3 className="font-semibold text-white text-sm">Default rate by BDC, last twelve months</h3>
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            % of the debt that was performing a year ago. Each defaulted borrower is counted once, under its
            first event. <span className="text-white">Hard</span>{" "}= new non-accrual or a distressed exit.{" "}
            <span className="text-white">Shadow</span>{" "}adds material restructurings and PIK amendments —
            loans kept accruing by changing their terms.
          </p>
        </div>
        <CsvDownloadButton filename="default-rate-ttm" columns={csvCols} rows={csvRows} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {head.map(([k, label], i) => (
                <th key={k} onClick={() => { if (k === sortKey) setDir(dir === "asc" ? "desc" : "asc"); else { setSortKey(k); setDir(k === "ticker" ? "asc" : "desc"); } }}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none ${i === 0 ? "text-left" : "text-right"}`}
                  style={{ color: sortKey === k ? "#a5b4fc" : "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>
                  {label} {sortKey === k ? (dir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                <td className="px-3 py-2 font-mono font-semibold">
                  <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>{r.ticker}</Link>
                  {r.partial && (
                    <span className="ml-1 text-[10px]" style={{ color: "#6b6b88" }}
                      title="Discloses non-accruals only in aggregate — no non-accrual leg">partial</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-white" style={{ background: heat(r.default_rate, 14) }}>{pct(r.default_rate)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ background: heat(r.hard_rate, 8), color: "#e5e7eb" }}>{pct(r.hard_rate)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{r.partial ? "n/a" : pct(r.rate_non_accrual)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{pct(r.rate_restructuring)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{pct(r.rate_pik_amendment)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{pct(r.rate_distressed_exit)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}
                  title={`${r.n_default} of ${r.n_cohort} performing borrowers`}>{pct(r.count_rate, 1)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#6b6b88" }}>{r.partial ? "n/a" : pct(r.na_stock_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
