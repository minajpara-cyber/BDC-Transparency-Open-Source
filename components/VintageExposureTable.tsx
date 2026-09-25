"use client";

// BDC x vintage-year exposure matrix: where each book's cost actually sits,
// plus the "% of cost dated" table that says how each book was dated.
// Sibling to the BDC x Vintage PERFORMANCE table further down the page — that
// one asks how a vintage has done, this one asks who is holding it.
import { useMemo, useState } from "react";
import Link from "next/link";
import { vintageExposure, vintageDatingCoverage } from "@/data/vintage_exposure";
import CsvDownloadButton from "./CsvDownloadButton";

// Vintages before this are long-tail equity stubs and pre-panel loans; they
// carry real cost for a few BDCs but one column each would be mostly empty.
const OLD_BUCKET = 2018;
const OLD_LABEL = `≤${OLD_BUCKET - 1}`;
const UNDATED = -1;   // column key for loans with no evidence to date them

type View = "absolute" | "relative";

function absColor(pct: number, max: number): string {
  if (!pct) return "transparent";
  const t = Math.max(0, Math.min(1, pct / Math.max(max, 0.0001)));
  // Single-hue ramp — this is composition, not alarm.
  return `rgba(99, 102, 241, ${0.06 + 0.62 * t})`;
}

function relColor(delta: number): string {
  const t = Math.max(0, Math.min(1, Math.abs(delta) / 15));
  if (Math.abs(delta) < 0.5) return "transparent";
  return delta > 0 ? `rgba(239, 68, 68, ${0.08 + 0.5 * t})` : `rgba(56, 189, 248, ${0.08 + 0.5 * t})`;
}

const panel = { background: "#111118", borderColor: "#1e1e2e" };

/** "% of cost dated": how each BDC's latest debt book got its vintage dates. */
export function VintageDatingCoverageTable() {
  const rows = [...vintageDatingCoverage].sort((a, b) =>
    a.ticker === "industry" ? 1 : b.ticker === "industry" ? -1 : a.ticker.localeCompare(b.ticker));
  const csvRows = rows.map((r) => [r.ticker, r.period_end, r.debt_cost_b.toFixed(3), r.pct_own_disclosed.toFixed(1), r.pct_peer_disclosed.toFixed(1), r.pct_estimated.toFixed(1), r.pct_undated.toFixed(1), r.pct_high_conf.toFixed(1), r.pct_disclosed_only == null ? "" : r.pct_disclosed_only.toFixed(1)]);
  return (
    <div className="rounded-xl border overflow-hidden mb-6" style={panel}>
      <div className="px-4 py-3 border-b flex items-start justify-between gap-3 flex-wrap" style={{ borderColor: "#1e1e2e" }}>
        <div>
          <h2 className="font-semibold text-white">How each book is dated — % of debt cost</h2>
          <p className="text-xs mt-0.5 max-w-4xl" style={{ color: "#8b8ba8" }}>
            Latest debt book of each BDC (every position that is not equity), split by where its vintage dates come from.
            <span className="text-white"> Own disclosed</span> = the BDC prints an acquisition date.
            <span className="text-white"> Peer, same tranche</span> = another BDC holding the same facility (same lien, maturity within two years) prints one.
            <span className="text-white"> Estimated</span> = a labelled inference (graded LOW).
            <span className="text-white"> Undated</span> = no evidence, left out of the curves.
            The last column is the stricter &ldquo;disclosed dates only&rdquo; view (own date, consistent across filings, no estimates),
            which is 0% for BDCs that never print acquisition dates.
          </p>
        </div>
        <CsvDownloadButton filename="vintage-dating-coverage"
          columns={["ticker", "period_end", "debt_cost_b", "own_disclosed_pct", "peer_same_tranche_pct", "estimated_pct", "undated_pct", "high_conf_pct", "disclosed_only_view_pct"]}
          rows={csvRows} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {["BDC", "As of", "Debt cost $bn", "Own disclosed", "Peer, same tranche", "Estimated", "Undated", "Mix", "Hi-conf", "Disclosed-only view"].map((h) => (
                <th key={h} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-left" style={{ color: "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = r.pct_disclosed_only;
              const isInd = r.ticker === "industry";
              return (
                <tr key={r.ticker} data-ticker={r.ticker} style={{ background: isInd ? "#12121c" : i % 2 === 0 ? "#111118" : "#0f0f16", borderTop: isInd ? "2px solid #2d2d45" : undefined }}>
                  <td className="px-3 py-1.5 font-mono font-semibold whitespace-nowrap">
                    {isInd ? <span className="text-white">Industry</span> : <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>{r.ticker}</Link>}
                  </td>
                  <td className="px-3 py-1.5 text-xs" style={{ color: "#9ca3af" }}>{r.period_end}</td>
                  <td className="px-3 py-1.5 tabular-nums" style={{ color: "#d1d5db" }}>{r.debt_cost_b.toFixed(1)}</td>
                  <td className="px-3 py-1.5 tabular-nums" style={{ color: "#e5e7eb" }}>{r.pct_own_disclosed.toFixed(0)}%</td>
                  <td className="px-3 py-1.5 tabular-nums" style={{ color: "#e5e7eb" }}>{r.pct_peer_disclosed.toFixed(0)}%</td>
                  <td className="px-3 py-1.5 tabular-nums" style={{ color: r.pct_estimated > 50 ? "#eab308" : "#9ca3af" }}>{r.pct_estimated.toFixed(0)}%</td>
                  <td className="px-3 py-1.5 tabular-nums" style={{ color: r.pct_undated > 5 ? "#f97316" : "#9ca3af" }}>{r.pct_undated.toFixed(0)}%</td>
                  <td className="px-3 py-1.5">
                    <div className="flex h-2 w-28 overflow-hidden rounded" title={`own ${r.pct_own_disclosed.toFixed(1)}% · peer ${r.pct_peer_disclosed.toFixed(1)}% · estimated ${r.pct_estimated.toFixed(1)}% · undated ${r.pct_undated.toFixed(1)}%`}>
                      <div style={{ width: `${r.pct_own_disclosed}%`, background: "#6366f1" }} />
                      <div style={{ width: `${r.pct_peer_disclosed}%`, background: "#38bdf8" }} />
                      <div style={{ width: `${r.pct_estimated}%`, background: "#eab308" }} />
                      <div style={{ width: `${r.pct_undated}%`, background: "#4b5563" }} />
                    </div>
                  </td>
                  <td className="px-3 py-1.5 tabular-nums" style={{ color: "#9ca3af" }}>{r.pct_high_conf.toFixed(0)}%</td>
                  <td className="px-3 py-1.5 tabular-nums" style={{ color: "#9ca3af" }}>{s == null ? "—" : `${s.toFixed(0)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs px-4 py-3" style={{ color: "#6b6b88" }}>
        Bar: <span style={{ color: "#6366f1" }}>own</span> · <span style={{ color: "#38bdf8" }}>peer</span> · <span style={{ color: "#eab308" }}>estimated</span> · <span style={{ color: "#9ca3af" }}>undated</span>.
        Hi-conf = HIGH or MED confidence dates (disclosed and stable). Rows with blank instrument labels in the filing (e.g. most of CGBD&apos;s schedule) count as debt here.
      </p>
    </div>
  );
}

export default function VintageExposureTable() {
  const [view, setView] = useState<View>("absolute");
  const [sortKey, setSortKey] = useState<string>("ticker");
  const [sortAsc, setSortAsc] = useState(true);

  const { tickers, columns, cell, estimated, totals, industry, asOf, maxPct } = useMemo(() => {
    const bucket = (y: number | null) => (y == null ? UNDATED : y < OLD_BUCKET ? OLD_BUCKET - 1 : y);
    const cell = new Map<string, number>();       // `${ticker}|${col}` -> pct
    const estimated = new Map<string, number>();  // `${ticker}|${col}` -> $bn dated by estimate
    const totals = new Map<string, number>();     // ticker -> total cost $bn
    const cols = new Set<number>();
    let asOf = "";
    for (const r of vintageExposure) {
      const c = bucket(r.vintage_year);
      cols.add(c);
      const k = `${r.ticker}|${c}`;
      cell.set(k, (cell.get(k) ?? 0) + r.pct_cost);
      estimated.set(k, (estimated.get(k) ?? 0) + r.cost_estimated_b);
      totals.set(r.ticker, (totals.get(r.ticker) ?? 0) + r.cost_b);
      if (r.period_end > asOf) asOf = r.period_end;
    }
    const columns = Array.from(cols).sort((a, b) => (a === UNDATED ? 1 : b === UNDATED ? -1 : a - b));
    const tickers = Array.from(new Set(vintageExposure.map((r) => r.ticker))).filter((t) => t !== "industry").sort();
    const industry = new Map<number, number>(columns.map((c) => [c, cell.get(`industry|${c}`) ?? 0]));
    const maxPct = Math.max(...tickers.flatMap((t) => columns.filter((c) => c !== UNDATED).map((c) => cell.get(`${t}|${c}`) ?? 0)));
    return { tickers, columns, cell, estimated, totals, industry, asOf, maxPct };
  }, []);

  // Cost-weighted average vintage year over DATED cost — "how young is this book".
  const avgVintage = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of [...tickers, "industry"]) {
      let num = 0, den = 0;
      for (const c of columns) {
        if (c === UNDATED) continue;
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
      else { const c = Number(sortKey); va = cell.get(`${a}|${c}`) ?? 0; vb = cell.get(`${b}|${c}`) ?? 0; }
      if (typeof va === "string" || typeof vb === "string") return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      return sortAsc ? va - vb : vb - va;
    });
    return rows;
  }, [tickers, sortKey, sortAsc, cell, totals, avgVintage]);

  const onSort = (k: string) => {
    if (k === sortKey) setSortAsc(!sortAsc);
    else { setSortKey(k); setSortAsc(k === "ticker"); }
  };

  const label = (c: number) => (c === UNDATED ? "Undated" : c === OLD_BUCKET - 1 ? OLD_LABEL : String(c));

  const csvColumns = useMemo(() => ["ticker", ...columns.map(label), "total_cost_b", "wtd_avg_vintage"], [columns]);
  const csvRows = useMemo(
    () => [...sorted, "industry"].map((t) => [
      t,
      ...columns.map((c) => (cell.get(`${t}|${c}`) ?? 0).toFixed(2)),
      (totals.get(t) ?? 0).toFixed(3),
      avgVintage.has(t) ? (avgVintage.get(t) ?? 0).toFixed(1) : "",
    ]),
    [sorted, columns, cell, totals, avgVintage],
  );

  return (
    <div className="rounded-xl border overflow-hidden mb-8" style={panel}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-white">Vintage Exposure — where each book sits</h2>
            <p className="text-xs mt-0.5 max-w-4xl" style={{ color: "#8b8ba8" }}>
              Share of each BDC&apos;s <span className="text-white">cost</span> by vintage year, as of {asOf}. Rows sum to 100%,
              including an <span className="text-white">Undated</span> column for loans with no evidence to date them. This is
              composition, not performance — a large 2024 cohort is not itself a problem, but it tells you whose results the
              2021-22 vintages still drive. <span className="text-white">Italic</span> cells are mostly dated by estimate (hover for
              the split). Switch to <span className="text-white">vs industry</span> for percentage-point over/under-weights.
            </p>
          </div>
          <CsvDownloadButton filename="vintage-exposure" columns={csvColumns} rows={csvRows} />
        </div>
        <div className="flex items-center gap-1.5 mt-3 text-xs">
          <span className="uppercase tracking-wider mr-1" style={{ color: "#6b6b88" }}>View</span>
          {([
            { id: "absolute" as View, label: "Share of cost", hint: "Each cell is the % of that BDC's cost in that vintage year" },
            { id: "relative" as View, label: "vs industry", hint: "Percentage-point difference against the pooled industry composition" },
          ]).map((o) => (
            <button key={o.id} onClick={() => setView(o.id)} title={o.hint} className="px-2.5 py-1 rounded border transition-all"
                    style={{ background: view === o.id ? "rgba(99,102,241,0.15)" : "#111118", borderColor: view === o.id ? "#6366f1" : "#2d2d45", color: view === o.id ? "#a5b4fc" : "#9ca3af" }}>
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
                <th key={h.k} onClick={() => onSort(h.k)}
                    className={`px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none ${h.align}`}
                    style={{ color: sortKey === h.k ? "#a5b4fc" : "#8b8ba8", borderBottom: "1px solid #1e1e2e" }} title="Click to sort">
                  {h.l}{sortKey === h.k ? (sortAsc ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, ri) => (
              <tr key={t} style={{ background: ri % 2 === 0 ? "#111118" : "#0f0f16" }}>
                <td className="px-2.5 py-1.5 font-mono font-semibold whitespace-nowrap">
                  <Link href={`/bdcs/${t.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>{t}</Link>
                </td>
                {columns.map((c) => {
                  const pct = cell.get(`${t}|${c}`) ?? 0;
                  const delta = pct - (industry.get(c) ?? 0);
                  const tot = totals.get(t) ?? 0;
                  const costB = (pct / 100) * tot;
                  const estShare = costB > 0 ? (100 * (estimated.get(`${t}|${c}`) ?? 0)) / costB : 0;
                  const mostlyEst = c !== UNDATED && estShare > 50;
                  return (
                    <td key={c} className="px-2.5 py-1.5 text-right tabular-nums"
                        style={{
                          background: c === UNDATED ? "transparent" : view === "absolute" ? absColor(pct, maxPct) : relColor(delta),
                          color: pct === 0 ? "#3f3f56" : c === UNDATED ? "#9ca3af" : "#e5e7eb",
                          fontStyle: mostlyEst ? "italic" : undefined,
                        }}
                        title={`${t} · ${label(c)} · ${pct.toFixed(2)}% of cost · industry ${(industry.get(c) ?? 0).toFixed(2)}%${c === UNDATED ? "" : ` · ${estShare.toFixed(0)}% of this cell dated by estimate`}`}>
                      {pct === 0 ? "—" : view === "absolute" || c === UNDATED ? `${pct.toFixed(1)}%` : `${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
                    </td>
                  );
                })}
                <td className="px-2.5 py-1.5 text-right tabular-nums" style={{ color: "#9ca3af" }}>{(totals.get(t) ?? 0).toFixed(1)}</td>
                <td className="px-2.5 py-1.5 text-right tabular-nums" style={{ color: "#9ca3af" }}>{avgVintage.has(t) ? (avgVintage.get(t) ?? 0).toFixed(1) : "—"}</td>
              </tr>
            ))}
            <tr style={{ background: "#12121c", borderTop: "2px solid #2d2d45" }}>
              <td className="px-2.5 py-2 font-semibold text-white">Industry</td>
              {columns.map((c) => (
                <td key={c} className="px-2.5 py-2 text-right tabular-nums font-semibold" style={{ color: "#e5e7eb" }}>{(industry.get(c) ?? 0).toFixed(1)}%</td>
              ))}
              <td className="px-2.5 py-2 text-right tabular-nums font-semibold" style={{ color: "#e5e7eb" }}>{(totals.get("industry") ?? 0).toFixed(1)}</td>
              <td className="px-2.5 py-2 text-right tabular-nums font-semibold" style={{ color: "#e5e7eb" }}>{(avgVintage.get("industry") ?? 0).toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs px-4 py-3" style={{ color: "#6b6b88" }}>
        Vintage dates come from the waterfall in the methodology note (own disclosed date, then the same tranche at a peer, then a
        labelled estimate), so a BDC that discloses acquisition dates is dated more precisely than one that doesn&apos;t — see the
        &ldquo;How each book is dated&rdquo; table. {OLD_LABEL} pools everything older. Weighted vintage is the cost-weighted mean
        vintage year of the dated cost: higher means a younger book.
      </p>
    </div>
  );
}
