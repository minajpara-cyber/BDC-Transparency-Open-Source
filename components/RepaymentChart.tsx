"use client";

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from "recharts";

export interface RepaymentPoint {
  period_end: string;
  deployed: number;     // % of prior-quarter book deployed (new capital)  [above 0]
  repaid: number;       // % repaid healthy                                [below 0]
  distressed: number;   // % left distressed                              [below 0]
  indDeployed?: number | null;  // industry-avg deployment (above 0)
  indOutflow?: number | null;   // industry-avg total outflow (below 0)
}

/** Portfolio FLOWS per quarter, as % of the prior-quarter book: capital
 *  DEPLOYED above zero (new originations entering), capital LEAVING below
 *  zero (healthy repayment + distressed exit). Net = book growth/run-off.
 *  Dashed lines are the industry averages on each side. */
export default function RepaymentChart({ data }: { data: RepaymentPoint[] }) {
  if (data.length < 3) return null;
  const hasIndustry = data.some((d) => d.indDeployed != null || d.indOutflow != null);
  // repaid/distressed rendered as negative so they stack below zero.
  const rows = data.map((d) => ({
    period_end: d.period_end,
    deployed: d.deployed,
    repaidNeg: -Math.abs(d.repaid),
    distressedNeg: -Math.abs(d.distressed),
    indDeployed: d.indDeployed ?? null,
    indOutflowNeg: d.indOutflow != null ? -Math.abs(d.indOutflow) : null,
  }));
  return (
    <div style={{ width: "100%", height: 250 }}>
      <ResponsiveContainer>
        <ComposedChart data={rows} stackOffset="sign" margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
          <XAxis dataKey="period_end" tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: string) => v.slice(0, 7)} minTickGap={40} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }}
            tickFormatter={(v: number) => `${Math.abs(v)}%`} width={40} />
          <ReferenceLine y={0} stroke="#3d3d52" />
          <Tooltip
            contentStyle={{ background: "#15151f", border: "1px solid #2d2d50", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#8b8ba8" }}
            formatter={(v, name) => [typeof v === "number" ? `${Math.abs(v).toFixed(2)}%` : "—", String(name)]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="deployed" name="Deployed (new)" stackId="a" fill="#6366f1" />
          <Bar dataKey="repaidNeg" name="Repaid / refinanced" stackId="a" fill="#22c55e" />
          <Bar dataKey="distressedNeg" name="Distressed exit" stackId="a" fill="#ef4444" />
          {hasIndustry && (
            <Line type="monotone" dataKey="indDeployed" name="Industry deployed (avg)"
              stroke="#a5b4fc" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
          )}
          {hasIndustry && (
            <Line type="monotone" dataKey="indOutflowNeg" name="Industry outflow (avg)"
              stroke="#86efac" strokeWidth={1.5} strokeDasharray="5 4" dot={false} connectNulls />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
