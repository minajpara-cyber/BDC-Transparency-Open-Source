// One BDC's row from the four-quarter non-accrual projection, for its own page.
// Server-safe (no hooks); the full table with the back-test lives on /watchlist.
import Link from "next/link";
import { naForecast } from "@/data/na_forecast";
import {
  confidenceLabel,
  coverageFloorPct,
  coverageText,
  floorText,
  fmtPct,
  forecastConfidence,
  formationMeta,
  notModelledReason,
  projectionValue,
  sortForecastRows,
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
  const rank = value == null ? null : ranked.findIndex((r) => r.ticker === ticker) + 1;
  const coverage = coverageText(row);

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
            The share of {ticker}&apos;s performing loans (at cost) expected to newly go on non-accrual over
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
              sub={value != null && row.form_lo != null && row.form_hi != null
                ? `80% range ${row.form_lo.toFixed(2)}–${row.form_hi.toFixed(2)}%`
                : "no number in this data release"}
              color={value == null ? "#8b8ba8" : value >= 3 ? "#ef4444" : value >= 1.5 ? "#f59e0b" : "#22c55e"} />
            <Stat label="Trailing 4Q actual" value={fmtPct(row.form_trailing)} sub="new NA over the past year" />
            <Stat label="X-holder NA" value={fmtPct(row.xh_pp)} sub="cost in borrowers on NA at another BDC" />
            <Stat label="Marked <90¢" value={fmtPct(row.b90_pp, 1)} sub="of cost" />
            <Stat label={`NA rate ${row.q1_label}`} value={fmtPct(row.na_q1)}
              sub={row.lo_q1 != null && row.hi_q1 != null ? `80% range ${row.lo_q1.toFixed(2)}–${row.hi_q1.toFixed(2)}%` : undefined} />
            <Stat label="P(rise ≥0.5pp)" value={row.p_rise == null ? "—" : `${(100 * row.p_rise).toFixed(0)}%`}
              sub="next quarter · weak signal" />
          </div>
          <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
            {rank != null && `Ranks #${rank} of ${ranked.length} BDCs with a projection (#1 = most expected new non-accruals). `}
            {confidence === "lower" && `Lower confidence: ${coverageFloorPct != null
              ? `less than ${floorText()} of the model's inputs could be observed for this book`
              : "fewer of the model's inputs could be observed for this book"}${value == null
              ? ", and this data release has no four-quarter number for it yet; the other figures above still apply. "
              : ", so treat the number as rougher than the others. "}`}
            {formationMeta.n != null && `The model's back-test covers ${formationMeta.n} BDC-quarters without look-ahead.`}
          </p>
        </>
      )}
    </div>
  );
}
