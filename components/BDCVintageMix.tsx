"use client";

import { useState } from "react";

// One digested row per vintage year for a single BDC, computed server-side
// from vintage_exposure (where the current book sits) and vintage_analysis
// (how that vintage has performed). Performance is read at the oldest age
// EVERY loan in the BDC's cohort has reached, next to the industry at that
// same age — so no row rests on the early-dated part of a cohort only.
export interface VintageMixRow {
  vintage_year: number | null;   // null = undated loans
  label?: string;                // display label override (e.g. "≤2017")
  pct_of_book: number;           // 0..100, share of the BDC's current cost
  current_cost_b: number;
  estimated_pct: number;         // share of this vintage's current cost dated by estimate
  entry_cost_b: number | null;   // cohort entry cost (null when too small to publish)
  age_years: number | null;      // comparison age
  n_loans: number | null;
  pct_ever_na: number | null;    // on-book non-accrual (cumulative)
  pct_ever_default: number | null; // NA OR distressed exit (cumulative)
  ind_ever_na: number | null;
  ind_ever_default: number | null;
  is_partial: boolean;           // vintage predates this BDC's filing coverage
  na_partial: boolean;           // NA status partly unknown at that age
}

type MetricId = "default" | "na";

const METRIC: Record<MetricId, { label: string; short: string; get: (r: VintageMixRow) => number | null; ind: (r: VintageMixRow) => number | null; thresh: { g: number; y: number; o: number } }> = {
  default: { label: "Cumulative default", short: "Cum. default", get: (r) => r.pct_ever_default, ind: (r) => r.ind_ever_default, thresh: { g: 2, y: 5, o: 8 } },
  na: { label: "On-book non-accrual", short: "On-book NA", get: (r) => r.pct_ever_na, ind: (r) => r.ind_ever_na, thresh: { g: 0.75, y: 2, o: 4 } },
};

function sevColor(v: number | null, t: { g: number; y: number; o: number }): string {
  if (v == null) return "#6b6b88";
  if (v < t.g) return "#22c55e";
  if (v < t.y) return "#eab308";
  if (v < t.o) return "#f97316";
  return "#ef4444";
}

export default function BDCVintageMix({ ticker, asOf, rows }: { ticker: string; asOf: string; rows: VintageMixRow[] }) {
  const [metric, setMetric] = useState<MetricId>("default");
  const m = METRIC[metric];
  if (rows.length === 0) return null;

  const dated = rows.filter((r) => r.vintage_year != null).sort((a, b) => (a.vintage_year ?? 0) - (b.vintage_year ?? 0));
  const undated = rows.find((r) => r.vintage_year == null);
  const ordered = undated ? [...dated, undated] : dated;
  const totalCost = rows.reduce((s, r) => s + r.current_cost_b, 0);
  const estimatedCost = dated.reduce((s, r) => s + (r.estimated_pct / 100) * r.current_cost_b, 0);
  const estimatedShare = totalCost > 0 ? (100 * estimatedCost) / totalCost : 0;
  const withMetric = dated.filter((r) => m.get(r) != null);
  const metricCost = withMetric.reduce((s, r) => s + r.current_cost_b, 0);
  const wAvg = metricCost > 0 ? withMetric.reduce((s, r) => s + (m.get(r) ?? 0) * r.current_cost_b, 0) / metricCost : null;
  const elevatedShare = withMetric.filter((r) => (m.get(r) ?? 0) >= m.thresh.o).reduce((s, r) => s + r.pct_of_book, 0);
  const newest = dated[dated.length - 1];
  const fmtB = (b: number) => (b >= 1 ? `$${b.toFixed(1)}B` : `$${(b * 1000).toFixed(0)}M`);

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold text-white">{ticker} vintage mix &amp; non-accrual performance</h2>
        <span className="text-xs px-2 py-0.5 rounded border" style={{ color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)" }}>as of {asOf}</span>
        <span className="text-xs px-2 py-0.5 rounded border" style={{ color: estimatedShare > 50 ? "#eab308" : "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)" }}
              title="Share of this BDC's current cost whose vintage date is a labelled estimate rather than a disclosed date (its own or the same tranche at a peer BDC).">
          {estimatedShare.toFixed(0)}% of cost dated by estimate
        </span>
      </div>
      <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
        How much of {ticker}&apos;s current book comes from each vintage year (by amortized cost), and how that vintage has performed.
        Vintage = the BDC&apos;s own disclosed acquisition date, else the same tranche&apos;s date at a peer BDC, else a labelled estimate.
        Performance is read at the oldest age every loan in {ticker}&apos;s cohort has reached and compared with the industry at that age;
        see <a href="/vintage" className="text-indigo-400 hover:underline">/vintage</a>{" "}for the curves and method.
      </p>

      <div className="flex items-center gap-1.5 mb-4 text-xs">
        <span className="uppercase tracking-wider mr-1" style={{ color: "#6b6b88" }}>Color by</span>
        {(Object.keys(METRIC) as MetricId[]).map((id) => (
          <button key={id} onClick={() => setMetric(id)} className="px-2.5 py-1 rounded border transition-all"
                  style={{ background: metric === id ? "rgba(99,102,241,0.15)" : "#111118", borderColor: metric === id ? "#6366f1" : "#2d2d45", color: metric === id ? "#a5b4fc" : "#9ca3af", whiteSpace: "nowrap" }}
                  title={id === "default" ? "Cumulative % of vintage cost ever non-accrual OR exited in distress" : "Cumulative % of vintage cost flagged non-accrual while still on the book"}>
            {METRIC[id].label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Current book</div>
          <div className="text-xl font-bold text-white tabular-nums">{fmtB(totalCost)}</div>
          {undated && undated.pct_of_book > 0 && <div className="text-[11px] mt-0.5" style={{ color: "#6b6b88" }}>{undated.pct_of_book.toFixed(0)}% undated</div>}
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Book-weighted {m.short.toLowerCase()}</div>
          <div className="text-xl font-bold tabular-nums" style={{ color: sevColor(wAvg, m.thresh) }}>{wAvg == null ? "—" : `${wAvg.toFixed(2)}%`}</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>In elevated vintages</div>
          <div className="text-xl font-bold tabular-nums" style={{ color: elevatedShare >= 20 ? "#f59e0b" : "#fafafa" }}>{elevatedShare.toFixed(0)}%</div>
          <div className="text-[11px] mt-0.5" style={{ color: "#6b6b88" }}>{m.short} ≥ {m.thresh.o}%</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Newest vintage</div>
          <div className="text-xl font-bold text-white tabular-nums">
            {newest ? newest.vintage_year : "—"}
            {newest && <span className="text-sm font-medium ml-1" style={{ color: "#8b8ba8" }}>· {newest.pct_of_book.toFixed(0)}%</span>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-4 mb-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="text-sm font-semibold text-white mb-1">Share of book by vintage</div>
        <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
          Each segment is a vintage year, widened by its share of {ticker}&apos;s current cost and shaded by {m.label.toLowerCase()}.
          Grey = no published rate (cohort under 30 loans, or undated). Hover for detail.
        </p>
        <div className="flex w-full h-12 rounded-lg overflow-hidden" style={{ border: "1px solid #1e1e2e" }}>
          {ordered.map((r) => {
            const v = m.get(r);
            const color = sevColor(v, m.thresh);
            const wide = r.pct_of_book >= 7;
            const label = r.label ?? r.vintage_year ?? "Undated";
            return (
              <div key={String(label)}
                   style={{ width: `${r.pct_of_book}%`, background: `${color}33`, borderRight: "1px solid #111118", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 0 }}
                   title={`${label} · ${r.pct_of_book.toFixed(1)}% of book (${fmtB(r.current_cost_b)}) · ${r.estimated_pct.toFixed(0)}% dated by estimate · ${m.short} ${v == null ? "not published" : `${v.toFixed(2)}%`}${r.is_partial ? " · thin coverage" : ""}`}>
                {wide && (
                  <>
                    <span className="text-[11px] font-semibold leading-none" style={{ color: "#e5e7eb" }}>{label}</span>
                    <span className="text-[10px] leading-tight mt-0.5" style={{ color }}>{v == null ? "—" : `${v.toFixed(1)}%`}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px]" style={{ color: "#8b8ba8" }}>
          <span>{m.short} scale:</span>
          {[
            { c: "#22c55e", l: `<${m.thresh.g}%` },
            { c: "#eab308", l: `${m.thresh.g}–${m.thresh.y}%` },
            { c: "#f97316", l: `${m.thresh.y}–${m.thresh.o}%` },
            { c: "#ef4444", l: `≥${m.thresh.o}%` },
          ].map((s) => (
            <span key={s.l} className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: `${s.c}55`, border: `1px solid ${s.c}` }} />
              {s.l}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Vintage", "% of book", "On book", "Dated by estimate", "Cohort entry cost", "Age compared", "On-book NA %", "Cum. default %", "vs industry"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...ordered].reverse().map((r, i) => {
                const indV = m.ind(r);
                const sel = m.get(r);
                const delta = indV != null && sel != null ? sel - indV : null;
                const deltaColor = delta == null ? "#6b6b88" : delta > 0.25 ? "#ef4444" : delta < -0.25 ? "#22c55e" : "#9ca3af";
                const arrow = delta == null ? "" : delta > 0.25 ? "↑" : delta < -0.25 ? "↓" : "≈";
                const label = r.label ?? r.vintage_year ?? "Undated";
                return (
                  <tr key={String(label)} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">
                      {label}
                      {r.is_partial && <span className="ml-1.5 px-1.5 py-0 rounded text-[10px]" style={{ background: "rgba(234,179,8,0.12)", color: "#eab308" }} title="Predates this BDC's filing coverage — rates under-count (survivors only)">thin</span>}
                      {r.estimated_pct > 50 && <span className="ml-1.5 px-1.5 py-0 rounded text-[10px]" style={{ background: "rgba(107,107,136,0.15)", color: "#9ca3af" }} title="Most of this vintage's cost is dated by estimate">mostly estimated</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[120px] h-2 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
                          <div style={{ width: `${r.pct_of_book}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#a5b4fc)" }} />
                        </div>
                        <span className="text-xs font-mono tabular-nums" style={{ color: "#d1d5db" }}>{r.pct_of_book.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-mono tabular-nums text-white">{fmtB(r.current_cost_b)}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums" style={{ color: r.estimated_pct > 50 ? "#eab308" : "#9ca3af" }}>{r.vintage_year == null ? "—" : `${r.estimated_pct.toFixed(0)}%`}</td>
                    <td className="px-4 py-2.5 text-sm font-mono tabular-nums" style={{ color: "#9ca3af" }}>{r.entry_cost_b == null ? "—" : fmtB(r.entry_cost_b)}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums" style={{ color: "#9ca3af" }}>{r.age_years == null ? "—" : `${r.age_years.toFixed(1)}y`}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold tabular-nums" style={{ color: sevColor(r.pct_ever_na, METRIC.na.thresh) }}>{r.pct_ever_na == null ? "—" : `${r.pct_ever_na.toFixed(2)}%${r.na_partial ? "*" : ""}`}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold tabular-nums" style={{ color: sevColor(r.pct_ever_default, METRIC.default.thresh) }}>{r.pct_ever_default == null ? "—" : `${r.pct_ever_default.toFixed(2)}%${r.na_partial ? "*" : ""}`}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: deltaColor }} title={indV != null ? `Industry ${m.short} at the same age: ${indV.toFixed(2)}%` : "No industry baseline at this age"}>
                      {delta == null ? "—" : `${arrow} ${Math.abs(delta).toFixed(2)}pp`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-xs border-t" style={{ borderColor: "#1e1e2e", color: "#6b6b88" }}>
          &quot;% of book&quot; = this vintage&apos;s amortized cost ÷ {ticker}&apos;s current cost (undated loans shown separately).
          Rates are read at the oldest age every loan in the cohort has reached; &quot;—&quot; = cohort under 30 loans. On-book NA counts
          only loans still held; cumulative default also counts loans that went non-accrual or were marked down and then left.
          * = non-accrual status partly unknown at that age (unknown-status loans are left out, not counted as performing).
        </div>
      </div>
    </section>
  );
}
