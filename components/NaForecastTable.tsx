"use client";

import Link from "next/link";
import { bdcsHistory } from "@/data/bdcs_history";
import { latestNonAccrualSnapshots } from "@/lib/latestNonAccruals";
import CsvDownloadButton from "./CsvDownloadButton";

const rows = latestNonAccrualSnapshots(bdcsHistory);

export default function NaForecastTable() {
  const csvColumns = ["ticker", "reporting_date", "na_at_cost_pct", "status"];
  const csvRows = rows.map((r) => [
    r.ticker,
    r.period_end,
    r.na_pct_at_cost,
    r.na_pct_at_cost == null ? "unknown" : "available",
  ]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white">Latest non-accruals by BDC</h2>
            <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>
              Non-accruals at cost for each BDC&apos;s latest reporting date. Unknown means the
              current rate could not be established; it is not a zero or an earlier quarter&apos;s rate.
            </p>
          </div>
          <CsvDownloadButton filename="na-latest-snapshots" columns={csvColumns} rows={csvRows} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {["BDC", "Reporting date", "Non-accruals at cost"].map((c, i) => (
                <th key={c} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                  style={{ color: "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                <td className="px-3 py-2 font-mono font-semibold">
                  <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>
                    {r.ticker}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                  {r.period_end}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                  {r.na_pct_at_cost == null ? "Unknown" : `${r.na_pct_at_cost.toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
