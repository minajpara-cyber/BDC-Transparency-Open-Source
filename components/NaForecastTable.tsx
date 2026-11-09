"use client";

// Forward non-accrual view. The headline is EXPECTED NEW NON-ACCRUAL FORMATION
// OVER FOUR QUARTERS, not next quarter's rate: the signals predict defaults, and
// defaults take time to arrive. Every BDC with non-accrual data is listed;
// thinly observed inputs earn a "lower confidence" label rather than a blank.
import React, { useState } from "react";
import Link from "next/link";
import { bdcsHistory } from "@/data/bdcs_history";
import { naForecast, naForecastNames } from "@/data/na_forecast";
import { latestNonAccrualSnapshots } from "@/lib/latestNonAccruals";
import {
  backtestCount,
  backtestText,
  biasText,
  calibrationRows,
  confidenceLabel,
  coverageFloorPct,
  floorText,
  coverageText,
  directionMeta,
  fmtPct,
  forecastConfidence,
  formationMeta,
  labelBasisText,
  levelText,
  lowerConfidenceReason,
  notBacktested,
  testedTailText,
  whyThisOneText,
  modelSignalLabels,
  nameChance,
  nextQuarterMeta,
  nextQuarterSettingsInSample,
  notModelledReason,
  outcomeInText,
  projectionValue,
  rangeText,
  readQuartiles,
  riseRankText,
  riseRecordText,
  riseTiersText,
  signalsReadPct,
  simulatedRangeText,
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

const namesByTicker = new Map<string, typeof naForecastNames>();
for (const name of naForecastNames) {
  namesByTicker.set(name.ticker, [...(namesByTicker.get(name.ticker) ?? []), name]);
}

export default function NaForecastTable() {
  const [showRate, setShowRate] = useState(false);
  const [openNames, setOpenNames] = useState<string | null>(null);

  const counts = { standard: 0, lower: 0, none: 0 };
  for (const row of rows) counts[forecastConfidence(row)] += 1;
  const lowerWithoutNumber = rows
    .filter((row) => forecastConfidence(row) === "lower" && projectionValue(row) == null)
    .map((row) => row.ticker);
  // lower confidence because the back-test never scored the BDC (inputs are fine)
  const untested = rows
    .filter((row) => forecastConfidence(row) === "lower" && notBacktested(row)
      && lowerConfidenceReason(row)?.startsWith("the back-test"))
    .map((row) => row.ticker);
  const lowerForInputs = counts.lower - untested.length;
  const fm = formationMeta;
  const quartiles = fm.quartiles ?? [];
  const reading = readQuartiles(quartiles);
  const embargoQ = fm.observability?.training_embargo_quarters ?? fm.horizon_q ?? null;
  const signals = modelSignalLabels(fm.observability?.model_features);
  const relative = fm.calibration?.kind === "relative" || fm.calibration?.kind === "odds_level";
  const level = levelText(fm);
  const band = simulatedRangeText(fm);
  const testedTail = testedTailText(rows);
  const whyThisOne = whyThisOneText(fm);
  const labels = labelBasisText(fm);
  const options = calibrationRows(fm);
  const shippedOption = options.find((option) => option.shipped);
  const realisedNow = fm.calibration_comparison?.realised;
  const realisedFewer = realisedNow?.latest_period ? outcomeInText(fm, realisedNow.latest_period) : null;
  const bias = biasText(fm);
  const riseTiers = riseTiersText(directionMeta);
  const nextQuarterRange = nextQuarterMeta?.range_coverage;
  const nextQuarterPit = nextQuarterMeta?.point_in_time?.mean_abs;
  const brier = directionMeta?.brier;

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
    // the direction as the table shows it: a rank and its tier's record, not the score's own percentage
    "rise_rank",
    "rise_rank_of",
    "rise_tier",
    "rise_tier_rose",
    "rise_tier_n",
    // "% of signals read", as the confidence column prints it
    "signals_read_pct",
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
      row.rise_rank,
      row.rise_rank_of,
      row.rise_tier,
      row.rise_tier_rose,
      row.rise_tier_n,
      signalsReadPct(row),
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
              For each BDC, the share of today&apos;s performing book (at cost) we expect to{" "}
              <span className="text-white">newly</span>{" "}go on non-accrual over the next four quarters.
              Every performing borrower gets a chance of going on non-accrual within a year, from the same model
              as the <a href="#signal-backtest" className="text-indigo-400 hover:text-indigo-300">watchlist</a>, and those
              chances are added up by cost.{" "}
              {level ?? "The total is then calibrated against what actually happened."}{" "}
              Use it to rank BDCs, not as a precise number for any one of them; the 80% range shows
              how imprecise it is. Click a BDC&apos;s &ldquo;names&rdquo; to see the borrowers behind its number.
            </p>
            <p className="text-xs mt-2 max-w-4xl" style={{ color: "#6b6b88" }}>
              {counts.standard} BDCs have standard-confidence projections.{" "}
              {lowerForInputs > 0 && (
                <>
                  {lowerForInputs} {lowerForInputs === 1 ? "is" : "are"} <span style={{ color: "#fbbf24" }}>lower confidence</span>{" "}because
                  {coverageFloorPct != null
                    ? ` less than ${floorText()} of the model's signals (weighted by cost) could be read`
                    : " fewer of the model's signals could be read"}
                  {lowerWithoutNumber.length > 0
                    ? ` (this data release has no number yet for ${lowerWithoutNumber.join(", ")})`
                    : ""}
                  .{" "}
                </>
              )}
              {untested.length > 0 && (
                <>
                  {untested.join(", ")} {untested.length === 1 ? "is" : "are"} <span style={{ color: "#fbbf24" }}>lower confidence</span>{" "}because
                  the back-test never scored {untested.length === 1 ? "it" : "them"} (past outcomes could not all be observed), so no track record stands behind the number.{" "}
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
          {showRate ? "Hide" : "Show"}{" "}next-quarter rate columns
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {["BDC", "NA now", "Expected new NA · next 4Q", "80% range", "Trailing 4Q actual",
                "X-holder NA", "Performing loans <90¢ of par", "Confidence",
                ...(showRate ? ["Rate next quarter", "Rank for a rise ≥0.5pp"] : [])]
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
                <React.Fragment key={row.ticker}>
                <tr
                  data-forecast-status={row.form_observation_status}
                  data-forecast-confidence={confidence}
                  data-projection-published={value != null ? "true" : "false"}
                  style={{ background: i % 2 === 0 ? "#111118" : "#0f0f16" }}
                >
                  <td className="px-3 py-2 font-mono font-semibold">
                    <Link href={`/bdcs/${row.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>
                      {row.ticker}
                    </Link>
                    {namesByTicker.has(row.ticker) && (
                      <button onClick={() => setOpenNames(openNames === row.ticker ? null : row.ticker)}
                        aria-expanded={openNames === row.ticker}
                        className="ml-2 text-[10px] font-normal hover:underline" style={{ color: "#8b8ba8" }}>
                        {openNames === row.ticker ? "hide names" : "names"}
                      </button>
                    )}
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
                    {rangeText(row, value, formationMeta, " – ") ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#6b6b88" }}>
                    {fmtPct(row.form_trailing)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums"
                    style={{ color: row.xh_pp == null ? "#6b6b88" : row.xh_pp >= 2 ? "#ef4444" : row.xh_pp >= 0.5 ? "#f59e0b" : "#6b6b88" }}
                    title="Share of this BDC's performing book (at cost) in its own loans on the same lien as, or junior to, a loan another BDC has on non-accrual. A preferred share or other equity on non-accrual does not count; a BDC that has not filed this quarter yet counts at its last filing.">
                    {fmtPct(row.xh_pp)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums"
                    style={{ color: row.b90_pp != null && row.b90_pp >= 15 ? "#f59e0b" : "#6b6b88" }}
                    title="Share of the loan cost of performing borrowers (nothing on non-accrual here) whose loans, taken together, are marked below 90¢ per dollar of par. The mark is fair value ÷ par; at a BDC whose schedule nets the undrawn discount into a facility's fair value, a loan with an undrawn commitment is priced on its whole commitment. Borrowers with no usable par, and equity, are left out.">
                    {fmtPct(row.b90_pp, 1)}
                  </td>
                  <td className="px-3 py-2 text-right text-xs">
                    <span className="inline-block rounded px-2 py-1 whitespace-nowrap" style={CONFIDENCE_STYLE[confidence]}>
                      {confidenceLabel(row)}
                    </span>
                    <div className="text-[10px] mt-1" style={{ color: "#6b6b88" }}>
                      {confidence === "none" ? notModelledReason(row) : coverage ?? "Input coverage unknown"}
                    </div>
                    {confidence !== "none" && backtestText(row, formationMeta) && (
                      <div className="text-[10px] mt-0.5 whitespace-nowrap" style={{ color: "#6b6b88" }} data-backtest-n={backtestCount(row) ?? ""}>
                        {backtestText(row, formationMeta)}
                      </div>
                    )}
                  </td>
                  {showRate && (
                    <>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                        <div>{fmtPct(row.na_q1)}</div>
                        {row.na_q1 != null && row.q1_label && (
                          <div className="text-[10px] mt-0.5 whitespace-nowrap" style={{ color: "#6b6b88" }}>
                            {row.q1_label}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold"
                        style={{ color: row.rise_tier == null ? "#8b8ba8" : row.rise_tier === "top" ? "#ef4444" : row.rise_tier === "2-5" ? "#f59e0b" : "#8b8ba8" }}>
                        <div>{riseRankText(row) ?? "—"}</div>
                        {riseRecordText(row) && (
                          <div className="text-[10px] font-normal mt-0.5 whitespace-nowrap" style={{ color: "#6b6b88" }}>
                            {riseRecordText(row)}
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
                {openNames === row.ticker && (
                  <tr data-forecast-names={row.ticker} style={{ background: "#0d0d14" }}>
                    <td colSpan={showRate ? 10 : 8} className="px-4 py-3">
                      <div className="text-xs mb-1.5" style={{ color: "#8b8ba8" }}>
                        The largest expected new non-accruals behind {row.ticker}&apos;s {fmtPct(value)}: cost × chance, as a share of its forecast.
                      </div>
                      <table className="text-xs">
                        <thead>
                          <tr style={{ color: "#6b6b88" }}>
                            {["Borrower", "Chance ≤1yr", "Cost", "Expected", "Share of forecast"].map((h, k) => (
                              <th key={h} className={`font-medium pb-1 ${k === 0 ? "text-left pr-6" : "text-right px-3"}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(namesByTicker.get(row.ticker) ?? []).map((n) => (
                            <tr key={`${n.name}-${n.cost_m}`} style={{ color: "#c7c7e0" }}>
                              <td className="pr-6 py-0.5">
                                {n.slug
                                  ? <Link href={`/borrowers/${n.slug}`} className="text-indigo-300 hover:text-indigo-200">{n.name}</Link>
                                  : n.name}
                              </td>
                              <td className="text-right px-3 py-0.5 tabular-nums">{nameChance(n)}%</td>
                              <td className="text-right px-3 py-0.5 tabular-nums">${n.cost_m.toFixed(0)}M</td>
                              <td className="text-right px-3 py-0.5 tabular-nums">${n.expected_m.toFixed(0)}M</td>
                              <td className="text-right px-3 py-0.5 tabular-nums">{n.share_of_forecast_pct == null ? "—" : `${n.share_of_forecast_pct.toFixed(0)}%`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t" style={{ borderColor: "#1e1e2e" }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8b8ba8" }}>
          How well has it worked?{fm.n != null ? ` — ${fm.n} BDC-quarters, each forecast made only from outcomes known at the time` : ""}
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
          <span className="text-white">The test.</span>{" "}We re-ran the model at past quarter-ends and compared
          each forecast with what then happened. Each past forecast was fitted only on loans whose
          {embargoQ != null ? ` ${embargoQ}-quarter` : ""}{" "}outcome was already known on that date, so the
          test has no look-ahead on outcomes (the outcome window is embargoed), though the model&apos;s settings were chosen on
          this same window and a loan&apos;s age is dated from all of its filings, later ones included. Borrowers
          whose later status is unknown are left out of the scoring rather than counted as &ldquo;no default&rdquo;, except
          that a single unread quarter between two quarters read as performing counts as performing.
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
            {band && ` ${band}`}
          </p>
        )}
        {bias && (
          <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
            <span className="text-white">Why it runs low.</span>{" "}
            {bias}
            {(fm.bias ?? 0) < 0
              ? relative
                ? " The level of each forecast is the realised rate of the latest year whose outcomes are known — the only year a forecast can learn from — and new non-accruals rose over the test, so the forecast trailed them."
                : " Each forecast can only learn from outcomes that are already known — a year old — and new non-accruals rose over the test, so the forecast trailed them."
              : " Each forecast can only learn from outcomes that are already known — a year old — so it trails turns in the cycle."}
            {testedTail ? ` ${testedTail}` : ""}
          </p>
        )}
        {options.length > 1 && shippedOption && (
          <div className="mt-3">
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#8b8ba8" }}>
              How the last step was chosen
            </div>
            <p className="text-xs mb-2" style={{ color: "#6b6b88" }}>
              The model&apos;s raw scores have to be turned into an expected rate. We tried {options.length}{" "}ways of
              doing that on the same back-test, each refitted at every past quarter on outcomes already known
              then (settings picked on the first half of the test, {shippedOption.candidate.early?.from?.slice(0, 7)} to{" "}
              {shippedOption.candidate.early?.to?.slice(0, 7)}, and checked on the second). The fifth column is
              the average each would publish today
              {realisedNow?.latest_mean != null
                ? `, against ${fmtPct(realisedNow.latest_mean)} of new non-accruals in the latest year with known outcomes (forecasts made ${realisedNow.latest_period?.slice(0, 7)}${realisedFewer ? `, ${realisedFewer}` : ""})`
                : ""}; the last counts the BDCs it would put above the highest forecast its own back-test scored.
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs" style={{ minWidth: 560 }} data-calibration-options={options.length}>
                <thead>
                  <tr style={{ color: "#6b6b88" }}>
                    {["Method", "Average miss", "Average signed miss", "Rank correlation", "Average projection today", "Above tested range"]
                      .map((c, i) => (
                        <th key={c} className={`${i === 0 ? "text-left pr-4" : "text-right px-3"} pb-1 font-medium`}>{c}</th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {options.map(({ key, name, shipped, candidate }) => (
                    <tr key={key} data-calibration-option={key} style={{ color: shipped ? "#fafafa" : "#8b8ba8" }}>
                      <td className="pr-4 py-0.5">{name}{shipped ? " — used" : ""}</td>
                      <td className="text-right px-3 py-0.5 tabular-nums">{candidate.mean_abs != null ? `${candidate.mean_abs.toFixed(2)}pp` : "—"}</td>
                      <td className="text-right px-3 py-0.5 tabular-nums">{candidate.bias != null ? `${candidate.bias >= 0 ? "+" : ""}${candidate.bias.toFixed(2)}pp` : "—"}</td>
                      <td className="text-right px-3 py-0.5 tabular-nums">{candidate.rank_corr != null ? candidate.rank_corr.toFixed(2) : "—"}</td>
                      <td className="text-right px-3 py-0.5 tabular-nums">{fmtPct(candidate.published_mean)}</td>
                      <td className="text-right px-3 py-0.5 tabular-nums">{candidate.published_above_tested ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {relative && (
              <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
                <span className="text-white">Why this one.</span>{" "}The model&apos;s chances tell BDCs apart well, but
                their average across all BDCs has not tracked how many new non-accruals followed, so a method that
                lets a rise in every BDC&apos;s chance carry the level up can publish far above anything that has
                happened. The order and proportions come from the model; the level comes from realised history, moved
                together so that no BDC is pushed to zero and a BDC&apos;s names still add up to its number.
                {whyThisOne ? ` ${whyThisOne}` : ""}
              </p>
            )}
          </div>
        )}
        {labels && (
          <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
            <span className="text-white">What counts as new.</span>{" "}{labels}
          </p>
        )}
        {(nextQuarterMeta?.mean_abs != null || directionMeta?.auc != null) && (
          <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
            <span className="text-white">Next-quarter columns.</span>{" "}The rate comes from a simpler model of the
            non-accrual rate itself, for each BDC&apos;s own next quarter.
            {nextQuarterMeta?.mean_abs != null && nextQuarterMeta.naive_mean_abs != null &&
              ` Its average miss is ${nextQuarterMeta.mean_abs.toFixed(2)}pp against ${nextQuarterMeta.naive_mean_abs.toFixed(2)}pp for simply carrying today's rate forward${nextQuarterMeta.n != null ? ` (${nextQuarterMeta.n} BDC-quarters)` : ""}${nextQuarterSettingsInSample && nextQuarterPit != null ? `, but its two settings were picked on those same quarters; re-picked each quarter from earlier outcomes only, it misses by ${nextQuarterPit.toFixed(2)}pp` : ""}.`}
            {nextQuarterRange?.inside != null &&
              ` Its 80% range, shown on each BDC's page, held ${Math.round(100 * nextQuarterRange.inside)}% of outcomes when rebuilt at each past quarter from the misses known then${nextQuarterRange.n != null ? ` (${nextQuarterRange.n} BDC-quarters)` : ""}.`}
            {directionMeta?.auc != null &&
              ` The rank orders the BDCs by a separate score for the rate rising ${directionMeta.threshold_pp ?? 0.5}pp or more next quarter, a weak guide (AUC ${directionMeta.auc.toFixed(2)}, where 0.5 is a coin toss).`}
            {riseTiers && ` Beside each rank is how often BDCs at that rank rose in the back-test: ${riseTiers}.`}
            {brier?.rank_tier_record != null && brier.score != null && brier.rank_tier_record < brier.score &&
              " The score's own percentage is not shown: as a forecast of a rise, that record did better."}
          </p>
        )}
        {signals.length > 0 && (
          <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
            <span className="text-white">What drives it.</span>{" "}Borrower-level signals, each weighted by
            cost: {signals.join("; ")}.{" "}When a signal can&apos;t be observed for a loan, the model records
            that it is missing instead of assuming &ldquo;no&rdquo;; the confidence column shows how much of
            each BDC&apos;s book, by cost, had the model&apos;s inputs read: the mark, spread, maturity and age of its loans,
            non-accrual at another BDC or here before, and PIK history (the lower of that and the same share for the last
            three alone). A borrower counts as performing only if we can see
            {fm.observability?.label_basis === "debt" ? " that all its funded loans are accruing today." : " it is accruing today."}
          </p>
        )}
        <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
          <span className="text-white">What we tested and dropped</span>, because the misses are as
          informative as the hits: amend-and-extends, spread cuts, stressed cuts to the loan amount, lien downgrades,
          debt-for-equity swaps, second-lien and subordinated flags, how stressed the borrower&apos;s sector, the BDC&apos;s book or the
          whole market is, and a machine-learned model on the same inputs (gradient boosting ranked no better than this one, which
          can be read term by term). They add nothing once the mark, PIK, equity, maturity and spread are counted.
        </p>
        <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
          <span className="text-white">Changed November 2026.</span>{" "}The watchlist, the forward queue and this table now read
          one model instead of three scorings. FSK&apos;s non-accrual flags before 2021-09 now count (they match the rates FSK printed
          within 0.07pp in every quarter tested), so the model has seen the 2020 defaults. CLO and other structured notes, joint
          ventures, funds and securitizations are not borrowers: a vehicle&apos;s notes stay out of the fit and carry the low rate
          at which such paper has gone on non-accrual, so they no longer teach it that a low mark means little, and fund and
          joint-venture interests are not in the at-risk book at all. The range is simulated from each BDC&apos;s own
          borrowers rather than taken from past misses at a similar level, and a forecast can no longer sit at exactly 0%.
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
