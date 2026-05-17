"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
  Area,
  Bar,
  ReferenceLine,
} from "recharts";
import type { BDCQuarter } from "@/data/bdcs_history";
import type { PIKModEvent } from "@/data/pik_modifications";

interface Props {
  rows: BDCQuarter[];
  modRows: PIKModEvent[];
  ticker: string;
  /** Hide the bottom credit-quality (NA% / PIK%) panel — useful when a richer
   *  credit section already lives elsewhere on the page. */
  hideCreditPanel?: boolean;
}

const fmtBn = (v: number) => `$${v.toFixed(1)}B`;
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

const hasNonZero = (rows: { na: number; pik: number }[]) =>
  rows.some((r) => r.na > 0 || r.pik > 0);

export default function BDCTimelineChart({ rows, modRows, ticker, hideCreditPanel }: Props) {
  const data = rows.map((r) => ({
    period_end: r.period_end,
    cost: r.total_cost_b,
    fv: r.total_fv_b,
    n: r.n_positions,
    na: r.na_pct_at_cost,
    pik: r.pik_pct_at_cost,
  }));

  // Build modification series aligned to the SAME quarter axis as `data`.
  // Each bucket is expressed as % of eligible-loan COST for the quarter (not loan count).
  const modByPeriod = new Map(modRows.map((m) => [m.period_end, m]));
  const modData = rows.map((r) => {
    const m = modByPeriod.get(r.period_end);
    const pctCured = m && m.total_cost
      ? (100 * (m.cured_cost ?? 0)) / m.total_cost
      : 0;
    const pctNewTotal = (m?.pct_new_minimal_cost ?? 0)
      + (m?.pct_new_moderate_cost ?? 0)
      + (m?.pct_new_severe_cost ?? 0);
    return {
      period_end: r.period_end,
      new_minimal: m?.pct_new_minimal_cost ?? 0,
      new_moderate: m?.pct_new_moderate_cost ?? 0,
      new_severe:   m?.pct_new_severe_cost ?? 0,
      cured: -pctCured,           // negative bar below zero line
      net:   pctNewTotal - pctCured,
    };
  });
  const showModPanel = modRows.length > 0;

  const showCreditPanel = !hideCreditPanel && hasNonZero(data);

  return (
    <div className="space-y-6">
    <div
      className="rounded-xl border p-5"
      style={{ background: "#111118", borderColor: "#1e1e2e" }}
    >
      <h2 className="font-semibold text-white mb-1">{ticker} portfolio size over time</h2>
      <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
        Amortized cost vs fair value (US$ billions) per quarter-end. Source: SEC EDGAR 10-K/10-Q SOI parsing.
      </p>
      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
            <XAxis
              dataKey="period_end"
              tick={{ fill: "#8b8ba8", fontSize: 11 }}
              tickFormatter={(v: string) => v.slice(0, 7)}
              minTickGap={20}
            />
            <YAxis
              yAxisId="left"
              tick={{ fill: "#8b8ba8", fontSize: 11 }}
              tickFormatter={(v: number) => `$${v}B`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: "#8b8ba8", fontSize: 11 }}
              tickFormatter={(v: number) => `${v}`}
            />
            <Tooltip
              contentStyle={{
                background: "#0f0f16",
                border: "1px solid #1e1e2e",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#d1d5db" }}
              formatter={(value, name) => {
                const v = Number(value);
                if (name === "Positions") return [v.toString(), name as string];
                return [fmtBn(v), name as string];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#8b8ba8" }} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="cost"
              name="Amortized cost"
              stroke="#6366f1"
              strokeWidth={2}
              fill="#6366f1"
              fillOpacity={0.18}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="fv"
              name="Fair value"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="n"
              name="Positions"
              stroke="#eab308"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>

    {showModPanel && (
      <div
        className="rounded-xl border p-5"
        style={{ background: "#111118", borderColor: "#1e1e2e" }}
      >
        <h2 className="font-semibold text-white mb-1">{ticker} PIK modifications by quarter — % of cost</h2>
        <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
          Cost of loans flipping cash-pay → PIK that quarter, as % of eligible-loan cost (stacked
          above, by severity). Cured cost shown below as negative bar. Light line = net change.
        </p>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={modData} margin={{ top: 10, right: 30, left: 0, bottom: 8 }} stackOffset="sign">
              <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
              <XAxis
                dataKey="period_end"
                tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(0, 7)}
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
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
                formatter={(value, name) => {
                  const v = Number(value);
                  const n = name as string;
                  return n === "Cured (PIK → cash)"
                    ? [`${Math.abs(v).toFixed(2)}%`, n]
                    : [`${v.toFixed(2)}%`, n];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#8b8ba8" }} />
              <Bar dataKey="new_minimal"  name="New mod — minimal"  stackId="a" fill="#fde68a" />
              <Bar dataKey="new_moderate" name="New mod — moderate" stackId="a" fill="#f97316" />
              <Bar dataKey="new_severe"   name="New mod — severe"   stackId="a" fill="#dc2626" />
              <Bar dataKey="cured"        name="Cured (PIK → cash)" stackId="a" fill="#22c55e" />
              <Line
                type="monotone"
                dataKey="net"
                name="Net change"
                stroke="#e5e7eb"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}

    {showCreditPanel && (
      <div
        className="rounded-xl border p-5"
        style={{ background: "#111118", borderColor: "#1e1e2e" }}
      >
        <h2 className="font-semibold text-white mb-1">{ticker} credit quality over time</h2>
        <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
          Non-accrual % and PIK % at amortized cost, decoded from per-position SOI footnotes.
        </p>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
              <XAxis
                dataKey="period_end"
                tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(0, 7)}
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f0f16",
                  border: "1px solid #1e1e2e",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#d1d5db" }}
                formatter={(value) => fmtPct(Number(value))}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: "#8b8ba8" }} />
              <Line
                type="monotone"
                dataKey="na"
                name="Non-accrual % (cost)"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
              <Line
                type="monotone"
                dataKey="pik"
                name="PIK % (cost)"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}
    </div>
  );
}
