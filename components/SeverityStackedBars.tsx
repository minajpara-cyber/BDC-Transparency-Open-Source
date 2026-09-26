"use client";

import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";

export interface SeverityBarPoint {
  period_end: string;
  minimal: number;
  moderate: number;
  severe: number;
  unknown: number;
}

export interface StackSeries {
  key: string;
  name: string;
  color: string;
}

// PIK severity: the PIK share of the coupon (the default series).
export const PIK_SEVERITY_SERIES: StackSeries[] = [
  { key: "minimal", name: "Minimal (<20% PIK share)", color: "#fde68a" },
  { key: "moderate", name: "Moderate (20–50%)", color: "#f97316" },
  { key: "severe", name: "Severe (≥50% or all-PIK)", color: "#dc2626" },
  { key: "unknown", name: "Severity unknown", color: "#94a3b8" },
];

interface Props {
  /** One point per quarter: period_end plus one number per series key. */
  data: Array<{ period_end: string }>;
  yLabel?: string;
  /** "%" for cost-percent display, "" for raw counts. Defaults to "". */
  unit?: string;
  /** Stack layers; defaults to PIK severity. lib/pikOrigin's
   *  SEVERE_PIK_TYPE_SERIES stacks severe PIK by type instead. */
  series?: StackSeries[];
}

export default function SeverityStackedBars({ data, yLabel = "# inferred PIK changes", unit = "", series = PIK_SEVERITY_SERIES }: Props) {
  const fmtTick = (v: number) =>
    unit === "%" ? `${v.toFixed(1)}%` : Number(v).toLocaleString();
  const fmtTooltip = (value: unknown) => {
    if (value === undefined || value === null) return "";
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return unit === "%" ? `${n.toFixed(2)}%` : n.toLocaleString();
  };
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
          <XAxis
            dataKey="period_end"
            tick={{ fill: "#8b8ba8", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(0, 7)}
            minTickGap={20}
          />
          <YAxis
            tick={{ fill: "#8b8ba8", fontSize: 11 }}
            tickFormatter={fmtTick}
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
            formatter={fmtTooltip}
          />
          {/* legend in stack order (recharts sorts by label by default) */}
          <Legend wrapperStyle={{ fontSize: 11, color: "#8b8ba8" }}
            itemSorter={(item) => series.findIndex((s) => s.name === item.value)} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
