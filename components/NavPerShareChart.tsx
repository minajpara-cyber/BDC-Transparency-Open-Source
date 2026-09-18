"use client";

// NAV per share, indexed to 100 at a common start, for up to six BDCs against
// the median BDC. A dividend paid out of income leaves NAV flat; one paid partly
// out of capital, or eaten by credit losses, shows up as a falling line.
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
import type { NavPoint } from "@/data/dividend_support";

const COLORS = ["#a5b4fc", "#fda4af", "#86efac", "#fde68a", "#67e8f9", "#d8b4fe"];

export default function NavPerShareChart({ points, defaultTickers }: { points: NavPoint[]; defaultTickers: string[] }) {
  const tickers = useMemo(() => Array.from(new Set(points.map((p) => p.ticker))).sort(), [points]);
  const [sel, setSel] = useState<string[]>(defaultTickers.slice(0, 6));
  const [base, setBase] = useState("2023-06-30");
  const data = useMemo(() => {
    const byT = new Map<string, Map<string, number>>();
    for (const p of points) {
      if (!byT.has(p.ticker)) byT.set(p.ticker, new Map());
      byT.get(p.ticker)!.set(p.period_end, p.nav_ps);
    }
    const periods = Array.from(new Set(points.map((p) => p.period_end))).filter((p) => p >= base).sort();
    return periods.map((pe) => {
      const rec: Record<string, number | string | null> = { period_end: pe };
      const idx: number[] = [];
      for (const [t, m] of byT) {
        const b0 = m.get(base), v = m.get(pe);
        if (b0 && v) {
          const iv = (100 * v) / b0;
          idx.push(iv);
          if (sel.includes(t)) rec[t] = +iv.toFixed(2);
        }
      }
      idx.sort((a, b) => a - b);
      rec.median = idx.length >= 5 ? +idx[Math.floor(idx.length / 2)].toFixed(2) : null;
      return rec;
    });
  }, [points, sel, base]);

  return (
    <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="max-w-3xl">
          <h3 className="font-semibold text-white text-sm">NAV per share, indexed (start = 100)</h3>
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            Split-adjusted NAV per share against the median BDC (dashed). Non-traded BDCs use their Class I NAV.
          </p>
        </div>
        <select value={base} onChange={(e) => setBase(e.target.value)}
          className="text-xs rounded px-2 py-1 border"
          style={{ background: "#0f0f16", borderColor: "#2d2d45", color: "#e5e7eb" }}>
          <option value="2019-12-31">Since end-2019</option>
          <option value="2021-12-31">Since end-2021</option>
          <option value="2023-06-30">Last three years</option>
          <option value="2025-06-30">Last year</option>
        </select>
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
            <YAxis tick={{ fill: "#6b6b88", fontSize: 11 }} width={44} domain={["auto", "auto"]} />
            <ReferenceLine y={100} stroke="#3b3b55" />
            <Tooltip contentStyle={{ background: "#0f0f16", border: "1px solid #2d2d45", fontSize: 12 }}
              labelStyle={{ color: "#e5e7eb" }}
              formatter={(v, name) => [Number(v).toFixed(1), name === "median" ? "Median BDC" : String(name)]} />
            <Line type="monotone" dataKey="median" stroke="#e5e7eb" strokeDasharray="6 3" strokeWidth={2}
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
