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
  ReferenceLine,
} from "recharts";

export interface IndustryPoint {
  period_end: string;
  value: number;        // industry-aggregate metric value (e.g., weighted % NA)
  coverage: number;     // count of BDCs reporting this quarter
}

interface Props {
  data: IndustryPoint[];
  yLabel: string;
  unit?: string;        // suffix like "%" or "" (count)
  color?: string;
  height?: number;
}

export default function CreditLensChart({
  data,
  yLabel,
  unit = "%",
  color = "#6366f1",
  height = 280,
}: Props) {
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
            tickFormatter={(v: number) => (unit === "%" ? `${v.toFixed(0)}%` : `${v}`)}
            label={{ value: yLabel, angle: -90, position: "insideLeft", fill: "#8b8ba8", fontSize: 11 }}
          />
          <ReferenceLine y={0} stroke="#3b3b55" />
          <Tooltip
            contentStyle={{
              background: "#0f0f16",
              border: "1px solid #1e1e2e",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "#d1d5db" }}
            formatter={(value, _name, item) => {
              const v = Number(value);
              const coverage =
                (item?.payload as IndustryPoint | undefined)?.coverage ?? null;
              const valStr = unit === "%" ? `${v.toFixed(2)}%` : v.toLocaleString();
              return [`${valStr}  (n=${coverage ?? "?"} BDCs)`, "Industry weighted avg"];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#8b8ba8" }} />
          <Line
            type="monotone"
            dataKey="value"
            name="Industry aggregate"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
