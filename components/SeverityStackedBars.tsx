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
}

interface Props {
  data: SeverityBarPoint[];
  yLabel?: string;
}

export default function SeverityStackedBars({ data, yLabel = "# loans modified" }: Props) {
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
            formatter={(value) => Number(value).toLocaleString()}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#8b8ba8" }} />
          <Bar dataKey="minimal"  name="Minimal (<20% PIK share)" stackId="a" fill="#fde68a" />
          <Bar dataKey="moderate" name="Moderate (20–50%)"        stackId="a" fill="#f97316" />
          <Bar dataKey="severe"   name="Severe (≥50% or all-PIK)"  stackId="a" fill="#dc2626" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
