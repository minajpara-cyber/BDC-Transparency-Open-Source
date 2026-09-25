"use client";

// Where each BDC's PIK income went: the PIK booked since the window start,
// split by what happened to the loans it accrued on — collected as principal
// on exit (estimate), still in the book (observed: accruing, cured to
// cash-pay, relabelled onto another equity line, impaired, or PIK status
// unknown), or lost (estimated from the last mark before exit).
import { useMemo, useState } from "react";
import Link from "next/link";
import type { PikLedgerRow } from "@/data/pik_ledger";
import CsvDownloadButton from "./CsvDownloadButton";

type Key = "ticker" | "pik_accrued_m" | "pik_pct_nii_window" | "collected_pct" | "still_pik_pct" | "cured_pct"
  | "refinanced_pct" | "relabelled_pct" | "in_book_impaired_pct" | "in_book_unknown_pct" | "lost_pct" | "unresolved_pct_book"
  | "unresolved_x_nii" | "pik_window_observation_coverage_pct";

const pct = (v: number | null | undefined, d = 0) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)}%`);
const green = (v: number | null, hi: number) =>
  v == null ? "transparent" : `rgba(34,197,94,${(0.04 + 0.3 * Math.min(1, v / hi)).toFixed(2)})`;
const red = (v: number | null, hi: number) =>
  v == null ? "transparent" : `rgba(239,68,68,${(0.04 + 0.34 * Math.min(1, v / hi)).toFixed(2)})`;

export default function PikLedgerTable({ rows }: { rows: PikLedgerRow[] }) {
  const [sortKey, setSortKey] = useState<Key>("pik_accrued_m");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = a[sortKey] as number | string | null, bv = b[sortKey] as number | string | null;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [rows, sortKey, dir]);

  const head: [Key, string, string][] = [
    ["ticker", "BDC", ""],
    ["pik_accrued_m", "PIK booked ($m)", "PIK allocated to each loan from its disclosed PIK rate × principal since the window start; scaled to the cash-flow statement's PIK in quarters where at least 97% of the book's cost has a known PIK status and rate"],
    ["pik_pct_nii_window", "% of NII", "PIK income as a share of NII over the window"],
    ["collected_pct", "Collected (est.)", "estimate: loans that left the book at 97¢ or better, or were refinanced at par at the same BDC, plus the recovered part of loans exited below par"],
    ["refinanced_pct", "of which refinanced", "included in Collected: loans that left at par while the borrower kept a position at the same BDC — the old loan was repaid from the new facility"],
    ["still_pik_pct", "Still PIK", "observed: loans still on the book and still accruing PIK"],
    ["cured_pct", "Cured", "observed: loans back on cash-pay; the PIK already capitalized is still owed as principal"],
    ["relabelled_pct", "Relabelled", "observed: PIK equity whose cost moved onto another equity line at the same borrower (for example preferred restated as an LP interest) — still in the book, not collected"],
    ["in_book_impaired_pct", "Impaired", "observed: loans on non-accrual or marked under 80¢, and restructurings at the same BDC"],
    ["in_book_unknown_pct", "Status unknown", "still on the book, but the latest schedule does not show whether the loan pays PIK"],
    ["lost_pct", "Lost (est.)", "estimated from the last mark: the part of exits below par not recovered"],
    ["unresolved_pct_book", "Uncollected, % of book", "PIK not yet collected or lost, as a share of the portfolio at cost"],
    ["unresolved_x_nii", "Uncollected ÷ NII", "years of the current NII run-rate sitting in uncollected PIK"],
    ["pik_window_observation_coverage_pct", "PIK status observed", "share of the book's cost over the window whose PIK status is shown in the filings; unknown cost is left out of the dollars"],
  ];
  const csvCols = ["ticker", "as_of", "window_start", "pik_booked_m", "pik_pct_nii_window", "collected_estimate_pct",
    "still_pik_pct", "cured_pct", "relabelled_pct", "refinanced_pct", "impaired_pct", "status_unknown_pct", "lost_estimate_pct",
    "collected_at_par_pct", "collected_below_par_pct", "distressed_exit_pct", "restructured_same_bdc_pct",
    "uncollected_m", "uncollected_pct_book", "uncollected_x_nii", "collected_last4q_estimate_m",
    "reported_collected_last4q_m", "loan_level_coverage_of_statement", "statement_scaled", "pik_dollars_basis", "statement_basis",
    "pik_status_observed_window_pct", "n_loans"];
  const csvRows = sorted.map((r) => [r.ticker, r.period_end, r.window_start, r.pik_accrued_m, r.pik_pct_nii_window,
    r.collected_pct, r.still_pik_pct, r.cured_pct, r.relabelled_pct, r.refinanced_pct, r.in_book_impaired_pct, r.in_book_unknown_pct,
    r.lost_pct, r.collected_par_pct, r.collected_discount_pct, r.distressed_exit_pct, r.restructured_pct,
    r.unresolved_m, r.unresolved_pct_book, r.unresolved_x_nii, r.collected_last4q_m, r.reported_collected_last4q_m,
    r.loan_coverage_of_statement, r.statement_scaling_eligible ? "yes" : "no", r.pik_dollars_basis, r.statement_basis,
    r.pik_window_observation_coverage_pct, r.n_tranches]);

  // Where a BDC reports its PIK collected in cash, set our estimate beside it.
  const calibration = rows
    .filter((r) => r.reported_collected_last4q_m != null && r.reported_collected_last4q_m > 0)
    .map((r) => `${r.ticker} $${r.collected_last4q_m.toFixed(0)}m estimated vs $${r.reported_collected_last4q_m!.toFixed(0)}m reported over the last four quarters`);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b flex items-start justify-between gap-3 flex-wrap" style={{ borderColor: "#1e1e2e" }}>
        <div className="max-w-4xl">
          <h3 className="font-semibold text-white text-sm">Where the PIK went, by BDC</h3>
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            The PIK income each BDC has booked since{" "}
            {rows.reduce((m, r) => (r.window_start < m ? r.window_start : m), rows[0]?.window_start ?? "2016").slice(0, 4)}
            {" "}(or its first filing), followed loan by loan to today. Hover a column heading for its definition; hover a BDC for its loan count
            and how well its loan-level PIK rates tie to the statement.
          </p>
        </div>
        <CsvDownloadButton filename="pik-ledger" columns={csvCols} rows={csvRows} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {head.map(([k, label, tip], i) => (
                <th key={k} title={tip}
                  onClick={() => { if (k === sortKey) setDir(dir === "asc" ? "desc" : "asc"); else { setSortKey(k); setDir(k === "ticker" ? "asc" : "desc"); } }}
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
                <td className="px-3 py-2 font-mono font-semibold whitespace-nowrap"
                  title={`${r.n_tranches} PIK loans since ${r.window_start}` +
                    (r.loan_coverage_of_statement != null
                      ? `\nloan-level PIK rates imply ${(100 * r.loan_coverage_of_statement).toFixed(0)}% of the statement PIK` : "") +
                    (r.reported_collected_last4q_m != null
                      ? `\nreports PIK collected in cash: $${r.reported_collected_last4q_m.toFixed(0)}m over the last four quarters (our estimate: $${r.collected_last4q_m.toFixed(0)}m)` : "") +
                    (r.pik_dollars_basis === "statement_scaled"
                      ? `\nscaled to the cash-flow statement in ${r.statement_scaled_quarters} of ${r.window_quarters} quarters (${r.statement_scaled_pct_of_accrued == null ? "—" : `${r.statement_scaled_pct_of_accrued.toFixed(0)}%`} of these PIK dollars)`
                      : "\nloan-level PIK rate × principal (not matched to the statement)") +
                    (r.statement_basis && r.statement_basis !== "gross" ? `\nstatement basis: ${r.statement_basis.replace(/_/g, " ")}` : "")}>
                  <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>{r.ticker}</Link>
                  {r.statement_basis && r.statement_basis !== "gross" && (
                    <span className="ml-1 text-[10px]" style={{ color: "#6b6b88" }}>†</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-white">{r.pik_accrued_m.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: (r.pik_pct_nii_window ?? 0) >= 20 ? "#fcd34d" : "#d1d5db" }}>{pct(r.pik_pct_nii_window)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-white" style={{ background: green(r.collected_pct, 60) }}>{pct(r.collected_pct)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#6b6b88" }}>{pct(r.refinanced_pct)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#d1d5db" }}>{pct(r.still_pik_pct)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{pct(r.cured_pct)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: (r.relabelled_pct ?? 0) > 0 ? "#9ca3af" : "#6b6b88" }}>{pct(r.relabelled_pct)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ background: red(r.in_book_impaired_pct, 30), color: "#e5e7eb" }}>{pct(r.in_book_impaired_pct)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: (r.in_book_unknown_pct ?? 0) > 0 ? "#9ca3af" : "#6b6b88" }}>{pct(r.in_book_unknown_pct)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ background: red(r.lost_pct, 15), color: "#e5e7eb" }}>{pct(r.lost_pct)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: (r.unresolved_pct_book ?? 0) >= 5 ? "#fcd34d" : "#d1d5db" }}>{pct(r.unresolved_pct_book, 1)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: (r.unresolved_x_nii ?? 0) >= 1 ? "#fcd34d" : "#d1d5db" }}>
                  {r.unresolved_x_nii == null ? "—" : `${r.unresolved_x_nii.toFixed(1)}y`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: (r.pik_window_observation_coverage_pct ?? 100) < 97 ? "#fcd34d" : "#6b6b88" }}>
                  {pct(r.pik_window_observation_coverage_pct, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t text-xs" style={{ borderColor: "#1e1e2e", color: "#6b6b88" }}>
        Collected + still PIK + cured + relabelled + impaired + status unknown + lost = 100% of the PIK booked;
        &quot;of which refinanced&quot; is the part of Collected that was rolled into a new loan at the same BDC. Still
        PIK, cured, relabelled and impaired are what the latest schedule shows; relabelled is PIK equity whose cost
        moved onto another equity line at the same borrower, so it is still owed. Collected and lost are estimates from how each loan left
        the book: collected counts loans that exited at 97¢ or better or were refinanced at par, and lost is taken
        from the last reported mark, not from sale proceeds. PIK paid in cash while a loan stays on the book is
        not visible in the schedule
        {calibration.length > 0
          ? `, so check the estimate against the BDCs that report their PIK collections: ${calibration.join("; ")}`
          : ""}. † NMFC prints only a broader non-cash income line (PIK plus accretion), so its loan-level dollars are
        used as they are; OCSL prints PIK net of cash collected, which understates gross PIK.
      </div>
    </div>
  );
}
