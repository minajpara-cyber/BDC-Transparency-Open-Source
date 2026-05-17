"use client";
import { useMemo, useState } from "react";
import VintageChart, { VintageSeries } from "@/components/VintageChart";
import { vintageRows, VintageRow } from "@/data/vintage_analysis";

type Metric = "pct_ever_na" | "pct_ever_b80" | "pct_b90_alive";

const METRIC_META: Record<Metric, { label: string; sub: string; color: string }> = {
  pct_ever_na: {
    label: "% Cost Ever Non-Accrual",
    sub: "Cumulative — share of vintage cost that has been flagged non-accrual at any point through age T",
    color: "#ef4444",
  },
  pct_ever_b80: {
    label: "% Cost Ever Marked < 80¢",
    sub: "Cumulative — share of vintage cost ever marked below 80¢ on the dollar by age T",
    color: "#f97316",
  },
  pct_b90_alive: {
    label: "% Surviving Cost Marked < 90¢",
    sub: "Point-in-time — share of currently-alive cost marked below 90¢ at age T (leading indicator)",
    color: "#eab308",
  },
};

// Compress raw rows into one series per vintage_year for a given metric.
function buildSeries(rows: VintageRow[], metric: Metric): VintageSeries[] {
  const byVintage = new Map<number, VintageRow[]>();
  for (const r of rows) {
    if (!byVintage.has(r.vintage_year)) byVintage.set(r.vintage_year, []);
    byVintage.get(r.vintage_year)!.push(r);
  }
  return Array.from(byVintage.entries()).map(([vy, list]) => {
    const sorted = [...list].sort((a, b) => a.age_quarters - b.age_quarters);
    return {
      vintage_year: vy,
      is_partial: sorted[0]?.is_partial ?? false,
      points: sorted.map((r) => ({
        age_years: r.age_years,
        value: r[metric] as number,
        alive_cost_b: r.alive_cost_b,
      })),
    };
  });
}

// Latest data point per vintage — what the table shows in each column.
function latestPerVintage(rows: VintageRow[]) {
  const byV = new Map<number, VintageRow>();
  for (const r of rows) {
    const prev = byV.get(r.vintage_year);
    if (!prev || r.age_quarters > prev.age_quarters) byV.set(r.vintage_year, r);
  }
  return Array.from(byV.values()).sort((a, b) => a.vintage_year - b.vintage_year);
}

// At a specific age (years), pluck the cumulative metric per vintage. Returns
// null for vintages too young to have reached that age.
function metricAtAge(rows: VintageRow[], vintage: number, ageYears: number, metric: Metric): number | null {
  const targetQ = Math.round(ageYears * 4);
  const r = rows.find((x) => x.vintage_year === vintage && x.age_quarters === targetQ);
  return r ? (r[metric] as number) : null;
}

export default function VintagePage() {
  const [includePartial, setIncludePartial] = useState(false);

  const industryRows = useMemo(
    () => vintageRows.filter((r) => r.ticker === "industry"),
    [],
  );

  const visibleRows = useMemo(() => {
    if (includePartial) return industryRows;
    return industryRows.filter((r) => !r.is_partial);
  }, [industryRows, includePartial]);

  const naSeries  = useMemo(() => buildSeries(visibleRows, "pct_ever_na"),  [visibleRows]);
  const b80Series = useMemo(() => buildSeries(visibleRows, "pct_ever_b80"), [visibleRows]);
  const b90Series = useMemo(() => buildSeries(visibleRows, "pct_b90_alive"), [visibleRows]);

  const tableRows = useMemo(() => latestPerVintage(visibleRows), [visibleRows]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white mb-2">Vintage Analysis</h1>
        <p className="text-sm" style={{ color: "#8b8ba8" }}>
          Cumulative credit performance by vintage year — sliced by{" "}
          <span className="text-white">when each loan first appeared on a BDC&apos;s book</span> (the
          BDC&apos;s acquisition date when disclosed; otherwise the period of first
          observation in our parser). All metrics are <span className="text-white">cost-weighted</span>.
          MFIC excluded from non-accrual metrics — its SOI doesn&apos;t flag NA per position.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "#9ca3af" }}>
            <input
              type="checkbox"
              checked={includePartial}
              onChange={(e) => setIncludePartial(e.target.checked)}
              className="cursor-pointer"
            />
            Include vintages pre-dating parser coverage (shown dashed — heavy survivorship bias)
          </label>
        </div>
      </div>

      {/* Three industry curves stacked */}
      {(Object.keys(METRIC_META) as Metric[]).map((m) => {
        const meta = METRIC_META[m];
        const series = m === "pct_ever_na" ? naSeries : m === "pct_ever_b80" ? b80Series : b90Series;
        return (
          <div key={m} className="rounded-xl border p-5 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <h2 className="font-semibold text-white mb-1">{meta.label}</h2>
            <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>{meta.sub}</p>
            <VintageChart series={series} yLabel={meta.label} height={300} />
          </div>
        );
      })}

      {/* Per-vintage summary table */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Vintage Summary — Industry</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            Latest observation per vintage. NA% and Below-80% are cumulative through age; Below-90% is point-in-time among survivors.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Vintage", "Loans", "Cohort Size", "Latest Age", "Cumulative NA%", "Ever <80¢ %", "Current <90¢ %", "Coverage"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => {
                const naColor  = r.pct_ever_na >= 3 ? "#ef4444" : r.pct_ever_na >= 1 ? "#f97316" : "#22c55e";
                const b80Color = r.pct_ever_b80 >= 5 ? "#ef4444" : r.pct_ever_b80 >= 2 ? "#f97316" : "#22c55e";
                const b90Color = r.pct_b90_alive >= 10 ? "#ef4444" : r.pct_b90_alive >= 5 ? "#f97316" : "#22c55e";
                return (
                  <tr key={r.vintage_year} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-4 py-3 font-semibold text-white">{r.vintage_year}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }}>{r.n_loans_cohort.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#d1d5db" }}>${r.cohort_entry_cost_b.toFixed(1)}B</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }}>{r.age_years.toFixed(2)}y</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: naColor }}>{r.pct_ever_na.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: b80Color }}>{r.pct_ever_b80.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: b90Color }}>{r.pct_b90_alive.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-xs">
                      {r.is_partial ? (
                        <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.2)" }}>
                          partial
                        </span>
                      ) : (
                        <span style={{ color: "#22c55e" }}>full</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vintage-on-vintage comparison at standard ages */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Cumulative NA% at Standard Ages</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            How each vintage looked at year 1, 2, 3, 4, 5 since acquisition. &mdash; means the vintage hasn&apos;t aged that far yet.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Vintage", "Y1", "Y2", "Y3", "Y4", "Y5", "Y6"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => (
                <tr key={r.vintage_year} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                  <td className="px-4 py-3 font-semibold text-white">{r.vintage_year}</td>
                  {[1, 2, 3, 4, 5, 6].map((yr) => {
                    const v = metricAtAge(visibleRows, r.vintage_year, yr, "pct_ever_na");
                    if (v === null) return <td key={yr} className="px-4 py-3 text-sm" style={{ color: "#444" }}>&mdash;</td>;
                    const color = v >= 3 ? "#ef4444" : v >= 1 ? "#f97316" : "#22c55e";
                    return <td key={yr} className="px-4 py-3 text-sm font-semibold" style={{ color }}>{v.toFixed(2)}%</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Methodology */}
      <div className="rounded-lg p-5 border" style={{ background: "#0f0f16", borderColor: "#1e1e2e" }}>
        <h3 className="text-sm font-semibold text-white mb-2">Methodology</h3>
        <ul className="text-xs space-y-1.5 list-disc list-inside" style={{ color: "#9ca3af" }}>
          <li>
            <span className="text-white">Vintage</span> = year of the BDC&apos;s first observation of the
            loan. When acquisition_date is disclosed in the filing, we use that; otherwise we fall back
            to the period_end of the quarter we first saw the loan in our parsed data.
          </li>
          <li>
            <span className="text-white">Cohort cost</span> is fixed for the vintage&apos;s life
            (= sum of cost at first observation across all loans in the cohort). This keeps the
            denominator stable so cumulative curves are directly comparable.
          </li>
          <li>
            <span className="text-white">Ever-NA / Ever-below-80</span> are cumulative through age T
            and monotonically non-decreasing.{" "}
            <span className="text-white">Currently below-90</span> is a point-in-time snapshot among
            loans still on the book at age T — it can rise and fall as loans cure or exit.
          </li>
          <li>
            Vintages flagged <span style={{ color: "#eab308" }}>partial</span> predate our parser
            coverage. Their denominators include only the survivors that made it into our window —
            real defaults from those years are under-counted.
          </li>
        </ul>
      </div>
    </div>
  );
}
