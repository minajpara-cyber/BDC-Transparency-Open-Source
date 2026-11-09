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
import { signalBacktest } from "@/data/signal_backtest";
import { ewsRows } from "@/data/early_warning_scores";
import {
  backtestBase, backtestCrossHolder, backtestCrossHolderStacked, backtestHigh, backtestInfo, backtestLabelText,
  ewsIndustry, ewsInfo, ewsLabelText, pikTypeLift, scoreText, signalLabel, validationWindow,
} from "@/lib/earlyWarningDisplay";

const SWITCHED_LIFT = pikTypeLift("switched");
// The back-test reads loans only (scripts/51 `eligible` drops equity), so its
// by-design row holds convertible notes and no preferred shares.
const PIK_BY_DESIGN_ROW = signalBacktest.find((b) => b.signal.startsWith("PIK severe (by design"));
// "never went non-accrual" only when the back-test row says 0% on a real sample
const PIK_BY_DESIGN_NEVER = PIK_BY_DESIGN_ROW != null && PIK_BY_DESIGN_ROW.n >= 20 && PIK_BY_DESIGN_ROW.rate_na === 0;
// "the sharpest single signal" only while no other single-signal row lifts more
const XH_LIFT = backtestCrossHolder?.lift_na ?? null;
const XH_SHARPEST = XH_LIFT != null && signalBacktest
  .filter((b) => b !== backtestCrossHolder && !b.signal.startsWith("tier:") && !b.signal.startsWith("ALL")
    && !b.signal.startsWith("NA elsewhere +"))
  .every((b) => (b.lift_na ?? 0) <= (XH_LIFT ?? 0));
// The tier rows' first start quarter (the first with calibrated chances), as YYYY-MM.
const TIER_FROM = backtestInfo.tier_calibrated_from ? backtestInfo.tier_calibrated_from.slice(0, 7) : null;
// The out-of-sample test's first quarter, as YYYY-MM.
const OOS_FROM = validationWindow(ewsInfo.validated)?.from ?? null;

/** "A", "A and B", "A, B and C". */
function listText(items: string[]): string {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

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
// Each BDC's latest filing on the list (every row of a BDC carries the same one).
const AS_OF_BY_TICKER = new Map(watchlist.map((r) => [r.ticker, r.period_end]));

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
  // CLO / structured / fund positions are not scored, so the toggle only
  // shows when the export carries such rows
  const anyStructured = watchlist.some((r) => r.is_structured);
  const [valTab, setValTab] = useState<"lifts" | "oos">("oos");
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

  // Back-test hit rate by tier, lowest tier first.
  const tierRates = ["Watch", "Elevated", "High"]
    .map((tier) => ({ tier, rate: signalBacktest.find((b) => b.signal === `tier: ${tier}`)?.rate_na }))
    .filter((t): t is { tier: string; rate: number } => t.rate != null);
  const tierRatesRise = tierRates.every((t, i) => i === 0 || t.rate > tierRates[i - 1].rate);

  const totalFV = rows.reduce((s, r) => s + r.fv_m, 0);
  const nHigh = rows.filter((r) => r.tier === "High").length;
  // High-tier borrower positions (BDC × borrower) among the rows shown, so the
  // card follows the filters like the loan counts beside it
  const nHighBorrowers = new Set(rows.filter((r) => r.tier === "High").map((r) => `${r.ticker}|${r.company}|${r.score}`)).size;
  const nElevated = rows.filter((r) => r.tier === "Elevated").length;
  // High-tier borrower positions the whole list shows, against the model's count
  // (ewsIndustry.n_hi): the rest have no loan with a usable mark above 2¢
  // (scripts/51 eligible, MARK_DEAD), so none of their loans is listed
  const nHighListed = new Set(watchlist.filter((r) => r.tier === "High").map((r) => `${r.ticker}|${r.company}|${r.score}`)).size;
  const nHighUnlisted = ewsIndustry ? Math.max(0, ewsIndustry.n_hi - nHighListed) : 0;
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
  // Once a quarter is settled (10+ BDCs filed it) scripts/51 keeps a manager's
  // row for it with only the BDCs that filed: name the ones it leaves out.
  const mgrPartial = useMemo(() => {
    const tickersOf = new Map<string, Set<string>>();
    watchlist.forEach((r) => tickersOf.set(r.manager, (tickersOf.get(r.manager) ?? new Set<string>()).add(r.ticker)));
    return mgrLatest
      .map((m) => ({ key: m.key, period: m.period_end,
        missing: Array.from(tickersOf.get(m.key) ?? []).filter((t) => (AS_OF_BY_TICKER.get(t) ?? "") < m.period_end).sort() }))
      .filter((m) => m.missing.length > 0);
  }, [mgrLatest]);

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
    { key: "score", label: "Chance ≤1yr", sortable: true, align: "right",
      render: (r) => (
        <span className="font-semibold text-white tabular-nums"
          title="The model's chance that this borrower goes on non-accrual at this BDC within four quarters.">
          {r.score}%
        </span>
      ) },
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
      key: "signals", label: "Why",
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

  // The BDCs still on an earlier filing, grouped by that filing (newest first):
  // pooled figures name them rather than stamp the newest date on everything.
  // Kept below the hooks: the React Compiler reads listText(g.tickers) in the
  // hero as a possible write to these lists, and a value still being written
  // across the useMemo calls above makes it drop their memoization.
  const behindBy = new Map<string, string[]>();
  AS_OF_BY_TICKER.forEach((period, ticker) => {
    if (period < latest) behindBy.set(period, [...(behindBy.get(period) ?? []), ticker]);
  });
  const behind = Array.from(behindBy, ([period, tickers]) => ({ period, tickers: tickers.sort() }))
    .sort((a, b) => b.period.localeCompare(a.period));
  const asOfPhrase = (date: string) => (behind.length ? `on each BDC's latest filing (newest ${date})` : `as of ${date}`);

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
            {behind.length ? `newest filing ${latest}` : `as of ${latest}`}
          </span>
        </div>
        <p className="text-sm max-w-3xl" style={{ color: "#9ca3af" }}>
          Loans to borrowers that are <span className="text-white">showing stress but are not yet on non-accrual</span>{" "}— the
          leading edge of credit problems. Each borrower gets a chance of going on non-accrual at that BDC within a year, from
          one model read off the filings: how it is marked, by this BDC and by the worst of its other holders, and how fast that
          is moving; PIK; equity written down; its next maturity; its spread; non-accrual at another BDC, or earlier at this one;
          the age and size of its loans; and which BDC holds them.{" "}
          <span style={{ color: TIER_COLOR.Watch }}>Watch</span>{" "}is 5–10%, <span style={{ color: TIER_COLOR.Elevated }}>Elevated</span>{" "}10–25%,{" "}
          <span style={{ color: TIER_COLOR.High }}>High</span>{" "}25% or more. A borrower with a loan already tagged non-accrual
          at that BDC is left out.
          {backtestHigh && backtestHigh.lift_na != null && (
            <>
              {" "}Out of sample{TIER_FROM ? `, in start quarters from ${TIER_FROM} on` : ""}, loans in the{" "}
              <span style={{ color: TIER_COLOR.High }}>High</span> tier went on non-accrual within a year{" "}
              <span className="text-white">{backtestHigh.lift_na}× as often as the average loan</span>.
            </>
          )}{" "}
          Dollar amounts are reported fair value, not an estimate of losses.
          {behind.length > 0 && (
            <>
              {" "}Each BDC is shown at its latest filing:{" "}
              {behind.map((g) => `${listText(g.tickers)} ${g.tickers.length === 1 ? "is" : "are"} still at ${g.period}`).join("; ")},
              the rest at {latest}.
            </>
          )}
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Reported FV on watchlist" value={fmtM(totalFV)}
          sub={`${rows.length} loan${rows.length === 1 ? "" : "s"}, not yet on non-accrual`} color="#f59e0b" highlight />
        <StatCard label="High-tier loans" value={String(nHigh)} color="#ef4444"
          sub={`${nHighBorrowers.toLocaleString()} borrower position${nHighBorrowers === 1 ? "" : "s"} · + ${nElevated} elevated loan${nElevated === 1 ? "" : "s"}`} />
        <StatCard label="New this quarter" value={String(nNew)} color="#6366f1"
          sub={`${fmtM(newFV)} entered the watchlist`} />
        <StatCard label="High → non-accrual ≤1yr"
          value={backtestHigh ? `${backtestHigh.rate_na}%` : "—"} color="#ef4444"
          trend="neutral" trendLabel={backtestHigh?.lift_na != null ? `${backtestHigh.lift_na}× base rate` : undefined}
          sub={`${backtestInfo.tier_base_rate_na != null ? `vs ${backtestInfo.tier_base_rate_na}% base · ` : ""}out of sample${TIER_FROM ? `, loans from ${TIER_FROM}` : ""}`} />
      </div>

      {/* Back-test credibility panel — two validation lenses, one card */}
      <section className="mb-8 rounded-xl border p-5" style={{ background: "#0d0d14", borderColor: "#1e1e2e" }}
        id="signal-backtest">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <h2 className="text-lg font-semibold text-white">Does the signal actually predict trouble?</h2>
          <div className="flex items-center gap-1 text-xs">
            {([["oos", "Out-of-sample test"], ["lifts", "Each signal's history"]] as const).map(([k, label]) => (
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
        {valTab === "oos" && (() => {
          const oosWindow = validationWindow(ewsInfo.validated);
          const bands = ewsInfo.validation_buckets ?? [];
          const pct0 = (v: number | undefined) => (v == null ? "—" : `${Math.round(100 * v)}%`);
          // Watch and Elevated ran above their average chance over the whole test
          // (the export carries the pooled bands only, so nothing is said by year)
          const ranAbove = (name: string) => bands.some((b) => b.bucket.startsWith(name)
            && b.avg_probability_pct != null && b.hit_rate_pct > b.avg_probability_pct);
          const midLow = ranAbove("Watch") && ranAbove("Elevated");
          // the bands pool the test's quarters before calibrated_from (raw chances) with later ones
          const calFrom = ewsInfo.calibrated_from ? ewsInfo.calibrated_from.slice(0, 7) : null;
          const poolsRaw = calFrom != null && oosWindow != null && oosWindow.from < calFrom;
          return (
            <>
              <p className="text-sm mt-1 mb-2" style={{ color: "#9ca3af" }}>
                At each past quarter-end{oosWindow ? ` from ${oosWindow.from} to ${oosWindow.to}` : ""}{" "}the model was fitted only on
                loans whose next year&apos;s outcome was already known, then used to score that quarter&apos;s book. Across{" "}
                {ewsInfo.n_labeled?.toLocaleString() ?? "these"}{" "}borrower-quarters
                {ewsInfo.capture_top_10pct != null && <>, <span className="text-white">the riskiest 10% of the book held {pct0(ewsInfo.capture_top_10pct)} of the next year&apos;s new non-accrual dollars</span></>}
                {ewsInfo.capture_top_5pct != null && <> and the riskiest 5% held {pct0(ewsInfo.capture_top_5pct)}</>}.
                {ewsInfo.precision_at_50_pct != null && <> Of the 50 highest-ranked borrowers each quarter, {ewsInfo.precision_at_50_pct}% went on non-accrual within a year{ewsInfo.validation_base_rate_pct != null ? `, against ${ewsInfo.validation_base_rate_pct}% overall` : ""}.</>}
                {ewsInfo.auc != null && <> Its AUC (0.5 is a coin toss, 1 a perfect ranking) is {ewsInfo.auc.toFixed(2)}{ewsInfo.marks_only_auc != null ? `, against ${ewsInfo.marks_only_auc.toFixed(2)} for ranking on the mark alone` : ""}.</>}
              </p>
              <div className="overflow-x-auto mb-3">
                <table className="w-full text-sm" data-oos-bands={bands.length}>
                  <thead>
                    <tr style={{ color: "#8b8ba8" }} className="text-xs uppercase tracking-wider">
                      {["Model's chance", "Borrower-quarters", "Average chance", "Went on non-accrual ≤1yr", "Book per quarter", "Share of later non-accrual $"].map((h, i) => (
                        <th key={h} className={`font-semibold py-2 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bands.map((b) => (
                      <tr key={b.bucket} style={{ borderTop: "1px solid #1a1a28" }}>
                        <td className="py-2 font-medium" style={{ color: "#e5e5f0" }}>{b.bucket}</td>
                        <td className="py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{b.n.toLocaleString()}</td>
                        <td className="py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{b.avg_probability_pct?.toFixed(1)}%</td>
                        <td className="py-2 text-right tabular-nums font-semibold text-white">{b.hit_rate_pct.toFixed(1)}%</td>
                        <td className="py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{b.cost_per_quarter_bn != null ? `$${b.cost_per_quarter_bn.toFixed(1)}B` : "—"}</td>
                        <td className="py-2 text-right tabular-nums" style={{ color: "#c7c7e0" }}>{b.share_of_later_na_cost_pct != null ? `${b.share_of_later_na_cost_pct.toFixed(0)}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs mb-2" style={{ color: "#8b8ba8" }}>
                Read the chance as a ranking first and a number second.
                {calFrom && <>{" "}Chances from {calFrom}{" "}on are calibrated against what
                  actually happened, as today&apos;s are; earlier ones are the model&apos;s raw chances.</>}
                {poolsRaw && <>{" "}The table above pools both, as the export does not split them: each band mixes quarters
                  banded on raw chances with quarters banded on calibrated ones.</>}
                {midLow && <>{" "}Over the test as a whole, more went on non-accrual in the Watch and Elevated bands than the
                  model&apos;s average chance.</>}{" "}
                Its settings (which inputs it reads, how hard the fit is shrunk) were chosen on this same window, so treat this as a strong
                check rather than a pure forward test; each quarter&apos;s fit itself only ever saw earlier outcomes.
              </p>
              <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
                {ewsLabelText}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                    <tr>
                      {["BDC", "Borrower", "Chance ≤1yr", "Why", "Reported FV", "Mark"].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ewsRows.slice(0, 25).map((r, i) => (
                      <tr key={`${r.ticker}-${r.borrower}-${i}`} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                        <td className="px-3 py-2 text-xs font-semibold text-white">{r.ticker}</td>
                        <td className="px-3 py-2 text-sm" style={{ color: "#d1d5db" }}>{r.borrower}</td>
                        <td className="px-3 py-2 text-sm font-bold" style={{ color: r.score >= 25 ? "#ef4444" : r.score >= 10 ? "#f97316" : "#eab308" }}>{scoreText(r)}</td>
                        <td className="px-3 py-2">
                          {r.signals.map(s => (
                            <span key={s} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded text-xs"
                                  style={{ background: "rgba(239,68,68,0.10)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
                              {signalLabel(s)}
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
                Top 25 of the {ewsRows.length} highest-ranked borrowers {asOfPhrase(ewsInfo.as_of ?? latest)}
                {ewsIndustry ? `; ${ewsIndustry.n_hi.toLocaleString()} borrower positions across the universe are in the High tier` : ""}
                {nHighUnlisted > 0
                  ? `, ${nHighUnlisted.toLocaleString()} of them off the watchlist below because none of their loans has a usable mark above 2¢`
                  : ""}.
                A borrower held by several BDCs appears once per BDC. A borrower with a loan already on
                non-accrual at that BDC is left out — this is the queue before non-accrual.{" "}
                <Link href="/credit#forward-queue" className="text-indigo-400 hover:text-indigo-300">
                  Per-BDC rollup →
                </Link>
              </p>
            </>
          );
        })()}
        {valTab === "lifts" && (
        <>
        <p className="text-sm mb-3" style={{ color: "#9ca3af" }}>
          For every loan not yet on non-accrual since 2018, we checked whether its borrower went on non-accrual at that BDC
          within four quarters. Each row shows how often loans with that signal did
          {backtestBase ? `, against the ${backtestBase.rate_na}% base rate across ${backtestBase.n.toLocaleString()} loan-quarters` : ""}.
          {tierRates.length > 1 && (tierRatesRise
            ? ` Out of sample, the tiers rank risk in order: ${tierRates.map((t) => `${t.tier} ${t.rate}%`).join(" → ")} went non-accrual within a year.`
            : ` Tier hit rates, out of sample: ${tierRates.map((t) => `${t.tier} ${t.rate}%`).join(", ")}.`)}
        </p>
        {backtestCrossHolder && (
          <p className="text-sm mb-3" style={{ color: "#9ca3af" }}>
            {XH_SHARPEST ? "The sharpest single signal is one a single-BDC view cannot see:" : "One signal a single-BDC view cannot see:"}{" "}
            <span className="text-white">the same borrower already on non-accrual at a different BDC</span>{" "}
            ({backtestCrossHolder.rate_na}% went non-accrual{backtestCrossHolder.lift_na != null ? `, ${backtestCrossHolder.lift_na}× the base rate` : ""}
            {`, across ${backtestCrossHolder.n.toLocaleString()} loan-quarters`}).
            {backtestCrossHolderStacked && ` Combined with a mark below 90¢ it reaches ${backtestCrossHolderStacked.rate_na}%.`}
          </p>
        )}
        {SWITCHED_LIFT.early?.lift_na != null && SWITCHED_LIFT.late?.lift_na != null && (
          <p className="text-sm mb-3" style={{ color: "#9ca3af" }}>
            {"Why heavy PIK is paid in kind matters, because the types behave nothing alike: loans that "
              + "switched from cash to heavy PIK while the BDC held them went on non-accrual within a year "
              + `${SWITCHED_LIFT.early.lift_na}× as often as the average loan in start quarters to 2023, and `
              + `${SWITCHED_LIFT.late.lift_na}× from 2024 on, so the pattern holds in both halves of the history. `
              + (PIK_BY_DESIGN_NEVER
                ? "None of the convertible notes built to pay in kind went on non-accrual within a year. "
                : "")
              + (PIK_BY_DESIGN_ROW
                ? "The by-design row holds convertible notes only: preferred shares are not loans, so this test leaves them out. "
                : "")
              + "The model itself does not read why PIK is paid: any PIK coupon raises a borrower's chance, a convertible "
              + "note's included, and a switch from cash to PIK while the BDC held the loan raises it further."}
          </p>
        )}
        <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
          The signal rows describe every start quarter since 2018; a signal&apos;s lift here is on its own, before the others are
          counted. The tier rows are out of sample: only quarters whose chance came from a fit on earlier outcomes
          {TIER_FROM ? ` and was calibrated against what actually happened (from ${TIER_FROM} on)` : ""}, with lift against those
          quarters&apos; base rate. They count loans, so a borrower with several loans counts once for each; the out-of-sample test
          {OOS_FROM ? ` (from ${OOS_FROM})` : ""} counts each borrower once a quarter. {backtestLabelText}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "#8b8ba8" }} className="text-xs uppercase tracking-wider">
                <th className="text-left font-semibold py-2">Signal / tier</th>
                <th className="text-right font-semibold py-2">Loan-quarters</th>
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
          Watchlist dollars added up across each manager&apos;s BDCs. Absolute $ favors the biggest books, so the
          <span className="text-white"> % of book</span>{" "}column is the like-for-like read across managers.
          {mgrPartial.length > 0 && (() => {
            const periods = Array.from(new Set(mgrPartial.map((m) => m.period)));
            const items = mgrPartial.map((m) => `${m.key} without ${listText(m.missing)}${periods.length > 1 ? ` at ${m.period}` : ""}`);
            return (
              <>
                {" "}A manager&apos;s row is its newest quarter, so a BDC that has not filed that quarter yet is not in it:{" "}
                {listText(items)}{periods.length === 1 ? ` at ${periods[0]}` : ""}. The list below still has their loans, from
                their latest filing, and the chart&apos;s last point leaves them out too.
              </>
            );
          })()}
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
          title={`% of the funded book on the watchlist — ${WL_CUT_META[wlCut].label}`}
          description={
            `Pre-non-accrual stress by BDC and quarter, as a share of the funded book at amortized cost` +
            (wlGrid.periods.length ? `, from ${wlGrid.periods[0].slice(0, 7)}, the first quarter whose chances are calibrated against what actually happened` : "") +
            `. ` +
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
            <input type="checkbox" checked={newOnly} onChange={(e) => setNewOnly(e.target.checked)} />{" "}New only
          </label>
          {anyStructured && (
            <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: "#9ca3af" }}>
              <input type="checkbox" checked={hideStructured} onChange={(e) => setHideStructured(e.target.checked)} />{" "}Hide JV/structured
            </label>
          )}
          <CsvDownloadButton filename={`watchlist_${latest}`}
            columns={["tier", "chance_of_non_accrual_within_1yr_pct", "company", "ticker", "manager", "parent", "industry",
              "maturity", "mark", "fv_m", "cost_m", "is_new", "signals"]}
            rows={csvRows} />
        </div>
        <SortableTable<WatchlistRow>
          data={rows}
          columns={columns}
          rowKey={(r) => `${r.ticker}|${r.company}|${r.maturity_date}|${r.investment_type}`}
          initialSort={{ key: "score", dir: "desc" }}
          dense
          stickyHeader
          emptyMessage="No positions match these filters."
        />
        <p className="text-xs mt-4 max-w-3xl" style={{ color: "#6b6b88" }}>
          How the list works: a borrower appears when the model gives it at least a 5% chance of going on non-accrual at that BDC
          within four quarters, and it shows the reasons that added most. All of a listed borrower&apos;s marked loans at that BDC
          appear, so a loan marked at par can be listed because of what is happening to its borrower. When a BDC marks its loans
          to a borrower below 80¢ together, the chance is read against what happened to earlier borrowers marked that low, because
          a low mark with no other signal still went on non-accrual far more often than its signals add up to. The model reads
          loans only, so a fund or joint venture held only as an equity stake is not scored at all; loans to a vehicle (CLO
          and other structured notes, joint ventures, funds and securitizations) stay out of the fit and off this list: a price
          below par is how those trade, not a sign of a borrower in trouble. Amend-and-extends, spread cuts and stressed cuts to the
          loan amount are shown as tags only: tested on top of the rest, they added nothing, and most spread cuts are healthy
          repricings. The mark is fair value ÷ par, the same mark as the credit heatmaps; at the twelve BDCs whose schedules
          net the undrawn discount into a facility&apos;s fair value, a loan with an undrawn commitment is priced on its whole
          commitment. A loan with no mark is not on this list. A loan has no mark when: it is an unfunded
          commitment; its par is missing, or in a currency we cannot convert; its undrawn commitment could not be tied to it;
          its par is the whole commitment of a partly drawn revolver or delayed draw (fair value close to its drawn cost, or par above twice cost —
          MFIC and ADS loans from 2021–2024 are read this way, because those schedules printed the commitment as
          the par); its revolver or delayed draw would price 5¢ or more below the borrower&apos;s other loans, so its par is
          not its drawn par; its par is more than fifty times cost, or more than twice cost on a loan that is neither on
          non-accrual nor paying PIK and is valued near its cost; its cost is more than 1.06× par (1.35× for a
          par converted from another currency); or it is marked above 150¢. A written-down or restructured loan
          keeps its own low mark. The same loan is followed quarter to quarter through extensions and
          label changes; that matching is automated, so treat a signal as a prompt to look, not proof of an
          amendment or default. Loans already on non-accrual, loans marked below 2¢, equity and CLO / structured /
          fund positions are not listed, and neither is a borrower whose non-accrual status could not be read from its filing that
          quarter. An input that could not be read counts as missing, not as clear.
        </p>
      </section>
    </div>
  );
}
