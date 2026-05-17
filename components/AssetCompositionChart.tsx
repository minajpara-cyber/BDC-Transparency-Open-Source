"use client";

import {
  ResponsiveContainer,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Area,
} from "recharts";

export interface CompositionPoint {
  period_end: string;
  pct_first_lien: number;
  pct_second_lien: number;
  pct_unsecured: number;
  pct_subordinated: number;
  pct_structured_jv: number;
  pct_equity: number;
  pct_other: number; // unsecured+subordinated+abf+other_secured+other+cash+unclassified rolled together
}

interface Props {
  data: CompositionPoint[];
  title: string;
  subtitle?: string;
}

const SERIES: Array<{ key: keyof Omit<CompositionPoint, "period_end">; label: string; color: string }> = [
  { key: "pct_first_lien",     label: "First lien",       color: "#22c55e" },
  { key: "pct_second_lien",    label: "Second lien",      color: "#eab308" },
  { key: "pct_unsecured",      label: "Unsecured",        color: "#f97316" },
  { key: "pct_subordinated",   label: "Subordinated",     color: "#ef4444" },
  { key: "pct_structured_jv",  label: "Structured / JV",  color: "#06b6d4" },
  { key: "pct_equity",         label: "Equity",           color: "#a855f7" },
  { key: "pct_other",          label: "Other",            color: "#6b6b88" },
];

export default function AssetCompositionChart({ data, title, subtitle }: Props) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ background: "#111118", borderColor: "#1e1e2e" }}
    >
      <h3 className="font-semibold text-white text-sm">{title}</h3>
      {subtitle && (
        <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>{subtitle}</p>
      )}
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <AreaChart data={data} stackOffset="expand" margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
            <XAxis
              dataKey="period_end"
              tick={{ fill: "#8b8ba8", fontSize: 11 }}
              tickFormatter={(v: string) => v.slice(0, 7)}
              minTickGap={20}
            />
            <YAxis
              tick={{ fill: "#8b8ba8", fontSize: 11 }}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            />
            <Tooltip
              contentStyle={{
                background: "#0f0f16",
                border: "1px solid #1e1e2e",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#d1d5db" }}
              formatter={(value) => `${Number(value).toFixed(1)}%`}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#8b8ba8" }} />
            {SERIES.map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.7}
                stackId="1"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
