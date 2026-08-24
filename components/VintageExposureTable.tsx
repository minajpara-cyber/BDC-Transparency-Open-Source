"use client";

// BDC x vintage-year exposure matrix: where each book's cost actually sits.
// Sibling to the BDC x Vintage PERFORMANCE table further down the page — that
// one asks how a vintage has done, this one asks who is holding it.
import { useMemo, useState } from "react";
import Link from "next/link";
import { vintageExposure } from "@/data/vintage_exposure";
import CsvDownloadButton from "./CsvDownloadButton";

// Vintages before this are long-tail equity stubs and pre-panel loans; they
// carry real cost for a few BDCs but one column each would be mostly empty.
const OLD_BUCKET = 2018;
const OLD_LABEL = `≤${OLD_BUCKET - 1}`;

type View = "absolute" | "relative";

function absColor(pct: number, max: number): string {
  if (!pct) return "transparent";
  const t = Math.max(0, Math.min(1, pct / Math.max(max, 0.0001)));
  // Single-hue ramp — this is composition, not alarm; a red/green scale here
  // would imply a big 2024 vintage is "bad", which it isn't.
  return `rgba(99, 102, 241, ${0.06 + 0.62 * t})`;
}

function relColor(delta: number): string {
  const t = Math.max(0, Math.min(1, Math.abs(delta) / 15));
  if (Math.abs(delta) < 0.5) return "transparent";
  return delta > 0
    ? `rgba(239, 68, 68, ${0.08 + 0.5 * t})`   // over-indexed vs the space
    : `rgba(56, 189, 248, ${0.08 + 0.5 * t})`; // under-indexed
}

export default function VintageExposureTable() {
  const [view, setView] = useState<View>("absolute");
  const [sortKey, setSortKey] = useState<string>("ticker");
  const [sortAsc, setSortAsc] = useState(true);

  const { tickers, columns, cell, totals, industry, asOf, maxPct } = useMemo(() => {
    const bucket = (y: number) => (y < OLD_BUCKET ? OLD_BUCKET - 1 : y);
    const cell = new Map<string, number>();     // `${ticker}|${col}` -> pct
    const totals = new Map<string, number>();   // ticker -> total cost $bn
    const cols = new Set<number>();
    let asOf = "";
    for (const r of vintageExposure) {
      const c = bucket(r.vintage_year);
      cols.add(c);
      const k = `${r.ticker}|${c}`;
      cell.set(k, (cell.get(k) ?? 0) + r.pct_cost);
      totals.set(r.ticker, (totals.get(r.ticker) ?? 0) + r.cost_b);
      if (r.period_end > asOf) asOf = r.period_end;
    }
    const columns = Array.from(cols).sort((a, b) => a - b);
    const tickers = Array.from(new Set(vintageExposure.map((r) => r.ticker)))
      .filter((t) => t !== "industry")
      .sort();
    const industry = new Map<number, number>(
      columns.map((c) => [c, cell.get(`industry|${c}`) ?? 0]),
    );
    const maxPct = Math.max(
      ...tickers.flatMap((t) => columns.map((c) => cell.get(`${t}|${c}`) ?? 0)),
    );
    return { tickers, columns, cell, totals, industry, asOf, maxPct };
  }, []);

  // Cost-weighted average vintage year — one number for "how young is this book".
  const avgVintage = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of [...tickers, "industry"]) {
      let num = 0, den = 0;
      for (const c of columns) {
        const p = cell.get(`${t}|${c}`) ?? 0;
        num += p * c;
        den += p;
      }
      if (den > 0) m.set(t, num / den);
    }
    return m;
  }, [tickers, columns, cell]);

  const sorted = useMemo(() => {
    const rows = [...tickers];
    rows.sort((a, b) => {
      let va: number | string, vb: number | string;
      if (sortKey === "ticker") { va = a; vb = b; }
      else if (sortKey === "total") { va = totals.get(a) ?? 0; vb = totals.get(b) ?? 0; }
      else if (sortKey === "avg") { va = avgVintage.get(a) ?? 0; vb = avgVintage.get(b) ?? 0; }
      else {
        const c = Number(sortKey);
        va = cell.get(`${a}|${c}`) ?? 0;
        vb = cell.get(`${b}|${c}`) ?? 0;
      }
      if (typeof va === "string" || typeof vb === "string") {
        return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      }
      return sortAsc ? va - vb : vb - va;
    });
    return rows;
  }, [tickers, sortKey, sortAsc, cell, totals, avgVintage]);

  const onSort = (k: string) => {
    if (k === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(k === "ticker"); }
  };

  const label = (c: number) => (c === OLD_BUCKET - 1 ? OLD_LABEL : String(c));

  const csvColumns = useMemo(
    () => ["ticker", ...columns.map(label), "total_cost_b", "wtd_avg_vintage"],
    [columns],
  );
  const csvRows = useMemo(
    () => [...sorted, "industry"].map((t) => [
      t,
      ...columns.map((c) => (cell.get(`${t}|${c}`) ?? 0).toFixed(2)),
      (totals.get(t) ?? 0).toFixed(3),
      (avgVintage.get(t) ?? 0).toFixed(1),
    ]),
    [sorted, columns, cell, totals, avgVintage],
  );

  return (
    <div className="rounded-xl border overflow-hidden mb-8" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-white">Vintage Exposure — where each book sits</h2>
            <p className="text-xs mt-0.5 max-w-4xl" style={{ color: "#8b8ba8" }}>
              Share of each BDC&apos;s <span className="text-white">cost</span> by origination year, as of{" "}
              {asOf}. Rows sum to 100%. This is composition, not performance — a large 2024 cohort is
              not itself a problem, but it tells you whose results the 2021-22 vintages still drive.
              Switch to <span className="text-white">vs industry</span> to see who is over- or
              under-indexed to an era in percentage points.
            </p>
          </div>
          <CsvDownloadButton filename="vintage-exposure" columns={csvColumns} rows={csvRows} />
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-xs">
          <span className="uppercase tracking-wider mr-1" style={{ color: "#6b6b88" }}>View</span>
          {([
            { id: "absolute" as View, label: "Share of cost", hint: "Each cell is the % of that BDC's cost originated in the year" },
            { id: "relative" as View, label: "vs industry", hint: "Percentage-point difference against the pooled industry composition" },
          ]).map((o) => (
            <button
              key={o.id}
              onClick={() => setView(o.id)}
              title={o.hint}
              className="px-2.5 py-1 rounded border transition-all"
              style={{
                background: view === o.id ? "rgba(99,102,241,0.15)" : "#111118",
                borderColor: view === o.id ? "#6366f1" : "#2d2d45",
                color: view === o.id ? "#a5b4fc" : "#9ca3af",
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {[
                { k: "ticker", l: "BDC", align: "text-left" },
                ...columns.map((c) => ({ k: String(c), l: label(c), align: "text-right" })),
                { k: "total", l: "Cost $bn", align: "text-right" },
                { k: "avg", l: "Wtd. vintage", align: "text-right" },
              ].map((h) => (
                <th
                  key={h.k}
                  onClick={() => onSort(h.k)}
                  className={`px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none ${h.align}`}
                  style={{
                    color: sortKey === h.k ? "#a5b4fc" : "#8b8ba8",
                    borderBottom: "1px solid #1e1e2e",
                  }}
                  title="Click to sort"
                >
                  {h.l}{sortKey === h.k ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, ri) => (
              <tr key={t} style={{ background: ri % 2 === 0 ? "#111118" : "#0f0f16" }}>
                <td className="px-2.5 py-1.5 font-mono font-semibold whitespace-nowrap">
                  <Link href={`/bdcs/${t.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>
                    {t}
                  </Link>
                </td>
                {columns.map((c) => {
                  const pct = cell.get(`${t}|${c}`) ?? 0;
                  const delta = pct - (industry.get(c) ?? 0);
                  const show = view === "absolute" ? pct : delta;
                  return (
                    <td
                      key={c}
                      className="px-2.5 py-1.5 text-right tabular-nums"
                      style={{
                        background: view === "absolute" ? absColor(pct, maxPct) : relColor(delta),
                        color: pct === 0 ? "#3f3f56" : "#e5e7eb",
                      }}
                      title={`${t} · ${label(c)} vintage · ${pct.toFixed(2)}% of cost · industry ${(industry.get(c) ?? 0).toFixed(2)}%`}
                    >
                      {pct === 0 ? "—"
                        : view === "absolute" ? `${pct.toFixed(1)}%`
                        : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                    </td>
                  );
                })}
                <td className="px-2.5 py-1.5 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                  {(totals.get(t) ?? 0).toFixed(1)}
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                  {(avgVintage.get(t) ?? 0).toFixed(1)}
                </td>
              </tr>
            ))}
            <tr style={{ background: "#12121c", borderTop: "2px solid #2d2d45" }}>
              <td className="px-2.5 py-2 font-semibold text-white">Industry</td>
              {columns.map((c) => (
                <td key={c} className="px-2.5 py-2 text-right tabular-nums font-semibold" style={{ color: "#e5e7eb" }}>
                  {(industry.get(c) ?? 0).toFixed(1)}%
                </td>
              ))}
              <td className="px-2.5 py-2 text-right tabular-nums font-semibold" style={{ color: "#e5e7eb" }}>
                {(totals.get("industry") ?? 0).toFixed(1)}
              </td>
              <td className="px-2.5 py-2 text-right tabular-nums font-semibold" style={{ color: "#e5e7eb" }}>
                {(avgVintage.get("industry") ?? 0).toFixed(1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs px-4 py-3" style={{ color: "#6b6b88" }}>
        Vintage is assigned per loan by the dating waterfall described in the methodology note below, so
        cells inherit its confidence caveats — a BDC that discloses acquisition dates is dated more
        precisely than one that doesn&apos;t. {OLD_LABEL} pools everything older, which for most books is
        a small tail of legacy equity and pre-panel loans. Weighted vintage is the cost-weighted mean
        origination year: higher means a younger book.
      </p>
    </div>
  );
}
