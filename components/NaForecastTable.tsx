"use client";

// Forward non-accrual view. The headline is EXPECTED NEW NON-ACCRUAL FORMATION
// OVER FOUR QUARTERS, not next quarter's rate: the signals predict defaults, and
// defaults take time to arrive. Forecast-to-outcome correlation runs +0.09 at one
// quarter against +0.47 at four, so the longer horizon is the honest one.
import { useMemo, useState } from "react";
import Link from "next/link";
import { naForecast, naFcMeta } from "@/data/na_forecast";
import CsvDownloadButton from "./CsvDownloadButton";

function bandColor(v: number | null): string {
  if (v == null) return "transparent";
  if (v >= 3) return "rgba(239,68,68,0.22)";
  if (v >= 1.5) return "rgba(245,158,11,0.18)";
  if (v >= 0.75) return "rgba(234,179,8,0.12)";
  return "rgba(34,197,94,0.10)";
}

export default function NaForecastTable() {
  const [showRate, setShowRate] = useState(false);

  const rows = useMemo(
    () => [...naForecast].sort((a, b) => (b.form_4q ?? -1) - (a.form_4q ?? -1)),
    [],
  );
  const fm = naFcMeta.formation as {
    n: number; horizon_q: number; mean_abs: number; corr: number; bias: number;
    actual_mean: number;
    quartiles: readonly { q: number; pred: number; actual: number; n: number }[];
  } | undefined;
  const dir = naFcMeta.direction as { auc: number; top_decile_hit: number; base_rate: number } | undefined;

  const csvColumns = ["ticker", "base_quarter", "na_now_pct", "expected_new_na_4q_pct",
    "band_lo_pct", "band_hi_pct", "trailing_4q_actual_pct", "xholder_na_pct",
    "marked_below_90_pct", "rate_next_q_pct", "p_rise_next_q"];
  const csvRows = rows.map((r) => [
    r.ticker, r.period_end, r.na_now.toFixed(2), r.form_4q?.toFixed(2) ?? "",
    r.form_lo?.toFixed(2) ?? "", r.form_hi?.toFixed(2) ?? "",
    r.form_trailing?.toFixed(2) ?? "", r.xh_pp?.toFixed(2) ?? "",
    r.b90_pp?.toFixed(2) ?? "", r.na_q1.toFixed(2), r.p_rise?.toFixed(3) ?? "",
  ]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Forward non-accruals — expected new defaults over the next year
            </h2>
            <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>
              For each BDC, the share of today&apos;s cost expected to go{" "}
              <span className="text-white">newly</span> non-accrual over the next four quarters —
              scoring every performing borrower on mark, PIK, modification, cross-holder and loan-age
              signals, aggregating cost-weighted, then blending with the BDC&apos;s own trailing year
              and calibrating. This is a{" "}
              <span className="text-white">ranking tool</span>: sorted into quartiles, realised
              formation runs{" "}
              {fm ? fm.quartiles.map((q) => `${q.actual.toFixed(2)}%`).join(" / ") : "—"} from lowest
              to highest predicted — a{" "}
              {fm && fm.quartiles.length >= 4
                ? `${(fm.quartiles[3].actual / Math.max(fm.quartiles[0].actual, 0.01)).toFixed(1)}x`
                : ""}{" "}
              spread. It is not precise for any single BDC; the band says how imprecise.
            </p>
          </div>
          <CsvDownloadButton filename="na-forward-4q" columns={csvColumns} rows={csvRows} />
        </div>
        <button
          onClick={() => setShowRate(!showRate)}
          className="text-xs mt-3 px-2.5 py-1 rounded border transition-all"
          style={{
            background: showRate ? "rgba(99,102,241,0.15)" : "transparent",
            borderColor: showRate ? "#6366f1" : "#2d2d45",
            color: showRate ? "#a5b4fc" : "#9ca3af",
          }}
        >
          {showRate ? "Hide" : "Show"} next-quarter rate columns
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {["BDC", "NA now", "Expected new NA · next 4Q", "80% range", "Trailing 4Q actual",
                "X-holder NA", "Marked <90¢",
                ...(showRate ? [`Rate ${rows[0]?.q1_label ?? ""}`, "P(rise ≥0.5pp)"] : [])]
                .map((c, i) => (
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
                  style={{ background: bandColor(r.form_4q) }}>
                  {r.form_4q == null ? "—" : `${r.form_4q.toFixed(2)}%`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-xs" style={{ color: "#6b6b88" }}>
                  {r.form_lo == null ? "—" : `${r.form_lo.toFixed(2)} – ${r.form_hi?.toFixed(2)}`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#6b6b88" }}>
                  {r.form_trailing == null ? "—" : `${r.form_trailing.toFixed(2)}%`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums"
                  style={{ color: (r.xh_pp ?? 0) >= 2 ? "#ef4444" : (r.xh_pp ?? 0) >= 0.5 ? "#f59e0b" : "#6b6b88" }}
                  title="Share of cost in borrowers already on non-accrual at ANOTHER BDC — the single strongest signal we hold.">
                  {r.xh_pp == null ? "—" : `${r.xh_pp.toFixed(2)}%`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: (r.b90_pp ?? 0) >= 15 ? "#f59e0b" : "#6b6b88" }}>
                  {r.b90_pp == null ? "—" : `${r.b90_pp.toFixed(1)}%`}
                </td>
                {showRate && (
                  <>
                    <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                      {r.na_q1.toFixed(2)}%
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold"
                      style={{ color: (r.p_rise ?? 0) >= 0.4 ? "#ef4444" : (r.p_rise ?? 0) >= 0.25 ? "#f59e0b" : "#8b8ba8" }}>
                      {r.p_rise == null ? "—" : `${(100 * r.p_rise).toFixed(0)}%`}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fm && (
        <div className="px-4 py-3 border-t" style={{ borderColor: "#1e1e2e" }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8b8ba8" }}>
            Does it work? — {fm.n} BDC-quarters, walk-forward
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs" style={{ minWidth: 380 }}>
              <thead>
                <tr style={{ color: "#6b6b88" }}>
                  <th className="text-left pr-4 pb-1 font-medium">Predicted quartile</th>
                  {fm.quartiles.map((q) => (
                    <th key={q.q} className="text-right px-3 pb-1 font-medium">Q{q.q}{q.q === 1 ? " (low)" : q.q === 4 ? " (high)" : ""}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-4 py-0.5" style={{ color: "#8b8ba8" }}>Forecast</td>
                  {fm.quartiles.map((q) => (
                    <td key={q.q} className="text-right px-3 py-0.5 tabular-nums" style={{ color: "#8b8ba8" }}>{q.pred.toFixed(2)}%</td>
                  ))}
                </tr>
                <tr>
                  <td className="pr-4 py-0.5 text-white">Actually happened</td>
                  {fm.quartiles.map((q) => (
                    <td key={q.q} className="text-right px-3 py-0.5 tabular-nums font-semibold text-white">{q.actual.toFixed(2)}%</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
            The ranking is the robust part — correlation of forecast to outcome{" "}
            <span className="text-white">{fm.corr >= 0 ? "+" : ""}{fm.corr.toFixed(2)}</span>, against
            roughly +0.09 for the same build at a one-quarter horizon. Mean absolute error is{" "}
            {fm.mean_abs.toFixed(2)}pp on an average outcome of {fm.actual_mean.toFixed(2)}%, so read
            the quartile a BDC sits in, not the decimal. The band is the empirical 10th–90th percentile
            of walk-forward errors and is deliberately asymmetric: a bad year is far worse than a good
            year is good.
          </p>
          <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
            <span className="text-white">What drives it.</span> Twelve borrower-level signals, fitted
            cost-weighted. The lifts alone are misleading — what matters is lift × how much cost the
            signal covers. Being non-accrual at another BDC is the sharpest signal we have (31.6%
            convert, 41× the base rate) but touches only 0.2% of cost, so it barely moves a portfolio
            total. Most of the work is done by the broad middle: cash→PIK flips (6.3% of cost, 4.6×),
            par haircuts (12.0%, 2.5×), any modification (16.6%, 2.4×), loans aged 4–5 years (11.6%,
            3.4×) and equity/warrant paper (7.7%, 2.0×). Two signals earn their place despite tiny
            coverage because they are so sharp: cross-holder non-accrual, and a borrower that has been
            on non-accrual at <span className="text-white">this</span> BDC before (21× lift).
          </p>
          <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
            <span className="text-white">What we tested and threw away</span>, since the misses are as
            informative as the hits. Maturity proximity is the instructive one: loans maturing in 1–2
            years default at 3.3× the base rate, but adding it makes the portfolio forecast{" "}
            <span className="text-white">worse</span> — a real borrower-level signal that does not
            survive aggregation. Also discarded: cross-holder intensity and interaction terms,
            quarter-over-quarter mark drop, syndication breadth, second-lien and subordinated flags,
            position size, spread cuts, maturity extensions, and the HY OAS credit cycle (inverted —
            wide-spread quarters were followed by lower formation, not higher). Coupon and PIK share
            parse on only 8% and 7% of positions, too sparse to use.
            {dir ? ` The optional next-quarter columns are far weaker (AUC ${dir.auc.toFixed(2)}); they are kept for continuity, not confidence.` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
