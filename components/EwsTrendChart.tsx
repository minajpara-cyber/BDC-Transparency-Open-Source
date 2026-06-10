"use client";

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export interface EwsTrendPoint {
  period_end: string;
  bdc: number | null;
  industry: number | null;
}

/** Implied 2Q NA formation over time — this BDC vs the industry aggregate. */
export default function EwsTrendChart({ data, ticker }: { data: EwsTrendPoint[]; ticker: string }) {
  if (data.length < 4) return null;
  return (
    <div style={{ width: "100%", height: 220 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
          <XAxis
            dataKey="period_end"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(0, 7)}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            width={44}
          />
          <Tooltip
            contentStyle={{ background: "#15151f", border: "1px solid #2d2d50", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#8b8ba8" }}
            formatter={(v, name) => [typeof v === "number" ? `${v.toFixed(2)}%` : "—", String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="bdc" name={ticker} stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="industry" name="Industry" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
