"use client";

// Wide BDC×quarter heatmap. Cells are colored by metric magnitude using a
// green→yellow→red scale. Each ticker label in the row header links to
// /bdcs/{slug}. When `flagKey` is provided, individual cells become clickable
// buttons that open a position-level drilldown modal scoped to that
// (ticker, period_end, flag).
import { useState } from "react";
import Link from "next/link";
import LoanDetailsModal from "./LoanDetailsModal";

interface Cell {
  value: number | null;  // null = missing (no filing that quarter)
  reliable?: boolean;     // if false, cell is muted/striped
}

type FlagKey = "f_na" | "f_below_95" | "f_below_90" | "f_below_80" | "f_pik";

interface Props {
  title: string;
  description?: string;
  // ordered list of period_end strings forming the column axis
  periods: string[];
  // ordered list of tickers forming the row axis
  tickers: string[];
  // value lookup: cellMap.get(`${ticker}|${period_end}`)
  cellMap: Map<string, Cell>;
  // color thresholds: [green, yellow, red]
  thresholds: [number, number, number];
  unit?: string; // e.g., "%"
  // Optional: when set, cells become clickable buttons that open a modal
  // showing the position-level rows in our stressed_positions extract for
  // (ticker, period_end) filtered to this flag.
  flagKey?: FlagKey;
  metricLabel?: string;
}

function cellColor(v: number | null, t: [number, number, number]): string {
  if (v === null || v === undefined) return "transparent";
  const [g, y, r] = t;
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  let red = 0, green = 0, blue = 0, alpha = 0;
  if (v <= g) {
    const t01 = clamp(v / Math.max(g, 0.0001));
    red = 30 + (34 - 30) * t01;
    green = 30 + (197 - 30) * t01;
    blue = 40 + (94 - 40) * t01;
    alpha = 0.1 + 0.25 * t01;
  } else if (v <= y) {
    const t01 = clamp((v - g) / (y - g));
    red = 34 + (234 - 34) * t01;
    green = 197 + (179 - 197) * t01;
    blue = 94 + (8 - 94) * t01;
    alpha = 0.35 + 0.15 * t01;
  } else if (v <= r) {
    const t01 = clamp((v - y) / (r - y));
    red = 234 + (239 - 234) * t01;
    green = 179 + (68 - 179) * t01;
    blue = 8 + (68 - 8) * t01;
    alpha = 0.5 + 0.2 * t01;
  } else {
    red = 239;
    green = 68;
    blue = 68;
    alpha = 0.85;
  }
  return `rgba(${Math.round(red)},${Math.round(green)},${Math.round(blue)},${alpha.toFixed(2)})`;
}

export default function CreditHeatmap({
  title,
  description,
  periods,
  tickers,
  cellMap,
  thresholds,
  unit = "%",
  flagKey,
  metricLabel,
}: Props) {
  const [modal, setModal] = useState<{ ticker: string; period_end: string } | null>(null);
  const clickable = !!flagKey;

  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "#111118", borderColor: "#1e1e2e" }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
        <h3 className="font-semibold text-white text-sm">{title}</h3>
        {description && (
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            {description}
            {clickable && (
              <span style={{ color: "#a5b4fc" }}>
                {" "}Click any cell to see the underlying loans.
              </span>
            )}
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              <th
                className="px-3 py-2 text-left font-semibold sticky left-0 z-10"
                style={{
                  color: "#8b8ba8",
                  background: "#0f0f16",
                  borderBottom: "1px solid #1e1e2e",
                  borderRight: "1px solid #1e1e2e",
                  minWidth: 70,
                }}
              >
                BDC
              </th>
              {periods.map((p) => (
                <th
                  key={p}
                  className="px-2 py-2 font-mono whitespace-nowrap"
                  style={{
                    color: "#8b8ba8",
                    borderBottom: "1px solid #1e1e2e",
                    minWidth: 60,
                  }}
                >
                  {p.slice(2, 7)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((ticker, ri) => (
              <tr key={ticker}>
                <td
                  className="px-3 py-2 font-mono font-semibold sticky left-0 z-10"
                  style={{
                    background: ri % 2 === 0 ? "#111118" : "#0f0f16",
                    borderRight: "1px solid #1e1e2e",
                  }}
                >
                  <Link
                    href={`/bdcs/${ticker.toLowerCase()}`}
                    className="hover:text-white transition-colors"
                    style={{ color: "#a5b4fc" }}
                    title={`Open ${ticker} detail`}
                  >
                    {ticker}
                  </Link>
                </td>
                {periods.map((p) => {
                  const cell = cellMap.get(`${ticker}|${p}`);
                  const v = cell?.value ?? null;
                  const reliable = cell?.reliable ?? true;
                  const canClick = clickable && v !== null && reliable;
                  const cellStyle = {
                    background: cellColor(v, thresholds),
                    color: v === null ? "#3b3b55" : reliable ? "#fafafa" : "#9ca3af",
                    fontStyle: reliable ? "normal" : ("italic" as const),
                    opacity: reliable ? 1 : 0.55,
                    cursor: canClick ? "pointer" : "default",
                  };
                  const displayText =
                    v === null
                      ? "—"
                      : unit.toLowerCase().includes("bps")
                      ? Math.round(v).toString()
                      : v.toFixed(1);
                  const titleText =
                    v === null
                      ? "no filing"
                      : `${ticker} · ${p}: ${unit.toLowerCase().includes("bps") ? Math.round(v) : v.toFixed(2)}${unit}${reliable ? "" : "  (partial coverage)"}${canClick ? "  — click for loan detail" : ""}`;
                  return (
                    <td
                      key={p}
                      className="px-2 py-1.5 text-center font-mono"
                      style={cellStyle}
                      title={titleText}
                      onClick={canClick ? () => setModal({ ticker, period_end: p }) : undefined}
                    >
                      {displayText}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className="px-5 py-3 text-xs flex items-center gap-4 flex-wrap"
        style={{ color: "#6b6b88", borderTop: "1px solid #1e1e2e" }}
      >
        <span>Scale ({unit}):</span>
        {[0, thresholds[0], thresholds[1], thresholds[2]].map((bound, i, a) => {
          const next = a[i + 1];
          if (next === undefined) {
            return (
              <span key={i} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-4 h-3 rounded-sm"
                  style={{ background: cellColor(bound + 1, thresholds), border: "1px solid #1e1e2e" }}
                />
                ≥ {bound}
              </span>
            );
          }
          return (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className="inline-block w-4 h-3 rounded-sm"
                style={{ background: cellColor((bound + next) / 2, thresholds), border: "1px solid #1e1e2e" }}
              />
              {bound}–{next}
            </span>
          );
        })}
      </div>
      {clickable && (
        <LoanDetailsModal
          open={modal !== null}
          onClose={() => setModal(null)}
          ticker={modal?.ticker ?? null}
          period_end={modal?.period_end ?? null}
          flagKey={flagKey!}
          metricLabel={metricLabel ?? title}
        />
      )}
    </div>
  );
}
