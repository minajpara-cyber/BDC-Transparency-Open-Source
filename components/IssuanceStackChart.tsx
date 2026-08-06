"use client";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

const COLORS = ["#6366f1", "#f59e0b", "#22c55e", "#06b6d4", "#a855f7", "#ec4899", "#5b5b78"];

/** Quarterly gross equity issuance, stacked by the biggest issuers. */
export default function IssuanceStackChart({
  data, tickers, height = 300,
}: { data: Record<string, number | string>[]; tickers: string[]; height?: number }) {
  const keys = [...tickers, "Other"];
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="quarter" tick={{ fill: "#6b7280", fontSize: 11 }} minTickGap={12} />
          <YAxis
            tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v}M`)}
            width={56}
          />
          <Tooltip
            contentStyle={{ background: "#15151f", border: "1px solid #2d2d50", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#8b8ba8" }}
            formatter={(v, name) => [
              typeof v === "number" ? `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}M` : "—",
              String(name),
            ]}
            itemSorter={(item) => -(item.value as number)}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {keys.map((k, i) => (
            <Bar key={k} dataKey={k} name={k} stackId="iss"
              fill={COLORS[i % COLORS.length]} maxBarSize={46}
              isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
