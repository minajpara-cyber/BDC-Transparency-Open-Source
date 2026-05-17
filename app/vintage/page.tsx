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

// For the BDC × Vintage matrix: per (ticker, vintage_year), get the latest
// observation row for that BDC's cohort AND the industry's row at the
// SAME age_quarters (so the BDC↔industry comparison is apples-to-apples).
interface MatrixCell {
  bdcVal: number;
  indVal: number;
  delta: number;       // bdcVal - indVal
  age_years: number;
  cohort_b: number;    // BDC's cohort entry cost
  n_loans: number;
}

function buildMatrix(
  bdcRows: VintageRow[],
  industryRows: VintageRow[],
  metric: Metric,
): { tickers: string[]; vintages: number[]; cells: Map<string, MatrixCell> } {
  const cells = new Map<string, MatrixCell>();

  // Group BDC rows by (ticker, vintage) and take the latest age observed.
  const latestByPair = new Map<string, VintageRow>();
  for (const r of bdcRows) {
    if (r.is_partial) continue;
    const key = `${r.ticker}|${r.vintage_year}`;
    const prev = latestByPair.get(key);
    if (!prev || r.age_quarters > prev.age_quarters) latestByPair.set(key, r);
  }

  const tickerSet = new Set<string>();
  const vintageSet = new Set<number>();

  for (const [key, bdcR] of latestByPair) {
    // Industry baseline at the SAME (vintage, age_quarters)
    const indR = industryRows.find(
      (i) => i.vintage_year === bdcR.vintage_year && i.age_quarters === bdcR.age_quarters && !i.is_partial,
    );
    if (!indR) continue;
    const bdcVal = bdcR[metric] as number;
    const indVal = indR[metric] as number;
    cells.set(key, {
      bdcVal,
      indVal,
      delta: bdcVal - indVal,
      age_years: bdcR.age_years,
      cohort_b: bdcR.cohort_entry_cost_b,
      n_loans: bdcR.n_loans_cohort,
    });
    tickerSet.add(bdcR.ticker);
    vintageSet.add(bdcR.vintage_year);
  }

  return {
    tickers: Array.from(tickerSet).sort(),
    vintages: Array.from(vintageSet).sort(),
    cells,
  };
}

export default function VintagePage() {
  const [includePartial, setIncludePartial] = useState(false);
  const [matrixMetric, setMatrixMetric] = useState<Metric>("pct_ever_na");
  const [matrixSortVintage, setMatrixSortVintage] = useState<number | null>(null);
  const [matrixSortDir, setMatrixSortDir] = useState<"asc" | "desc">("asc");

  const industryRows = useMemo(
    () => vintageRows.filter((r) => r.ticker === "industry"),
    [],
  );
  const bdcRows = useMemo(
    () => vintageRows.filter((r) => r.ticker !== "industry"),
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

  const matrix = useMemo(
    () => buildMatrix(bdcRows, industryRows, matrixMetric),
    [bdcRows, industryRows, matrixMetric],
  );

  // Sort tickers: by selected vintage's delta (asc = best performers first) when
  // a column header is clicked, otherwise alphabetical.
  const sortedTickers = useMemo(() => {
    const ts = [...matrix.tickers];
    if (matrixSortVintage === null) return ts;
    return ts.sort((a, b) => {
      const ca = matrix.cells.get(`${a}|${matrixSortVintage}`);
      const cb = matrix.cells.get(`${b}|${matrixSortVintage}`);
      const va = ca?.delta ?? Number.POSITIVE_INFINITY;
      const vb = cb?.delta ?? Number.POSITIVE_INFINITY;
      return matrixSortDir === "asc" ? va - vb : vb - va;
    });
  }, [matrix, matrixSortVintage, matrixSortDir]);

  const onSortClick = (vy: number) => {
    if (matrixSortVintage === vy) {
      setMatrixSortDir(matrixSortDir === "asc" ? "desc" : "asc");
    } else {
      setMatrixSortVintage(vy);
      setMatrixSortDir("asc");
    }
  };

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

      {/* BDC × Vintage performance matrix */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b flex flex-wrap items-baseline justify-between gap-3" style={{ borderColor: "#1e1e2e" }}>
          <div>
            <h2 className="font-semibold text-white">BDC × Vintage Performance vs Peers</h2>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              Each cell: this BDC&apos;s cumulative metric at the latest age its cohort has reached, with the delta vs the
              industry average at the SAME age (apples-to-apples). Greener = outperforms peers; redder = underperforms.
              Click a vintage column header to sort by relative performance.
            </p>
          </div>
          {/* Metric toggle */}
          <div className="flex gap-1.5 text-xs">
            {(Object.keys(METRIC_META) as Metric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMatrixMetric(m)}
                className="px-2.5 py-1 rounded border transition-all"
                style={{
                  background: matrixMetric === m ? "rgba(99,102,241,0.15)" : "#111118",
                  borderColor: matrixMetric === m ? "#6366f1" : "#2d2d45",
                  color: matrixMetric === m ? "#a5b4fc" : "#9ca3af",
                  whiteSpace: "nowrap",
                }}
                title={METRIC_META[m].sub}
              >
                {m === "pct_ever_na" ? "Ever NA" : m === "pct_ever_b80" ? "Ever <80¢" : "Curr. <90¢"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8b8ba8" }}>BDC</th>
                {matrix.vintages.map((vy) => {
                  const active = matrixSortVintage === vy;
                  return (
                    <th key={vy} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      <button
                        onClick={() => onSortClick(vy)}
                        className="flex items-center gap-1 hover:text-white transition-colors"
                        style={{ color: active ? "#a5b4fc" : "#8b8ba8" }}
                      >
                        Vintage {vy} {active ? (matrixSortDir === "asc" ? "↑" : "↓") : "↕"}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {sortedTickers.map((ticker, i) => (
                <tr key={ticker} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                  <td className="px-3 py-2">
                    <a href={`/bdcs/${ticker.toLowerCase()}`}>
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold hover:opacity-80 cursor-pointer" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>
                        {ticker}
                      </span>
                    </a>
                  </td>
                  {matrix.vintages.map((vy) => {
                    const cell = matrix.cells.get(`${ticker}|${vy}`);
                    if (!cell) return <td key={vy} className="px-3 py-2 text-xs" style={{ color: "#444" }}>&mdash;</td>;
                    // Color the cell background by relative performance.
                    // Outperformance (BDC better than industry) = green tint; under = red.
                    // For Ever-NA / Ever-<80, lower is better.
                    // For Curr-<90, lower is better too.
                    const lowerIsBetter = true;
                    const directedDelta = lowerIsBetter ? -cell.delta : cell.delta;
                    const intensity = Math.min(Math.abs(directedDelta) / 2.0, 1.0); // saturate at 2pp
                    const bg = directedDelta > 0
                      ? `rgba(34,197,94,${0.06 + 0.18 * intensity})`
                      : directedDelta < 0
                        ? `rgba(239,68,68,${0.06 + 0.18 * intensity})`
                        : "transparent";
                    const arrowColor = directedDelta > 0.25 ? "#22c55e" : directedDelta < -0.25 ? "#ef4444" : "#9ca3af";
                    const arrow = directedDelta > 0.25 ? "↓" : directedDelta < -0.25 ? "↑" : "≈";
                    return (
                      <td key={vy} className="px-3 py-2" style={{ background: bg }} title={`Age ${cell.age_years.toFixed(2)}y · cohort ${cell.n_loans} loans / $${cell.cohort_b.toFixed(2)}B · industry ${cell.indVal.toFixed(2)}%`}>
                        <div className="text-sm font-semibold" style={{ color: "#d1d5db" }}>{cell.bdcVal.toFixed(2)}%</div>
                        <div className="text-xs" style={{ color: arrowColor }}>
                          {arrow} {Math.abs(cell.delta).toFixed(2)}pp vs {cell.indVal.toFixed(2)}%
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs border-t" style={{ borderColor: "#1e1e2e", color: "#6b6b88" }}>
          Hover any cell for cohort size + age. Click a BDC ticker to drill into its full credit page. {sortedTickers.length} BDCs · {matrix.vintages.length} vintages
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
