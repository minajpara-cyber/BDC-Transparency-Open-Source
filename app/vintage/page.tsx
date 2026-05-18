"use client";
import React, { useMemo, useState } from "react";
import VintageChart, { VintageSeries } from "@/components/VintageChart";
import { vintageRows, VintageRow } from "@/data/vintage_analysis";

type Metric = "pct_ever_default" | "pct_ever_modified" | "pct_ever_na" | "pct_ever_b80" | "pct_b90_alive";

const METRIC_META: Record<Metric, { label: string; sub: string; color: string }> = {
  pct_ever_default: {
    label: "% Cost Ever Defaulted (cumulative default exposure)",
    sub: "Cumulative — share of vintage cost ever flagged non-accrual OR exited in distress (write-off, distressed sale, debt-for-equity). Matches Raymond James's published 'cumulative 1L default exposure' methodology. Primary vintage-performance metric.",
    color: "#dc2626",
  },
  pct_ever_modified: {
    label: "% Cost Ever Modified (multi-signal)",
    sub: "Cumulative — share of vintage cost that has experienced ANY modification event by age T: cash→PIK flip, maturity extension (>180 days), par haircut (>15% drop, cross-BDC corroborated), or spread cut (>50bps). Captures restructuring activity broader than non-accrual.",
    color: "#a855f7",
  },
  pct_ever_na: {
    label: "% Cost Ever Non-Accrual (on-book only)",
    sub: "Legacy metric — only counts loans still on the balance sheet flagged non-accrual. Excludes loans that defaulted then exited. Runs ~5pp LOWER than pct_ever_default.",
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
// When hcOnly=true and the metric has a *_hc counterpart, use that; rows
// where the HC value is null (cohort had <5 HIGH+MED loans) are dropped.
function buildSeries(rows: VintageRow[], metric: Metric, hcOnly: boolean = false): VintageSeries[] {
  const hcVariant: Partial<Record<Metric, keyof VintageRow>> = {
    pct_ever_default: "pct_ever_default_hc",
    pct_ever_modified: "pct_ever_modified_hc",
  };
  const useKey = (hcOnly && hcVariant[metric]) ? hcVariant[metric]! : metric;
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
      points: sorted
        .map((r) => ({
          age_years: r.age_years,
          value: r[useKey] as number | null,
          alive_cost_b: r.alive_cost_b,
        }))
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => ({ age_years: p.age_years, value: p.value as number, alive_cost_b: p.alive_cost_b })),
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

interface MatrixData {
  tickers: string[];
  vintages: number[];
  cells: Map<string, MatrixCell>;          // key = `${ticker}|${vintage}`
  bdcTotal: Map<string, number>;           // per BDC: cohort-weighted aggregate metric
  industryByVintage: Map<number, number>;  // per vintage: industry's latest reading
  industryTotal: number;                   // industry cohort-weighted across vintages
}

function buildMatrix(
  bdcRows: VintageRow[],
  industryRows: VintageRow[],
  metric: Metric,
): MatrixData {
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

  for (const [, bdcR] of latestByPair) {
    // Industry baseline at the SAME (vintage, age_quarters)
    const indR = industryRows.find(
      (i) => i.vintage_year === bdcR.vintage_year && i.age_quarters === bdcR.age_quarters && !i.is_partial,
    );
    if (!indR) continue;
    const bdcVal = bdcR[metric] as number;
    const indVal = indR[metric] as number;
    cells.set(`${bdcR.ticker}|${bdcR.vintage_year}`, {
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

  // Per-BDC total: cohort-weighted aggregate of the metric across all this
  // BDC's vintages. For cumulative metrics (ever_na, ever_b80) the weight is
  // entry-cost; for the point-in-time snapshot (curr <90) we'd ideally weight
  // by alive_cost, but cohort_entry_cost is a reasonable scale proxy and keeps
  // the totals comparable to the per-cell values.
  const bdcTotal = new Map<string, number>();
  for (const ticker of tickerSet) {
    let num = 0;
    let den = 0;
    for (const vy of vintageSet) {
      const c = cells.get(`${ticker}|${vy}`);
      if (!c) continue;
      num += (c.bdcVal / 100) * c.cohort_b;
      den += c.cohort_b;
    }
    if (den > 0) bdcTotal.set(ticker, (num / den) * 100);
  }

  // Industry row per vintage: industry's metric at its LATEST observable age
  // for that vintage (i.e., the freshest industry snapshot, vintage by vintage).
  const industryByVintage = new Map<number, number>();
  const industryLatest = new Map<number, VintageRow>();
  for (const r of industryRows) {
    if (r.is_partial) continue;
    const prev = industryLatest.get(r.vintage_year);
    if (!prev || r.age_quarters > prev.age_quarters) industryLatest.set(r.vintage_year, r);
  }
  for (const vy of vintageSet) {
    const r = industryLatest.get(vy);
    if (r) industryByVintage.set(vy, r[metric] as number);
  }

  // Industry overall total: cohort-weighted across vintages
  let indNum = 0;
  let indDen = 0;
  for (const vy of vintageSet) {
    const r = industryLatest.get(vy);
    if (!r) continue;
    indNum += ((r[metric] as number) / 100) * r.cohort_entry_cost_b;
    indDen += r.cohort_entry_cost_b;
  }
  const industryTotal = indDen > 0 ? (indNum / indDen) * 100 : 0;

  return {
    tickers: Array.from(tickerSet).sort(),
    vintages: Array.from(vintageSet).sort(),
    cells,
    bdcTotal,
    industryByVintage,
    industryTotal,
  };
}

// Color helpers — picks a tinted background and a text color given a metric
// value, in either "absolute" (color by level) or "relative" (color by delta vs
// industry, where negative delta is good since lower NA% is better).
type ViewMode = "absolute" | "relative";

function absLevelColor(value: number, metric: Metric): { bg: string; fg: string } {
  // Thresholds tuned per metric so the colors mean roughly the same thing
  // across the views (good / amber / bad). pct_ever_default uses RJ-scale
  // thresholds (~5% = average, 8%+ = severe). pct_ever_modified runs higher
  // since restructurings precede defaults (2022/23 vintages ~15% modified).
  const t = metric === "pct_b90_alive"
    ? { greenMax: 3, yellowMax: 7, orangeMax: 12 }
    : metric === "pct_ever_b80"
      ? { greenMax: 1.5, yellowMax: 4, orangeMax: 8 }
      : metric === "pct_ever_default"
        ? { greenMax: 2, yellowMax: 5, orangeMax: 8 }
        : metric === "pct_ever_modified"
          ? { greenMax: 4, yellowMax: 10, orangeMax: 18 }
          : { greenMax: 0.75, yellowMax: 2, orangeMax: 4 };
  if (value < t.greenMax) return { bg: "rgba(34,197,94,0.10)",  fg: "#22c55e" };
  if (value < t.yellowMax) return { bg: "rgba(234,179,8,0.08)", fg: "#eab308" };
  if (value < t.orangeMax) return { bg: "rgba(249,115,22,0.10)", fg: "#f97316" };
  return { bg: "rgba(239,68,68,0.14)", fg: "#ef4444" };
}

function relDeltaColor(delta: number): { bg: string; fg: string } {
  // delta = bdc - industry. Lower NA% is better, so negative delta = good.
  const directed = -delta;
  const saturate = Math.min(Math.abs(directed) / 2.0, 1.0);
  if (directed > 0.25) return { bg: `rgba(34,197,94,${0.08 + 0.18 * saturate})`,  fg: "#22c55e" };
  if (directed < -0.25) return { bg: `rgba(239,68,68,${0.08 + 0.18 * saturate})`, fg: "#ef4444" };
  return { bg: "transparent", fg: "#9ca3af" };
}

export default function VintagePage() {
  const [includePartial, setIncludePartial] = useState(false);
  // Default ON — per docs/acq_date_methodology.md, low-confidence vintage
  // assignments (heuristic first-observed inference, or drifted disclosed
  // acq_dates likely indicating amendments not originations) shouldn't drive
  // the headline view. User can toggle off to see all-loans rollup.
  const [hcOnly, setHcOnly] = useState(true);
  const [matrixMetric, setMatrixMetric] = useState<Metric>("pct_ever_default");
  const [matrixView, setMatrixView] = useState<ViewMode>("absolute");
  const [matrixSortKey, setMatrixSortKey] = useState<number | "total" | null>("total");
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

  const defaultSeries = useMemo(() => buildSeries(visibleRows, "pct_ever_default", hcOnly), [visibleRows, hcOnly]);
  const modSeries     = useMemo(() => buildSeries(visibleRows, "pct_ever_modified", hcOnly), [visibleRows, hcOnly]);
  const naSeries  = useMemo(() => buildSeries(visibleRows, "pct_ever_na"),  [visibleRows]);
  const b80Series = useMemo(() => buildSeries(visibleRows, "pct_ever_b80"), [visibleRows]);
  const b90Series = useMemo(() => buildSeries(visibleRows, "pct_b90_alive"), [visibleRows]);

  const tableRows = useMemo(() => latestPerVintage(visibleRows), [visibleRows]);

  const matrix = useMemo(
    () => buildMatrix(bdcRows, industryRows, matrixMetric),
    [bdcRows, industryRows, matrixMetric],
  );

  // Sort tickers by clicked column (vintage year or "total"). Default = sort by
  // overall total ascending (best aggregate performer first).
  const sortedTickers = useMemo(() => {
    const ts = [...matrix.tickers];
    if (matrixSortKey === null) return ts;
    return ts.sort((a, b) => {
      const va = matrixSortKey === "total"
        ? (matrix.bdcTotal.get(a) ?? Number.POSITIVE_INFINITY)
        : (matrix.cells.get(`${a}|${matrixSortKey}`)?.bdcVal ?? Number.POSITIVE_INFINITY);
      const vb = matrixSortKey === "total"
        ? (matrix.bdcTotal.get(b) ?? Number.POSITIVE_INFINITY)
        : (matrix.cells.get(`${b}|${matrixSortKey}`)?.bdcVal ?? Number.POSITIVE_INFINITY);
      return matrixSortDir === "asc" ? va - vb : vb - va;
    });
  }, [matrix, matrixSortKey, matrixSortDir]);

  const onSortClick = (key: number | "total") => {
    if (matrixSortKey === key) {
      setMatrixSortDir(matrixSortDir === "asc" ? "desc" : "asc");
    } else {
      setMatrixSortKey(key);
      setMatrixSortDir("asc");
    }
  };

  // Cell renderer: one centered % per cell, no second-line annotation. Color
  // and value depend on the active view mode.
  const renderCell = (cell: MatrixCell | undefined): React.ReactElement => {
    if (!cell) {
      return <td className="px-3 py-2.5 text-center text-xs" style={{ color: "#444" }}>—</td>;
    }
    const isAbs = matrixView === "absolute";
    const value = isAbs ? cell.bdcVal : cell.delta;
    const { bg, fg } = isAbs
      ? absLevelColor(cell.bdcVal, matrixMetric)
      : relDeltaColor(cell.delta);
    const displayed = isAbs
      ? `${value.toFixed(2)}%`
      : `${value > 0 ? "+" : ""}${value.toFixed(2)}pp`;
    return (
      <td
        className="px-3 py-2.5 text-center font-semibold tabular-nums"
        style={{ background: bg, color: fg, fontSize: "0.95rem" }}
        title={`Age ${cell.age_years.toFixed(2)}y · cohort ${cell.n_loans} loans / $${cell.cohort_b.toFixed(2)}B · industry ${cell.indVal.toFixed(2)}%`}
      >
        {displayed}
      </td>
    );
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
        <div className="mt-3 rounded-lg border p-3 text-xs"
             style={{ background: "rgba(99,102,241,0.05)", borderColor: "rgba(99,102,241,0.2)", color: "#9ca3af" }}>
          <span className="text-white font-semibold">Methodology (updated 2026-05-18):</span>{" "}
          Primary metric is <span className="text-white">% Cost Ever Defaulted</span> — loans
          flagged on-book non-accrual OR exited in distress (write-off, distressed sale, debt-for-equity).
          Matches Raymond James&apos;s &ldquo;cumulative 1L default exposure&rdquo;.{" "}
          Industry rollup excludes loans where the holder&apos;s coverage started <em>after</em> the
          vintage year (eliminates BCRED/ADS/ASIF/BBDC survivor bias).{" "}
          <span className="text-white">Vintage assignment is tiered HIGH/MED/LOW</span> by acq_date
          stability across quarters and across BDC holders — investigation showed disclosed
          acquisition_date is materially polluted by amendment retags (88% of intra-BDC drifts go
          forward by median 22 months; BCRED is the dominant late-discloser). LOW-tier loans are
          excluded from the headline view by default; toggle off to include them.
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "#9ca3af" }}>
            <input
              type="checkbox"
              checked={hcOnly}
              onChange={(e) => setHcOnly(e.target.checked)}
              className="cursor-pointer"
            />
            <span>
              High-confidence vintage only{" "}
              <span style={{ color: "#6b6b88" }}>
                (HIGH+MED tier: stable acq_date across quarters & holders; default on — see methodology)
              </span>
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "#9ca3af" }}>
            <input
              type="checkbox"
              checked={includePartial}
              onChange={(e) => setIncludePartial(e.target.checked)}
              className="cursor-pointer"
            />
            Include vintages pre-dating parser coverage (shown dashed)
          </label>
        </div>
      </div>

      {/* Three industry curves stacked */}
      {(Object.keys(METRIC_META) as Metric[]).map((m) => {
        const meta = METRIC_META[m];
        const series =
          m === "pct_ever_default" ? defaultSeries :
          m === "pct_ever_modified" ? modSeries :
          m === "pct_ever_na" ? naSeries :
          m === "pct_ever_b80" ? b80Series : b90Series;
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
                {["Vintage", "Loans", "Hi-Conf", "Cohort Size", "Latest Age", "Cum. Default %", "Ever Modified %", "On-book NA %", "Ever <80¢ %", "Current <90¢ %", "Coverage"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => {
                const defValue = hcOnly ? r.pct_ever_default_hc : r.pct_ever_default;
                const modValue = hcOnly ? r.pct_ever_modified_hc : r.pct_ever_modified;
                const defColor = defValue == null ? "#444"
                  : defValue >= 8 ? "#dc2626" : defValue >= 4 ? "#f97316" : "#22c55e";
                const modColor = modValue == null ? "#444"
                  : modValue >= 12 ? "#a855f7" : modValue >= 6 ? "#c084fc" : "#9ca3af";
                const naColor  = r.pct_ever_na >= 3 ? "#ef4444" : r.pct_ever_na >= 1 ? "#f97316" : "#22c55e";
                const b80Color = r.pct_ever_b80 >= 5 ? "#ef4444" : r.pct_ever_b80 >= 2 ? "#f97316" : "#22c55e";
                const b90Color = r.pct_b90_alive >= 10 ? "#ef4444" : r.pct_b90_alive >= 5 ? "#f97316" : "#22c55e";
                return (
                  <tr key={r.vintage_year} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-4 py-3 font-semibold text-white">{r.vintage_year}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }}>{r.n_loans_cohort.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }} title={
                      `HIGH (stable acq_date ≤90d drift, peer spread ≤90d): ${r.n_loans_hi_tier ?? 0}\n` +
                      `MED (drift ≤12mo OR peer spread ≤12mo): ${r.n_loans_med_tier ?? 0}\n` +
                      `LOW (drift >12mo OR first_obs heuristic): ${r.n_loans_low_tier ?? 0}\n` +
                      `Hi-Conf = HIGH + MED. Higher = more reliable vintage tagging.`
                    }>
                      {r.n_loans_high_conf?.toLocaleString() ?? "—"}
                      {r.n_loans_cohort > 0 && r.n_loans_high_conf !== undefined && (
                        <span className="ml-1 text-xs" style={{ color: "#6b6b88" }}>
                          ({Math.round(100 * r.n_loans_high_conf / r.n_loans_cohort)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#d1d5db" }}>${r.cohort_entry_cost_b.toFixed(1)}B</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }}>{r.age_years.toFixed(2)}y</td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: defColor }}>{defValue == null ? "—" : `${defValue.toFixed(2)}%`}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: modColor }}>{modValue == null ? "—" : `${modValue.toFixed(2)}%`}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: naColor }}>{r.pct_ever_na.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm" style={{ color: b80Color }}>{r.pct_ever_b80.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm" style={{ color: b90Color }}>{r.pct_b90_alive.toFixed(2)}%</td>
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
          <h2 className="font-semibold text-white">Cumulative Default % at Standard Ages</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            Share of vintage cost that has defaulted (on-book NA OR exited in distress) by year T. RJ-comparable.
            &mdash; means the vintage hasn&apos;t aged that far yet.
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
                    const v = metricAtAge(visibleRows, r.vintage_year, yr, "pct_ever_default");
                    if (v === null) return <td key={yr} className="px-4 py-3 text-sm" style={{ color: "#444" }}>&mdash;</td>;
                    const color = v >= 8 ? "#dc2626" : v >= 4 ? "#f97316" : "#22c55e";
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
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">BDC × Vintage Performance</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            Rows = BDCs, columns = vintage years. Each cell is the BDC&apos;s metric at the latest age its cohort has reached.
            The <span className="text-white">Industry Average</span> row at the bottom is the cohort-weighted baseline per
            vintage; the <span className="text-white">Total</span> column on the right aggregates each BDC&apos;s metric
            across all its vintages (weighted by cohort size).
          </p>

          {/* Two rows of toggles: metric (which credit signal) + view (absolute level vs delta vs industry) */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider mr-1" style={{ color: "#6b6b88" }}>Metric</span>
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
                  {m === "pct_ever_default" ? "Cum. Default"
                    : m === "pct_ever_modified" ? "Ever Modified"
                    : m === "pct_ever_na" ? "Ever NA"
                    : m === "pct_ever_b80" ? "Ever <80¢"
                    : "Curr. <90¢"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider mr-1" style={{ color: "#6b6b88" }}>View</span>
              {([
                { id: "absolute" as ViewMode, label: "Absolute %", hint: "Each cell is the BDC's actual metric value" },
                { id: "relative" as ViewMode, label: "Relative (vs ind.)", hint: "Each cell is the BDC's delta in percentage points vs the industry average at the same age" },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setMatrixView(opt.id)}
                  className="px-2.5 py-1 rounded border transition-all"
                  style={{
                    background: matrixView === opt.id ? "rgba(99,102,241,0.15)" : "#111118",
                    borderColor: matrixView === opt.id ? "#6366f1" : "#2d2d45",
                    color: matrixView === opt.id ? "#a5b4fc" : "#9ca3af",
                    whiteSpace: "nowrap",
                  }}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8b8ba8" }}>BDC</th>
                {matrix.vintages.map((vy) => {
                  const active = matrixSortKey === vy;
                  return (
                    <th key={vy} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                      <button
                        onClick={() => onSortClick(vy)}
                        className="hover:text-white transition-colors mx-auto"
                        style={{ color: active ? "#a5b4fc" : "#8b8ba8" }}
                      >
                        {vy} {active ? (matrixSortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                  );
                })}
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-l" style={{ borderColor: "#1e1e2e" }}>
                  <button
                    onClick={() => onSortClick("total")}
                    className="hover:text-white transition-colors mx-auto"
                    style={{ color: matrixSortKey === "total" ? "#a5b4fc" : "#8b8ba8" }}
                    title="Cohort-weighted aggregate metric across all this BDC's vintages"
                  >
                    Total {matrixSortKey === "total" ? (matrixSortDir === "asc" ? "↑" : "↓") : ""}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTickers.map((ticker, i) => {
                const total = matrix.bdcTotal.get(ticker);
                const totalDelta = total != null ? total - matrix.industryTotal : null;
                const isAbs = matrixView === "absolute";
                const totalStyle = total == null
                  ? { bg: "transparent", fg: "#444" }
                  : isAbs
                    ? absLevelColor(total, matrixMetric)
                    : relDeltaColor(totalDelta ?? 0);
                const totalText = total == null
                  ? "—"
                  : isAbs
                    ? `${total.toFixed(2)}%`
                    : `${(totalDelta ?? 0) > 0 ? "+" : ""}${(totalDelta ?? 0).toFixed(2)}pp`;
                return (
                  <tr key={ticker} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-3 py-2.5">
                      <a href={`/bdcs/${ticker.toLowerCase()}`}>
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold hover:opacity-80 cursor-pointer" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>
                          {ticker}
                        </span>
                      </a>
                    </td>
                    {matrix.vintages.map((vy) => (
                      <React.Fragment key={vy}>{renderCell(matrix.cells.get(`${ticker}|${vy}`))}</React.Fragment>
                    ))}
                    <td className="px-3 py-2.5 text-center font-semibold tabular-nums border-l" style={{
                      background: totalStyle.bg,
                      color: totalStyle.fg,
                      borderColor: "#1e1e2e",
                      fontSize: "0.95rem",
                    }}
                    title={total != null ? `Cohort-weighted across all of ${ticker}'s vintages · industry total ${matrix.industryTotal.toFixed(2)}%` : undefined}
                    >
                      {totalText}
                    </td>
                  </tr>
                );
              })}

              {/* Industry Average row — always shows ABSOLUTE values regardless of mode,
                  since it IS the baseline that "relative" is relative to. */}
              <tr className="border-t-2" style={{ borderColor: "#2d2d45", background: "#0f0f16" }}>
                <td className="px-3 py-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a5b4fc" }}>
                    Industry avg
                  </span>
                </td>
                {matrix.vintages.map((vy) => {
                  const v = matrix.industryByVintage.get(vy);
                  if (v == null) return <td key={vy} className="px-3 py-2.5 text-center text-xs" style={{ color: "#444" }}>—</td>;
                  return (
                    <td key={vy} className="px-3 py-2.5 text-center font-semibold tabular-nums"
                        style={{ color: "#d1d5db", fontSize: "0.95rem" }}
                        title={`Industry baseline for vintage ${vy} (latest observable age)`}>
                      {v.toFixed(2)}%
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-center font-semibold tabular-nums border-l"
                    style={{ color: "#d1d5db", fontSize: "0.95rem", borderColor: "#1e1e2e" }}
                    title="Industry cohort-weighted across all vintages">
                  {matrix.industryTotal.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs border-t" style={{ borderColor: "#1e1e2e", color: "#6b6b88" }}>
          Hover any cell for cohort size + age. {sortedTickers.length} BDCs · {matrix.vintages.length} vintages · industry baseline always shown in absolute %.
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
