// One BDC's row from the four-quarter non-accrual projection, for its own page.
// Server-safe (no hooks); the full table with the back-test lives on /watchlist.
import Link from "next/link";
import { naForecast } from "@/data/na_forecast";
import {
  backtestText,
  beyondBacktest,
  confidenceLabel,
  coverageText,
  fmtPct,
  forecastConfidence,
  formationMeta,
  lowerConfidenceReason,
  notBacktested,
  notModelledReason,
  projectionValue,
  rangeText,
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
  const rel = formationMeta.relative_effect;
  const move = rel?.reference_period ? rel.moves?.[ticker] : undefined;
  const fellAgainstScore = move != null && move.blend_now >= move.blend_then - 0.05
    && move.forecast_now <= move.forecast_then - 0.5;

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
            the next year, from warning signs on each borrower. It ranks BDCs; it is not a precise
            forecast for any one of them.{" "}
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
              sub={rangeText(row, value) == null
                ? "no number in this data release"
                : beyondBacktest(row) ? rangeText(row, value) ?? undefined : `80% range ${rangeText(row, value)}%`}
              color={value == null ? "#8b8ba8" : value >= 3 ? "#ef4444" : value >= 1.5 ? "#f59e0b" : "#22c55e"} />
            <Stat label="Trailing 4Q actual" value={fmtPct(row.form_trailing)} sub="new NA over the past year" />
            <Stat label="X-holder NA" value={fmtPct(row.xh_pp)} sub="cost in borrowers with a loan on NA at another BDC" />
            <Stat label="Loans <90¢ of par" value={fmtPct(row.b90_pp, 1)} sub="of marked loan cost" />
            <Stat label={`NA rate ${row.q1_label}`} value={fmtPct(row.na_q1)}
              sub={row.lo_q1 != null && row.hi_q1 != null ? `80% range ${row.lo_q1.toFixed(2)}–${row.hi_q1.toFixed(2)}%` : undefined} />
            <Stat label="P(rise ≥0.5pp)" value={row.p_rise == null ? "—" : `${(100 * row.p_rise).toFixed(0)}%`}
              sub="next quarter · weak signal" />
          </div>
          <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
            {place != null && `Ranks ${place.tiedWith.length ? "joint " : ""}#${place.rank} of ${ranked.length} BDCs with a projection${place.tiedWith.length ? ` (tied with ${place.tiedWith.join(", ")})` : ""} (#1 = most expected new non-accruals). `}
            {value === 0 && `0.00% is the floor, not a forecast of no new non-accruals: ${ticker}'s warning signs are so far below its peers' that the method puts it at zero${row.form_hi != null ? `, and the 80% range still runs up to ${fmtPct(row.form_hi)}` : ""}. `}
            {confidence === "lower" && lowerReason && `Lower confidence: ${lowerReason}${value == null
              ? "; this data release has no four-quarter number for it yet, and the other figures above still apply. "
              : ". Treat the number as rougher than the others. "}`}
            {record && !notBacktested(row) && `${record}. `}
            {rel?.level != null && `Projections are relative: each sits above or below ${fmtPct(rel.level)} according to how the BDC's warning signs compare with the other BDCs' this quarter, so a rise in other BDCs' scores lowers this one. `}
            {fellAgainstScore && move && rel?.reference_period && `Since ${rel.reference_period.slice(0, 7)} ${ticker}'s own score went ${move.blend_then.toFixed(2)} → ${move.blend_now.toFixed(2)} while its projection went ${fmtPct(move.forecast_then)} → ${fmtPct(move.forecast_now)}, because the other BDCs' scores rose more${rel.since_reference ? ` (the average by ${rel.since_reference.change_pp.toFixed(2)}pp)` : ""}. `}
            {formationMeta.n != null && `The model's back-test covers ${formationMeta.n} BDC-quarters without look-ahead.`}
          </p>
        </>
      )}
    </div>
  );
}
