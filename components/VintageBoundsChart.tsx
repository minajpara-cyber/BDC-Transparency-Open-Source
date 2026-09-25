"use client";

// Disclosed-dates-only view (secondary tab on /vintage): lower / upper bounds
// on observed quarter-end non-accrual for fixed-horizon holding cohorts.

import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from "recharts";

const COLORS = ["#a855f7", "#ec4899", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6"];

export interface BoundsSeries {
  cohort_year: number;
  n_issuers: number; issuers: string[]; n_holdings: number; entry_cost_b: number;
  points: Array<{ age_quarters: number; lower: number | null; upper: number | null }>;
}

export default function VintageBoundsChart({ series, height = 340 }: { series: BoundsSeries[]; height?: number }) {
  const ordered = [...series].sort((a, b) => a.cohort_year - b.cohort_year);
  const ages = Array.from(new Set(series.flatMap((s) => s.points.map((p) => p.age_quarters)))).sort((a, b) => a - b);
  const data = ages.map((age) => {
    const row: Record<string, number | null> = { age_quarters: age };
    for (const s of ordered) {
      const p = s.points.find((point) => point.age_quarters === age);
      row[`${s.cohort_year}_lower`] = p?.lower ?? null;
      row[`${s.cohort_year}_upper`] = p?.upper ?? null;
    }
    return row;
  });
  if (!data.length) return <p className="text-sm text-gray-400">No eligible cohort observations for these filters.</p>;
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 18, left: 4, bottom: 16 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
          <XAxis dataKey="age_quarters" type="number" domain={[0, "dataMax"]}
            tick={{ fill: "#8b8ba8", fontSize: 11 }} tickFormatter={(v: number) => `${v / 4}y`}
            label={{ value: "Time from the selected cohort anchor", position: "insideBottom", offset: -8, fill: "#8b8ba8", fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fill: "#8b8ba8", fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip contentStyle={{ background: "#0f0f16", border: "1px solid #1e1e2e", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(label) => `${Number(label)} quarters from cohort anchor`}
            formatter={(value, name) => {
              const cohort = ordered.find((s) => String(name).startsWith(String(s.cohort_year)));
              const evidence = cohort ? ` · ${cohort.n_issuers} holders · ${cohort.n_holdings} groups · $${cohort.entry_cost_b.toFixed(3)}B initial cost` : "";
              return [value == null ? "Unknown" : `${Number(value).toFixed(2)}%${evidence}`, String(name)];
            }} />
          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
          {ordered.flatMap((s, i) => [
            <Line key={`${s.cohort_year}_lower`} dataKey={`${s.cohort_year}_lower`} name={`${s.cohort_year} observed NA (lower)`}
              type="linear" stroke={COLORS[i % COLORS.length]} strokeWidth={2} connectNulls={false} dot={{ r: 2 }} isAnimationActive={false} />,
            <Line key={`${s.cohort_year}_upper`} dataKey={`${s.cohort_year}_upper`} name={`${s.cohort_year} including unresolved (upper)`}
              type="linear" stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} strokeDasharray="5 4" connectNulls={false} dot={false} isAnimationActive={false} />,
          ])}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
