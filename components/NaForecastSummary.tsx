// One BDC's row from the four-quarter non-accrual projection, for its own page.
// Server-safe (no hooks); the full table with the back-test lives on /watchlist.
import Link from "next/link";
import { naForecast } from "@/data/na_forecast";
import {
  backtestText,
  confidenceLabel,
  coverageText,
  fmtPct,
  forecastConfidence,
  formationMeta,
  lowerConfidenceReason,
  nextQuarterMeta,
  notBacktested,
  notModelledReason,
  projectionValue,
  rangeText,
  riseRankText,
  riseRecordText,
  sortForecastRows,
  tiedRank,
} from "@/lib/naForecastDisplay";

function Stat({ label, value, sub, color = "#fafafa" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: "#6b7280" }}>{sub}</div>}
    </div>
  );
}

export default function NaForecastSummary({ ticker }: { ticker: string }) {
  const row = naForecast.find((r) => r.ticker === ticker);
  if (!row) return null;
  const confidence = forecastConfidence(row);
  const value = projectionValue(row);
  const ranked = sortForecastRows(naForecast).filter((r) => projectionValue(r) != null);
  const place = value == null ? null : tiedRank(ticker, ranked.map((r) => ({ ticker: r.ticker, value: projectionValue(r) as number })));
  const coverage = coverageText(row);
  const record = backtestText(row, formationMeta);
  const lowerReason = lowerConfidenceReason(row);
  // how the next-quarter range held, built each quarter from the misses known then
  const q1Held = nextQuarterMeta?.range_coverage?.inside;
  const riseRecord = riseRecordText(row);

  return (
    <div className="rounded-xl border p-5 mb-8" style={{ background: "#111118", borderColor: "#1e1e2e" }}
      data-forecast-confidence={confidence}>
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-white">
            Non-accrual outlook{" "}
            <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
              next four quarters · from {row.period_end}
            </span>
          </h2>
          <p className="text-xs mt-1 max-w-3xl" style={{ color: "#8b8ba8" }}>
            The share of {ticker}&apos;s performing book (at cost) expected to newly go on non-accrual over
            the next year: each borrower&apos;s chance of non-accrual, added up by cost. It ranks BDCs; it is not a
            precise forecast for any one of them, and the range shows how far off a year of a few lumpy names can land.{" "}
            <Link href="/watchlist#gated-na-projections" className="text-indigo-400 hover:text-indigo-300">
              All BDCs and how well the model has worked →
            </Link>
          </p>
        </div>
        <span className="text-xs rounded px-2 py-1 whitespace-nowrap" style={{
          background: confidence === "standard" ? "rgba(34,197,94,0.10)" : confidence === "lower" ? "rgba(245,158,11,0.10)" : "rgba(107,114,128,0.12)",
          color: confidence === "standard" ? "#86efac" : confidence === "lower" ? "#fbbf24" : "#9ca3af",
        }}>
          {confidenceLabel(row)}{coverage ? ` · ${coverage}` : ""}
        </span>
      </div>

      {confidence === "none" ? (
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          No projection for {ticker}: {notModelledReason(row).toLowerCase()}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
            <Stat label="Expected new NA · next 4Q" value={fmtPct(value)}
              sub={rangeText(row, value) == null ? "no number in this data release" : `80% range ${rangeText(row, value)}%`}
              color={value == null ? "#8b8ba8" : value >= 3 ? "#ef4444" : value >= 1.5 ? "#f59e0b" : "#22c55e"} />
            <Stat label="Trailing 4Q actual" value={fmtPct(row.form_trailing)} sub="new NA over the past year" />
            <Stat label="X-holder NA" value={fmtPct(row.xh_pp)} sub="cost in its loans at or below a lien on NA at another BDC" />
            <Stat label="Performing loans <90¢ of par" value={fmtPct(row.b90_pp, 1)}
              sub="of marked loan cost, borrowers with nothing on NA" />
            <Stat label={`NA rate ${row.q1_label}`} value={fmtPct(row.na_q1)}
              sub={row.lo_q1 != null && row.hi_q1 != null
                ? `80% range ${row.lo_q1.toFixed(2)}–${row.hi_q1.toFixed(2)}%${q1Held != null ? `, held ${Math.round(100 * q1Held)}% of the time` : ""}`
                : undefined} />
            <Stat label="Rank for a rise ≥0.5pp" value={riseRankText(row) ?? "—"}
              sub={riseRecord ? `next quarter · ${riseRecord}` : "next quarter"} />
          </div>
          <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
            {place != null && `Ranks ${place.tiedWith.length ? "joint " : ""}#${place.rank} of ${ranked.length} BDCs with a projection${place.tiedWith.length ? ` (tied with ${place.tiedWith.join(", ")})` : ""} (#1 = most expected new non-accruals). `}
            {confidence === "lower" && lowerReason && `Lower confidence: ${lowerReason}${value == null
              ? "; this data release has no four-quarter number for it yet, and the other figures above still apply. "
              : ". Treat the number as rougher than the others. "}`}
            {record && !notBacktested(row) && `${record}. `}
            {formationMeta.n != null && `The model's back-test covers ${formationMeta.n} BDC-quarters, each forecast made only from outcomes known at the time.`}
          </p>
        </>
      )}
    </div>
  );
}
