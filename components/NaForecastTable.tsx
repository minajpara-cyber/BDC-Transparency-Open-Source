"use client";

// Forward non-accrual view. The headline is EXPECTED NEW NON-ACCRUAL FORMATION
// OVER FOUR QUARTERS, not next quarter's rate: the signals predict defaults, and
// defaults take time to arrive. Every BDC with non-accrual data is listed;
// thinly observed inputs earn a "lower confidence" label rather than a blank.
import { useState } from "react";
import Link from "next/link";
import { bdcsHistory } from "@/data/bdcs_history";
import { naForecast } from "@/data/na_forecast";
import { latestNonAccrualSnapshots } from "@/lib/latestNonAccruals";
import {
  confidenceLabel,
  coverageFloorPct,
  floorText,
  coverageText,
  directionMeta,
  fmtPct,
  forecastConfidence,
  formationMeta,
  modelSignalLabels,
  nextQuarterMeta,
  notModelledReason,
  projectionValue,
  readQuartiles,
  sortForecastRows,
} from "@/lib/naForecastDisplay";
import CsvDownloadButton from "./CsvDownloadButton";

const snapshotsByTicker = new Map(
  latestNonAccrualSnapshots(bdcsHistory).map((row) => [row.ticker, row]),
);
const rows = sortForecastRows(naForecast);

function bandColor(v: number | null): string {
  if (v == null) return "transparent";
  if (v >= 3) return "rgba(239,68,68,0.22)";
  if (v >= 1.5) return "rgba(245,158,11,0.18)";
  if (v >= 0.75) return "rgba(234,179,8,0.12)";
  return "rgba(34,197,94,0.10)";
}

function snapshotBasisLabel(status: string | undefined, basis: string | undefined): string | null {
  if (status === "disclosed_aggregate") {
    return basis === "issuer_reported_investments_excluding_cash"
      ? "Issuer disclosure · excludes cash"
      : "Issuer aggregate disclosure";
  }
  if (status === "withheld_reconciliation") return "Reconciliation pending";
  return null;
}

const CONFIDENCE_STYLE = {
  standard: { background: "rgba(34,197,94,0.10)", color: "#86efac" },
  lower: { background: "rgba(245,158,11,0.10)", color: "#fbbf24" },
  none: { background: "rgba(107,114,128,0.12)", color: "#9ca3af" },
} as const;

export default function NaForecastTable() {
  const [showRate, setShowRate] = useState(false);

  const counts = { standard: 0, lower: 0, none: 0 };
  for (const row of rows) counts[forecastConfidence(row)] += 1;
  const lowerWithoutNumber = rows
    .filter((row) => forecastConfidence(row) === "lower" && projectionValue(row) == null)
    .map((row) => row.ticker);
  const fm = formationMeta;
  const quartiles = fm.quartiles ?? [];
  const reading = readQuartiles(quartiles);
  const embargoQ = fm.observability?.training_embargo_quarters ?? fm.horizon_q ?? null;
  const signals = modelSignalLabels(fm.observability?.model_features);
  const q1Label = rows.find((row) => row.q1_label)?.q1_label ?? "next quarter";

  const csvColumns = [
    "ticker",
    "reporting_date",
    "na_at_cost_pct",
    "current_na_publication_status",
    "current_na_basis",
    "current_na_publication_reason",
    "base_quarter",
    "expected_new_na_4q_pct",
    "band_lo_pct",
    "band_hi_pct",
    "trailing_4q_actual_pct",
    "xholder_na_pct",
    "marked_below_90_pct",
    "rate_next_q_pct",
    "p_rise_next_q",
    "form_feature_coverage_pct",
    "form_observation_status",
    "confidence",
  ];
  const csvRows = rows.map((row) => {
    const snapshot = snapshotsByTicker.get(row.ticker);
    const value = projectionValue(row);
    return [
      row.ticker,
      snapshot?.period_end ?? row.period_end,
      snapshot?.na_pct_at_cost ?? null,
      snapshot?.na_publication_status ?? "unknown",
      snapshot?.na_basis ?? "unknown",
      snapshot?.na_publication_reason ?? "",
      row.period_end,
      value,
      value == null ? null : row.form_lo,
      value == null ? null : row.form_hi,
      row.form_trailing,
      row.xh_pp,
      row.b90_pp,
      row.na_q1,
      row.p_rise,
      row.form_feature_coverage_pct,
      row.form_observation_status,
      confidenceLabel(row),
    ];
  });

  return (
    <div
      id="gated-na-projections"
      className="rounded-xl border overflow-hidden scroll-mt-6"
      style={{ background: "#111118", borderColor: "#1e1e2e" }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Forward non-accruals — expected new defaults over the next year
            </h2>
            <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>
              For each BDC, the share of today&apos;s performing loans (at cost) we expect to{" "}
              <span className="text-white">newly</span>{" "}go on non-accrual over the next four quarters.
              Every performing borrower is scored on warning signs — its mark, PIK, loan changes,
              trouble at other lenders and loan age — the scores are added up by cost, and the total
              is calibrated against each BDC&apos;s recent history. Use it to rank BDCs, not as a
              precise number for any one of them; the 80% range shows how imprecise it is.
            </p>
            <p className="text-xs mt-2 max-w-4xl" style={{ color: "#6b6b88" }}>
              {counts.standard} BDCs have standard-confidence projections.{" "}
              {counts.lower > 0 && (
                <>
                  {counts.lower} are <span style={{ color: "#fbbf24" }}>lower confidence</span> because
                  {coverageFloorPct != null
                    ? ` less than ${floorText()} of their model inputs (weighted by cost) could be observed`
                    : " fewer of their model inputs could be observed"}
                  {lowerWithoutNumber.length > 0
                    ? ` (this data release has no number yet for ${lowerWithoutNumber.join(", ")})`
                    : ""}
                  .{" "}
                </>
              )}
              {counts.none > 0 && `${counts.none} cannot be modelled; the table says why.`}
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
                "X-holder NA", "Marked <90¢", "Confidence",
                ...(showRate ? [`Rate ${q1Label}`, "P(rise ≥0.5pp)"] : [])]
                .map((c, i) => (
                  <th key={c} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                    style={{ color: "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>
                    {c}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const snapshot = snapshotsByTicker.get(row.ticker);
              const confidence = forecastConfidence(row);
              const value = projectionValue(row);
              const basisLabel = snapshotBasisLabel(snapshot?.na_publication_status, snapshot?.na_basis);
              const coverage = coverageText(row);
              return (
                <tr
                  key={row.ticker}
                  data-forecast-status={row.form_observation_status}
                  data-forecast-confidence={confidence}
                  data-projection-published={value != null ? "true" : "false"}
                  style={{ background: i % 2 === 0 ? "#111118" : "#0f0f16" }}
                >
                  <td className="px-3 py-2 font-mono font-semibold">
                    <Link href={`/bdcs/${row.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>
                      {row.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                    <div>{fmtPct(snapshot?.na_pct_at_cost)}</div>
                    {basisLabel && (
                      <div className="text-[10px] mt-0.5 whitespace-nowrap" style={{ color: "#6b6b88" }}>
                        {basisLabel}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold"
                    style={{ background: bandColor(value), color: confidence === "standard" ? "#fafafa" : "#d1d5db" }}>
                    {fmtPct(value)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs" style={{ color: "#6b6b88" }}>
                    {value == null || row.form_lo == null || row.form_hi == null
                      ? "—"
                      : `${row.form_lo.toFixed(2)} – ${row.form_hi.toFixed(2)}`}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#6b6b88" }}>
                    {fmtPct(row.form_trailing)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums"
                    style={{ color: row.xh_pp == null ? "#6b6b88" : row.xh_pp >= 2 ? "#ef4444" : row.xh_pp >= 0.5 ? "#f59e0b" : "#6b6b88" }}
                    title="Share of this BDC's cost in borrowers already on non-accrual at another BDC.">
                    {fmtPct(row.xh_pp)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums"
                    style={{ color: row.b90_pp != null && row.b90_pp >= 15 ? "#f59e0b" : "#6b6b88" }}>
                    {fmtPct(row.b90_pp, 1)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <span className="inline-block rounded px-2 py-1 whitespace-nowrap" style={CONFIDENCE_STYLE[confidence]}>
                      {confidenceLabel(row)}
                    </span>
                    <div className="text-[10px] mt-1" style={{ color: "#6b6b88" }}>
                      {confidence === "none" ? notModelledReason(row) : coverage ?? "Input coverage unknown"}
                    </div>
                  </td>
                  {showRate && (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                        {fmtPct(row.na_q1)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold"
                        style={{ color: row.p_rise == null ? "#8b8ba8" : row.p_rise >= 0.4 ? "#ef4444" : row.p_rise >= 0.25 ? "#f59e0b" : "#8b8ba8" }}>
                        {row.p_rise == null ? "—" : `${(100 * row.p_rise).toFixed(0)}%`}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t" style={{ borderColor: "#1e1e2e" }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8b8ba8" }}>
          How well has it worked?{fm.n != null ? ` — ${fm.n} BDC-quarters, tested without look-ahead` : ""}
        </div>
        {quartiles.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="text-xs" style={{ minWidth: 380 }} data-validation-sample={fm.n ?? ""}>
              <thead>
                <tr style={{ color: "#6b6b88" }}>
                  <th className="text-left pr-4 pb-1 font-medium">Forecast bucket</th>
                  {quartiles.map((q) => (
                    <th key={q.q} className="text-right px-3 pb-1 font-medium">
                      Q{q.q}{q.q === 1 ? " (low)" : q.q === quartiles.length ? " (high)" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="pr-4 py-0.5" style={{ color: "#8b8ba8" }}>Forecast</td>
                  {quartiles.map((q) => (
                    <td key={q.q} className="text-right px-3 py-0.5 tabular-nums" style={{ color: "#8b8ba8" }}>{fmtPct(q.pred)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="pr-4 py-0.5 text-white">Actually happened</td>
                  {quartiles.map((q) => (
                    <td key={q.q} className="text-right px-3 py-0.5 tabular-nums font-semibold text-white">{fmtPct(q.actual)}</td>
                  ))}
                </tr>
                <tr>
                  <td className="pr-4 py-0.5" style={{ color: "#6b6b88" }}>BDC-quarters</td>
                  {quartiles.map((q) => (
                    <td key={q.q} className="text-right px-3 py-0.5 tabular-nums" style={{ color: "#6b6b88" }}>{q.n}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs" style={{ color: "#6b6b88" }}>No back-test results are in this data release.</p>
        )}
        <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
          <span className="text-white">The test.</span> We re-ran the model at past quarter-ends and compared
          each forecast with what then happened. Each past forecast was fitted only on loans whose
          {embargoQ != null ? ` ${embargoQ}-quarter` : ""}{" "}outcome was already known on that date, so the
          test has no look-ahead (the outcome window is embargoed). Loans whose later status is unknown are left
          out of the scoring rather than counted as &ldquo;no default&rdquo;.
          {fm.n != null && ` That strictness leaves a small sample — ${fm.n} BDC-quarters — so read these results as indicative.`}
        </p>
        {reading.lowest && reading.highest && (
          <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
            <span className="text-white">What it shows.</span>{" "}
            {reading.ordered
              ? `Realised formation rose with each step up in forecast, from ${fmtPct(reading.lowest.actual)} in the lowest bucket to ${fmtPct(reading.highest.actual)} in the highest`
              : `The highest-forecast bucket saw ${fmtPct(reading.highest.actual)} against ${fmtPct(reading.lowest.actual)} in the lowest, but the buckets in between are out of order`}
            {reading.spread != null ? ` (${reading.spread.toFixed(1)}× from lowest to highest)` : ""}.
            {!reading.ordered && " Treat the ranking as rough until the sample grows."}
            {fm.corr != null && ` Correlation of forecast with outcome: ${fm.corr >= 0 ? "+" : ""}${fm.corr.toFixed(2)}.`}
            {fm.mean_abs != null && fm.actual_mean != null &&
              ` The average miss is ${fm.mean_abs.toFixed(2)}pp on an average outcome of ${fmtPct(fm.actual_mean)}, so read which bucket a BDC sits in, not the decimal.`}
            {fm.n != null && ` The 80% range is the 10th–90th percentile of these same ${fm.n} misses; it is lopsided because a bad year can miss by far more than a good one.`}
          </p>
        )}
        {(nextQuarterMeta?.mean_abs != null || directionMeta?.auc != null) && (
          <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
            <span className="text-white">Next-quarter columns.</span> These come from a simpler model of the
            non-accrual rate itself.
            {nextQuarterMeta?.mean_abs != null && nextQuarterMeta.naive_mean_abs != null &&
              ` Its average miss is ${nextQuarterMeta.mean_abs.toFixed(2)}pp against ${nextQuarterMeta.naive_mean_abs.toFixed(2)}pp for simply carrying today's rate forward${nextQuarterMeta.n != null ? ` (${nextQuarterMeta.n} BDC-quarters)` : ""}.`}
            {directionMeta?.auc != null &&
              ` P(rise) is only a weak guide to direction (AUC ${directionMeta.auc.toFixed(2)}, where 0.5 is a coin toss); it is kept for continuity, not confidence.`}
          </p>
        )}
        {signals.length > 0 && (
          <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
            <span className="text-white">What drives it.</span> Borrower-level signals, each weighted by
            cost: {signals.join("; ")}. When a signal can&apos;t be observed for a loan, the model records
            that it is missing instead of assuming &ldquo;no&rdquo;; the confidence column shows how much of
            each BDC&apos;s book had its inputs observed. A borrower counts as performing only if we can see it
            is accruing today.
          </p>
        )}
        <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
          <span className="text-white">What we tested and dropped</span>, because the misses are as
          informative as the hits: loans maturing within 1–2 years (a real warning sign for a single
          borrower that made the BDC-level forecast worse), a separate flag for marks below 80¢ (deeply
          marked loans are more often restructured or sold than put on non-accrual), how many lenders
          report a borrower on non-accrual, quarter-over-quarter mark drops, how widely a loan is shared,
          second-lien and subordinated flags, position size, spread cuts, maturity extensions, and the
          high-yield credit spread.
        </p>
        <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
          <span className="text-white">Corrected September 2026.</span>{" "}The back-test now waits for
          outcomes to be known before using a loan for training — earlier versions did not, which made
          the track record look better than it was. Unknown non-accrual status is no longer counted as
          &ldquo;performing&rdquo;. Borrowers are tracked as the same company even when the name in the
          filing changes at the moment of default.
        </p>
      </div>
    </div>
  );
}
