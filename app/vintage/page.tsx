"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import CreditNav from "@/components/CreditNav";
import VintageChart, { VintageSeries } from "@/components/VintageChart";
import { vintageRows, VintageRow } from "@/data/vintage_analysis";
import { vintageLGD } from "@/data/vintage_lgd";
import { vintageGolden } from "@/data/vintage_golden";
import VintageExposureTable, { VintageDatingCoverageTable } from "@/components/VintageExposureTable";
import VintageDisclosedView from "@/components/VintageDisclosedView";
import { fullySeasonedRow, lowTierShare, MOSTLY_ESTIMATED_PCT } from "@/lib/vintage";

type Metric = "pct_ever_default" | "pct_ever_modified" | "pct_ever_na" | "pct_ever_b80" | "pct_b90_alive";

const METRIC_META: Record<Metric, { label: string; sub: string; color: string }> = {
  pct_ever_default: {
    label: "% Cost Ever Defaulted (cumulative default exposure)",
    sub: "Cumulative — share of vintage cost ever flagged non-accrual OR that left the book in distress (write-off, distressed sale, debt-for-equity). Directionally comparable to Raymond James's 'cumulative 1L default exposure' (ours spans all instruments unless First-lien only is ticked). Loans whose non-accrual status is unknown at an age are left out of that point, never counted as performing.",
    color: "#dc2626",
  },
  pct_ever_modified: {
    label: "% Cost Ever Modified (multi-signal)",
    sub: "Cumulative — share of vintage cost with ANY modification event by age T: a material cash→PIK flip, a maturity extension (>6 months), a par haircut at a stressed mark, a spread cut (>50bps of spread), or a lien downgrade. Broader than non-accrual.",
    color: "#a855f7",
  },
  pct_ever_na: {
    label: "% Cost Ever Non-Accrual (on-book only)",
    sub: "Only counts loans flagged non-accrual while still on the balance sheet; loans that defaulted and then left the book are not included. Runs below % Cost Ever Defaulted.",
    color: "#ef4444",
  },
  pct_ever_b80: {
    label: "% Cost Ever Marked < 80¢",
    sub: "Cumulative — share of vintage cost ever marked below 80¢ on the dollar by age T.",
    color: "#f97316",
  },
  pct_b90_alive: {
    label: "% Surviving Cost Marked < 90¢",
    sub: "Point-in-time — share of the cost still on the book at age T that is marked below 90¢ (leading indicator).",
    color: "#eab308",
  },
};

const pctOf = (a: number, b: number) => (b > 0 ? (100 * a) / b : 0);

// When hcOnly and the metric has a *_hc counterpart, use that; rows where the
// HC value is null (cohort had <15 HIGH+MED loans old enough) are dropped.
// l1Only switches the default metric to the first-lien-only series.
function resolveMetricKey(metric: Metric, hcOnly: boolean, l1Only: boolean): keyof VintageRow {
  const hcVariant: Partial<Record<Metric, keyof VintageRow>> = {
    pct_ever_default: "pct_ever_default_hc",
    pct_ever_modified: "pct_ever_modified_hc",
  };
  if (l1Only && metric === "pct_ever_default") return "pct_ever_default_1l";
  if (hcOnly && hcVariant[metric]) return hcVariant[metric]!;
  return metric;
}

// NA-based metrics carry the "status partly unknown" flag.
const NA_KEYS = new Set<keyof VintageRow>(["pct_ever_default", "pct_ever_default_hc", "pct_ever_default_1l", "pct_ever_na"]);

function buildSeries(rows: VintageRow[], key: keyof VintageRow): VintageSeries[] {
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
        .filter((r) => typeof r[key] === "number")
        .map((r) => ({
          age_years: r.age_years,
          value: r[key] as number,
          alive_cost_b: r.alive_cost_b,
          pct_eligible: r.pct_eligible,
          n_eligible: r.n_loans_eligible,
          partial: NA_KEYS.has(key) ? r.na_partial : false,
        })),
    };
  });
}

// Latest published point per vintage — what the summary table shows.
function latestPerVintage(rows: VintageRow[]) {
  const byV = new Map<number, VintageRow>();
  for (const r of rows) {
    const prev = byV.get(r.vintage_year);
    if (!prev || r.age_quarters > prev.age_quarters) byV.set(r.vintage_year, r);
  }
  return Array.from(byV.values()).sort((a, b) => a.vintage_year - b.vintage_year);
}

function rowAtAge(rows: VintageRow[], vintage: number, ageYears: number): VintageRow | undefined {
  const targetQ = Math.round(ageYears * 4);
  return rows.find((x) => x.vintage_year === vintage && x.age_quarters === targetQ);
}


interface MatrixCell {
  bdcVal: number;
  indVal: number;
  delta: number;
  age_years: number;
  cohort_b: number;
  n_loans: number;
  estimated_pct: number;
  partial: boolean;
}

interface MatrixData {
  tickers: string[];
  vintages: number[];
  cells: Map<string, MatrixCell>;
  bdcTotal: Map<string, number>;
  industryByVintage: Map<number, { v: number; age: number }>;
  industryTotal: number;
}

function buildMatrix(bdcRows: VintageRow[], industryRows: VintageRow[], metric: Metric, hcOnly: boolean): MatrixData {
  const mKey = resolveMetricKey(metric, hcOnly, false);
  const cells = new Map<string, MatrixCell>();
  const byPair = new Map<string, VintageRow[]>();
  for (const r of bdcRows) {
    if (r.is_partial) continue;
    const key = `${r.ticker}|${r.vintage_year}`;
    if (!byPair.has(key)) byPair.set(key, []);
    byPair.get(key)!.push(r);
  }
  const tickerSet = new Set<string>();
  const vintageSet = new Set<number>();
  for (const [, rows] of byPair) {
    const bdcR = fullySeasonedRow(rows);
    if (!bdcR) continue;
    const indR = industryRows.find((i) => i.vintage_year === bdcR.vintage_year && i.age_quarters === bdcR.age_quarters && !i.is_partial);
    if (!indR) continue;
    const bdcVal = bdcR[mKey] as number | null;
    const indVal = indR[mKey] as number | null;
    if (bdcVal == null || indVal == null) continue;
    cells.set(`${bdcR.ticker}|${bdcR.vintage_year}`, {
      bdcVal, indVal, delta: bdcVal - indVal, age_years: bdcR.age_years,
      cohort_b: bdcR.cohort_entry_cost_b, n_loans: bdcR.n_loans_cohort,
      estimated_pct: lowTierShare(bdcR),
      partial: NA_KEYS.has(mKey) && bdcR.na_partial,
    });
    tickerSet.add(bdcR.ticker);
    vintageSet.add(bdcR.vintage_year);
  }
  const bdcTotal = new Map<string, number>();
  for (const ticker of tickerSet) {
    let num = 0, den = 0;
    for (const vy of vintageSet) {
      const c = cells.get(`${ticker}|${vy}`);
      if (!c) continue;
      num += (c.bdcVal / 100) * c.cohort_b;
      den += c.cohort_b;
    }
    if (den > 0) bdcTotal.set(ticker, (num / den) * 100);
  }
  const industryByVintage = new Map<number, { v: number; age: number }>();
  let indNum = 0, indDen = 0;
  for (const vy of vintageSet) {
    const r = fullySeasonedRow(industryRows.filter((x) => x.vintage_year === vy && !x.is_partial));
    const v = r ? (r[mKey] as number | null) : null;
    if (r && v != null) {
      industryByVintage.set(vy, { v, age: r.age_years });
      indNum += (v / 100) * r.cohort_entry_cost_b;
      indDen += r.cohort_entry_cost_b;
    }
  }
  return {
    tickers: Array.from(tickerSet).sort(),
    vintages: Array.from(vintageSet).sort(),
    cells, bdcTotal, industryByVintage,
    industryTotal: indDen > 0 ? (indNum / indDen) * 100 : 0,
  };
}

// Measured dating error by source bucket, from the golden-set check
// (scripts/77) — a SMALL reference set, so these are rough error bars.
const bucketMae = (b: string) => vintageGolden.by_bucket[b]?.mae_years ?? null;
function cohortDatingError(r: VintageRow): number | null {
  const parts: Array<[number, number | null]> = [
    [r.n_src_disclosed ?? 0, bucketMae("disclosed")],
    [r.n_src_corrected ?? 0, bucketMae("corrected")],
    [r.n_src_borrowed ?? 0, bucketMae("borrowed")],
    [r.n_src_name_matched ?? 0, bucketMae("name_matched")],
    [r.n_src_inferred ?? 0, bucketMae("inferred")],
  ];
  const usable = parts.filter(([, m]) => m != null) as Array<[number, number]>;
  const n = usable.reduce((s, [c]) => s + c, 0);
  if (!n) return null;
  return usable.reduce((s, [c, mae]) => s + c * mae, 0) / n;
}

type ViewMode = "absolute" | "relative";

function absLevelColor(value: number, metric: Metric): { bg: string; fg: string } {
  const t = metric === "pct_b90_alive"
    ? { greenMax: 3, yellowMax: 7, orangeMax: 12 }
    : metric === "pct_ever_b80"
      ? { greenMax: 1.5, yellowMax: 4, orangeMax: 8 }
      : metric === "pct_ever_default"
        ? { greenMax: 2, yellowMax: 5, orangeMax: 8 }
        : metric === "pct_ever_modified"
          ? { greenMax: 4, yellowMax: 10, orangeMax: 18 }
          : { greenMax: 0.75, yellowMax: 2, orangeMax: 4 };
  if (value < t.greenMax) return { bg: "rgba(34,197,94,0.10)", fg: "#22c55e" };
  if (value < t.yellowMax) return { bg: "rgba(234,179,8,0.08)", fg: "#eab308" };
  if (value < t.orangeMax) return { bg: "rgba(249,115,22,0.10)", fg: "#f97316" };
  return { bg: "rgba(239,68,68,0.14)", fg: "#ef4444" };
}

function relDeltaColor(delta: number): { bg: string; fg: string } {
  const directed = -delta;
  const saturate = Math.min(Math.abs(directed) / 2.0, 1.0);
  if (directed > 0.25) return { bg: `rgba(34,197,94,${0.08 + 0.18 * saturate})`, fg: "#22c55e" };
  if (directed < -0.25) return { bg: `rgba(239,68,68,${0.08 + 0.18 * saturate})`, fg: "#ef4444" };
  return { bg: "transparent", fg: "#9ca3af" };
}

const ESTIMATED_GREY_PCT = MOSTLY_ESTIMATED_PCT;
const panel = { background: "#111118", borderColor: "#1e1e2e" };

export default function VintagePage() {
  const [view, setView] = useState<"main" | "disclosed">("main");
  const [includePartial, setIncludePartial] = useState(false);
  // Default ON: estimated (LOW-tier) dates should not drive the headline.
  const [hcOnly, setHcOnly] = useState(true);
  const [l1Only, setL1Only] = useState(false);
  const [matrixMetric, setMatrixMetric] = useState<Metric>("pct_ever_default");
  const [matrixView, setMatrixView] = useState<ViewMode>("absolute");
  const [matrixSortKey, setMatrixSortKey] = useState<number | "total" | null>("total");
  const [matrixSortDir, setMatrixSortDir] = useState<"asc" | "desc">("asc");

  const industryRows = useMemo(() => vintageRows.filter((r) => r.ticker === "industry"), []);
  const bdcRows = useMemo(() => vintageRows.filter((r) => r.ticker !== "industry"), []);
  const visibleRows = useMemo(
    () => (includePartial ? industryRows : industryRows.filter((r) => !r.is_partial)),
    [industryRows, includePartial],
  );

  const defaultMetricKey = useMemo(() => resolveMetricKey("pct_ever_default", hcOnly, l1Only), [hcOnly, l1Only]);
  const defaultSeries = useMemo(() => buildSeries(visibleRows, defaultMetricKey), [visibleRows, defaultMetricKey]);
  const modSeries = useMemo(() => buildSeries(visibleRows, resolveMetricKey("pct_ever_modified", hcOnly, false)), [visibleRows, hcOnly]);
  const naSeries = useMemo(() => buildSeries(visibleRows, "pct_ever_na"), [visibleRows]);
  const b80Series = useMemo(() => buildSeries(visibleRows, "pct_ever_b80"), [visibleRows]);
  const b90Series = useMemo(() => buildSeries(visibleRows, "pct_b90_alive"), [visibleRows]);
  const survivalSeries = useMemo(() => buildSeries(visibleRows, "pct_surviving"), [visibleRows]);
  const tableRows = useMemo(() => latestPerVintage(visibleRows), [visibleRows]);
  const matrix = useMemo(() => buildMatrix(bdcRows, industryRows, matrixMetric, hcOnly), [bdcRows, industryRows, matrixMetric, hcOnly]);

  const sortedTickers = useMemo(() => {
    const ts = [...matrix.tickers];
    if (matrixSortKey === null) return ts;
    return ts.sort((a, b) => {
      const va = matrixSortKey === "total" ? (matrix.bdcTotal.get(a) ?? Number.POSITIVE_INFINITY) : (matrix.cells.get(`${a}|${matrixSortKey}`)?.bdcVal ?? Number.POSITIVE_INFINITY);
      const vb = matrixSortKey === "total" ? (matrix.bdcTotal.get(b) ?? Number.POSITIVE_INFINITY) : (matrix.cells.get(`${b}|${matrixSortKey}`)?.bdcVal ?? Number.POSITIVE_INFINITY);
      return matrixSortDir === "asc" ? va - vb : vb - va;
    });
  }, [matrix, matrixSortKey, matrixSortDir]);

  const onSortClick = (key: number | "total") => {
    if (matrixSortKey === key) setMatrixSortDir(matrixSortDir === "asc" ? "desc" : "asc");
    else { setMatrixSortKey(key); setMatrixSortDir("asc"); }
  };

  const renderCell = (cell: MatrixCell | undefined): React.ReactElement => {
    if (!cell) return <td className="px-3 py-2.5 text-center text-xs" style={{ color: "#444" }}>—</td>;
    const isAbs = matrixView === "absolute";
    const value = isAbs ? cell.bdcVal : cell.delta;
    const mostlyEstimated = cell.estimated_pct > ESTIMATED_GREY_PCT;
    const { bg, fg } = mostlyEstimated ? { bg: "transparent", fg: "#6b6b88" } : isAbs ? absLevelColor(cell.bdcVal, matrixMetric) : relDeltaColor(cell.delta);
    const displayed = isAbs ? `${value.toFixed(2)}%` : `${value > 0 ? "+" : ""}${value.toFixed(2)}pp`;
    return (
      <td className="px-3 py-2.5 text-center font-semibold tabular-nums"
          style={{ background: bg, color: fg, fontSize: "0.95rem", fontStyle: mostlyEstimated ? "italic" : undefined }}
          data-estimated={mostlyEstimated ? "true" : undefined}
          title={`At age ${cell.age_years.toFixed(2)}y (the oldest age every loan in this cohort has reached) · cohort ${cell.n_loans} loans / $${cell.cohort_b.toFixed(2)}B · industry ${cell.indVal.toFixed(2)}% · ${cell.estimated_pct.toFixed(0)}% of cohort cost dated by estimate${mostlyEstimated ? " (greyed: mostly estimated dates)" : ""}${cell.partial ? " · NA status partly unknown" : ""}`}>
        {displayed}{cell.partial ? "*" : ""}
      </td>
    );
  };

  const g = vintageGolden.overall;
  const basisLabel = l1Only ? "first-lien only" : hcOnly ? "high-confidence dates only (HIGH+MED)" : "all dated loans";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CreditNav />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Vintage Analysis</h1>
        <p className="text-sm" style={{ color: "#8b8ba8" }}>
          Cumulative credit performance by vintage year. A loan&apos;s vintage is the date it came onto a BDC&apos;s
          book as best we can document it: <span className="text-white">the BDC&apos;s own disclosed acquisition date</span> when
          the filing shows one, otherwise <span className="text-white">the same tranche&apos;s date at a peer BDC</span>, otherwise a
          <span className="text-white"> labelled estimate</span> (graded LOW). These are acquisition / first-seen dates, not proven
          origination dates. All metrics are <span className="text-white">cost-weighted</span>. MFIC is excluded — its schedule
          doesn&apos;t flag non-accrual per position.
        </p>
      </div>

      <div className="flex items-center gap-1 mb-6 border-b" style={{ borderColor: "#1e1e2e" }} role="tablist">
        {([
          { id: "main" as const, label: "All dated loans (main view)" },
          { id: "disclosed" as const, label: "Disclosed dates only" },
        ]).map((t) => (
          <button key={t.id} role="tab" aria-selected={view === t.id} onClick={() => setView(t.id)}
                  className="px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors"
                  style={{ color: view === t.id ? "#a5b4fc" : "#9ca3af", borderColor: view === t.id ? "#6366f1" : "transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {view === "disclosed" ? <VintageDisclosedView /> : (
      <>
      <div className="rounded-lg border p-3 text-xs mb-4" style={{ background: "rgba(99,102,241,0.05)", borderColor: "rgba(99,102,241,0.2)", color: "#9ca3af" }}>
        <span className="text-white font-semibold">How to read this page.</span>{" "}
        The primary metric is <span className="text-white">% Cost Ever Defaulted</span> (on-book non-accrual or a distressed exit).
        A point at age T only counts loans whose vintage date is at least T old at their BDC&apos;s latest filing, so every loan
        counted has had the full T years to go wrong; younger loans are left out and a curve stops when too few loans are old
        enough. Hover a point for how much of the cohort it counts. Because the counted set shrinks at the oldest ages, a curve
        can dip at its tail: that is a smaller, earlier-dated part of the cohort, not a cure. A <span className="text-white">hollow dot</span> means the
        BDC&apos;s non-accrual marks were not captured for at least 5% of that cost in some quarter; loans whose status is unknown
        are left out rather than counted as performing.{" "}
        {g.n > 0 && (
          <span data-golden-caveat>
            Dating check: on a <span className="text-white">small reference set of {vintageGolden.n_reference_financings_matched} publicly
            documented financings ({g.n.toLocaleString()} matched loan-tranches)</span>, {g.pct_within_1y?.toFixed(0)}% of assigned vintage
            years land within ±1 year (mean error {g.mae_years?.toFixed(1)}y). {vintageGolden.caveat}{" "}
          </span>
        )}
        <Link href="/methodology#vintage" className="text-indigo-400 hover:text-indigo-300">Full vintage methodology →</Link>
      </div>
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "#9ca3af" }}>
          <input type="checkbox" checked={hcOnly} onChange={(e) => setHcOnly(e.target.checked)} className="cursor-pointer" />
          <span>High-confidence dates only <span style={{ color: "#6b6b88" }}>(HIGH+MED tier: disclosed dates that stay stable across quarters and holders; default on)</span></span>
        </label>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "#9ca3af" }}>
          <input type="checkbox" checked={l1Only} onChange={(e) => setL1Only(e.target.checked)} className="cursor-pointer" />
          <span>First-lien only <span style={{ color: "#6b6b88" }}>(the Raymond James-comparable universe; applies to the default metric and overrides the high-confidence filter for it)</span></span>
        </label>
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "#9ca3af" }}>
          <input type="checkbox" checked={includePartial} onChange={(e) => setIncludePartial(e.target.checked)} className="cursor-pointer" />
          <span>Include thin-coverage early vintages <span style={{ color: "#6b6b88" }}>(2018&ndash;2020: fewer than 60% of BDCs were yet in our data, so those cohorts over-weight survivors)</span></span>
        </label>
      </div>

      {(Object.keys(METRIC_META) as Metric[]).map((m) => {
        const meta = METRIC_META[m];
        const series = m === "pct_ever_default" ? defaultSeries : m === "pct_ever_modified" ? modSeries
          : m === "pct_ever_na" ? naSeries : m === "pct_ever_b80" ? b80Series : b90Series;
        return (
          <div key={m} className="rounded-xl border p-5 mb-6" style={panel}>
            <h2 className="font-semibold text-white mb-1">{meta.label}</h2>
            <p className="text-xs mb-1" style={{ color: "#8b8ba8" }}>{meta.sub}</p>
            {(m === "pct_ever_default" || m === "pct_ever_modified") && (
              <p className="text-xs mb-3" style={{ color: "#6b6b88" }}>Basis: {m === "pct_ever_default" ? basisLabel : hcOnly ? "high-confidence dates only" : "all dated loans"}.</p>
            )}
            <VintageChart series={series} yLabel={meta.label} height={300} />
          </div>
        );
      })}

      <div className="rounded-xl border p-5 mb-6" style={panel}>
        <h2 className="font-semibold text-white mb-1">% of Cohort Still On Book</h2>
        <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
          Share of each vintage&apos;s entry cost (counting only loans old enough to reach age T) whose loan still appears on a BDC&apos;s
          schedule at age T or later. Declines reflect refinancings, paydowns, sales and write-offs. It cannot exceed 100% — loans
          that grew through add-ons or PIK still count once, at their entry cost.
        </p>
        <VintageChart series={survivalSeries} yLabel="% of cohort cost still on book" height={300} yMax={100} />
      </div>

      <div className="rounded-xl border overflow-hidden mb-6" style={panel}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Mark-based loss proxy by vintage (not realized loss-given-default)</h2>
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            For loans that left the book in distress (the same exits the default curve counts), how far below cost were they
            marked at the last filing before they disappeared? <b>Loss proxy % = −(last fair value − last cost) / last cost</b>.
            Filings don&apos;t disclose sale prices or recoveries, so this is the final markdown, not an audited loss. Industry rollup,
            all figures in US$.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Vintage", "# loans", "# exited", "% exited", "# distress exits", "% distress", "Distress cost ($B)", "Markdown at exit ($B)", "Loss proxy"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vintageLGD.map((r, i) => {
                const small = r.n_distress < 10;
                return (
                  <tr key={r.vintage_year} style={{ background: i % 2 === 0 ? "#111118" : "#0f0f16", borderBottom: "1px solid #1a1a28" }}>
                    <td className="px-4 py-2.5 font-semibold text-white">{r.vintage_year}</td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: "#9ca3af" }}>{r.n_loans_total.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: "#9ca3af" }}>{r.n_exited.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums" style={{ color: "#9ca3af" }}>{r.pct_exited.toFixed(0)}%</td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: small ? "#6b6b88" : "#fdba74" }}>{r.n_distress}{small ? " (small sample)" : ""}</td>
                    <td className="px-4 py-2.5 text-sm tabular-nums" style={{ color: r.pct_distress >= 10 ? "#ef4444" : r.pct_distress >= 5 ? "#f97316" : "#22c55e" }}>{r.pct_distress.toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-sm font-mono tabular-nums" style={{ color: "#d1d5db" }}>{r.distress_cost_b.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm font-mono tabular-nums" style={{ color: r.mark_loss_b < 0 ? "#fca5a5" : "#86efac" }}>{r.mark_loss_b.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold tabular-nums" style={{ color: small ? "#6b6b88" : (r.mark_loss_pct ?? 0) >= 30 ? "#ef4444" : (r.mark_loss_pct ?? 0) >= 15 ? "#f97316" : "#9ca3af" }}>
                      {r.mark_loss_pct == null ? "—" : `${r.mark_loss_pct.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs border-t" style={{ borderColor: "#1e1e2e", color: "#6b6b88" }}>
          Vintages with fewer than 10 distress exits are greyed: one or two loans drive their percentage.
        </div>
      </div>

      <VintageDatingCoverageTable />
      <VintageExposureTable />

      <div className="rounded-xl border overflow-hidden mb-6" style={panel}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Vintage Summary — Industry</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            Latest published point per vintage ({basisLabel} for the default column). &ldquo;Counted&rdquo; is the share of the
            cohort old enough to reach that age; the rest is too young and left out. NA% and Below-80% are cumulative through age;
            Below-90% is point-in-time among loans still on the book.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Vintage", "Loans", "Hi-Conf", "Dating", "Cohort Size", "Latest Age", "Counted", l1Only ? "Cum. Default % (1L)" : "Cum. Default %", "Ever Modified %", "On-book NA %", "Ever <80¢ %", "Current <90¢ %", "NA status", "Coverage"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r, i) => {
                const defValue = r[defaultMetricKey] as number | null;
                const modValue = hcOnly ? r.pct_ever_modified_hc : r.pct_ever_modified;
                const defColor = defValue == null ? "#444" : defValue >= 8 ? "#dc2626" : defValue >= 4 ? "#f97316" : "#22c55e";
                const modColor = modValue == null ? "#444" : modValue >= 12 ? "#a855f7" : modValue >= 6 ? "#c084fc" : "#9ca3af";
                const naColor = r.pct_ever_na == null ? "#444" : r.pct_ever_na >= 3 ? "#ef4444" : r.pct_ever_na >= 1 ? "#f97316" : "#22c55e";
                const b80Color = r.pct_ever_b80 >= 5 ? "#ef4444" : r.pct_ever_b80 >= 2 ? "#f97316" : "#22c55e";
                const b90Color = r.pct_b90_alive >= 10 ? "#ef4444" : r.pct_b90_alive >= 5 ? "#f97316" : "#22c55e";
                const discPct = pctOf(r.cohort_high_conf_b ?? 0, r.cohort_entry_cost_b);
                const discColor = discPct >= 75 ? "#22c55e" : discPct >= 50 ? "#eab308" : "#ef4444";
                const altDef = (l1Only || hcOnly) ? r.pct_ever_default : r.pct_ever_default_hc;
                const altLabel = (l1Only || hcOnly) ? "all" : "hi-conf";
                const err = cohortDatingError(r);
                const doc = (r.n_src_disclosed ?? 0) + (r.n_src_corrected ?? 0) + (r.n_src_borrowed ?? 0);
                const nm = r.n_src_name_matched ?? 0;
                const inf = r.n_src_inferred ?? 0;
                const tot = doc + nm + inf;
                const unk = r.pct_na_unknown + r.pct_na_history_gap;
                return (
                  <tr key={r.vintage_year} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-4 py-3 font-semibold text-white">{r.vintage_year}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }}>{r.n_loans_cohort.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }} title={`HIGH (stable disclosed date, ≤90d drift and peer spread): ${r.n_loans_hi_tier}\nMED (≤12mo, or a corrected amendment retag): ${r.n_loans_med_tier}\nLOW (estimated, drifted, or dated after we first saw the loan): ${r.n_loans_low_tier}`}>
                      {r.n_loans_high_conf.toLocaleString()}
                      <span className="ml-1 text-xs" style={{ color: "#6b6b88" }}>({Math.round(pctOf(r.n_loans_high_conf, r.n_loans_cohort))}%)</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: discColor }} title="Share of cohort $ with a HIGH or MED confidence date. Low = this vintage's metrics rest mostly on estimated dates.">
                      {discPct.toFixed(0)}%
                      {err != null && (
                        <span className="ml-1 text-xs font-normal" style={{ color: "#6b6b88" }} title={`Rough dating error for this cohort: its source mix weighted by each source's mean error on the small reference set (${vintageGolden.overall.n} loan-tranches). Not a representative accuracy benchmark.`}>
                          ±{err.toFixed(1)}y
                        </span>
                      )}
                      {tot > 0 && (
                        <div className="mt-1 flex h-1.5 w-16 overflow-hidden rounded"
                             title={`How this cohort's loans were dated (count):\nown disclosed: ${r.n_src_disclosed}\nretag-corrected: ${r.n_src_corrected}\npeer, same tranche: ${r.n_src_borrowed}\nname-matched / sibling facility / DERA (estimate): ${nm}\ntenor model / first-observed (estimate): ${inf}`}>
                          <div style={{ width: `${(100 * doc) / tot}%`, background: "#6366f1" }} />
                          <div style={{ width: `${(100 * nm) / tot}%`, background: "#eab308" }} />
                          <div style={{ width: `${(100 * inf) / tot}%`, background: "#4b5563" }} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#d1d5db" }}>${r.cohort_entry_cost_b.toFixed(1)}B</td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }}>{r.age_years.toFixed(2)}y</td>
                    <td className="px-4 py-3 text-sm" style={{ color: r.pct_eligible < 50 ? "#eab308" : "#9ca3af" }} title={`${r.n_loans_eligible} of ${r.n_loans_cohort} loans ($${r.eligible_cost_b.toFixed(1)}B) are old enough to reach this age.`}>
                      {r.pct_eligible.toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 text-sm font-bold" style={{ color: defColor }}>
                      {defValue == null ? "—" : `${defValue.toFixed(2)}%`}
                      {altDef != null && defValue != null && Math.abs(altDef - defValue) >= 0.3 && (
                        <span className="ml-1 text-xs font-normal" style={{ color: "#6b6b88" }} title={l1Only ? "Rate across ALL instruments" : hcOnly ? "Rate including estimated dates" : "Rate on high-confidence dates only"}>
                          ({altLabel} {altDef.toFixed(1)})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: modColor }}>{modValue == null ? "—" : `${modValue.toFixed(2)}%`}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: naColor }}>{r.pct_ever_na == null ? "—" : `${r.pct_ever_na.toFixed(2)}%`}</td>
                    <td className="px-4 py-3 text-sm" style={{ color: b80Color }}>{r.pct_ever_b80.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm" style={{ color: b90Color }}>{r.pct_b90_alive.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-xs" title={`Left out (status unknown now): ${r.pct_na_unknown.toFixed(1)}% · counted but with an earlier unknown quarter: ${r.pct_na_history_gap.toFixed(1)}%`}>
                      {r.na_partial
                        ? <span style={{ color: "#eab308" }}>partial ({unk.toFixed(0)}% unknown)</span>
                        : <span style={{ color: "#22c55e" }}>complete</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.is_partial
                        ? <span className="px-2 py-0.5 rounded text-xs" style={{ background: "rgba(234,179,8,0.12)", color: "#eab308", border: "1px solid rgba(234,179,8,0.2)" }}>thin</span>
                        : <span style={{ color: "#22c55e" }}>full</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden mb-6" style={panel}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Cumulative Default % at Standard Ages</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            Share of vintage cost that has defaulted (on-book NA or a distressed exit) by year T, counting only loans old enough to
            reach year T (hover for how much of the cohort that is). &mdash; means too few loans have reached that age.
            * = non-accrual status partly unknown. Basis: <b>{basisLabel}</b>.
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
                    const row = rowAtAge(visibleRows, r.vintage_year, yr);
                    const v = row ? (row[defaultMetricKey] as number | null) : null;
                    if (!row || v == null) return <td key={yr} className="px-4 py-3 text-sm" style={{ color: "#444" }}>&mdash;</td>;
                    const color = v >= 8 ? "#dc2626" : v >= 4 ? "#f97316" : "#22c55e";
                    return (
                      <td key={yr} className="px-4 py-3 text-sm font-semibold" style={{ color }}
                          title={`${row.n_loans_eligible} loans, ${row.pct_eligible.toFixed(0)}% of the cohort's cost, old enough to reach year ${yr}`}>
                        {v.toFixed(2)}%{row.na_partial ? "*" : ""}
                        {row.pct_eligible < 100 && <span className="ml-1 text-[10px] font-normal" style={{ color: "#6b6b88" }}>{row.pct_eligible.toFixed(0)}%</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs border-t" style={{ borderColor: "#1e1e2e", color: "#6b6b88" }}>
          Small grey figures = share of the cohort&apos;s cost counted at that age when it is below 100%.
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden mb-6" style={panel}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">BDC × Vintage Performance</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            Rows = BDCs, columns = vintage years. Each cell is the BDC&apos;s metric at the <span className="text-white">oldest age every
            loan in its cohort has reached</span>, next to the industry at that same age — so a cell never rests on the early-dated
            part of a cohort only. <span className="text-white">Greyed italic</span> cells: more than {ESTIMATED_GREY_PCT}% of the
            cohort&apos;s cost is dated by estimate (BDCs that do not disclose acquisition dates). * = NA status partly unknown.
            Cohorts below 30 loans are not shown.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider mr-1" style={{ color: "#6b6b88" }}>Metric</span>
              {(Object.keys(METRIC_META) as Metric[]).map((m) => (
                <button key={m} onClick={() => setMatrixMetric(m)} className="px-2.5 py-1 rounded border transition-all"
                        style={{ background: matrixMetric === m ? "rgba(99,102,241,0.15)" : "#111118", borderColor: matrixMetric === m ? "#6366f1" : "#2d2d45", color: matrixMetric === m ? "#a5b4fc" : "#9ca3af", whiteSpace: "nowrap" }}
                        title={METRIC_META[m].sub}>
                  {m === "pct_ever_default" ? "Cum. Default" : m === "pct_ever_modified" ? "Ever Modified" : m === "pct_ever_na" ? "Ever NA" : m === "pct_ever_b80" ? "Ever <80¢" : "Curr. <90¢"}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider mr-1" style={{ color: "#6b6b88" }}>View</span>
              {([
                { id: "absolute" as ViewMode, label: "Absolute %", hint: "Each cell is the BDC's metric value" },
                { id: "relative" as ViewMode, label: "Relative (vs ind.)", hint: "Each cell is the BDC's difference in percentage points vs the industry at the same age" },
              ]).map((opt) => (
                <button key={opt.id} onClick={() => setMatrixView(opt.id)} className="px-2.5 py-1 rounded border transition-all"
                        style={{ background: matrixView === opt.id ? "rgba(99,102,241,0.15)" : "#111118", borderColor: matrixView === opt.id ? "#6366f1" : "#2d2d45", color: matrixView === opt.id ? "#a5b4fc" : "#9ca3af", whiteSpace: "nowrap" }}
                        title={opt.hint}>
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
                      <button onClick={() => onSortClick(vy)} className="hover:text-white transition-colors mx-auto" style={{ color: active ? "#a5b4fc" : "#8b8ba8" }}>
                        {vy} {active ? (matrixSortDir === "asc" ? "↑" : "↓") : ""}
                      </button>
                    </th>
                  );
                })}
                <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap border-l" style={{ borderColor: "#1e1e2e" }}>
                  <button onClick={() => onSortClick("total")} className="hover:text-white transition-colors mx-auto" style={{ color: matrixSortKey === "total" ? "#a5b4fc" : "#8b8ba8" }} title="Cohort-weighted across this BDC's vintages">
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
                const totalStyle = total == null ? { bg: "transparent", fg: "#444" } : isAbs ? absLevelColor(total, matrixMetric) : relDeltaColor(totalDelta ?? 0);
                const totalText = total == null ? "—" : isAbs ? `${total.toFixed(2)}%` : `${(totalDelta ?? 0) > 0 ? "+" : ""}${(totalDelta ?? 0).toFixed(2)}pp`;
                return (
                  <tr key={ticker} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-3 py-2.5">
                      <a href={`/bdcs/${ticker.toLowerCase()}`}>
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold hover:opacity-80 cursor-pointer" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>{ticker}</span>
                      </a>
                    </td>
                    {matrix.vintages.map((vy) => <React.Fragment key={vy}>{renderCell(matrix.cells.get(`${ticker}|${vy}`))}</React.Fragment>)}
                    <td className="px-3 py-2.5 text-center font-semibold tabular-nums border-l" style={{ background: totalStyle.bg, color: totalStyle.fg, borderColor: "#1e1e2e", fontSize: "0.95rem" }}
                        title={total != null ? `Cohort-weighted across ${ticker}'s vintages · industry total ${matrix.industryTotal.toFixed(2)}%` : undefined}>
                      {totalText}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2" style={{ borderColor: "#2d2d45", background: "#0f0f16" }}>
                <td className="px-3 py-2.5"><span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#a5b4fc" }}>Industry</span></td>
                {matrix.vintages.map((vy) => {
                  const v = matrix.industryByVintage.get(vy);
                  if (v == null) return <td key={vy} className="px-3 py-2.5 text-center text-xs" style={{ color: "#444" }}>—</td>;
                  return (
                    <td key={vy} className="px-3 py-2.5 text-center font-semibold tabular-nums" style={{ color: "#d1d5db", fontSize: "0.95rem" }} title={`Industry at age ${v.age.toFixed(2)}y, the oldest age every loan in its ${vy} cohort has reached`}>
                      {v.v.toFixed(2)}%
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-center font-semibold tabular-nums border-l" style={{ color: "#d1d5db", fontSize: "0.95rem", borderColor: "#1e1e2e" }}>{matrix.industryTotal.toFixed(2)}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs border-t" style={{ borderColor: "#1e1e2e", color: "#6b6b88" }}>
          Hover any cell for its age, cohort size and dating mix. {sortedTickers.length} BDCs · {matrix.vintages.length} vintages. Each BDC cell
          is compared with the industry at the BDC cohort&apos;s own fully-seasoned age; the Industry row shows the industry cohort at its own.
        </div>
      </div>

      <div className="rounded-lg p-5 border" style={{ background: "#0f0f16", borderColor: "#1e1e2e" }}>
        <h3 className="text-sm font-semibold text-white mb-2">Methodology</h3>
        <ul className="text-xs space-y-1.5 list-disc list-inside" style={{ color: "#9ca3af" }}>
          <li><span className="text-white">Vintage date</span> = the BDC&apos;s own disclosed acquisition date; else the same tranche&apos;s date at a peer BDC; else a labelled estimate (long-tail name match, a sibling facility, a DERA filing floor, maturity minus typical tenor, or the first quarter we saw the loan), graded LOW. A date more than two quarters after we first saw the loan is rejected; when a BDC&apos;s own re-dated acquisition date is replaced by the same tranche&apos;s peer date or a reliably covered first sighting, the loan counts as corrected (MED).</li>
          <li><span className="text-white">Entry weight</span> = the loan&apos;s cost in the first quarter we saw it, summing every piece (e.g. a USD term loan, a GBP tranche and an add-on of the same facility). It stays fixed, so a loan that went on non-accrual stays counted even if it later cures at a lower cost.</li>
          <li><span className="text-white">Old enough to count</span>: at age T a cohort only counts loans whose vintage date is at least T before their BDC&apos;s latest filing. Points with fewer than 20 such loans (30 for one BDC), or with under a quarter of the cohort&apos;s cost old enough, are not shown.</li>
          <li><span className="text-white">Unknown non-accrual flags</span>: for some BDC-quarters the filing&apos;s non-accrual marks were not captured. A loan whose latest status is unknown is left out of that point (never counted as performing); points where unknown history touches at least 5% of the counted cost are marked partial (hollow dot, *).</li>
          <li>Vintages marked <span style={{ color: "#eab308" }}>thin</span> predate most of our filing coverage; their denominators only include loans that were still on the book when coverage began.</li>
          <li>The <span className="text-white">Disclosed dates only</span> tab shows a stricter cross-check that uses no peer dates and no estimates.</li>
        </ul>
      </div>
      </>
      )}
    </div>
  );
}
