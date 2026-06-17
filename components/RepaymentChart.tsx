"use client";

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export interface RepaymentPoint {
  period_end: string;
  repaid: number;       // % of prior-quarter book repaid healthy
  distressed: number;   // % that left distressed
}

/** Portfolio turnover: % of the book leaving each quarter, healthy repayment
 *  (stacked green) vs distressed exit (red), with the repayment line on top.
 *  A proxy for prepayment speed — high = short effective duration. */
export default function RepaymentChart({ data }: { data: RepaymentPoint[] }) {
  if (data.length < 3) return null;
  return (
    <div style={{ width: "100%", height: 230 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
          <XAxis dataKey="period_end" tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(0, 7)} minTickGap={40} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: number) => `${v}%`} width={40} />
          <Tooltip
            contentStyle={{ background: "#15151f", border: "1px solid #2d2d50", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#8b8ba8" }}
            formatter={(v, name) => [typeof v === "number" ? `${v.toFixed(2)}%` : "—", String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="repaid" name="Repaid / refinanced" stackId="a" fill="#22c55e" />
          <Bar dataKey="distressed" name="Distressed exit" stackId="a" fill="#ef4444" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
