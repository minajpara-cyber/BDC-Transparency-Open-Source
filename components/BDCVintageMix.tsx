"use client";

import { useState } from "react";

// One digested row per vintage year for a single BDC, computed server-side from
// vintage_analysis. pct_of_book is this vintage's share of the BDC's dated
// (vintage-tagged) cost still on book; the *_default / *_na fields are the
// cumulative credit metrics the /vintage tab uses.
export interface VintageMixRow {
  vintage_year: number;
  pct_of_book: number;          // 0..100, share of alive (still-on-book) dated cost
  alive_cost_b: number;
  entry_cost_b: number;
  age_years: number;
  n_loans: number;
  pct_ever_na: number;          // on-book non-accrual (cumulative)
  pct_ever_default: number;     // NA OR distressed exit (cumulative, RJ-comparable)
  ind_ever_na: number | null;   // industry baseline at the same age
  ind_ever_default: number | null;
  is_partial: boolean;          // vintage predates full parser coverage (rate under-counts)
  period_end: string;
}

type MetricId = "default" | "na";

const METRIC: Record<MetricId, { label: string; short: string; get: (r: VintageMixRow) => number; ind: (r: VintageMixRow) => number | null; thresh: { g: number; y: number; o: number } }> = {
  default: {
    label: "Cumulative default",
    short: "Cum. default",
    get: (r) => r.pct_ever_default,
    ind: (r) => r.ind_ever_default,
    thresh: { g: 2, y: 5, o: 8 },
  },
  na: {
    label: "On-book non-accrual",
    short: "On-book NA",
    get: (r) => r.pct_ever_na,
    ind: (r) => r.ind_ever_na,
    thresh: { g: 0.75, y: 2, o: 4 },
  },
};

// Severity color for a metric value, matching the /vintage tab's level scale.
function sevColor(v: number, t: { g: number; y: number; o: number }): string {
  if (v < t.g) return "#22c55e";
  if (v < t.y) return "#eab308";
  if (v < t.o) return "#f97316";
  return "#ef4444";
}

export default function BDCVintageMix({
  ticker,
  asOf,
  rows,
}: {
  ticker: string;
  asOf: string;
  rows: VintageMixRow[];
}) {
  const [metric, setMetric] = useState<MetricId>("default");
  const m = METRIC[metric];

  if (rows.length === 0) return null;

  const byYear = [...rows].sort((a, b) => a.vintage_year - b.vintage_year);
  const totalAlive = rows.reduce((s, r) => s + r.alive_cost_b, 0);
  const hasPartial = rows.some((r) => r.is_partial);

  // Cost-weighted (by alive cost) average of the selected metric across vintages.
  const wAvg = totalAlive > 0
    ? rows.reduce((s, r) => s + m.get(r) * r.alive_cost_b, 0) / totalAlive
    : 0;

  // Share of the book sitting in vintages whose selected metric is "elevated"
  // (>= the orange threshold) — a quick read of how much of the book is in
  // cohorts that have already shown real distress.
  const elevatedShare = rows
    .filter((r) => m.get(r) >= m.thresh.o)
    .reduce((s, r) => s + r.pct_of_book, 0);

  const fmtB = (b: number) => (b >= 1 ? `$${b.toFixed(1)}B` : `$${(b * 1000).toFixed(0)}M`);

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h2 className="text-lg font-semibold text-white">{ticker} vintage mix &amp; non-accrual performance</h2>
        <span className="text-xs px-2 py-0.5 rounded border" style={{
          color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
        }}>
          as of {asOf}
        </span>
        <span className="text-xs px-2 py-0.5 rounded border" style={{
          color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
        }}>
          {byYear.length} vintage{byYear.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
        How much of {ticker}&apos;s current book comes from each origination vintage (by amortized
        cost still on book), and how that vintage has performed on a non-accrual basis. Bar widths =
        share of book; color = the selected credit metric, on the same scale as{" "}
        <a href="/vintage" className="text-indigo-400 hover:underline">/vintage</a>. Cohort dating
        and metrics use the vintage methodology (cost-weighted, acq_date when disclosed).
      </p>

      {/* Metric toggle */}
      <div className="flex items-center gap-1.5 mb-4 text-xs">
        <span className="uppercase tracking-wider mr-1" style={{ color: "#6b6b88" }}>Color by</span>
        {(Object.keys(METRIC) as MetricId[]).map((id) => (
          <button
            key={id}
            onClick={() => setMetric(id)}
            className="px-2.5 py-1 rounded border transition-all"
            style={{
              background: metric === id ? "rgba(99,102,241,0.15)" : "#111118",
              borderColor: metric === id ? "#6366f1" : "#2d2d45",
              color: metric === id ? "#a5b4fc" : "#9ca3af",
              whiteSpace: "nowrap",
            }}
            title={id === "default"
              ? "Cumulative % of vintage cost ever non-accrual OR exited in distress (RJ-comparable)"
              : "Cumulative % of vintage cost flagged non-accrual while still on the book"}
          >
            {METRIC[id].label}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Dated book on the books</div>
          <div className="text-xl font-bold text-white tabular-nums">{fmtB(totalAlive)}</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Book-weighted {m.short.toLowerCase()}</div>
          <div className="text-xl font-bold tabular-nums" style={{ color: sevColor(wAvg, m.thresh) }}>{wAvg.toFixed(2)}%</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>In elevated vintages</div>
          <div className="text-xl font-bold tabular-nums" style={{ color: elevatedShare >= 20 ? "#f59e0b" : "#fafafa" }}>
            {elevatedShare.toFixed(0)}%
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: "#6b6b88" }}>{m.short} ≥ {m.thresh.o}%</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Newest vintage</div>
          <div className="text-xl font-bold text-white tabular-nums">
            {byYear[byYear.length - 1].vintage_year}
            <span className="text-sm font-medium ml-1" style={{ color: "#8b8ba8" }}>
              · {byYear[byYear.length - 1].pct_of_book.toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      {/* Stacked share-of-book bar, colored by the selected metric */}
      <div className="rounded-xl border p-4 mb-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="text-sm font-semibold text-white mb-1">Share of book by vintage</div>
        <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
          Each segment is a vintage year, widened by its share of {ticker}&apos;s dated cost and shaded
          by {m.label.toLowerCase()}. Hover for detail.
        </p>
        <div className="flex w-full h-12 rounded-lg overflow-hidden" style={{ border: "1px solid #1e1e2e" }}>
          {byYear.map((r) => {
            const v = m.get(r);
            const color = sevColor(v, m.thresh);
            const wide = r.pct_of_book >= 7;
            return (
              <div
                key={r.vintage_year}
                style={{
                  width: `${r.pct_of_book}%`,
                  background: `${color}33`,
                  borderRight: "1px solid #111118",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 0,
                }}
                title={`${r.vintage_year} vintage · ${r.pct_of_book.toFixed(1)}% of book (${fmtB(r.alive_cost_b)} alive) · ${m.short} ${v.toFixed(2)}%${r.is_partial ? " · partial (under-counts)" : ""}`}
              >
                {wide && (
                  <>
                    <span className="text-[11px] font-semibold leading-none" style={{ color: "#e5e7eb" }}>{r.vintage_year}</span>
                    <span className="text-[10px] leading-tight mt-0.5" style={{ color }}>{v.toFixed(1)}%</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {/* legend */}
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

      {/* Detail table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Vintage", "% of book", "On book", "Entry cost", "Age", "On-book NA %", "Cum. default %", "vs industry"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8b8ba8" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...byYear].reverse().map((r, i) => {
                const naColor = sevColor(r.pct_ever_na, METRIC.na.thresh);
                const defColor = sevColor(r.pct_ever_default, METRIC.default.thresh);
                const indV = m.ind(r);
                const sel = m.get(r);
                const delta = indV != null ? sel - indV : null;
                const deltaColor = delta == null ? "#6b6b88" : delta > 0.25 ? "#ef4444" : delta < -0.25 ? "#22c55e" : "#9ca3af";
                const arrow = delta == null ? "" : delta > 0.25 ? "↑" : delta < -0.25 ? "↓" : "≈";
                return (
                  <tr key={r.vintage_year} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-4 py-2.5 font-semibold text-white whitespace-nowrap">
                      {r.vintage_year}
                      {r.is_partial && (
                        <span className="ml-1.5 px-1.5 py-0 rounded text-[10px]" style={{ background: "rgba(234,179,8,0.12)", color: "#eab308" }}
                              title="Predates full parser coverage — default/NA rates under-count (survivorship)">
                          partial
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[120px] h-2 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
                          <div style={{ width: `${r.pct_of_book}%`, height: "100%", background: "linear-gradient(90deg,#6366f1,#a5b4fc)" }} />
                        </div>
                        <span className="text-xs font-mono tabular-nums" style={{ color: "#d1d5db" }}>{r.pct_of_book.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-mono tabular-nums text-white">{fmtB(r.alive_cost_b)}</td>
                    <td className="px-4 py-2.5 text-sm font-mono tabular-nums" style={{ color: "#9ca3af" }}>{fmtB(r.entry_cost_b)}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums" style={{ color: "#9ca3af" }}>{r.age_years.toFixed(1)}y</td>
                    <td className="px-4 py-2.5 text-sm font-semibold tabular-nums" style={{ color: naColor }}>{r.pct_ever_na.toFixed(2)}%</td>
                    <td className="px-4 py-2.5 text-sm font-semibold tabular-nums" style={{ color: defColor }}>{r.pct_ever_default.toFixed(2)}%</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums" style={{ color: deltaColor }}
                        title={indV != null ? `Industry ${m.short} at this age: ${indV.toFixed(2)}%` : "No industry baseline at this age"}>
                      {delta == null ? "—" : `${arrow} ${Math.abs(delta).toFixed(2)}pp`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-xs border-t" style={{ borderColor: "#1e1e2e", color: "#6b6b88" }}>
          &quot;% of book&quot; = this vintage&apos;s amortized cost still on book ÷ {ticker}&apos;s total dated
          cost. &quot;vs industry&quot; compares the selected metric to the cohort-weighted industry
          average at the same age (lower is better). On-book NA counts only loans still held; cumulative
          default also captures loans that went non-accrual then exited.
          {hasPartial && " Vintages tagged partial predate full coverage, so their rates under-count."}
          {" "}Cohorts older than 7 years are held at their 7-year mark. See{" "}
          <a href="/vintage" className="text-indigo-400 hover:underline">/vintage</a> for full curves.
        </div>
      </div>
    </section>
  );
}
