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

export interface ComparisonPoint {
  period_end: string;
  bdc: number | null;
  industry: number | null;
}

interface Props {
  data: ComparisonPoint[];
  yLabel: string;
  /** "%" for percent display, "" for raw, " bps" for basis points. */
  unit?: string;
  /** Color for the BDC's own series. */
  bdcColor?: string;
  /** Label for the BDC's own series (e.g. "ARCC"). */
  bdcLabel: string;
  height?: number;
}

export default function ComparisonChart({
  data,
  yLabel,
  unit = "%",
  bdcColor = "#6366f1",
  bdcLabel,
  height = 240,
}: Props) {
  const fmtTick = (v: number) => {
    if (unit === "%") return `${v.toFixed(0)}%`;
    if (unit.toLowerCase().includes("bps")) return `${Math.round(v)}`;
    return `${v}`;
  };
  const fmtValue = (v: number) => {
    if (unit === "%") return `${v.toFixed(2)}%`;
    if (unit.toLowerCase().includes("bps")) return `${Math.round(v)} bps`;
    return v.toLocaleString();
  };

  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
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
            label={{
              value: yLabel,
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
            formatter={(value) => fmtValue(Number(value))}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#8b8ba8" }} />
          <Line
            type="monotone"
            dataKey="bdc"
            name={bdcLabel}
            stroke={bdcColor}
            strokeWidth={2.5}
            dot={{ r: 2.5 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="industry"
            name="Industry avg"
            stroke="#9ca3af"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
