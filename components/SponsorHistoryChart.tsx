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
import type { SponsorHistoryRow } from "@/data/sponsors_history";

type Mode = "fv" | "credit";

type SponsorHistoryPikFields = {
  pct_pik_now_upper?: number;
  pik_observation_coverage_pct?: number | null;
  pik_publication_status?: string;
};

interface Props {
  // Optional fields keep older generated sponsor artifacts renderable.
  rows: Array<SponsorHistoryRow & SponsorHistoryPikFields>;
  mode: Mode;
  height?: number;
}

export default function SponsorHistoryChart({ rows, mode, height = 240 }: Props) {
  const data = rows.map((r) => {
    const unavailable = r.pik_publication_status === "unavailable";
    return {
      period_end: r.period_end,
      total_fv_b: r.total_fv / 1e9,
      pct_below_95: r.pct_below_95,
      pct_non_accrual: r.pct_non_accrual,
      pct_pik_now: unavailable ? null : r.pct_pik_now,
      pct_pik_now_upper: !unavailable
        && r.pik_publication_status === "bounded"
        && Number.isFinite(r.pct_pik_now_upper)
        ? r.pct_pik_now_upper as number
        : null,
      pik_observation_coverage_pct: Number.isFinite(r.pik_observation_coverage_pct)
        ? r.pik_observation_coverage_pct as number
        : null,
      n_positions: r.n_positions,
    };
  });
  const hasPikUpperBound = data.some((r) => r.pct_pik_now_upper != null);
  const hasPikCoverage = data.some((r) => r.pik_observation_coverage_pct != null);

  const isFV = mode === "fv";
  const fmtTick = (v: number) =>
    isFV ? `$${v.toFixed(1)}B` : `${v.toFixed(0)}%`;
  const fmtValue = (v: number) =>
    isFV ? `$${v.toFixed(2)}B` : `${v.toFixed(2)}%`;

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
              value: isFV ? "Aggregate FV (USD B)" : "% positions",
              angle: -90,
              position: "insideLeft",
              fill: "#8b8ba8",
              fontSize: 11,
            }}
          />
          {!isFV && hasPikCoverage && (
            <YAxis
              yAxisId="coverage"
              orientation="right"
              domain={[0, 100]}
              tick={{ fill: "#6b7280", fontSize: 10 }}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              width={34}
            />
          )}
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
          {isFV ? (
            <Line
              type="monotone"
              dataKey="total_fv_b"
              name="Aggregate FV"
              stroke="#6366f1"
              strokeWidth={2.5}
              dot={{ r: 2.5 }}
              connectNulls
            />
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="pct_below_95"
                name="< 95¢"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="pct_non_accrual"
                name="Non-accrual"
                stroke="#f87171"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="pct_pik_now"
                name="PIK lower bound"
                stroke="#a5b4fc"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              {hasPikUpperBound && (
                <Line
                  type="monotone"
                  dataKey="pct_pik_now_upper"
                  name="PIK upper bound"
                  stroke="#c4b5fd"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={{ r: 1.5 }}
                />
              )}
              {hasPikCoverage && (
                <Line
                  type="monotone"
                  dataKey="pik_observation_coverage_pct"
                  name="PIK observation coverage"
                  yAxisId="coverage"
                  stroke="#6b7280"
                  strokeWidth={1.5}
                  strokeDasharray="2 4"
                  dot={false}
                />
              )}
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
