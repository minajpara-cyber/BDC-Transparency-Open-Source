"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ModificationEvent } from "@/data/modification_events";

type PublishedModificationEvent = ModificationEvent & {
  rate_included?: boolean;
  comparison_status?: "observed" | "unknown";
  comparison_reason?: "all_required_inputs_observed" | "supported_positive_with_incomplete_inputs";
};

const TYPE_META: Record<string, { label: string; color: string }> = {
  maturity_extended: { label: "Maturity extension", color: "#fbbf24" },
  pik_flip:          { label: "Cash → PIK",     color: "#f97316" },
  spread_cut:        { label: "Spread cut",     color: "#a5b4fc" },
  par_haircut:       { label: "Stressed par reduction", color: "#f87171" },
  lien_downgrade:    { label: "Lien downgrade", color: "#c084fc" },
};

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "maturity_extended", label: "Maturity extension" },
  { key: "pik_flip", label: "Cash → PIK" },
  { key: "spread_cut", label: "Spread cut" },
  { key: "par_haircut", label: "Stressed par reduction" },
  { key: "lien_downgrade", label: "Lien downgrade" },
];

const MAX_ROWS = 120;

function borrowerSlug(companyNorm: string): string {
  return companyNorm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export default function ModificationEventsTable({ events }: { events: PublishedModificationEvent[] }) {
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

  const detail = (e: PublishedModificationEvent): string => {
    const parts: string[] = [];
    if (e.maturity_old && e.maturity_new) parts.push(`maturity ${e.maturity_old} → ${e.maturity_new}`);
    if (e.par_old_m != null && e.par_new_m != null)
      parts.push(`par $${e.par_old_m.toFixed(1)}M → $${e.par_new_m.toFixed(1)}M`);
    if (e.spread_old_bps != null && e.spread_new_bps != null)
      parts.push(`contractual spread ${e.spread_old_bps} → ${e.spread_new_bps} bps`);
    if (e.mod_types.includes("pik_flip"))
      parts.push(`PIK severity: ${e.pik_severity ?? "unknown"}`);
    return parts.join("  ·  ");
  };

  return (
    <div className="rounded-xl border overflow-hidden mt-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
        <h3 className="font-semibold text-white text-sm">Recent inferred loan modifications</h3>
        <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
          Observed changes between adjacent quarter-ends on identified funded debt:
          maturity extensions (at least six indexed months), contractual-spread cuts
          (&gt; 50 bps), material-rule cash → PIK changes, stressed par reductions
          (&gt; 15%) and lien downgrades. These signals infer a change; they do not confirm
          a disclosed amendment. PIK persistence is provisional until observed in the
          following quarter. Source locations are available for each comparison.
        </p>
        <p className="text-xs mt-2" style={{ color: "#8b8ba8" }}>
          Supported positive signals remain in this table when an unrelated comparison
          input is unavailable. Quarterly modification rates include only rows labeled
          “Included in rate.”
        </p>
        <p className="text-xs mt-2" style={{ color: "#8b8ba8" }}>
          Historical PIK labels can change when the next filing arrives. These retrospective
          observations should not be used as point-in-time prediction inputs.
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
                ? events.filter((e) => e.period_end === period).length
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
                  {f.label} ({n})
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
              {["BDC", "Borrower", "Signal", "Observed change", "Evidence and rate treatment", "Cost ($M)"].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap" style={{ color: "#8b8ba8" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((e, i) => (
              <tr key={e.event_id} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
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
                <td className="px-4 py-2.5 text-xs" style={{ color: "#9ca3af" }}>
                  <span style={{ color: e.evidence_status === "provisional" ? "#fbbf24" : "#a5b4fc" }}>
                    {e.evidence_status === "provisional" ? "Provisional inference" : "Inferred"}
                  </span>
                  <p
                    className="mt-1 font-semibold"
                    style={{ color: e.rate_included === false ? "#fbbf24" : "#86efac" }}
                    title={e.rate_included === false
                      ? "The listed positive change is supported, but at least one unrelated input required to evaluate the full comparison was unavailable. It is excluded from quarterly modification rates."
                      : "All inputs required to evaluate the combined modification comparison were observed. This event is included in quarterly modification rates."}
                  >
                    {e.rate_included === false ? "Excluded from rate · incomplete comparison" : "Included in rate"}
                  </p>
                  {e.pik_persistence_status !== "not_applicable" && (
                    <p className="mt-1">
                      {e.pik_persistence_status === "observed_next_quarter"
                        ? "PIK observed next quarter"
                        : "Next-quarter PIK persistence unobserved"}
                    </p>
                  )}
                  <details className="mt-1 max-w-64">
                    <summary className="cursor-pointer text-indigo-300">Source comparison</summary>
                    <div className="mt-2 space-y-1 break-words">
                      <p>Before ({e.prior_period_end}): {e.prior_filing_basename ?? "Unavailable"}; table {e.prior_source_bs_table_idx ?? "?"}, row {e.prior_source_row_idx ?? "?"}.</p>
                      <p>After ({e.period_end}): {e.filing_basename}; table {e.source_bs_table_idx ?? "?"}, row {e.source_row_idx ?? "?"}.</p>
                      <p className="break-all font-mono">Reference: {e.event_id}</p>
                    </div>
                  </details>
                </td>
                <td className="px-4 py-2.5 text-sm font-mono text-white">${e.cost_m.toFixed(1)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-6 text-sm text-center" style={{ color: "#8b8ba8" }}>No supported signals matching this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ROWS && (
        <div className="px-5 py-2.5 text-xs border-t" style={{ color: "#6b6b88", borderColor: "#1e1e2e" }}>
          Showing top {MAX_ROWS} of {rows.length}{" "}by cost. Refine with the filters above.
        </div>
      )}
    </div>
  );
}
