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
import { signalBacktest } from "@/data/signal_backtest";
import { ewsRows, ewsMeta } from "@/data/early_warning_scores";

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
  const [valTab, setValTab] = useState<"lifts" | "oos">("lifts");
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

  const highBacktest = signalBacktest.find((b) => b.signal === "tier: High");
  const baseRate = signalBacktest.find((b) => b.signal === "ALL (base rate)");

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
    { key: "score", label: "Score", sortable: true, align: "right",
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
    { key: "fv_m", label: "$ at risk", sortable: true, align: "right",
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
          Positions that are <span className="text-white">deteriorating but not yet on non-accrual</span> — the leading
          edge of credit problems. Each loan gets a composite stress score from its mark level &amp; trajectory, cash→PIK
          flips, amend-and-extends and spread cuts, then is ranked by dollars at risk. The score is back-tested below:
          loans flagged <span style={{ color: TIER_COLOR.High }}>High</span> have historically gone non-accrual within a
          year {highBacktest && baseRate
            ? <span className="text-white">{highBacktest.lift_na}× as often as the average position</span>
            : "far more often than average"}.
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="$ at risk (watchlist)" value={fmtM(totalFV)}
          sub={`${rows.length} positions, pre-non-accrual`} color="#f59e0b" highlight />
        <StatCard label="High tier" value={String(nHigh)} color="#ef4444"
          sub={`+ ${nElevated} elevated`} />
        <StatCard label="New this quarter" value={String(nNew)} color="#6366f1"
          sub={`${fmtM(newFV)} entered the watchlist`} />
        <StatCard label="High → non-accrual ≤1yr"
          value={highBacktest ? `${highBacktest.rate_na}%` : "—"} color="#ef4444"
          trend="down" trendLabel={highBacktest ? `${highBacktest.lift_na}× base rate` : undefined}
          sub={baseRate ? `vs ${baseRate.rate_na}% base` : undefined} />
      </div>

      {/* Back-test credibility panel — two validation lenses, one card */}
      <section className="mb-8 rounded-xl border p-5" style={{ background: "#0d0d14", borderColor: "#1e1e2e" }}>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h2 className="text-lg font-semibold text-white">Does the signal actually predict trouble?</h2>
          <div className="flex items-center gap-1 text-xs">
            {([["lifts", "Historical signal lifts"], ["oos", "Out-of-sample 2Q score"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setValTab(k)}
                className="px-2.5 py-1 rounded-md font-medium transition-colors"
                style={{
                  color: valTab === k ? "#a5b4fc" : "#8b8ba8",
                  background: valTab === k ? "rgba(99,102,241,0.12)" : "transparent",
                  border: `1px solid ${valTab === k ? "rgba(99,102,241,0.35)" : "#2d2d50"}`,
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {valTab === "oos" && (
          <>
            <p className="text-xs mt-1 mb-3" style={{ color: "#8b8ba8" }}>
              The stricter lens: points per signal are{" "}
              <span className="text-white">fitted purely on history through {ewsMeta.trained_through}</span>{" "}
              (mark &lt;90¢ = {ewsMeta.signal_multipliers.mark_below_90}× the base non-accrual rate; a
              ≥3pt quarterly mark drop = {ewsMeta.signal_multipliers.mark_drop_3pt}×; a cash→PIK flip ={" "}
              {ewsMeta.signal_multipliers.pik_flip}×), then tested on 2024–25 data the fit never saw:{" "}
              {ewsMeta.validation_buckets.map(b => `score ${b.bucket}: ${b.hit_rate_pct}%`).join(" · ")}{" "}
              went on non-accrual within 2 quarters (top-50 scored: {ewsMeta.precision_at_50_pct}% vs a{" "}
              {ewsMeta.validation_base_rate_pct}% base). Two honest negatives: broad modification flags
              and junior ranking showed <span className="text-white">no</span> predictive lift and score
              zero here.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                  <tr>
                    {["BDC", "Borrower", "Score", "Fired signals", "FV", "Mark"].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ewsRows.slice(0, 25).map((r, i) => (
                    <tr key={`${r.ticker}-${r.borrower}-${i}`} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                      <td className="px-3 py-2 text-xs font-semibold text-white">{r.ticker}</td>
                      <td className="px-3 py-2 text-sm" style={{ color: "#d1d5db" }}>{r.borrower}</td>
                      <td className="px-3 py-2 text-sm font-bold" style={{ color: r.score >= 5 ? "#ef4444" : r.score >= 3 ? "#f97316" : "#eab308" }}>{r.score}</td>
                      <td className="px-3 py-2">
                        {r.signals.map(s => (
                          <span key={s} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded text-xs"
                                style={{ background: "rgba(239,68,68,0.10)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
                            {s.replace(/_/g, " ")}
                          </span>
                        ))}
                      </td>
                      <td className="px-3 py-2 text-sm" style={{ color: "#9ca3af" }}>${r.fv_m.toFixed(0)}M</td>
                      <td className="px-3 py-2 text-sm font-mono" style={{ color: "#9ca3af" }}>{r.mark == null ? "—" : `${(100 * r.mark).toFixed(0)}¢`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
              Top 25 of {ewsRows.length} positions scoring ≥2, as of {ewsMeta.as_of}. Scores are per
              position (one borrower can appear via several tranches/holders). Loans already on
              non-accrual are excluded by construction — this is the <em>pre</em>-non-accrual queue.{" "}
              <Link href="/credit#forward-queue" className="text-indigo-400 hover:text-indigo-300">
                Per-BDC rollup (implied NA formation) →
              </Link>
            </p>
          </>
        )}
        {valTab === "lifts" && (
        <>
        <p className="text-sm mb-4" style={{ color: "#9ca3af" }}>
          For every pre-non-accrual loan since 2018, we measured whether it went on to non-accrual within four quarters.
          Each signal&apos;s hit-rate is shown against the {baseRate ? `${baseRate.rate_na}%` : ""} base rate across all loans.
          Higher tiers and stacked signals are sharply more predictive — the score rank-orders risk.
        </p>
        <p className="text-sm mb-4" style={{ color: "#9ca3af" }}>
          The strongest signal here is one a single-BDC view cannot see at all:{" "}
          <span className="text-white">the same borrower already on non-accrual at a different BDC</span>.
          It beats every mark-based signal, and stacked with a sub-90¢ mark it is the sharpest screen we
          have. It also fires <span className="text-white">early</span> — cross-held names still marked at
          or above 90¢ convert at roughly 8x the base rate, so it moves before our own marks do. It was
          added to the composite score in August 2026, which made the High tier both bigger and more
          accurate at once (555 loan-quarters at {highBacktest ? `${highBacktest.rate_na}%` : "~43%"}, against
          385 at 40.3% before).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "#8b8ba8" }} className="text-xs uppercase tracking-wider">
                <th className="text-left font-semibold py-2">Signal / tier</th>
                <th className="text-right font-semibold py-2">Observations</th>
                <th className="text-right font-semibold py-2">→ Non-accrual ≤1yr</th>
                <th className="text-right font-semibold py-2">Lift</th>
                <th className="text-right font-semibold py-2">→ NA or &lt;80¢</th>
              </tr>
            </thead>
            <tbody>
              {signalBacktest.map((b, i) => {
                const isTier = b.signal.startsWith("tier:");
                const isBase = b.signal.startsWith("ALL");
                return (
                  <tr key={i} style={{ borderTop: "1px solid #1a1a28",
                    background: isTier ? "#12121c" : undefined }}>
                    <td className="py-2 font-medium" style={{ color: isBase ? "#8b8ba8" : "#e5e5f0" }}>
                      {isTier ? <TierBadge tier={b.signal.replace("tier: ", "")} /> : b.signal}
                    </td>
                    <td className="py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{b.n.toLocaleString()}</td>
                    <td className="py-2 text-right tabular-nums font-semibold text-white">{b.rate_na}%</td>
                    <td className="py-2 text-right tabular-nums"
                      style={{ color: (b.lift_na ?? 1) >= 3 ? "#ef4444" : "#9ca3af" }}>
                      {b.lift_na != null ? `${b.lift_na}×` : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums" style={{ color: "#c7c7e0" }}>{b.rate_bad}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
        )}
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
                  <th className="text-right font-semibold py-2 px-3">$ at risk</th>
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

      {/* Where the watchlist is pointing: forward non-accrual rate */}
      <section className="mb-8">
        <NaForecastTable />
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
          Methodology &amp; caveats: a position scores on mark band (&lt;90¢/&lt;80¢), a ≥3pt quarterly mark slide
          (steeper if sustained two quarters), a cash→PIK flip, severe PIK, an amend-and-extend, or a spread cut.
          Par cuts count only alongside another signal (a &gt;15% par drop alone is dominated by benign amortization).
          Already-non-accrual and effectively-written-off (&lt;2¢) positions are excluded, as is preferred equity
          (structurally PIK). JV/structured vehicles are hidden by default. MFIC discloses no per-position non-accrual
          flag, so a few of its names may be under-excluded. Back-test base rates are weighted to 2018+ where loan
          history is deepest.
        </p>
      </section>
    </div>
  );
}
