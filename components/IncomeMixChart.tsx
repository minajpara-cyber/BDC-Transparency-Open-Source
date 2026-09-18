"use client";

// One BDC, quarter by quarter: net investment income split into the part that
// arrived in cash, discount accretion, and PIK — against the distributions it
// declared. Where the distribution line runs above the cash bar, the dividend
// leaned on income that has not yet been collected.
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
  Legend,
} from "recharts";
import type { IncomeQuarterRow } from "@/data/income_coverage";

interface Props {
  rows: IncomeQuarterRow[];
  defaultTicker: string;
}

export default function IncomeMixChart({ rows, defaultTicker }: Props) {
  const tickers = useMemo(() => Array.from(new Set(rows.map((r) => r.ticker))).sort(), [rows]);
  const [tk, setTk] = useState(defaultTicker);
  const [from, setFrom] = useState("2019-12-31");

  const data = useMemo(
    () => rows
      .filter((r) => r.ticker === tk && r.period_end >= from && r.nii != null)
      .sort((a, b) => a.period_end.localeCompare(b.period_end))
      .map((r) => {
        const pik = r.pik ?? 0;
        const acc = r.acc ?? 0;
        return {
          period_end: r.period_end,
          cash: +((r.nii as number) - pik - acc).toFixed(2),
          acc: +acc.toFixed(2),
          pik: +pik.toFixed(2),
          dist: r.dist,
        };
      }),
    [rows, tk, from],
  );

  return (
    <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="max-w-3xl">
          <h3 className="font-semibold text-white text-sm">Where each quarter&apos;s NII came from, against the dividend</h3>
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            Bars stack to reported NII: <span style={{ color: "#818cf8" }}>cash income</span>,{" "}
            <span style={{ color: "#c4b5fd" }}>discount accretion</span>{" "}and{" "}
            <span style={{ color: "#f59e0b" }}>PIK</span>. The line is distributions declared. When the line
            sits above the blue bar, part of that quarter&apos;s dividend was paid out of income that had not
            arrived as cash. Single quarters are lumpy — specials, supplementals and PIK catch-ups — so read
            the pattern, not one bar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select value={tk} onChange={(e) => setTk(e.target.value)}
            className="text-xs rounded px-2 py-1 border font-mono"
            style={{ background: "#0f0f16", borderColor: "#2d2d45", color: "#e5e7eb" }}>
            {tickers.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={from} onChange={(e) => setFrom(e.target.value)}
            className="text-xs rounded px-2 py-1 border"
            style={{ background: "#0f0f16", borderColor: "#2d2d45", color: "#e5e7eb" }}>
            <option value="2013-12-31">All history</option>
            <option value="2019-12-31">Since 2020</option>
            <option value="2022-12-31">Since 2023</option>
          </select>
        </div>
      </div>
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <ComposedChart data={data} stackOffset="sign" margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1e1e2e" vertical={false} />
            <XAxis dataKey="period_end" tick={{ fill: "#6b6b88", fontSize: 11 }}
              tickFormatter={(v: string) => v.slice(0, 7)} minTickGap={20} />
            <YAxis tick={{ fill: "#6b6b88", fontSize: 11 }} width={60}
              tickFormatter={(v: number) => `$${v.toFixed(0)}m`} />
            <Tooltip
              contentStyle={{ background: "#0f0f16", border: "1px solid #2d2d45", fontSize: 12 }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(v, name) => [`$${Number(v).toFixed(1)}m`, String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
            <Bar dataKey="cash" stackId="nii" fill="#818cf8" name="Cash income" isAnimationActive={false} />
            <Bar dataKey="acc" stackId="nii" fill="#c4b5fd" name="Accretion" isAnimationActive={false} />
            <Bar dataKey="pik" stackId="nii" fill="#f59e0b" name="PIK" isAnimationActive={false} />
            <Line type="monotone" dataKey="dist" stroke="#e5e7eb" strokeWidth={2} dot={{ r: 2 }}
              name="Distributions declared" isAnimationActive={false} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
