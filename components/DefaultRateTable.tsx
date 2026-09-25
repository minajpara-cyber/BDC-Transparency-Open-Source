"use client";

// Latest trailing-twelve-month default rate per BDC, split into the events that
// make up the "shadow" rate: new non-accruals, restructurings, PIK amendments
// and distressed exits. Only fully observed windows show numbers; every other
// BDC is listed as withheld with the reason (lib/defaultRatePublication.ts).
import { useMemo, useState } from "react";
import Link from "next/link";
import type { DefaultRateRow } from "@/data/default_rate";
import { isFullyObserved, latestObservedWindowByTicker, withheldReason } from "@/lib/defaultRatePublication";
import CsvDownloadButton from "./CsvDownloadButton";

type Key = "ticker" | "default_rate" | "hard_rate" | "rate_non_accrual" | "rate_distressed_exit"
  | "rate_restructuring" | "rate_pik_amendment" | "count_rate" | "na_stock_pct";

const pct = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)}%`);

function heat(v: number | null | undefined, hi: number): string {
  if (v == null || !Number.isFinite(v)) return "transparent";
  const t = Math.max(0, Math.min(1, v / hi));
  return `rgba(239,68,68,${(0.05 + 0.35 * t).toFixed(2)})`;
}

// Column heading, a short basis tag shown under it, and the hover definition.
const HEAD: [Key, string, string, string][] = [
  ["ticker", "BDC", "", ""],
  ["default_rate", "Shadow rate", "", "hard rate plus loans kept accruing by changing their terms"],
  ["hard_rate", "Hard rate", "", "new non-accruals plus distressed exits"],
  ["rate_non_accrual", "New non-accrual", "observed", "the BDC flagged the loan non-accrual during the year"],
  ["rate_distressed_exit", "Distressed exit", "inferred from exit mark",
    "the loan left the book below 85¢, or after a mark below 80¢, without ever going non-accrual — a sale or write-off at a distressed price is inferred from the last mark, not from sale proceeds"],
  ["rate_restructuring", "Restructuring", "inferred from term changes",
    "principal cut at a stressed mark or for equity, debt swapped for equity, a lien downgrade, or a maturity extension on a loan marked below 90¢"],
  ["rate_pik_amendment", "PIK amendment", "inferred from term changes",
    "cash interest switched to PIK for at least a fifth of the coupon after two cash-pay quarters"],
  ["count_rate", "By borrower count", "", "shadow rate counting borrowers instead of dollars"],
  ["na_stock_pct", "NA stock now", "debt only",
    "debt on non-accrual at the end of the window, % of debt cost — a point-in-time stock, not a rate"],
];

export default function DefaultRateTable({ rows, history }: {
  /** Each BDC's latest window, whatever its status. */
  rows: DefaultRateRow[];
  /** All windows, used to point withheld BDCs at their last published window. */
  history: DefaultRateRow[];
}) {
  const [sortKey, setSortKey] = useState<Key>("default_rate");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const lastObserved = useMemo(() => latestObservedWindowByTicker(history), [history]);
  const published = useMemo(() => rows.filter(isFullyObserved), [rows]);
  const withheld = useMemo(
    () => rows.filter((r) => !isFullyObserved(r)).sort((a, b) => a.ticker.localeCompare(b.ticker)),
    [rows],
  );
  const latestPeriod = rows.reduce((m, r) => (r.period_end > m ? r.period_end : m), "");
  const sorted = useMemo(() => [...published].sort((a, b) => {
    if (sortKey === "ticker") return dir === "asc" ? a.ticker.localeCompare(b.ticker) : b.ticker.localeCompare(a.ticker);
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    return dir === "asc" ? av - bv : bv - av;
  }), [published, sortKey, dir]);
  const csvCols = ["ticker", "twelve_months_to", "status", "shadow_rate_pct", "hard_rate_pct", "new_non_accrual_pct",
    "distressed_exit_inferred_from_exit_mark_pct", "restructuring_inferred_from_term_changes_pct",
    "pik_amendment_inferred_from_term_changes_pct", "shadow_rate_by_count_pct", "non_accrual_stock_debt_pct",
    "defaulted_borrowers", "cohort_borrowers", "withheld_reason"];
  const csvRows = [...sorted, ...withheld].map((r) => {
    const ok = isFullyObserved(r);
    return [r.ticker, r.period_end, r.window_observation_status,
      ok ? r.default_rate : null, ok ? r.hard_rate : null, ok ? r.rate_non_accrual : null,
      ok ? r.rate_distressed_exit : null, ok ? r.rate_restructuring : null, ok ? r.rate_pik_amendment : null,
      ok ? r.count_rate : null, ok ? r.na_stock_pct : null, ok ? r.n_default : null, ok ? r.n_cohort : null,
      withheldReason(r.window_observation_status)];
  });

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b flex items-start justify-between gap-3 flex-wrap" style={{ borderColor: "#1e1e2e" }}>
        <div className="max-w-4xl">
          <h3 className="font-semibold text-white text-sm">Default rate by BDC, last twelve months</h3>
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            % of the debt that was performing a year ago. Each defaulted borrower is counted once, under its
            first event. <span className="text-white">Hard</span>{" "}= a new non-accrual (observed) or a distressed
            exit (inferred from the exit mark). <span className="text-white">Shadow</span>{" "}adds restructurings
            and PIK amendments, both inferred from term changes — loans kept accruing by changing their terms.
            Hover a column heading for its definition. A BDC is shown only when every loan&apos;s non-accrual
            status is known for the whole twelve months; the rest are listed under the table with the reason.
          </p>
        </div>
        <CsvDownloadButton filename="default-rate-ttm" columns={csvCols} rows={csvRows} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {HEAD.map(([k, label, basis, tip], i) => (
                <th key={k} title={tip || undefined}
                  onClick={() => { if (k === sortKey) setDir(dir === "asc" ? "desc" : "asc"); else { setSortKey(k); setDir(k === "ticker" ? "asc" : "desc"); } }}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none align-bottom ${i === 0 ? "text-left" : "text-right"}`}
                  style={{ color: sortKey === k ? "#a5b4fc" : "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>
                  {label} {sortKey === k ? (dir === "asc" ? "↑" : "↓") : ""}
                  {basis && (
                    <div className="text-[10px] font-normal normal-case tracking-normal" style={{ color: "#6b6b88" }}>{basis}</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap">
                  <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>{r.ticker}</Link>
                  {r.period_end !== latestPeriod && (
                    <span className="ml-1 text-[10px] font-normal" style={{ color: "#6b6b88" }}>to {r.period_end.slice(0, 7)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-white" style={{ background: heat(r.default_rate, 14) }}>{pct(r.default_rate)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ background: heat(r.hard_rate, 8), color: "#e5e7eb" }}>{pct(r.hard_rate)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{pct(r.rate_non_accrual)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{pct(r.rate_distressed_exit)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{pct(r.rate_restructuring)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{pct(r.rate_pik_amendment)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}
                  title={r.n_default != null && r.n_cohort != null ? `${r.n_default} of ${r.n_cohort} performing borrowers` : undefined}>{pct(r.count_rate, 1)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#6b6b88" }}>{pct(r.na_stock_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {withheld.length > 0 && (
        <div className="px-4 py-3 border-t text-xs space-y-1" style={{ borderColor: "#1e1e2e", color: "#8b8ba8" }}
          data-default-rate-withheld={withheld.map((r) => r.ticker).join(",")}>
          <div className="font-semibold text-white">Withheld ({withheld.length})</div>
          {withheld.map((r) => {
            const last = lastObserved.get(r.ticker);
            return (
              <div key={r.ticker}>
                <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="font-mono font-semibold hover:underline" style={{ color: "#a5b4fc" }}>{r.ticker}</Link>
                {" — "}{withheldReason(r.window_observation_status)} (twelve months to {r.period_end})
                {r.start_status_observation_coverage_pct != null && r.start_status_observation_coverage_pct < 100
                  ? `; non-accrual status known for ${r.start_status_observation_coverage_pct.toFixed(0)}% of the starting book` : ""}
                {last
                  ? `. Last fully observed window: twelve months to ${last.period_end}, shadow ${pct(last.default_rate, 1)}, hard ${pct(last.hard_rate, 1)}.`
                  : ". No fully observed window yet."}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
