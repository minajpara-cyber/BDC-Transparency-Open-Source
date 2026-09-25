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

// Each curve is one vintage. The x-axis is age in years since the loan's
// vintage date, so curves are directly comparable ("how did this cohort
// perform by year 3 vs. how did 2021's cohort perform by year 3?"). A point
// only exists where enough loans are old enough to have reached that age, so
// younger vintages' curves simply stop.
export interface VintagePoint {
  age_years: number;
  value: number;
  alive_cost_b: number;
  /** Share of the cohort's entry cost old enough to be counted at this age. */
  pct_eligible?: number;
  n_eligible?: number;
  /** Non-accrual status unknown for >=5% of the counted cost (hollow dot). */
  partial?: boolean;
}

export interface VintageSeries {
  vintage_year: number;
  is_partial: boolean;
  points: VintagePoint[];
}

interface Props {
  series: VintageSeries[];
  yLabel: string;
  height?: number;
  /** When true the line strokes go dashed for is_partial vintages */
  dimPartial?: boolean;
  /** Clamp the y-axis at this value (e.g. 100 for shares). */
  yMax?: number;
}

type DotProps = { cx?: number; cy?: number; payload?: Record<string, unknown> };

export default function VintageChart({
  series,
  yLabel,
  height = 320,
  dimPartial = true,
  yMax,
}: Props) {
  // Pivot into wide form keyed by age_years; each vintage is a column, with
  // sidecar keys per vintage that carry the point's eligibility and flags.
  const allAges = Array.from(
    new Set(series.flatMap((s) => s.points.map((p) => p.age_years))),
  ).sort((a, b) => a - b);

  const wide = allAges.map((age) => {
    const row: Record<string, number | null | boolean> = { age_years: age };
    for (const s of series) {
      const point = s.points.find((p) => p.age_years === age);
      row[`v${s.vintage_year}`] = point ? point.value : null;
      row[`v${s.vintage_year}__partial`] = Boolean(point?.partial);
      row[`v${s.vintage_year}__elig`] = point?.pct_eligible ?? null;
      row[`v${s.vintage_year}__n`] = point?.n_eligible ?? null;
    }
    return row;
  });

  // Sort series by vintage so the legend reads left-to-right oldest → newest
  const ordered = [...series].sort((a, b) => a.vintage_year - b.vintage_year);

  const dotFor = (key: string, color: string) => {
    const Dot = (props: DotProps) => {
      const { cx, cy, payload } = props;
      if (cx == null || cy == null || !payload || payload[key] == null) return <g />;
      return payload[`${key}__partial`]
        ? <circle cx={cx} cy={cy} r={3.5} fill="#111118" stroke={color} strokeWidth={1.5} />
        : <circle cx={cx} cy={cy} r={2.5} fill={color} stroke={color} />;
    };
    Dot.displayName = `VintageDot_${key}`;
    return Dot;
  };

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
            label={{ value: "Years since the vintage date", position: "insideBottom", offset: -2, fill: "#8b8ba8", fontSize: 11 }}
          />
          <YAxis
            domain={yMax != null ? [0, yMax] : [0, "auto"]}
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
            labelFormatter={((v: unknown) => `${Number(v).toFixed(2)}y after the vintage date`) as unknown as (label: unknown) => string}
            formatter={(value, name, item) => {
              if (value === null || value === undefined) return ["—", String(name)];
              const v = Number(value);
              const key = String(name);
              const p = (item as { payload?: Record<string, unknown> } | undefined)?.payload ?? {};
              const elig = p[`${key}__elig`];
              const n = p[`${key}__n`];
              const extra = [
                typeof elig === "number" ? `${elig.toFixed(0)}% of cohort counted` : null,
                typeof n === "number" ? `${n} loans` : null,
                p[`${key}__partial`] ? "NA status partly unknown" : null,
              ].filter(Boolean).join(" · ");
              return [`${v.toFixed(2)}%${extra ? ` (${extra})` : ""}`, key.replace(/^v/, "Vintage ")];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#8b8ba8", paddingTop: 6 }}
            formatter={(value: string) => value.replace(/^v/, "Vintage ")}
          />
          {ordered.map((s) => {
            const color = VINTAGE_COLORS[s.vintage_year] ?? "#9ca3af";
            const key = `v${s.vintage_year}`;
            return (
              <Line
                key={s.vintage_year}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={dimPartial && s.is_partial ? "4 3" : undefined}
                connectNulls={false}
                dot={dotFor(key, color)}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
