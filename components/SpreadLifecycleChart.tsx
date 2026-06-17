"use client";

import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

export interface SpreadLifecyclePoint {
  period_end: string;
  book: number | null;
  origination: number | null;
  exit: number | null;
}

/** One BDC's spread lifecycle: whole book vs newly-originated vs exiting loans.
 *  New < book = writing tighter than the legacy book (spread compression);
 *  exit > book = the wider loans are the ones leaving (book tightening). */
export default function SpreadLifecycleChart({ data }: { data: SpreadLifecyclePoint[] }) {
  if (data.length < 3) return null;
  return (
    <div style={{ width: "100%", height: 230 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
          <XAxis dataKey="period_end" tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(0, 7)} minTickGap={40} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: number) => `${v}`} width={44}
            domain={["dataMin - 40", "dataMax + 40"]} />
          <Tooltip
            contentStyle={{ background: "#15151f", border: "1px solid #2d2d50", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#8b8ba8" }}
            formatter={(v, name) => [typeof v === "number" ? `${v} bps` : "—", String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="book" name="Whole book" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="origination" name="New originations" stroke="#a855f7" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="exit" name="Exiting / repaid" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
