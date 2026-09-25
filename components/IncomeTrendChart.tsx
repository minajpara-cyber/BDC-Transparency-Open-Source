"use client";

// Trailing-four-quarter trend of one income-quality measure: the universe
// median plus up to six BDCs the reader picks. Coverage metrics get a 1.0x
// reference line — below it, the dividend is being paid out of more than the
// measured income.
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  ReferenceLine,
} from "recharts";
import type { IncomeTtmRow, IncomeUniverseRow } from "@/data/income_coverage";

const COLORS = ["#a5b4fc", "#fda4af", "#86efac", "#fde68a", "#67e8f9", "#d8b4fe"];
const MEDIAN_COLOR = "#e5e7eb";
const MAX_BDCS = COLORS.length;

export type TrendMetric = "pik_pct_nii" | "cov_ex_pik" | "net_pik_pct_nii" | "cov_ex_net_pik";

interface Props {
  rows: IncomeTtmRow[];
  universe: IncomeUniverseRow[];
  metric: TrendMetric;
  defaultTickers: string[];
  title: string;
  subtitle?: string;
  from?: string;
  /** Marks a BDC-quarter value as an estimate: the tooltip adds "(estimate)". */
  isEstimate?: (r: IncomeTtmRow) => boolean;
  /** Tooltip name for the dashed median line. */
  medianLabel?: string;
}

const isCoverage = (m: TrendMetric) => m === "cov_ex_pik" || m === "cov_ex_net_pik";

function medianOf(u: IncomeUniverseRow, m: TrendMetric): number | null {
  if (m === "pik_pct_nii") return u.pik_pct_nii_median;
  if (m === "net_pik_pct_nii") return u.net_pik_pct_nii_median;
  if (m === "cov_ex_net_pik") return u.cov_ex_net_pik_median;
  return u.cov_ex_pik_median;
}

function fmt(m: TrendMetric, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return isCoverage(m) ? `${v.toFixed(2)}x` : `${v.toFixed(1)}%`;
}

export default function IncomeTrendChart({
  rows, universe, metric, defaultTickers, title, subtitle, from = "2016-12-31", isEstimate,
  medianLabel = "Universe median",
}: Props) {
  const tickers = useMemo(() => Array.from(new Set(rows.map((r) => r.ticker))).sort(), [rows]);
  const [sel, setSel] = useState<string[]>(defaultTickers.slice(0, MAX_BDCS));

  const data = useMemo(() => {
    const byP = new Map<string, Record<string, string | number | null>>();
    for (const u of universe) {
      if (u.period_end < from) continue;
      byP.set(u.period_end, { period_end: u.period_end, median: medianOf(u, metric) });
    }
    for (const r of rows) {
      if (r.period_end < from || !sel.includes(r.ticker)) continue;
      const rec = byP.get(r.period_end) ?? { period_end: r.period_end };
      rec[r.ticker] = r[metric];
      if (isEstimate && r[metric] != null && isEstimate(r)) rec[`${r.ticker}__estimate`] = 1;
      byP.set(r.period_end, rec);
    }
    return [...byP.values()].sort((a, b) => String(a.period_end).localeCompare(String(b.period_end)));
  }, [rows, universe, metric, sel, from, isEstimate]);

  const toggle = (t: string) =>
    setSel((s) => (s.includes(t) ? s.filter((x) => x !== t) : s.length >= MAX_BDCS ? s : [...s, t]));

  return (
    <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="mb-3">
        <h3 className="font-semibold text-white text-sm">{title}</h3>
        {subtitle && <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-4">
        <span className="text-xs mr-1 self-center" style={{ color: "#6b6b88" }}>
          BDCs ({sel.length}/{MAX_BDCS}) ·
        </span>
        {tickers.map((t) => {
          const on = sel.includes(t);
          const color = on ? COLORS[sel.indexOf(t) % COLORS.length] : undefined;
          const blocked = !on && sel.length >= MAX_BDCS;
          return (
            <button
              key={t}
              onClick={() => toggle(t)}
              disabled={blocked}
              title={blocked ? `Max ${MAX_BDCS} BDCs` : ""}
              className="text-xs font-mono px-2 py-0.5 rounded border transition-all"
              style={{
                background: on ? `${color}22` : "transparent",
                borderColor: on ? color : "#2d2d45",
                color: on ? color : blocked ? "#3b3b55" : "#9ca3af",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1e1e2e" vertical={false} />
            <XAxis dataKey="period_end" tick={{ fill: "#6b6b88", fontSize: 11 }}
              tickFormatter={(v: string) => v.slice(0, 7)} minTickGap={28} />
            <YAxis tick={{ fill: "#6b6b88", fontSize: 11 }} width={52}
              domain={isCoverage(metric) ? [0, "auto"] : [0, "auto"]}
              tickFormatter={(v: number) => (isCoverage(metric) ? `${v.toFixed(1)}x` : `${v.toFixed(0)}%`)} />
            {isCoverage(metric) && (
              <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="4 4"
                label={{ value: "1.0x — fully covered", fill: "#ef4444", fontSize: 10, position: "insideTopLeft" }} />
            )}
            <Tooltip
              contentStyle={{ background: "#0f0f16", border: "1px solid #2d2d45", fontSize: 12 }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(v, name, item) => {
                const est = name !== "median" && (item?.payload as Record<string, unknown> | undefined)?.[`${String(name)}__estimate`];
                return [`${fmt(metric, v as number)}${est ? " (estimate)" : ""}`, name === "median" ? medianLabel : String(name)];
              }}
              labelFormatter={(l) => `TTM to ${String(l)}`}
            />
            <Line type="monotone" dataKey="median" stroke={MEDIAN_COLOR} strokeWidth={2.5}
              strokeDasharray="6 3" dot={false} connectNulls isAnimationActive={false} name="median" />
            {sel.map((t, i) => (
              <Line key={t} type="monotone" dataKey={t} stroke={COLORS[i % COLORS.length]}
                strokeWidth={1.8} dot={false} connectNulls={false} isAnimationActive={false} name={t} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
        Dashed white = median of the covered BDCs each quarter. Every point is a trailing four-quarter
        figure, so one lumpy quarter moves it a quarter as much.
      </p>
    </div>
  );
}
