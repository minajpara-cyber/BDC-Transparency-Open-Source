"use client";

// PIK by the year it was booked, pooled across the BDCs, split by what has
// happened to it since: the maturation curve of PIK. Older PIK has had time
// to be repaid or written off; the newest is almost all still in the book.
// "Still in the book" is observed in the latest schedule; "collected" and
// "lost" are estimates from how each loan left the book.
import { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { PikLedgerYear } from "@/data/pik_ledger";

const SERIES = [
  { key: "collected", label: "Collected (estimate: repaid or refinanced at par)", color: "#86efac" },
  { key: "in_book_performing", label: "Still in the book, performing (observed)", color: "#a5b4fc" },
  { key: "in_book_impaired", label: "In impaired loans (observed)", color: "#fcd34d" },
  { key: "in_book_unknown", label: "Still in the book, PIK status unknown", color: "#6b7280" },
  { key: "lost", label: "Lost (estimated from last mark)", color: "#fca5a5" },
] as const;

export default function PikLedgerYearChart({ rows, latestYear }: { rows: PikLedgerYear[]; latestYear: string }) {
  const [mode, setMode] = useState<"pct" | "usd">("pct");
  const data = rows.map((r) => ({
    year: r.year === latestYear ? `${r.year}*` : r.year,
    total: r.pik_accrued_m,
    ...Object.fromEntries(SERIES.map((s) => [s.key, (mode === "pct" ? r[`${s.key}_pct`] : r[`${s.key}_m`]) ?? null])),
  }));
  return (
    <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="max-w-3xl">
          <h3 className="font-semibold text-white text-sm">PIK by the year it was booked — what has happened to it since</h3>
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            All covered BDCs pooled. Each bar is the PIK booked in that year, followed loan by loan; the colours
            show where those dollars are today. * = year to date.
          </p>
        </div>
        <div className="flex gap-1.5">
          {(["pct", "usd"] as const).map((k) => (
            <button key={k} onClick={() => setMode(k)}
              className="text-xs px-2.5 py-1 rounded border transition-all"
              style={{ background: mode === k ? "rgba(99,102,241,0.15)" : "transparent",
                borderColor: mode === k ? "#6366f1" : "#2d2d45", color: mode === k ? "#a5b4fc" : "#9ca3af" }}>
              {k === "pct" ? "% of the year's PIK" : "$ millions"}
            </button>
          ))}
        </div>
      </div>
      <div style={{ width: "100%", height: 340 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid stroke="#1e1e2e" vertical={false} />
            <XAxis dataKey="year" tick={{ fill: "#6b6b88", fontSize: 11 }} />
            <YAxis tick={{ fill: "#6b6b88", fontSize: 11 }} width={52}
              tickFormatter={(v: number) => (mode === "pct" ? `${v.toFixed(0)}%` : `$${v.toLocaleString()}m`)}
              domain={mode === "pct" ? [0, 100] : [0, "auto"]} />
            <Tooltip contentStyle={{ background: "#0f0f16", border: "1px solid #2d2d45", fontSize: 12 }}
              labelStyle={{ color: "#e5e7eb" }} cursor={{ fill: "rgba(255,255,255,0.04)" }}
              formatter={(v, name) => [v == null ? "—" : mode === "pct" ? `${Number(v).toFixed(1)}%` : `$${Number(v).toFixed(0)}m`, String(name)]}
              labelFormatter={(l, payload) => {
                const t = payload && payload[0] ? (payload[0].payload as { total: number }).total : null;
                return `PIK booked in ${String(l).replace("*", "")}${t != null ? ` — $${t.toFixed(0)}m` : ""}`;
              }} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
