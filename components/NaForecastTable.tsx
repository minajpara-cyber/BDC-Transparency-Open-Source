"use client";

// Forward non-accrual rate per BDC. Deliberately shows the CURRENT rate beside
// the forecast: the honest headline is "persistence, adjusted", and hiding the
// starting point would dress that up as more than it is.
import { useMemo, useState } from "react";
import Link from "next/link";
import { naForecast, naFcMeta } from "@/data/na_forecast";
import CsvDownloadButton from "./CsvDownloadButton";

type Horizon = 1 | 2;

function deltaColor(d: number): string {
  if (d > 0.25) return "#ef4444";
  if (d > 0.05) return "#f59e0b";
  if (d < -0.25) return "#22c55e";
  if (d < -0.05) return "#84cc16";
  return "#8b8ba8";
}

function levelColor(v: number): string {
  if (v >= 5) return "rgba(239,68,68,0.20)";
  if (v >= 3) return "rgba(245,158,11,0.18)";
  if (v >= 1.5) return "rgba(234,179,8,0.12)";
  return "rgba(34,197,94,0.10)";
}

export default function NaForecastTable() {
  const [h, setH] = useState<Horizon>(1);

  const rows = useMemo(() => {
    return [...naForecast]
      .map((r) => {
        const fc = h === 1 ? r.na_q1 : r.na_q2;
        const lo = h === 1 ? r.lo_q1 : r.lo_q2;
        const hi = h === 1 ? r.hi_q1 : r.hi_q2;
        const label = h === 1 ? r.q1_label : r.q2_label;
        return { ...r, fc, lo, hi, label, delta: fc - r.na_now };
      })
      .sort((a, b) => b.fc - a.fc);
  }, [h]);

  const label = rows[0]?.label ?? "";
  const stats = (naFcMeta.horizons as Record<string, {
    n: number; mean_abs: number; median_abs: number; p90_abs: number;
    naive_mean_abs: number; naive_median_abs: number; naive_p90_abs: number;
  }>)[String(h)];

  const csvColumns = ["ticker", "base_quarter", "na_now_pct", "forecast_quarter",
    "forecast_pct", "band_lo_pct", "band_hi_pct", "own_8q_mean_pct", "watchlist_high_pct"];
  const csvRows = rows.map((r) => [
    r.ticker, r.period_end, r.na_now.toFixed(2), r.label,
    r.fc.toFixed(2), r.lo.toFixed(2), r.hi.toFixed(2),
    r.na_mean8.toFixed(2), r.wl_high_pct.toFixed(2),
  ]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white">Forward non-accrual rate by BDC</h2>
            <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>
              Where each BDC&apos;s non-accrual rate (% of amortized cost) is headed, from its current
              level, its own 8-quarter average, and the share of its book sitting in the watchlist&apos;s
              High tier. The band is the empirical 10th–90th percentile of this model&apos;s own
              walk-forward errors — calibrated on how wrong it has actually been.
            </p>
          </div>
          <CsvDownloadButton filename={`na-forecast-${h}q`} columns={csvColumns} rows={csvRows} />
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-xs">
          <span className="uppercase tracking-wider mr-1" style={{ color: "#6b6b88" }}>Horizon</span>
          {([1, 2] as Horizon[]).map((x) => (
            <button
              key={x}
              onClick={() => setH(x)}
              className="px-2.5 py-1 rounded border transition-all"
              style={{
                background: h === x ? "rgba(99,102,241,0.15)" : "transparent",
                borderColor: h === x ? "#6366f1" : "#2d2d45",
                color: h === x ? "#a5b4fc" : "#9ca3af",
              }}
            >
              {x === 1 ? "Next quarter" : "Two quarters out"}
            </button>
          ))}
          <span style={{ color: "#6b6b88" }} className="ml-1">→ {label}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {["BDC", "Now", `Forecast ${label}`, "80% range", "Change", "Own 8q avg", "WL High"].map((c, i) => (
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
                  {r.na_now.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-white"
                  style={{ background: levelColor(r.fc) }}>
                  {r.fc.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs" style={{ color: "#6b6b88" }}>
                  {r.lo.toFixed(2)} – {r.hi.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: deltaColor(r.delta) }}>
                  {r.delta > 0 ? "▲" : r.delta < 0 ? "▼" : "–"} {Math.abs(r.delta).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#6b6b88" }}>
                  {r.na_mean8.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: r.wl_high_pct >= 1 ? "#f59e0b" : "#6b6b88" }}>
                  {r.has_watchlist ? `${r.wl_high_pct.toFixed(2)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {stats && (
        <p className="text-xs px-4 py-3" style={{ color: "#6b6b88" }}>
          <span className="text-white">How good is this?</span> Walk-forward over {stats.n} BDC-quarters
          since {naFcMeta.backtest_from}, against simply carrying the current rate forward: mean error{" "}
          <span className="text-white">{stats.mean_abs.toFixed(2)}pp</span> vs {stats.naive_mean_abs.toFixed(2)},
          and at the 90th percentile <span className="text-white">{stats.p90_abs.toFixed(2)}pp</span> vs{" "}
          {stats.naive_p90_abs.toFixed(2)} — the tail is where it earns its keep. On the{" "}
          <span className="text-white">median</span> quarter plain persistence is still slightly better
          ({stats.naive_median_abs.toFixed(2)}pp vs {stats.median_abs.toFixed(2)}), because most quarters
          barely move. Non-accrual rates are stubbornly persistent — this quarter&apos;s rate correlates
          0.77 with next quarter&apos;s, and nothing we hold correlates better than 0.12 with the change.
          Treat it as persistence adjusted for mean reversion and watchlist inflow, not as a call.
        </p>
      )}
    </div>
  );
}
