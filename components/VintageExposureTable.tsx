"use client";

import Link from "next/link";
import { vintageExposure } from "@/data/vintage_exposure";
import { vintageCoverage } from "@/data/vintage_analysis";
import CsvDownloadButton from "./CsvDownloadButton";

export default function VintageExposureTable() {
  const years = Array.from(new Set(vintageExposure.flatMap((r) => r.vintage_year == null ? [] : [r.vintage_year]))).sort((a, b) => a - b);
  const tickers = Array.from(new Set(vintageExposure.map((r) => r.ticker))).sort((a, b) => a === "industry" ? 1 : b === "industry" ? -1 : a.localeCompare(b));
  const grouped = tickers.map((ticker) => {
    const rows = vintageExposure.filter((r) => r.ticker === ticker);
    const cells = new Map<number | null, number | null>();
    for (const r of rows) cells.set(r.vintage_year, r.pct_cost == null || cells.get(r.vintage_year) === null ? null : (cells.get(r.vintage_year) ?? 0) + r.pct_cost);
    const starts = rows.map((r) => r.period_end_min).filter((d): d is string => Boolean(d)).sort();
    const ends = rows.map((r) => r.period_end_max).filter((d): d is string => Boolean(d)).sort();
    const min = starts[0];
    const max = ends[ends.length - 1];
    return { ticker, cells, coverage: vintageCoverage.find((r) => r.ticker === ticker), cost: rows.reduce((sum, r) => sum + r.cost_b, 0), date: min && max ? min === max ? min : `${min} – ${max}` : "Unknown" };
  });
  const columns = [...years, null];
  return (
    <section className="rounded-xl border overflow-hidden mt-8" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="p-5 flex items-start justify-between gap-4">
        <div><h2 className="font-semibold text-white">Latest holding acquisition mix</h2>
          <p className="text-xs text-gray-400 mt-2 max-w-4xl">Share of known positive funded-debt cost by each holder&apos;s disclosed acquisition year. Unknown or conflicting dates remain in the Unknown column. This is a current composition snapshot, separate from the fully seasoned cohort population above. Issuer reporting dates may differ; the pooled row combines those dates. Acquisition year is not documented original loan origination.</p></div>
        <CsvDownloadButton filename="holding-acquisition-mix" columns={["ticker", "period_end", ...years.map(String), "unknown_date_pct", "selected_debt_cost_b"]}
          rows={grouped.map((r) => [r.ticker, r.date, ...columns.map((y) => r.cells.has(y) ? r.cells.get(y) : r.cost > 0 ? 0 : null), r.cost])} />
      </div>
      <div className="overflow-x-auto"><table className="w-full text-xs text-right">
        <thead className="text-gray-400"><tr><th className="p-3 text-left">Holder</th><th className="p-3 text-left">As of</th>{columns.map((year) => <th className="p-3" key={year ?? "unknown"}>{year ?? "Unknown"}</th>)}<th className="p-3 whitespace-nowrap">Cost ($B)</th></tr></thead>
        <tbody>{grouped.map((r) => <tr key={r.ticker} className="border-t border-gray-800 text-gray-300">
          <td className="p-3 text-left font-semibold text-indigo-300">{r.ticker === "industry" ? "Pooled holders" : <Link href={`/bdcs/${r.ticker.toLowerCase()}`}>{r.ticker}</Link>}</td><td className="p-3 text-left whitespace-nowrap">{r.date}{r.coverage && !r.coverage.cost_complete && <div className="text-amber-300 mt-1">{r.coverage.n_missing_cost_holdings} groups missing cost</div>}</td>
          {columns.map((year) => { const pct = r.cells.has(year) ? r.cells.get(year) : r.cost > 0 ? 0 : null; return <td key={year ?? "unknown"} className="p-3 tabular-nums" style={{ background: pct != null && pct > 0 ? `rgba(99,102,241,${0.06 + Math.min(pct / 100, 1) * 0.6})` : undefined }}>{pct == null ? "Unknown" : `${pct.toFixed(1)}%`}</td>; })}
          <td className="p-3 tabular-nums">{r.cost.toFixed(2)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="p-4 text-xs text-gray-500">Rows with a positive known denominator sum to approximately 100% after rounding. Missing amounts are excluded from percentage weights; known components remain included, with incomplete coverage shown. The denominator is known positive funded-debt cost, not the issuer&apos;s entire portfolio. Pooled exposure can include the same borrower or facility held by different BDCs.</p>
    </section>
  );
}
