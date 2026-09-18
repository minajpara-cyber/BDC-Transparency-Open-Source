"use client";

// Uncollected PIK as a share of the portfolio over time: PIK booked since the
// window start, less what has since been collected on exits or lost. A line
// that keeps rising is a BDC whose PIK is piling up faster than it is being
// repaid.
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
} from "recharts";
import type { PikLedgerQuarter } from "@/data/pik_ledger";

const COLORS = ["#a5b4fc", "#fda4af", "#86efac", "#fde68a", "#67e8f9", "#d8b4fe"];

export default function PikStockChart({ points, defaultTickers }: { points: PikLedgerQuarter[]; defaultTickers: string[] }) {
  const tickers = useMemo(() => Array.from(new Set(points.filter((p) => p.ticker !== "ALL").map((p) => p.ticker))).sort(), [points]);
  const [sel, setSel] = useState<string[]>(defaultTickers.slice(0, 6));
  const data = useMemo(() => {
    const periods = Array.from(new Set(points.map((p) => p.period_end))).sort();
    const byKey = new Map(points.map((p) => [`${p.ticker}|${p.period_end}`, p.unresolved_pct_book]));
    return periods.map((pe) => {
      const rec: Record<string, number | string | null> = { period_end: pe, ALL: byKey.get(`ALL|${pe}`) ?? null };
      for (const t of sel) rec[t] = byKey.get(`${t}|${pe}`) ?? null;
      return rec;
    });
  }, [points, sel]);

  return (
    <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="mb-3 max-w-3xl">
        <h3 className="font-semibold text-white text-sm">Uncollected PIK as % of the portfolio, over time</h3>
        <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
          PIK booked since the window start that has neither been collected on an exit nor lost, as a share of
          investments at cost. All BDCs pooled is the dashed line. Early values are floors: PIK booked before the
          window is not counted.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tickers.map((t) => {
          const on = sel.includes(t);
          const c = on ? COLORS[sel.indexOf(t) % COLORS.length] : undefined;
          const blocked = !on && sel.length >= COLORS.length;
          return (
            <button key={t} disabled={blocked}
              onClick={() => setSel(on ? sel.filter((x) => x !== t) : [...sel, t])}
              className="text-xs font-mono px-2 py-0.5 rounded border transition-all"
              style={{ background: on ? `${c}22` : "transparent", borderColor: on ? c : "#2d2d45",
                color: on ? c : blocked ? "#3b3b55" : "#9ca3af" }}>
              {t}
            </button>
          );
        })}
      </div>
      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1e1e2e" vertical={false} />
            <XAxis dataKey="period_end" tick={{ fill: "#6b6b88", fontSize: 11 }}
              tickFormatter={(v: string) => v.slice(0, 7)} minTickGap={24} />
            <YAxis tick={{ fill: "#6b6b88", fontSize: 11 }} width={44} domain={[0, "auto"]}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
            <Tooltip contentStyle={{ background: "#0f0f16", border: "1px solid #2d2d45", fontSize: 12 }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(v, name) => [`${Number(v).toFixed(2)}%`, name === "ALL" ? "All BDCs" : String(name)]} />
            <Line type="monotone" dataKey="ALL" stroke="#e5e7eb" strokeDasharray="6 3" strokeWidth={2}
              dot={false} isAnimationActive={false} connectNulls />
            {sel.map((t, i) => (
              <Line key={t} type="monotone" dataKey={t} stroke={COLORS[i % COLORS.length]} strokeWidth={1.8}
                dot={false} isAnimationActive={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
