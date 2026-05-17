"use client";

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

// Color palette ordered by vintage year — newer vintages get cooler colors,
// older ones get warmer. Lets the viewer eyeball "are the later vintages
// performing worse" at a glance.
const VINTAGE_COLORS: Record<number, string> = {
  2018: "#a855f7",  // purple — incomplete pre-coverage
  2019: "#ec4899",  // pink   — incomplete pre-coverage
  2020: "#ef4444",  // red
  2021: "#f97316",  // orange
  2022: "#eab308",  // yellow
  2023: "#22c55e",  // green
  2024: "#06b6d4",  // cyan
  2025: "#3b82f6",  // blue
  2026: "#8b5cf6",  // violet
};

// Each curve is one vintage. The x-axis is age in years since the
// vintage_year's Jan 1, so curves are directly comparable ("how did this
// cohort perform by year 3 vs. how did 2021's cohort perform by year 3?").
export interface VintageSeries {
  vintage_year: number;
  is_partial: boolean;
  points: Array<{ age_years: number; value: number; alive_cost_b: number }>;
}

interface Props {
  series: VintageSeries[];
  yLabel: string;
  height?: number;
  /** When true the line strokes go dashed for is_partial vintages */
  dimPartial?: boolean;
}

export default function VintageChart({
  series,
  yLabel,
  height = 320,
  dimPartial = true,
}: Props) {
  // Pivot into wide form keyed by age_years; each vintage is a column.
  const allAges = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.age_years))),
  ).sort((a, b) => a - b);

  const wide = allAges.map((age) => {
    const row: Record<string, number | null> = { age_years: age };
    for (const s of series) {
      const point = s.points.find((p) => p.age_years === age);
      row[`v${s.vintage_year}`] = point ? point.value : null;
    }
    return row;
  });

  // Sort series by vintage so the legend reads left-to-right oldest → newest
  const ordered = [...series].sort((a, b) => a.vintage_year - b.vintage_year);

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={wide} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
          <XAxis
            dataKey="age_years"
            type="number"
            domain={[0, "auto"]}
            tick={{ fill: "#8b8ba8", fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(0)}y`}
            label={{ value: "Years since acquisition", position: "insideBottom", offset: -2, fill: "#8b8ba8", fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: "#8b8ba8", fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#8b8ba8", fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: "#0f0f16",
              border: "1px solid #1e1e2e",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#d1d5db" }}
            labelFormatter={((v: unknown) => `${Number(v).toFixed(2)}y after acquisition`) as unknown as (label: unknown) => string}
            formatter={(value, name) => {
              if (value === null) return ["—", String(name)];
              const v = Number(value);
              return [`${v.toFixed(2)}%`, String(name).replace(/^v/, "Vintage ")];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#8b8ba8", paddingTop: 6 }}
            formatter={(value: string) => value.replace(/^v/, "Vintage ")}
          />
          {ordered.map((s) => (
            <Line
              key={s.vintage_year}
              type="monotone"
              dataKey={`v${s.vintage_year}`}
              name={`v${s.vintage_year}`}
              stroke={VINTAGE_COLORS[s.vintage_year] ?? "#9ca3af"}
              strokeWidth={2}
              strokeDasharray={dimPartial && s.is_partial ? "4 3" : undefined}
              connectNulls
              dot={{ r: 2.5 }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
