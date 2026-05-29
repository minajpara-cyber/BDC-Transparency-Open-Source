"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ModificationEvent } from "@/data/modification_events";

const TYPE_META: Record<string, { label: string; color: string }> = {
  maturity_extended: { label: "Amend & extend", color: "#fbbf24" },
  pik_flip:          { label: "Cash → PIK",     color: "#f97316" },
  spread_cut:        { label: "Spread cut",     color: "#a5b4fc" },
  par_haircut:       { label: "Par cut",        color: "#f87171" },
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "maturity_extended", label: "Amend & extend" },
  { key: "pik_flip", label: "Cash → PIK" },
  { key: "spread_cut", label: "Spread cut" },
];

const MAX_ROWS = 120;

function borrowerSlug(companyNorm: string): string {
  return companyNorm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export default function ModificationEventsTable({ events }: { events: ModificationEvent[] }) {
  const periods = useMemo(
    () => Array.from(new Set(events.map((e) => e.period_end))).sort().reverse(),
    [events],
  );
  const [period, setPeriod] = useState<string>(periods[0] ?? "");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const rows = useMemo(() => {
    let r = events.filter((e) => e.period_end === period);
    if (typeFilter !== "all") r = r.filter((e) => e.mod_types.includes(typeFilter));
    return [...r].sort((a, b) => b.cost_m - a.cost_m);
  }, [events, period, typeFilter]);

  const shown = rows.slice(0, MAX_ROWS);

  // Per-type counts for the active quarter (a loan can have >1 type)
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of events.filter((x) => x.period_end === period))
      for (const t of e.mod_types) c[t] = (c[t] ?? 0) + 1;
    return c;
  }, [events, period]);

  const detail = (e: ModificationEvent): string => {
    const parts: string[] = [];
    if (e.maturity_old && e.maturity_new) parts.push(`maturity ${e.maturity_old} → ${e.maturity_new}`);
    if (e.par_old_m != null && e.par_new_m != null)
      parts.push(`par $${e.par_old_m.toFixed(1)}M → $${e.par_new_m.toFixed(1)}M`);
    if (e.cash_rate_old_bps != null && e.cash_rate_new_bps != null)
      parts.push(`cash ${e.cash_rate_old_bps} → ${e.cash_rate_new_bps} bps`);
    return parts.join("  ·  ");
  };

  return (
    <div className="rounded-xl border overflow-hidden mt-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
        <h3 className="font-semibold text-white text-sm">Recent loan modifications — named events</h3>
        <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
          Specific loans modified each quarter, beyond cash→PIK: amend-and-extends
          (maturity pushed out &gt; 6 months), spread cuts (&gt; 50 bps), and PIK flips.
          A par cut is shown only when it accompanies another signal (a par drop alone
          is dominated by benign paydowns). Click a borrower for its cross-BDC history.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {/* Period selector */}
          <div className="flex flex-wrap gap-1.5">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-2.5 py-1 rounded-md text-xs font-mono border transition-all"
                style={{
                  background: period === p ? "rgba(99,102,241,0.15)" : "#0f0f16",
                  borderColor: period === p ? "#6366f1" : "#2d2d45",
                  color: period === p ? "#a5b4fc" : "#9ca3af",
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <span style={{ color: "#3f3f5a" }}>|</span>
          {/* Type filter */}
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const n = f.key === "all"
                ? Object.values(counts).reduce((a, b) => a + b, 0)
                : counts[f.key] ?? 0;
              return (
                <button
                  key={f.key}
                  onClick={() => setTypeFilter(f.key)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold border transition-all"
                  style={{
                    background: typeFilter === f.key ? "rgba(99,102,241,0.15)" : "#0f0f16",
                    borderColor: typeFilter === f.key ? "#6366f1" : "#2d2d45",
                    color: typeFilter === f.key ? "#a5b4fc" : "#9ca3af",
                  }}
                >
                  {f.label}{f.key !== "all" ? ` (${n})` : ""}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto" style={{ maxHeight: 460 }}>
        <table className="w-full text-sm">
          <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e", position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              {["BDC", "Borrower", "Type", "Change", "Cost ($M)"].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap" style={{ color: "#8b8ba8" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((e, i) => (
              <tr key={`${e.ticker}-${i}`} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                <td className="px-4 py-2.5">
                  <Link href={`/bdcs/${e.ticker.toLowerCase()}`} className="text-xs font-mono font-semibold hover:text-white" style={{ color: "#a5b4fc" }}>
                    {e.ticker}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <Link href={`/borrowers/${borrowerSlug(e.company_norm)}`} className="text-sm text-white hover:text-indigo-400 transition-colors">
                    {e.company}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {e.mod_types.map((t) => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap" style={{
                        color: TYPE_META[t]?.color ?? "#9ca3af",
                        background: `${TYPE_META[t]?.color ?? "#9ca3af"}14`,
                        borderColor: `${TYPE_META[t]?.color ?? "#9ca3af"}33`,
                      }}>
                        {TYPE_META[t]?.label ?? t}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#9ca3af" }}>{detail(e) || "—"}</td>
                <td className="px-4 py-2.5 text-sm font-mono text-white">${e.cost_m.toFixed(1)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-6 text-sm text-center" style={{ color: "#8b8ba8" }}>No modifications matching this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ROWS && (
        <div className="px-5 py-2.5 text-xs border-t" style={{ color: "#6b6b88", borderColor: "#1e1e2e" }}>
          Showing top {MAX_ROWS} of {rows.length} by cost. Refine with the filters above.
        </div>
      )}
    </div>
  );
}
