"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
} from "recharts";

// Distinct colors for up to 6 overlaid BDCs.
const SERIES_COLORS = [
  "#a5b4fc", "#fda4af", "#86efac", "#fde68a", "#67e8f9", "#d8b4fe",
];

export type CompareMetric =
  | "pct_non_accrual"
  | "pct_below_95"
  | "pct_below_90"
  | "pct_pik_total";

const METRIC_META: Record<CompareMetric, { label: string; family: "mark" | "na" | "pik" }> = {
  pct_non_accrual: { label: "% non-accrual (at cost)",      family: "na"   },
  pct_below_95:    { label: "% debt cost below 95¢ of par", family: "mark" },
  pct_below_90:    { label: "% debt cost below 90¢ of par", family: "mark" },
  pct_pik_total:   { label: "% PIK (at cost)",              family: "pik"  },
};

export interface CompareRow {
  ticker: string;
  period_end: string;
  pct_non_accrual: number;
  pct_below_95: number;
  pct_below_90: number;
  pct_pik_total: number;
  /** Per-metric-family reliability — true means this row should appear when
   *  the user has selected a metric in that family. */
  rel_na: boolean;
  rel_mark: boolean;
  rel_pik: boolean;
}

interface Props {
  rows: CompareRow[];
  /** Tickers eligible for selection (ordered). */
  tickers: string[];
  /** Initial selection. */
  initialSelection?: string[];
}

export default function BDCComparePanel({
  rows,
  tickers,
  initialSelection,
}: Props) {
  const [metric, setMetric] = useState<CompareMetric>("pct_below_95");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelection ?? ["ARCC", "BXSL", "FSK", "OBDC"]),
  );

  const family = METRIC_META[metric].family;
  const relKey = ("rel_" + family) as keyof CompareRow;

  // Merged dataset: one row per period_end, one column per selected ticker.
  const chartData = useMemo(() => {
    const byPeriod = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      if (!selected.has(r.ticker)) continue;
      if (!r[relKey]) continue;
      const slot = byPeriod.get(r.period_end) ?? { period_end: r.period_end };
      slot[r.ticker] = r[metric];
      byPeriod.set(r.period_end, slot);
    }
    return Array.from(byPeriod.values()).sort((a, b) =>
      String(a.period_end).localeCompare(String(b.period_end)),
    );
  }, [rows, selected, metric, relKey]);

  const selectedList = Array.from(selected).sort();
  const canSelectMore = selected.size < SERIES_COLORS.length;

  const toggle = (t: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else if (canSelectMore) next.add(t);
      return next;
    });
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
        <h3 className="font-semibold text-white text-sm">Compare BDCs</h3>
        <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
          Pick up to {SERIES_COLORS.length} BDCs and a metric to overlay their full quarterly
          history on the same axis. Caveat-flagged (BDC, metric) combos and sub-30-position
          stub quarters are excluded automatically.
        </p>
      </div>

      {/* Controls */}
      <div className="px-5 py-4 border-b space-y-3" style={{ borderColor: "#1e1e2e" }}>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mr-3" style={{ color: "#8b8ba8" }}>
            Metric:
          </label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as CompareMetric)}
            className="text-xs px-2 py-1 rounded border"
            style={{ background: "#0f0f16", borderColor: "#2d2d50", color: "#d1d5db" }}
          >
            {(Object.keys(METRIC_META) as CompareMetric[]).map((k) => (
              <option key={k} value={k}>
                {METRIC_META[k].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8b8ba8" }}>
            BDCs ({selected.size} / {SERIES_COLORS.length} selected):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tickers.map((t) => {
              const isOn = selected.has(t);
              const idx = selectedList.indexOf(t);
              const color = isOn && idx >= 0 ? SERIES_COLORS[idx % SERIES_COLORS.length] : "#2d2d50";
              return (
                <button
                  key={t}
                  onClick={() => toggle(t)}
                  className="text-xs font-mono px-2 py-1 rounded border transition-colors"
                  style={{
                    background: isOn ? "rgba(99,102,241,0.12)" : "transparent",
                    borderColor: color,
                    color: isOn ? "#fafafa" : "#8b8ba8",
                    opacity: !isOn && !canSelectMore ? 0.4 : 1,
                    cursor: !isOn && !canSelectMore ? "not-allowed" : "pointer",
                  }}
                  disabled={!isOn && !canSelectMore}
                  title={!isOn && !canSelectMore ? `Max ${SERIES_COLORS.length} BDCs` : ""}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
              <XAxis
                dataKey="period_end"
                tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(0, 7)}
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                label={{
                  value: METRIC_META[metric].label,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#8b8ba8",
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f0f16",
                  border: "1px solid #1e1e2e",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#d1d5db" }}
                formatter={(v, name) => {
                  if (v === undefined || v === null) return ["—", String(name)];
                  return [`${Number(v).toFixed(2)}%`, String(name)];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8b8ba8" }} />
              {selectedList.map((t, i) => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  name={t}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
