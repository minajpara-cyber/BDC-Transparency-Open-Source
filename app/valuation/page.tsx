"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/StatCard";
import CsvDownloadButton from "@/components/CsvDownloadButton";
import PnavHistoryChart, { PnavChartSeries } from "@/components/PnavHistoryChart";
import IssuanceStackChart from "@/components/IssuanceStackChart";
import {
  pnavAsOf, pnavSnapshots, pnavSeries, pnavAggregate, managerPnav,
  type PnavSnapshot,
} from "@/data/pnav";
import { issuerModel, issuanceStackTickers, issuanceByQuarter } from "@/data/issuance";

const PALETTE = ["#f59e0b", "#22c55e", "#06b6d4", "#a855f7", "#ec4899", "#84cc16", "#ef4444", "#38bdf8"];
const RANGES: Record<string, number> = { "1Y": 366, "3Y": 3 * 366, "5Y": 5 * 366, Max: 12 * 366 };

const fmtX = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(2)}x`);
const fmtPct = (v: number | null | undefined, dp = 1) =>
  v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(dp)}%`;
const fmtM = (v: number | null | undefined) =>
  v == null || Math.abs(v) < 0.5 ? "—"
    : v >= 1000 ? `$${(v / 1000).toFixed(2)}B` : `$${v.toFixed(0)}M`;

function premColor(pb: number): string {
  if (pb >= 1.0) return "#22c55e";
  if (pb >= 0.9) return "#c7c7e0";
  if (pb >= 0.75) return "#f59e0b";
  return "#ef4444";
}

type SortKey = keyof PnavSnapshot;

export default function ValuationPage() {
  const [sortKey, setSortKey] = useState<SortKey>("pb");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [range, setRange] = useState<keyof typeof RANGES>("5Y");
  const [picked, setPicked] = useState<string[]>(["ARCC", "FSK", "MAIN"]);
  const [allMgrs, setAllMgrs] = useState(false);

  // Forward-quarter labels ride along on the data so the header always names the
  // quarters the model actually produced, rather than re-deriving them here and
  // drifting out of step with the export at a quarter boundary.
  const q1Label = issuerModel.find((r) => r.est_q1_label)?.est_q1_label ?? "next Q";
  const q2Label = issuerModel.find((r) => r.est_q2_label)?.est_q2_label ?? "Q after";

  const asOfDate = new Date(pnavAsOf + "T12:00:00");
  const from = new Date(asOfDate.getTime() - RANGES[range] * 86400_000)
    .toISOString().slice(0, 10);

  // ---- stat strip
  const stats = useMemo(() => {
    const n = pnavAggregate.d.length - 1;
    const sorted = [...pnavSnapshots].sort((a, b) => b.pb - a.pb);
    return {
      median: pnavAggregate.median[n],
      above1: pnavAggregate.above1[n],
      count: pnavAggregate.n[n],
      top: sorted[0],
      bottom: sorted[sorted.length - 1],
    };
  }, []);

  // ---- table
  const rows = useMemo(() => {
    const r = [...pnavSnapshots];
    r.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number")
        return sortDir === "desc" ? bv - av : av - bv;
      return sortDir === "desc"
        ? String(bv ?? "").localeCompare(String(av ?? ""))
        : String(av ?? "").localeCompare(String(bv ?? ""));
    });
    return r;
  }, [sortKey, sortDir]);
  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "ticker" || k === "manager" ? "asc" : "desc"); }
  };
  const arrow = (k: SortKey) => (sortKey === k ? (sortDir === "desc" ? " ↓" : " ↑") : "");

  // ---- history chart series
  const chartSeries = useMemo(() => {
    const out: PnavChartSeries[] = [
      { name: "Space median", color: "#e5e7eb", width: 2.4,
        d: pnavAggregate.d, v: pnavAggregate.median },
      { name: "NAV-weighted", color: "#6366f1", dash: "6 4", width: 1.5,
        d: pnavAggregate.d, v: pnavAggregate.wavg.map((x) => x ?? NaN) },
    ];
    picked.forEach((t, i) => {
      const s = pnavSeries.find((x) => x.t === t);
      if (s) out.push({ name: t, color: PALETTE[i % PALETTE.length], d: s.d, v: s.v });
    });
    return out;
  }, [picked]);

  const allTickers = useMemo(() => pnavSeries.map((s) => s.t).sort(), []);

  // ---- issuance
  const csvRows = rows.map((r) => [
    r.ticker, r.manager, r.price, r.priceDate, r.navPs, r.navDate, r.pb,
    r.premPct, r.avg1y ?? "", r.z3y ?? "", r.netAssetsB ?? "", r.leverage ?? "",
  ]);
  const mgrRows = allMgrs ? managerPnav : managerPnav.slice(0, 18);
  const scoreTier = (s: number) =>
    s >= 60 ? { label: "High", color: "#22c55e" }
      : s >= 35 ? { label: "Medium", color: "#f59e0b" }
        : { label: "Low", color: "#5b5b78" };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-white">Price / NAV & Issuance</h1>
          <span className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: "#1a1a28", color: "#a5b4fc", border: "1px solid #2d2d50" }}>
            prices as of {pnavAsOf}
          </span>
        </div>
        <p className="text-sm max-w-3xl" style={{ color: "#9ca3af" }}>
          Where every listed BDC trades against its own book value — most recent
          reported NAV per share under each day&apos;s closing price. Premiums to NAV are
          the sector&apos;s equity-issuance currency: a BDC above NAV can sell new shares
          accretively, below NAV it needs shareholder approval. Covers {stats.count} listed
          BDCs — the {pnavSnapshots.filter((s) => s.src === "core").length} we parse in
          depth plus the long tail.
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Space median P/NAV" value={fmtX(stats.median)}
          sub={`${stats.count} listed BDCs`} color="#6366f1" highlight />
        <StatCard label="Trading above NAV" value={`${stats.above1.toFixed(0)}%`}
          sub="share of listed BDCs at a premium" color="#22c55e" />
        <StatCard label="Richest" value={`${stats.top.ticker} ${fmtX(stats.top.pb)}`}
          sub={`${stats.top.manager}`} color="#f59e0b" />
        <StatCard label="Cheapest" value={`${stats.bottom.ticker} ${fmtX(stats.bottom.pb)}`}
          sub={`${stats.bottom.manager}`} color="#ef4444" />
      </div>

      {/* History chart */}
      <section className="mb-8 rounded-xl border p-5" style={{ background: "#0d0d14", borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">P/NAV through time</h2>
            <p className="text-sm max-w-3xl" style={{ color: "#9ca3af" }}>
              Weekly history (daily for the last six months), point-in-time: each day uses
              the last NAV that had been <span className="text-white">filed</span> by that
              day. Add individual BDCs to compare against the space.
            </p>
          </div>
          <div className="flex rounded-lg overflow-hidden border text-xs" style={{ borderColor: "#2d2d50" }}>
            {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
              <button key={r} onClick={() => setRange(r)}
                className="px-3 py-1.5 font-medium transition-colors"
                style={{ background: range === r ? "#6366f1" : "transparent", color: range === r ? "#fff" : "#9ca3af" }}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {picked.map((t) => (
            <button key={t} onClick={() => setPicked(picked.filter((x) => x !== t))}
              className="px-2 py-1 rounded text-xs font-mono font-semibold"
              style={{ background: "#1a1a28", border: "1px solid #2d2d50", color: PALETTE[picked.indexOf(t) % PALETTE.length] }}
              title="remove from chart">
              {t} ✕
            </button>
          ))}
          <select value="" onChange={(e) => { if (e.target.value) setPicked([...picked, e.target.value]); }}
            className="px-2 py-1 rounded text-xs"
            style={{ background: "#1a1a28", border: "1px solid #2d2d50", color: "#9ca3af" }}>
            <option value="">+ add BDC…</option>
            {allTickers.filter((t) => !picked.includes(t)).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <PnavHistoryChart series={chartSeries} from={from} />
      </section>

      {/* MRQ table */}
      <section className="mb-8">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Every listed BDC vs its book</h2>
            <p className="text-sm max-w-3xl" style={{ color: "#9ca3af" }}>
              Most-recent-quarter NAV per share against the latest close. &quot;vs 1y&quot; compares
              today&apos;s P/NAV to its own one-year average; &quot;z 3y&quot; is how unusual today is
              versus its own three-year history (±2 is stretched). Click columns to sort.
            </p>
          </div>
          <CsvDownloadButton filename="bdc-price-nav"
            columns={["ticker", "manager", "price", "price_date", "nav_ps", "nav_date", "p_nav",
              "prem_pct", "avg_1y", "z_3y", "net_assets_b", "leverage"]}
            rows={csvRows} />
        </div>
        <div className="rounded-xl border overflow-x-auto" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <table className="text-xs w-full" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead style={{ background: "#0f0f16" }}>
              <tr>
                {([
                  { k: "ticker" as SortKey, label: "BDC", align: "left" },
                  { k: "navPs" as SortKey, label: "NAV/sh", align: "right" },
                  { k: "navDate" as SortKey, label: "NAV as of", align: "right" },
                  { k: "price" as SortKey, label: "Price", align: "right" },
                  { k: "pb" as SortKey, label: "P/NAV", align: "right" },
                  { k: "premPct" as SortKey, label: "Prem/Disc", align: "right" },
                  { k: "avg1y" as SortKey, label: "1y avg", align: "right" },
                  { k: "z3y" as SortKey, label: "z 3y", align: "right" },
                  { k: "netAssetsB" as SortKey, label: "Net assets", align: "right" },
                  { k: "leverage" as SortKey, label: "Lev", align: "right" },
                ]).map((c) => (
                  <th key={String(c.k)} onClick={() => handleSort(c.k)}
                    className={`px-2.5 py-2 font-semibold cursor-pointer select-none whitespace-nowrap ${c.align === "left" ? "text-left" : "text-right"}`}
                    style={{ color: "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>
                    {c.label}{arrow(c.k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.ticker} style={{ background: ri % 2 === 0 ? "#111118" : "#0f0f16" }}>
                  <td className="px-2.5 py-2 whitespace-nowrap">
                    {r.src === "core" ? (
                      <Link href={`/bdcs/${r.ticker.toLowerCase()}`}
                        className="font-mono font-semibold hover:text-white"
                        style={{ color: "#a5b4fc" }} title={r.name}>{r.ticker}</Link>
                    ) : (
                      <span className="font-mono font-semibold" style={{ color: "#c7c7e0" }}
                        title={r.name}>{r.ticker}</span>
                    )}
                    <span className="ml-1.5" style={{ color: "#5b5b78" }}>{r.manager}</span>
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums text-white">${r.navPs.toFixed(2)}</td>
                  <td className="px-2.5 py-2 text-right tabular-nums whitespace-nowrap"
                    style={{ color: r.navDate >= "2026-06-30" ? "#9ca3af" : "#f59e0b" }}
                    title={`filed ${r.navFiled}${r.navSource !== "tagged" ? " · derived from net assets ÷ shares" : ""}`}>
                    {r.navDate.slice(0, 7)}
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: "#c7c7e0" }}>
                    ${r.price.toFixed(2)}
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums font-semibold"
                    style={{ color: premColor(r.pb) }}>{r.pb.toFixed(2)}x</td>
                  <td className="px-2.5 py-2 text-right tabular-nums"
                    style={{ color: r.premPct >= 0 ? "#22c55e" : "#ef4444" }}>
                    {fmtPct(r.premPct)}
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                    {r.avg1y ? `${r.avg1y.toFixed(2)}x` : "—"}
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums"
                    style={{ color: r.z3y != null && Math.abs(r.z3y) >= 1.5 ? "#f59e0b" : "#9ca3af" }}>
                    {r.z3y != null ? r.z3y.toFixed(1) : "—"}
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                    {r.netAssetsB != null ? `$${r.netAssetsB.toFixed(1)}B` : "—"}
                  </td>
                  <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                    {r.leverage != null ? `${r.leverage.toFixed(2)}x` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
          Amber NAV dates are one quarter behind (that BDC hasn&apos;t reported the latest
          quarter yet, or SEC&apos;s XBRL feed is still processing its filing). Leverage is
          (total assets − net assets) ÷ net assets — all liabilities, slightly above pure
          debt/equity. Prices are split-restated closes, not dividend-adjusted.
        </p>
      </section>

      {/* Manager rollup */}
      <section className="mb-8 rounded-xl border p-5" style={{ background: "#0d0d14", borderColor: "#1e1e2e" }}>
        <h2 className="text-lg font-semibold text-white mb-1">Which managers earn a premium</h2>
        <p className="text-sm max-w-3xl mb-4" style={{ color: "#9ca3af" }}>
          Listed vehicles grouped by manager, weighted by net assets. A manager whose
          BDCs trade above NAV has an open equity-growth channel — and a franchise the
          market trusts; a manager pinned at a discount is in run-off pricing.
        </p>
        <div className="rounded-xl border overflow-x-auto" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <table className="text-xs w-full" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead style={{ background: "#0f0f16" }}>
              <tr>
                {["Manager", "Vehicles", "Net assets", "Wtd P/NAV", "", "Range", "1y ago"].map((h, i) => (
                  <th key={i} className={`px-2.5 py-2 font-semibold whitespace-nowrap ${i === 0 ? "text-left" : i === 4 ? "text-left" : "text-right"}`}
                    style={{ color: "#8b8ba8", borderBottom: "1px solid #1e1e2e", width: i === 4 ? "26%" : undefined }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mgrRows.map((m, ri) => {
                const barPct = Math.max(2, Math.min(100, ((m.wpb - 0.2) / 1.6) * 100));
                const navPct = ((1.0 - 0.2) / 1.6) * 100;
                const delta = m.wpb1yAgo != null ? m.wpb - m.wpb1yAgo : null;
                return (
                  <tr key={m.manager} style={{ background: ri % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-2.5 py-2 font-medium whitespace-nowrap"
                      style={{ color: m.wpb >= 1 ? "#e5e7eb" : "#c7c7e0" }}>
                      {m.manager}
                      {m.wpb >= 1 && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: "#0c2618", color: "#22c55e", border: "1px solid #14532d" }}>
                          premium
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-right font-mono whitespace-nowrap" style={{ color: "#8b8ba8" }}>
                      {m.tickers.join(" ")}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                      ${m.netAssetsB.toFixed(1)}B
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-semibold"
                      style={{ color: premColor(m.wpb) }}>{m.wpb.toFixed(2)}x</td>
                    <td className="px-2.5 py-2">
                      <div className="relative h-3 rounded" style={{ background: "#1a1a28", minWidth: 120 }}>
                        <div className="absolute inset-y-0 left-0 rounded"
                          style={{ width: `${barPct}%`, background: m.wpb >= 1 ? "#22c55e66" : "#6366f166" }} />
                        <div className="absolute inset-y-0" style={{ left: `${navPct}%`, width: 1, background: "#8b8ba8" }} />
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums whitespace-nowrap" style={{ color: "#9ca3af" }}>
                      {m.minPb.toFixed(2)}–{m.maxPb.toFixed(2)}x
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums whitespace-nowrap"
                      style={{ color: delta == null ? "#5b5b78" : delta >= 0 ? "#22c55e" : "#ef4444" }}>
                      {m.wpb1yAgo != null ? `${m.wpb1yAgo.toFixed(2)}x` : "—"}
                      {delta != null && ` ${delta >= 0 ? "↑" : "↓"}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {managerPnav.length > 18 && (
          <button onClick={() => setAllMgrs(!allMgrs)}
            className="mt-3 px-3 py-1.5 rounded text-xs font-medium border"
            style={{ borderColor: "#2d2d50", color: "#9ca3af", background: "transparent" }}>
            {allMgrs ? "Show fewer" : `Show all ${managerPnav.length} managers`}
          </button>
        )}
      </section>

      {/* Issuance */}
      <section className="mb-8 rounded-xl border p-5" style={{ background: "#0d0d14", borderColor: "#1e1e2e" }}>
        <h2 className="text-lg font-semibold text-white mb-1">Equity issuance — who&apos;s printing shares</h2>
        <p className="text-sm max-w-3xl mb-4" style={{ color: "#9ca3af" }}>
          Gross common-stock issuance proceeds by quarter (ATMs + follow-ons, from each
          BDC&apos;s own cash-flow and equity disclosures; dividend reinvestment shown
          separately in the table). Issuance concentrates in whoever holds a premium —
          watch it rotate as P/NAV moves.
        </p>
        <IssuanceStackChart data={issuanceByQuarter} tickers={issuanceStackTickers} />

        <div className="flex items-start justify-between gap-3 mt-6 mb-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold text-white mb-1">Likely issuers — next two quarters and next 12 months</h3>
            <p className="text-sm max-w-3xl" style={{ color: "#9ca3af" }}>
              Scored 0–100 from premium level (40), premium persistence over the last
              quarter (20), trailing-12m issuance appetite (25) and leverage headroom (15);
              names below 0.97x NAV are scaled to a quarter of their score — sub-NAV
              issuance requires shareholder approval. The 12-month estimate is trailing-12m
              issuance scaled by the premium regime (a persistent premium with no ATM yet
              gets a nominal 2%-of-NAV starter estimate).
            </p>
            <p className="text-sm max-w-3xl mt-2" style={{ color: "#9ca3af" }}>
              The two quarterly estimates are built differently, and more carefully. Each
              BDC&apos;s own trailing 8-quarter issuance rate is carried forward, then bounded
              by what its premium can actually support: an empirical curve fitted across
              every BDC-quarter we hold shows median quarterly issuance of{" "}
              <span className="text-white">~0% of net assets below NAV</span> versus{" "}
              <span className="text-white">2.3–3.7% above it</span> — the 1940 Act
              shareholder-approval cliff, visible in the data. {q1Label} additionally uses the
              premium actually observed so far this quarter, and for the six issuers whose
              latest 10-Q cover page post-dates quarter-start (marked{" "}
              <span style={{ color: "#22c55e" }}>◆</span>), the share growth already reported
              — a measured fact rather than a forecast. Estimates are capped by ATM capacity
              at 15% of 60-day traded volume.
            </p>
          </div>
        </div>
        <div className="rounded-xl border overflow-x-auto" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <table className="text-xs w-full" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
            <thead style={{ background: "#0f0f16" }}>
              <tr>
                {["BDC", "P/NAV", "Days >NAV (3m)", "TTM issued", "% of NAV", "DRIP", "Buybacks", "Lev", "Score",
                  `Est. ${q1Label}`, `Est. ${q2Label}`, "Est. next 12m"].map((h, i) => (
                  <th key={i} className={`px-2.5 py-2 font-semibold whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                    style={{ color: "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {issuerModel.slice(0, 20).map((r, ri) => {
                const tier = scoreTier(r.score);
                return (
                  <tr key={r.ticker} style={{ background: ri % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-2.5 py-2 font-mono font-semibold" style={{ color: "#a5b4fc" }}>{r.ticker}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-semibold"
                      style={{ color: premColor(r.pb) }}>{r.pb.toFixed(2)}x</td>
                    <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                      {r.persistence.toFixed(0)}%
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums text-white">{fmtM(r.ttm_issuance_m)}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                      {r.ttm_pct_nav != null && r.ttm_issuance_m > 0.5 ? `${r.ttm_pct_nav.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{fmtM(r.ttm_drip_m)}</td>
                    <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: r.ttm_buyback_m > 0.5 ? "#f59e0b" : "#9ca3af" }}>
                      {fmtM(r.ttm_buyback_m)}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                      {r.leverage != null ? `${r.leverage.toFixed(2)}x` : "—"}
                    </td>
                    <td className="px-2.5 py-2 text-right">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold tabular-nums"
                        style={{ background: `${tier.color}1a`, color: tier.color, border: `1px solid ${tier.color}44` }}>
                        {r.score.toFixed(0)} {tier.label}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-semibold"
                      style={{ color: (r.est_q1_m ?? 0) >= 1 ? "#e5e7eb" : "#5b5b78" }}
                      title={r.est_q1_obs_w
                        ? `${r.est_q1_obs_w.toFixed(0)}% of this estimate comes from share growth already reported this quarter`
                        : "Modelled from premium regime and trailing issuance"}>
                      {r.est_q1_m == null ? "—" : fmtM(r.est_q1_m)}
                      {!!r.est_q1_obs_w && (
                        <span className="ml-1 text-[9px] align-super" style={{ color: "#22c55e" }}>◆</span>
                      )}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-semibold"
                      style={{ color: (r.est_q2_m ?? 0) >= 1 ? "#e5e7eb" : "#5b5b78" }}>
                      {r.est_q2_m == null ? "—" : fmtM(r.est_q2_m)}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular-nums font-semibold"
                      style={{ color: r.est_12m_m >= 1 ? "#e5e7eb" : "#5b5b78" }}>
                      {fmtM(r.est_12m_m)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
          Top 20 of {issuerModel.length} shown, ranked by score. TTM issued prefers cash
          proceeds from common-stock issuance; where a filer only tags the equity
          roll-forward, that value is used instead. These are scenarios, not guidance.
          The quarterly model is chosen by walk-forward backtest over 248 BDC-quarters
          rather than by assumption: median error 67bps of net assets against 91bps for
          carrying last quarter forward and 149bps for a trailing-4-quarter average, and
          mean dollar error ~$30M against ~$36M. It buys that by being right about the
          large misses — per-quarter it is closer than last-quarter-carried-forward only
          about 4 times in 10, so read it as an expected level, not a point forecast.
        </p>
      </section>

      {/* Methodology note */}
      <section className="mb-4 rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="text-sm font-semibold text-white mb-2">How this is built</h2>
        <p className="text-xs max-w-4xl" style={{ color: "#8b8ba8" }}>
          NAV per share, net assets, share counts and issuance flows come from each BDC&apos;s
          SEC XBRL filings (10-Q/10-K only — proxy statements tag hypothetical NAVs and are
          excluded). Old fiscal years without original XBRL are recovered from
          Financial-Highlights tables in later filings and dated with a standard filing lag.
          Daily closes are split-restated but not dividend-adjusted; as-reported NAVs around
          reverse splits (FSK, MFIC, GLAD&apos;s forward split) are restated onto the same share
          basis automatically. The P/NAV series is point-in-time — each day divides by the
          last NAV actually on file that day, and a NAV more than ~14 months stale ends the
          series. Universe: every BDC with a current NYSE/Nasdaq listing, BDC-style
          financials and at least $200M of net assets ({pnavSnapshots.length} today) —
          sub-$200M microcaps, non-traded BDCs, venture-equity vehicles and names that
          converted away from the BDC structure are excluded. Where a BDC has filed its
          latest 10-Q but SEC&apos;s aggregated XBRL feed hasn&apos;t ingested it yet, NAV is read
          directly from the filing document.
        </p>
      </section>
    </div>
  );
}
