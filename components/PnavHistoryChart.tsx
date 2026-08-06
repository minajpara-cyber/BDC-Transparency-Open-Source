"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  Legend, ReferenceLine,
} from "recharts";

export interface PnavChartSeries {
  name: string;
  color: string;
  dash?: string;
  width?: number;
  d: string[];
  v: number[];
}

/** Multi-series price/NAV history on a shared (sparse) date axis. */
export default function PnavHistoryChart({
  series, from, height = 340,
}: { series: PnavChartSeries[]; from: string; height?: number }) {
  const rows = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();
    for (const s of series) {
      for (let i = 0; i < s.d.length; i++) {
        const d = s.d[i];
        if (d < from) continue;
        let row = byDate.get(d);
        if (!row) {
          row = { date: d };
          byDate.set(d, row);
        }
        row[s.name] = s.v[i];
      }
    }
    return [...byDate.values()].sort((a, b) =>
      String(a.date).localeCompare(String(b.date)));
  }, [series, from]);

  if (rows.length < 4) return null;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(0, 7)}
            minTickGap={50}
          />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: number) => `${v.toFixed(2)}x`}
            domain={["auto", "auto"]}
            width={48}
          />
          <Tooltip
            contentStyle={{ background: "#15151f", border: "1px solid #2d2d50", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#8b8ba8" }}
            formatter={(v, name) => [typeof v === "number" ? `${v.toFixed(3)}x` : "—", String(name)]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <ReferenceLine y={1} stroke="#4b4b6b" strokeDasharray="4 4"
            label={{ value: "NAV", fill: "#6b6b88", fontSize: 10, position: "insideTopRight" }} />
          {series.map((s) => (
            <Line key={s.name} type="monotone" dataKey={s.name} name={s.name}
              stroke={s.color} strokeWidth={s.width ?? 1.6}
              strokeDasharray={s.dash} dot={false} connectNulls
              isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
