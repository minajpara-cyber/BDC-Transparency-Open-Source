import Link from "next/link";
import { type VintageExposureRow } from "@/data/vintage_exposure";
import { vintageCoverage } from "@/data/vintage_analysis";

export default function BDCVintageMix({ ticker, rows }: { ticker: string; rows: VintageExposureRow[] }) {
  if (!rows.length) return null;
  const latest = rows.reduce((date, r) => r.period_end > date ? r.period_end : date, "");
  const current = rows.filter((r) => r.period_end === latest);
  const coverage = vintageCoverage.find((r) => r.ticker === ticker);
  const total = current.reduce((sum, r) => sum + r.cost_b, 0);
  return (
    <section className="mt-8 rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <h2 className="text-lg font-semibold text-white">{ticker} holding acquisition mix</h2>
      <p className="text-xs text-gray-400 mt-2 mb-4">
        As of {latest}. Known positive funded-debt cost, ${total.toFixed(2)}B, grouped by this holder&apos;s disclosed acquisition year.
        Acquisition can reflect a security purchase or refinancing; it does not establish original loan origination. Unknown dates remain in the denominator.
      </p>
      {coverage && !coverage.cost_complete && <p className="text-xs text-amber-300 mb-4">Cost coverage is incomplete: {coverage.n_missing_cost_holdings.toLocaleString()} holding groups have missing cost. Shares use known positive cost only.</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-400"><tr><th className="p-2">Acquisition year</th><th className="p-2">Date evidence</th><th className="p-2">Cost ($B)</th><th className="p-2">Share of selected debt</th><th className="p-2">Positions</th></tr></thead>
          <tbody>{[...current].sort((a, b) => (b.vintage_year ?? -1) - (a.vintage_year ?? -1)).map((r, i) => (
            <tr key={`${r.vintage_year}-${r.date_status}-${i}`} className="border-t border-gray-800 text-gray-300">
              <td className="p-2 font-semibold text-white">{r.vintage_year ?? "Unknown"}</td>
              <td className="p-2 text-xs">{r.date_basis === "holder_acquisition" ? "Holder acquisition" : "Unknown"} · {r.date_status.replaceAll("_", " ")}</td>
              <td className="p-2 tabular-nums">{r.cost_b.toFixed(3)}</td><td className="p-2 tabular-nums">{r.pct_cost == null ? "Unknown" : `${r.pct_cost.toFixed(1)}%`}</td><td className="p-2">{r.n_positions.toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-4">This snapshot measures composition. Cohort observation bounds and coverage are available on the <Link href="/vintage" className="text-indigo-400 hover:underline">dated holding cohorts page</Link>.</p>
    </section>
  );
}
