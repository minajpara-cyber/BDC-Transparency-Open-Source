"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import MaturityWallChart from "@/components/MaturityWallChart";
import StatCard from "@/components/StatCard";
import CsvDownloadButton from "@/components/CsvDownloadButton";
import { managerOf } from "@/lib/managerMap";
import {
  maturityAggregate,
  maturityComparison,
  maturityMeta,
} from "@/data/maturity";

const asOfYear = parseInt(maturityMeta.as_of.slice(0, 4), 10);

// column key for a bucket — mirrors the python: "<=2025"->le2025, "2033+"->2033plus
const pctKey = (b: string) => `pct_${b.replace("<=", "le").replace("+", "plus")}`;
const bucketLabel = (b: string) => (b === "<=2025" ? "≤25" : b === "2033+" ? "’33+" : `’${b.slice(2)}`);

type SortKey = "ticker" | "debt_cost_m" | "wavg_years" | "pct_near24m" | string;

function fmtB(m: number): string {
  return m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${m.toFixed(0)}M`;
}

// faint heat behind a % cell so concentrations pop; intensity scaled to maxPct
function heat(pct: number, max: number): string {
  if (!pct) return "transparent";
  const a = Math.min(0.6, 0.06 + (pct / Math.max(max, 1)) * 0.5);
  return `rgba(99,102,241,${a.toFixed(2)})`;
}

export default function MaturityPage() {
  const [metric, setMetric] = useState<"cost_m" | "fv_m">("cost_m");
  const [sortKey, setSortKey] = useState<SortKey>("pct_near24m");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const buckets = maturityMeta.buckets;

  const totals = useMemo(() => {
    const debt = maturityComparison.reduce((s, r) => s + r.debt_cost_m, 0);
    const aggMap = new Map(maturityAggregate.map((a) => [a.bucket, a]));
    const due = (b: string) => (metric === "fv_m" ? aggMap.get(b)?.fv_m : aggMap.get(b)?.cost_m) ?? 0;
    const aggTotal = maturityAggregate.reduce((s, a) => s + (metric === "fv_m" ? a.fv_m : a.cost_m), 0);
    const near = due(String(asOfYear)) + due(String(asOfYear + 1));
    const wavg =
      maturityComparison.reduce((s, r) => s + r.debt_cost_m * (r.wavg_years ?? 0), 0) / (debt || 1);
    return {
      debt,
      aggTotal,
      due2026: due(String(asOfYear)),
      near,
      nearPct: aggTotal ? (near / aggTotal) * 100 : 0,
      due2026Pct: aggTotal ? (due(String(asOfYear)) / aggTotal) * 100 : 0,
      wavg,
    };
  }, [metric]);

  const maxPct = useMemo(() => {
    let mx = 0;
    for (const r of maturityComparison)
      for (const b of buckets) mx = Math.max(mx, (r as unknown as Record<string, number>)[pctKey(b)] ?? 0);
    return mx;
  }, [buckets]);

  const sorted = useMemo(() => {
    const rows = [...maturityComparison];
    rows.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "desc" ? bv - av : av - bv;
      return sortDir === "desc"
        ? String(bv ?? "").localeCompare(String(av ?? ""))
        : String(av ?? "").localeCompare(String(bv ?? ""));
    });
    return rows;
  }, [sortKey, sortDir]);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(k === "ticker" ? "asc" : "desc");
    }
  };

  const aggData = maturityAggregate.map((a) => ({
    bucket: a.bucket,
    cost_m: a.cost_m,
    fv_m: a.fv_m,
    n_loans: a.n_loans,
  }));

  const csvRows = sorted.map((r) => [
    r.ticker, managerOf(r.ticker), r.debt_cost_m, r.coverage_pct, r.wavg_years, r.pct_near24m,
    ...buckets.map((b) => (r as unknown as Record<string, number>)[pctKey(b)]),
  ]);

  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : "");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-white">Portfolio Maturity Wall</h1>
          <span className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: "#1a1a28", color: "#a5b4fc", border: "1px solid #2d2d50" }}>
            as of {maturityMeta.as_of}
          </span>
        </div>
        <p className="text-sm max-w-3xl" style={{ color: "#9ca3af" }}>
          When the loans each BDC <span className="text-white">holds</span>{" "}come due — when its borrowers must repay or
          refinance. This is the maturity of the BDC&apos;s <span className="text-white">assets</span>{" "}(its debt
          investments), not the BDC&apos;s own funding. Sized by amortized cost (raw par is misparsed in several filings).
          A tall <span style={{ color: "#f59e0b" }}>near-term</span>{" "}wall concentrates borrower repayment and refinancing
          in the next year or two — reinvestment risk for the BDC, plus credit risk if borrowers can&apos;t refinance when
          conditions tighten. Equity, warrants and structured/JV positions have no fixed maturity and are excluded.
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Portfolio loans (covered BDCs)" value={fmtB(totals.debt)}
          sub={`${maturityMeta.n_bdcs} BDCs · debt investments at cost`} color="#6366f1" highlight />
        <StatCard label={`Loans maturing ${asOfYear}`} value={fmtB(totals.due2026)}
          sub={`${totals.due2026Pct.toFixed(1)}% of loan book`} color="#ef4444" />
        <StatCard label={`Loans maturing ${asOfYear}–${asOfYear + 1}`} value={fmtB(totals.near)}
          sub={`${totals.nearPct.toFixed(1)}% of loan book · next 24 months`} color="#f59e0b" />
        <StatCard label="Weighted-avg loan maturity" value={`${totals.wavg.toFixed(1)} yrs`}
          sub="loan-weighted across the space" color="#22c55e" />
      </div>

      {/* Aggregate wall */}
      <section className="mb-8 rounded-xl border p-5" style={{ background: "#0d0d14", borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">The space-wide wall</h2>
            <p className="text-sm" style={{ color: "#9ca3af" }}>
              Every covered BDC&apos;s loan book, stacked by the year each loan matures (when borrowers repay).{" "}
              {`${asOfYear}–${asOfYear + 1}`} highlighted.
            </p>
          </div>
          <div className="flex rounded-lg overflow-hidden border text-xs" style={{ borderColor: "#2d2d50" }}>
            {(["cost_m", "fv_m"] as const).map((m) => (
              <button key={m} onClick={() => setMetric(m)}
                className="px-3 py-1.5 font-medium transition-colors"
                style={{ background: metric === m ? "#6366f1" : "transparent", color: metric === m ? "#fff" : "#9ca3af" }}>
                {m === "cost_m" ? "Amortized cost" : "Fair value"}
              </button>
            ))}
          </div>
        </div>
        <MaturityWallChart data={aggData} metric={metric} asOfYear={asOfYear} height={320} />
      </section>

      {/* Cross-BDC comparison grid */}
      <section className="mb-8">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Who matures when — across BDCs</h2>
            <p className="text-sm max-w-3xl" style={{ color: "#9ca3af" }}>
              Each row is one BDC; cells are the <span className="text-white">% of that BDC&apos;s loan book</span>{" "}(debt
              investments, at cost) maturing in each year, so books of different sizes compare like-for-like. Click a column to
              sort — default is the next-24-month wall. Short-duration lenders sit near the top; freshly-deployed perpetual vehicles near the bottom.
            </p>
          </div>
          <CsvDownloadButton filename="maturity-by-bdc"
            columns={["ticker", "manager", "debt_cost_m", "coverage_pct", "wavg_years", "pct_near24m",
              ...buckets.map((b) => `pct_${b}`)]}
            rows={csvRows} />
        </div>
        <div className="rounded-xl border overflow-x-auto" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <table className="text-xs" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: "100%" }}>
            <thead style={{ background: "#0f0f16" }}>
              <tr>
                {[
                  { k: "ticker", label: "BDC", align: "left" as const },
                  { k: "debt_cost_m", label: "Debt", align: "right" as const },
                  ...buckets.map((b) => ({ k: pctKey(b), label: bucketLabel(b), align: "right" as const })),
                  { k: "pct_near24m", label: "≤24mo", align: "right" as const },
                  { k: "wavg_years", label: "WAvg", align: "right" as const },
                ].map((c, i) => (
                  <th key={c.k}
                    onClick={() => handleSort(c.k)}
                    className={`px-2.5 py-2 font-semibold cursor-pointer select-none whitespace-nowrap ${c.align === "left" ? "text-left sticky left-0 z-10" : "text-right"}`}
                    style={{ color: "#8b8ba8", borderBottom: "1px solid #1e1e2e",
                      background: c.align === "left" ? "#0f0f16" : undefined,
                      borderRight: i === 1 ? "1px solid #1e1e2e" : undefined }}>
                    {c.label}{arrow(c.k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, ri) => (
                <tr key={r.ticker}>
                  <td className="px-2.5 py-2 sticky left-0 z-10"
                    style={{ background: ri % 2 === 0 ? "#111118" : "#0f0f16", borderRight: "1px solid #1e1e2e" }}>
                    <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="font-mono font-semibold hover:text-white"
                      style={{ color: "#a5b4fc" }} title={`${managerOf(r.ticker)} · open ${r.ticker}`}>
                      {r.ticker}
                    </Link>
                    <span className="ml-1.5" style={{ color: "#5b5b78" }}>{managerOf(r.ticker)}</span>
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums font-medium text-white"
                    style={{ borderRight: "1px solid #1e1e2e" }} title={`coverage ${r.coverage_pct}% of debt dated`}>
                    {fmtB(r.debt_cost_m)}
                  </td>
                  {buckets.map((b) => {
                    const v = (r as unknown as Record<string, number>)[pctKey(b)] ?? 0;
                    return (
                      <td key={b} className="px-2.5 py-2 text-right tabular-nums"
                        style={{ background: heat(v, maxPct), color: v >= 1 ? "#fafafa" : "#5b5b78" }}>
                        {v >= 0.1 ? v.toFixed(1) : "·"}
                      </td>
                    );
                  })}
                  <td className="px-2.5 py-2 text-right tabular-nums font-semibold"
                    style={{ color: r.pct_near24m >= 18 ? "#f59e0b" : "#c7c7e0" }}>
                    {r.pct_near24m.toFixed(1)}
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                    {r.wavg_years != null ? `${r.wavg_years.toFixed(1)}y` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
          Cells are % of each BDC&apos;s dated loan book (debt investments at amortized cost); shading scales with magnitude. &quot;≤24mo&quot; sums the
          {" "}{asOfYear} and {asOfYear + 1}{" "}columns. &quot;WAvg&quot; is the cost-weighted average years to maturity.
          {maturityMeta.excluded.length > 0 && (
            <> Excluded: {maturityMeta.excluded.map((e) => `${e.ticker} (${e.reason})`).join("; ")}.</>
          )}
        </p>
      </section>
    </div>
  );
}
