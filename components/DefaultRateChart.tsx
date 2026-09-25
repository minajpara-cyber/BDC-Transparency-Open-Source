"use client";

// Universe default rate over time, trailing twelve months: the conventional
// "hard" rate (non-accrual + distressed exits), the "shadow" rate that adds
// material distressed modifications, and the same shadow rate counted by
// borrower rather than by dollars — three of the ways published private-credit
// default rates end up disagreeing. The pooled series (scripts/92) uses only
// fully observed BDC windows, so the line starts wherever the data starts.
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  Legend,
} from "recharts";
import type { DefaultRateUniverse } from "@/data/default_rate";

const SERIES: { key: keyof DefaultRateUniverse; label: string; color: string; dash?: string }[] = [
  { key: "default_rate", label: "Shadow rate: hard + term changes (inferred)", color: "#f97316" },
  { key: "hard_rate", label: "Hard rate: new non-accruals + distressed exits", color: "#ef4444" },
  { key: "rate_non_accrual", label: "New non-accruals only (observed)", color: "#a5b4fc" },
  { key: "rate_distressed_exit", label: "Distressed exits only (inferred from exit mark)", color: "#fca5a5", dash: "4 3" },
  { key: "count_rate", label: "Shadow rate by borrower count", color: "#fde68a", dash: "6 3" },
  { key: "na_stock_pct", label: "Non-accrual stock, debt only (point in time)", color: "#6b7280", dash: "2 3" },
];

export default function DefaultRateChart({ data }: { data: DefaultRateUniverse[] }) {
  const [on, setOn] = useState<string[]>(["default_rate", "hard_rate", "rate_non_accrual", "count_rate"]);
  const rows = [...data].sort((a, b) => a.period_end.localeCompare(b.period_end));
  const first = rows[0]?.period_end;
  const last = rows[rows.length - 1]?.period_end;
  return (
    <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="mb-3">
        <h3 className="font-semibold text-white text-sm">Default rate across the BDCs, trailing twelve months</h3>
        <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>
          Share of the debt that was performing a year earlier that defaulted during the year, pooled across
          the BDCs whose twelve-month window is fully observed
          {first && last ? ` (twelve months to ${first.slice(0, 7)} through ${last.slice(0, 7)})` : ""}. Hover a
          point for how many BDCs it pools. Toggle the definitions to see how far apart they sit.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {SERIES.map((s) => {
          const act = on.includes(s.key as string);
          return (
            <button key={s.key as string}
              onClick={() => setOn(act ? on.filter((x) => x !== s.key) : [...on, s.key as string])}
              className="text-xs px-2 py-0.5 rounded border transition-all"
              style={{
                background: act ? `${s.color}22` : "transparent",
                borderColor: act ? s.color : "#2d2d45",
                color: act ? s.color : "#9ca3af",
              }}>
              {s.label}
            </button>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <div className="text-xs py-12 text-center" style={{ color: "#6b6b88" }}>
          No quarter has enough fully observed BDC windows to pool yet.
        </div>
      ) : (
        <div style={{ width: "100%", height: 340 }}>
          <ResponsiveContainer>
            <LineChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#1e1e2e" vertical={false} />
              <XAxis dataKey="period_end" tick={{ fill: "#6b6b88", fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(0, 7)} minTickGap={28} />
              <YAxis tick={{ fill: "#6b6b88", fontSize: 11 }} width={48}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`} domain={[0, "auto"]} />
              <Tooltip
                contentStyle={{ background: "#0f0f16", border: "1px solid #2d2d45", fontSize: 12 }}
                labelStyle={{ color: "#e5e7eb" }}
                formatter={(v, name) => [v == null ? "—" : `${Number(v).toFixed(2)}%`, String(name)]}
                labelFormatter={(l, payload) => {
                  const n = payload?.[0] ? (payload[0].payload as DefaultRateUniverse).n_bdcs : null;
                  return `Twelve months to ${String(l)}${n != null ? ` · ${n} BDCs pooled` : ""}`;
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
              {SERIES.filter((s) => on.includes(s.key as string)).map((s) => (
                <Line key={s.key as string} type="monotone" dataKey={s.key as string} name={s.label}
                  stroke={s.color} strokeWidth={s.key === "default_rate" ? 2.5 : 1.8}
                  strokeDasharray={s.dash} dot={false} connectNulls={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
