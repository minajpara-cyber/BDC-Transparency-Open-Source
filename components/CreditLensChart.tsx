"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  ReferenceLine,
} from "recharts";

export interface IndustryPoint {
  period_end: string;
  value: number;        // industry-aggregate metric value (e.g., weighted % NA)
  coverage: number;     // count of BDCs reporting this quarter
}

interface MacroOverlay {
  /** Quarter-end keyed series. Aligned to the same period_end strings as `data`. */
  series: Array<{ period_end: string; value: number }>;
  /** Label for the legend / tooltip. */
  label: string;
  /** Unit suffix for tooltip (e.g. "bps", "%"). */
  unit: string;
  /** Stroke color. Defaults to a muted grey-blue. */
  color?: string;
}

interface Props {
  data: IndustryPoint[];
  yLabel: string;
  unit?: string;        // suffix like "%" or "" (count)
  color?: string;
  height?: number;
  /** Optional secondary axis macro line (e.g. HY OAS, Fed funds). */
  overlay?: MacroOverlay;
}

type RangeKey = "3y" | "5y" | "10y" | "all";
const RANGES: Array<{ key: RangeKey; label: string; quarters: number | null }> = [
  { key: "3y",  label: "3y",  quarters: 12 },
  { key: "5y",  label: "5y",  quarters: 20 },
  { key: "10y", label: "10y", quarters: 40 },
  { key: "all", label: "All", quarters: null },
];

export default function CreditLensChart({
  data,
  yLabel,
  unit = "%",
  color = "#6366f1",
  height = 280,
  overlay,
}: Props) {
  const [range, setRange] = useState<RangeKey>("all");
  // Merge overlay into the same row by period_end so Recharts can plot both
  // series on shared x-axis with separate y-axes.
  const overlayByPeriod = new Map(
    (overlay?.series ?? []).map((p) => [p.period_end, p.value]),
  );
  const fullMerged = data.map((d) => ({
    ...d,
    overlayValue: overlay ? overlayByPeriod.get(d.period_end) ?? null : null,
  }));
  const merged = useMemo(() => {
    const cfg = RANGES.find((r) => r.key === range)!;
    if (cfg.quarters === null) return fullMerged;
    return fullMerged.slice(-cfg.quarters);
  }, [fullMerged, range]);

  return (
    <div style={{ width: "100%", height: height + 28 }}>
      <div className="flex justify-end gap-1 mb-1.5">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className="text-[10px] px-1.5 py-0.5 rounded border transition-colors"
            style={{
              background: range === r.key ? "rgba(99,102,241,0.15)" : "transparent",
              borderColor: range === r.key ? "#6366f1" : "#2d2d50",
              color: range === r.key ? "#a5b4fc" : "#8b8ba8",
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={merged} margin={{ top: 10, right: overlay ? 50 : 20, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
          <XAxis
            dataKey="period_end"
            tick={{ fill: "#8b8ba8", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(0, 7)}
            minTickGap={20}
          />
          <YAxis
            yAxisId="primary"
            tick={{ fill: "#8b8ba8", fontSize: 11 }}
            tickFormatter={(v: number) => (unit === "%" ? `${v.toFixed(0)}%` : `${v}`)}
            label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#8b8ba8", fontSize: 11 }}
          />
          {overlay && (
            <YAxis
              yAxisId="overlay"
              orientation="right"
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              tickFormatter={(v: number) => `${v}${overlay.unit === "bps" ? "" : overlay.unit}`}
              label={{
                value: overlay.label,
                angle: 90,
                position: "insideRight",
                fill: "#9ca3af",
                fontSize: 10,
              }}
            />
          )}
          <ReferenceLine y={0} yAxisId="primary" stroke="#3b3b55" />
          <Tooltip
            contentStyle={{
              background: "#0f0f16",
              border: "1px solid #1e1e2e",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#d1d5db" }}
            formatter={(value, name, item) => {
              const v = Number(value);
              if (name === "Industry aggregate") {
                const coverage =
                  (item?.payload as IndustryPoint | undefined)?.coverage ?? null;
                const valStr = unit === "%" ? `${v.toFixed(2)}%` : v.toLocaleString();
                return [`${valStr}  (n=${coverage ?? "?"} BDCs)`, name];
              }
              if (overlay && name === overlay.label) {
                const valStr =
                  overlay.unit === "bps"
                    ? `${Math.round(v)} bps`
                    : `${v.toFixed(2)}${overlay.unit}`;
                return [valStr, name];
              }
              return [String(value), name];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#8b8ba8" }} />
          <Line
            type="monotone"
            yAxisId="primary"
            dataKey="value"
            name="Industry aggregate"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
          {overlay && (
            <Line
              type="monotone"
              yAxisId="overlay"
              dataKey="overlayValue"
              name={overlay.label}
              stroke={overlay.color ?? "#6b7280"}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
