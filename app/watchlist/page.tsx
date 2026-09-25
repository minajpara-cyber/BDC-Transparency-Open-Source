"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
} from "recharts";
import StatCard from "@/components/StatCard";
import SortableTable, { Column } from "@/components/SortableTable";
import CrossHolderDivergence from "@/components/CrossHolderDivergence";
import CsvDownloadButton from "@/components/CsvDownloadButton";
import { watchlist, WatchlistRow } from "@/data/early_warning";
import { watchlistByManager, watchlistByTicker } from "@/data/early_warning_history";
import CreditHeatmap from "@/components/CreditHeatmap";
import NaForecastTable from "@/components/NaForecastTable";
import NaQuartileTrend from "@/components/NaQuartileTrend";
import OutcomeEvidenceNotice from "@/components/OutcomeEvidenceNotice";

const TIER_COLOR: Record<string, string> = {
  High: "#ef4444",
  Elevated: "#f59e0b",
  Watch: "#eab308",
};
const LINE_COLORS = [
  "#6366f1", "#ef4444", "#22c55e", "#f59e0b", "#06b6d4",
  "#ec4899", "#a855f7", "#84cc16",
];

const QUARTER_END_SUFFIXES = new Set(["03-31", "06-30", "09-30", "12-31"]);

type WlCut = "watch_plus" | "elevated_plus" | "high";

// Thresholds are per-cut because the levels differ by an order of magnitude —
// a shared scale would paint the High grid uniformly green and the Watch+ grid
// uniformly red, hiding the variation in both.
const WL_CUT_META: Record<WlCut, {
  label: string; short: string; thresholds: [number, number, number]; blurb: string;
}> = {
  watch_plus: {
    label: "Watch or worse", short: "Watch+",
    thresholds: [5, 12, 20],
    blurb: "every position on the list — Watch plus Elevated plus High",
  },
  elevated_plus: {
    label: "Elevated or worse", short: "Elevated+",
    thresholds: [2, 5, 10],
    blurb: "drops the Watch tier — Elevated plus High",
  },
  high: {
    label: "High severity", short: "High",
    thresholds: [0.5, 1.5, 3],
    blurb: "the most severe tier alone",
  },
};

function fmtM(v: number): string {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v.toFixed(0)}M`;
}

/** Tiny inline sparkline of the trailing mark trajectory (values 0..1). */
function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length < 2) return <span style={{ color: "#4b4b66" }}>—</span>;
  const w = 64, h = 18, pad = 2;
  const lo = Math.min(...data), hi = Math.max(...data);
  const span = hi - lo || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = pad + (1 - (v - lo) / span) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = data[data.length - 1], first = data[0];
  const stroke = last < first ? "#ef4444" : "#22c55e";
  return (
    <svg width={w} height={h} style={{ display: "inline-block", verticalAlign: "middle" }}>
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth={1.5} />
    </svg>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const c = TIER_COLOR[tier] ?? "#8b8ba8";
  return (
    <span className="px-2 py-0.5 rounded text-xs font-semibold"
      style={{ background: `${c}22`, color: c, border: `1px solid ${c}55` }}>
      {tier}
    </span>
  );
}

export default function WatchlistPage() {
  const [tier, setTier] = useState<string>("All");
  const [mgr, setMgr] = useState<string>("All");
  const [fund, setFund] = useState<string>("All");
  const [q, setQ] = useState<string>("");
  const [newOnly, setNewOnly] = useState(false);
  const [hideStructured, setHideStructured] = useState(true);
  const [wlCut, setWlCut] = useState<WlCut>("watch_plus");

  // BDC x quarter watchlist-severity grid — the same shape as the non-accrual
  // heatmap on /credit. Denominated in amortized COST, not fair value: on an FV
  // basis the markdown that puts a loan on the list also shrinks the
  // denominator, damping the very stress being measured. Cuts are "at this
  // severity or worse" over disjoint tiers, so nothing is double-counted.
  const wlGrid = useMemo(() => {
    const periods = Array.from(new Set(watchlistByTicker.map((r) => r.period_end)))
      .filter((p) => QUARTER_END_SUFFIXES.has(p.slice(5)))
      .sort();
    const tickers = Array.from(new Set(watchlistByTicker.map((r) => r.key))).sort();
    const cellMap = new Map<string, { value: number | null }>();
    for (const r of watchlistByTicker) {
      if (!r.book_cost_m) continue;
      const num = wlCut === "high" ? r.cost_High
        : wlCut === "elevated_plus" ? r.cost_High + r.cost_Elevated
        : r.wl_cost;
      cellMap.set(`${r.key}|${r.period_end}`, { value: (100 * num) / r.book_cost_m });
    }
    return { periods, tickers, cellMap };
  }, [wlCut]);

  // Newest quarter on the list — during reporting season BDCs are on mixed
  // quarters (each row carries its own period_end), so take the max, not row 0.
  const latest = watchlist.reduce((m, r) => (r.period_end > m ? r.period_end : m), "") || "—";
  const managers = useMemo(
    () => Array.from(new Set(watchlist.map((r) => r.manager))).sort(),
    [],
  );
  // Funds (BDC tickers). When a manager is selected, only that manager's funds
  // are offered, so "Blackstone → BXSL vs BCRED" is a two-click drill-down.
  const funds = useMemo(
    () => Array.from(new Set(
      watchlist.filter((r) => mgr === "All" || r.manager === mgr).map((r) => r.ticker),
    )).sort(),
    [mgr],
  );

  const rows = useMemo(() => {
    return watchlist.filter((r) => {
      if (tier !== "All" && r.tier !== tier) return false;
      if (mgr !== "All" && r.manager !== mgr) return false;
      if (fund !== "All" && r.ticker !== fund) return false;
      if (newOnly && !r.is_new) return false;
      if (hideStructured && r.is_structured) return false;
      if (q) {
        const needle = q.toLowerCase();
        const hay = [r.company, r.legal_name, r.ticker, r.manager, r.parent, r.industry]
          .map((s) => (s ?? "").toLowerCase());
        if (!hay.some((h) => h.includes(needle))) return false;
      }
      return true;
    });
  }, [tier, mgr, fund, q, newOnly, hideStructured]);

  const totalFV = rows.reduce((s, r) => s + r.fv_m, 0);
  const nHigh = rows.filter((r) => r.tier === "High").length;
  const nElevated = rows.filter((r) => r.tier === "Elevated").length;
  const nNew = rows.filter((r) => r.is_new).length;
  const newFV = rows.filter((r) => r.is_new).reduce((s, r) => s + r.fv_m, 0);


  // ---- by-manager rollup (each manager's own latest quarter) ----
  // Not a single global period: mid reporting season early filers are a
  // quarter ahead, and a global-latest filter would drop every other manager.
  const mgrLatest = useMemo(() => {
    const byKey = new Map<string, (typeof watchlistByManager)[number]>();
    watchlistByManager.forEach((r) => {
      const prev = byKey.get(r.key);
      if (!prev || r.period_end > prev.period_end) byKey.set(r.key, r);
    });
    return Array.from(byKey.values()).sort((a, b) => b.wl_fv - a.wl_fv);
  }, []);

  // ---- by-manager trend (% of book over time, top managers) ----
  const trend = useMemo(() => {
    const topMgrs = mgrLatest.slice(0, 6).map((r) => r.key);
    const periods = Array.from(new Set(watchlistByManager.map((r) => r.period_end)))
      .sort()
      .slice(-14);
    const byKey: Record<string, Record<string, number>> = {};
    watchlistByManager.forEach((r) => {
      if (!byKey[r.period_end]) byKey[r.period_end] = {};
      if (r.pct_book != null) byKey[r.period_end][r.key] = r.pct_book;
    });
    const data = periods.map((p) => {
      const row: Record<string, number | string> = { period_end: p.slice(2, 7) };
      topMgrs.forEach((m) => { if (byKey[p]?.[m] != null) row[m] = byKey[p][m]; });
      return row;
    });
    return { data, topMgrs };
  }, [mgrLatest]);

  const columns: Column<WatchlistRow>[] = [
    {
      key: "tier", label: "Tier", sortable: true,
      render: (r) => <TierBadge tier={r.tier} />,
    },
    { key: "score", label: "Screen score", sortable: true, align: "right",
      render: (r) => <span className="font-semibold text-white">{r.score}</span> },
    {
      key: "company", label: "Borrower", sortable: true,
      render: (r) => (
        <div>
          <div className="flex items-center gap-1.5">
            {r.borrower_slug
              ? <Link href={`/borrowers/${r.borrower_slug}`} className="text-indigo-300 hover:text-indigo-200">{r.company}</Link>
              : <span className="text-white">{r.company}</span>}
            {r.is_new ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: "#6366f122", color: "#a5b4fc", border: "1px solid #6366f155" }}>NEW</span> : null}
          </div>
          <div className="text-xs" style={{ color: "#6b6b88" }}>
            {r.legal_name ? <span style={{ color: "#52526a" }}>{r.legal_name} · </span> : null}
            {r.industry ?? "—"}{r.maturity_date ? ` · mat ${r.maturity_date}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "ticker", label: "BDC", sortable: true,
      render: (r) => (
        <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="font-medium text-indigo-300 hover:text-indigo-200">
          {r.ticker}
        </Link>
      ),
    },
    {
      key: "manager", label: "Manager", sortable: true,
      render: (r) => (
        <span className="text-sm" style={{ color: "#c7c7e0" }}>
          {r.manager}{r.parent ? <span style={{ color: "#6b6b88" }}> ({r.parent})</span> : null}
        </span>
      ),
    },
    {
      key: "mark", label: "Mark", sortable: true, align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-2">
          <Sparkline data={r.spark} />
          <span className="font-medium text-white tabular-nums">
            {r.mark != null ? `${(r.mark * 100).toFixed(0)}¢` : "—"}
          </span>
        </div>
      ),
    },
    { key: "fv_m", label: "Reported FV", sortable: true, align: "right",
      render: (r) => <span className="font-semibold text-white tabular-nums">{fmtM(r.fv_m)}</span> },
    {
      key: "signals", label: "Signals",
      render: (r) => (
        <div className="flex flex-wrap gap-1" style={{ maxWidth: 320 }}>
          {r.signals.map((s, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded text-[10px]"
              style={{ background: "#1a1a28", color: "#b9b9d6", border: "1px solid #2d2d50" }}>{s}</span>
          ))}
        </div>
      ),
    },
  ];

  const csvRows = rows.map((r) => [
    r.tier, r.score, r.company, r.ticker, r.manager, r.parent, r.industry,
    r.maturity_date, r.mark, r.fv_m, r.cost_m, r.is_new, r.signals.join("; "),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-white">Credit Early-Warning Watchlist</h1>
          <span className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: "#1a1a28", color: "#a5b4fc", border: "1px solid #2d2d50" }}>
            as of {latest}
          </span>
        </div>
        <p className="text-sm max-w-3xl" style={{ color: "#9ca3af" }}>
          Positions selected for review from reported marks, mark changes, PIK terms and other observed signals.
          Screen scores and tiers are heuristic labels, not validated probabilities of default or future non-accrual.
          Positions explicitly tagged non-accrual are excluded from this screen; missing status and ambiguous
          cross-holder matches can remain. Dollar amounts show reported fair value, not an estimate of future losses.
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Reported FV on watchlist" value={fmtM(totalFV)}
          sub={`${rows.length} positions selected for review`} color="#f59e0b" highlight />
        <StatCard label="High tier" value={String(nHigh)} color="#ef4444"
          sub={`+ ${nElevated} elevated`} />
        <StatCard label="New this quarter" value={String(nNew)} color="#6366f1"
          sub={`${fmtM(newFV)} entered the watchlist`} />
        <StatCard label="Position probabilities" value="Withheld" color="#9ca3af"
          sub="Pending source and follow-up validation" />
      </div>

      <section className="mb-8">
        <OutcomeEvidenceNotice title="Watchlist score performance pending validation">
          Historical hit rates, predictive lifts and fitted outcome scores are withheld until source labels,
          consecutive follow-up and unresolved observations are reviewed. The screen below preserves reported
          exposures and observed signals for investigation; it does not establish a future credit outcome. Current
          BDC-level four-quarter estimates that meet the separate coverage gate appear in the{" "}
          <Link href="#gated-na-projections" className="text-indigo-300 underline">gated projection table</Link>.
        </OutcomeEvidenceNotice>
      </section>

      {/* By manager */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-1">Where is the stress building — by manager</h2>
        <p className="text-sm mb-4" style={{ color: "#9ca3af" }}>
          Watchlist dollars rolled up to each platform&apos;s parent. Absolute $ favors the biggest books, so the
          <span className="text-white"> % of book</span> column is the like-for-like read across managers.
        </p>
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Summary table */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e1e2e" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#12121c", color: "#8b8ba8" }} className="text-xs uppercase tracking-wider">
                  <th className="text-left font-semibold py-2 px-3">Manager</th>
                  <th className="text-right font-semibold py-2 px-3">Reported FV</th>
                  <th className="text-right font-semibold py-2 px-3">% of book</th>
                  <th className="text-right font-semibold py-2 px-3">High</th>
                  <th className="text-right font-semibold py-2 px-3">Elev.</th>
                </tr>
              </thead>
              <tbody>
                {mgrLatest.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #1a1a28" }}>
                    <td className="py-2 px-3 font-medium text-white">{r.key}</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: "#e5e5f0" }}>{fmtM(r.wl_fv)}</td>
                    <td className="py-2 px-3 text-right tabular-nums font-semibold"
                      style={{ color: (r.pct_book ?? 0) >= 8 ? "#ef4444" : (r.pct_book ?? 0) >= 4 ? "#f59e0b" : "#22c55e" }}>
                      {r.pct_book != null ? `${r.pct_book.toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: "#ef4444" }}>{r.n_High}</td>
                    <td className="py-2 px-3 text-right tabular-nums" style={{ color: "#f59e0b" }}>{r.n_Elevated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Trend chart */}
          <div className="rounded-xl border p-4" style={{ borderColor: "#1e1e2e", background: "#0d0d14" }}>
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "#8b8ba8" }}>
              Watchlist % of book over time
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={trend.data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="period_end" tick={{ fill: "#8b8ba8", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8b8ba8", fontSize: 11 }} unit="%" />
                <Tooltip contentStyle={{ background: "#111118", border: "1px solid #2d2d50", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {trend.topMgrs.map((m, i) => (
                  <Line key={m} type="monotone" dataKey={m} stroke={LINE_COLORS[i % LINE_COLORS.length]}
                    strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Current non-accrual snapshots plus the publication-gated 4Q formation estimate */}
      <section className="mb-8">
        <NaForecastTable />
      </section>

      {/* Historical quartile comparisons remain withheld pending equivalent review */}
      <section className="mb-8">
        <NaQuartileTrend />
      </section>

      {/* BDC x quarter severity grid */}
      <section className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="text-lg font-semibold text-white mr-1">Watchlist rate by BDC over time</h2>
          {(Object.keys(WL_CUT_META) as WlCut[]).map((c) => (
            <button
              key={c}
              onClick={() => setWlCut(c)}
              title={WL_CUT_META[c].blurb}
              className="text-xs px-2.5 py-1 rounded border transition-colors"
              style={{
                background: wlCut === c ? "rgba(99,102,241,0.15)" : "transparent",
                borderColor: wlCut === c ? "#6366f1" : "#2d2d50",
                color: wlCut === c ? "#a5b4fc" : "#8b8ba8",
              }}
            >
              {WL_CUT_META[c].short}
            </button>
          ))}
        </div>
        <CreditHeatmap
          title={`% of debt cost on the watchlist — ${WL_CUT_META[wlCut].label}`}
          description={
            `Pre-non-accrual stress by BDC and quarter, as a share of debt at amortized cost. ` +
            `This cut is ${WL_CUT_META[wlCut].blurb}. A position sits in exactly one tier, so a ` +
            `severity-or-worse cut is a plain sum — nothing is double-counted, and the difference ` +
            `between two cuts is the band between them. Read it alongside the non-accrual heatmap ` +
            `on the credit page: this is what has NOT defaulted yet.`
          }
          periods={wlGrid.periods}
          tickers={wlGrid.tickers}
          cellMap={wlGrid.cellMap}
          thresholds={WL_CUT_META[wlCut].thresholds}
          unit="%"
          csvFilename={`watchlist-${wlCut.replace("_", "-")}`}
        />
      </section>

      {/* Cross-holder non-accrual divergence */}
      <CrossHolderDivergence />

      {/* Filters + main table */}
      <section>
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold text-white mr-2">The watchlist</h2>
          {["All", "High", "Elevated", "Watch"].map((t) => (
            <button key={t} onClick={() => setTier(t)}
              className="px-2.5 py-1 rounded text-xs font-medium"
              style={{
                background: tier === t ? "#6366f122" : "#12121c",
                color: tier === t ? "#a5b4fc" : "#9ca3af",
                border: `1px solid ${tier === t ? "#6366f155" : "#1e1e2e"}`,
              }}>{t}</button>
          ))}
          <select value={mgr} onChange={(e) => { setMgr(e.target.value); setFund("All"); }}
            className="px-2.5 py-1 rounded text-xs"
            style={{ background: "#12121c", color: "#c7c7e0", border: "1px solid #1e1e2e" }}>
            <option value="All">All managers</option>
            {managers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={fund} onChange={(e) => setFund(e.target.value)}
            className="px-2.5 py-1 rounded text-xs"
            style={{ background: "#12121c", color: "#c7c7e0", border: "1px solid #1e1e2e" }}>
            <option value="All">All funds</option>
            {funds.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search borrower / BDC…"
            className="px-2.5 py-1 rounded text-xs flex-1 min-w-[160px]"
            style={{ background: "#12121c", color: "#c7c7e0", border: "1px solid #1e1e2e" }} />
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "#9ca3af" }}>
            <input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} /> New only
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "#9ca3af" }}>
            <input type="checkbox" checked={hideStructured} onChange={(e) => setHideStructured(e.target.checked)} /> Hide JV/structured
          </label>
          <CsvDownloadButton filename={`watchlist_${latest}`}
            columns={["tier", "score", "company", "ticker", "manager", "parent", "industry",
              "maturity", "mark", "fv_m", "cost_m", "is_new", "signals"]}
            rows={csvRows} />
        </div>
        <SortableTable<WatchlistRow>
          data={rows}
          columns={columns}
          rowKey={(r) => `${r.ticker}|${r.company}|${r.maturity_date}|${r.investment_type}`}
          initialSort={{ key: "fv_m", dir: "desc" }}
          dense
          stickyHeader
          emptyMessage="No positions match these filters."
        />
        <p className="text-xs mt-4 max-w-3xl" style={{ color: "#6b6b88" }}>
          Methodology &amp; caveats: this heuristic screen combines mark bands, mark changes, cash→PIK signals,
          PIK share and inferred changes to loan terms. Matching across periods and holders can remain ambiguous;
          a signal is a review prompt, not a confirmed amendment or default. Scores have not been revalidated
          on the corrected source and identity basis. Already tagged non-accrual and sub-2¢ positions are excluded,
          as is preferred equity. JV/structured vehicles are hidden by default. MFIC has aggregate non-accrual
          disclosure, so individual status remains unknown. No historical hit rate or predictive lift is asserted.
        </p>
      </section>
    </div>
  );
}
