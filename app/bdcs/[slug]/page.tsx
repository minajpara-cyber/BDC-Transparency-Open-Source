import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Building2 } from "lucide-react";
import AlertBadge from "@/components/AlertBadge";
import StatCard from "@/components/StatCard";
import AssetCompositionChart from "@/components/AssetCompositionChart";
import SeverityStackedBars from "@/components/SeverityStackedBars";
import ComparisonChart, { ComparisonPoint } from "@/components/ComparisonChart";
import BDCTimelineChart from "@/components/BDCTimelineChart";
import BDCHoldingsTable from "@/components/BDCHoldingsTable";
import { bdcs } from "@/data/bdcs";
import { bdcsHistory } from "@/data/bdcs_history";
import { ewsByBdc, ewsTopByBdc, ewsMeta, ewsHistory } from "@/data/early_warning_scores";
import EwsTrendChart from "@/components/EwsTrendChart";
import { creditQuality } from "@/data/credit_quality";
import { modificationRate } from "@/data/modification_rate";
import { pikModifications } from "@/data/pik_modifications";
import { assetComposition } from "@/data/asset_composition";
import { spreadAnalysis } from "@/data/spread_analysis";
import { vintageRows } from "@/data/vintage_analysis";
import { bdcSponsorExposure } from "@/data/bdc_sponsor_exposure";
import { bdcSectorExposure } from "@/data/bdc_sector_exposure";
import { maturityByBdc, maturityMeta } from "@/data/maturity";
import MaturityWallChart from "@/components/MaturityWallChart";
import BDCVintageMix, { type VintageMixRow } from "@/components/BDCVintageMix";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return bdcs.map((b) => ({ slug: b.slug }));
}

export default async function BDCDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const bdc = bdcs.find((b) => b.slug === slug);
  if (!bdc) notFound();

  const softwareRisk = bdc.softwareExposure >= 50 ? "Critical" : bdc.softwareExposure >= 25 ? "High" : bdc.softwareExposure >= 15 ? "Medium" : "Low";

  const hasTimeline = bdcsHistory.some((r) => r.ticker === bdc.ticker);

  // Timeline data (for the "Through Time" section at the bottom of this page).
  const timelineRows = bdcsHistory
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const timelineMods = pikModifications
    .filter((m) => m.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const tlEarliest = timelineRows[0];
  const tlLatest   = timelineRows[timelineRows.length - 1];
  const tlFvChangeB    = tlLatest && tlEarliest ? tlLatest.total_fv_b - tlEarliest.total_fv_b : 0;
  const tlPositionChg  = tlLatest && tlEarliest ? tlLatest.n_positions  - tlEarliest.n_positions : 0;
  const tlQuarters     = timelineRows.length;

  // ---- Build per-BDC credit slices from our parsed data ---------------------
  const cqRows = creditQuality
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const cqLatest = cqRows[cqRows.length - 1];
  const cqPrior  = cqRows[cqRows.length - 2];
  const hasCredit = !!cqLatest;

  const acRows = assetComposition
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const acLatest = acRows[acRows.length - 1];

  const spRows = spreadAnalysis
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const spLatest = spRows[spRows.length - 1];
  const spPrior  = spRows[spRows.length - 2];

  const modRows = pikModifications
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const modRateRows = modificationRate
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));

  // -------- Industry comparison series ---------------------------------------
  // Per-metric coverage caveats — match the structure on /credit so reliable
  // pre-XBRL data (FSK mark back to 2013, OBDC mark + NA back to 2016, MFIC
  // mark-based metrics) feeds into the industry comparison curves.
  type MetricFamily = "mark" | "na" | "pik";
  const ALL_FAMILIES: MetricFamily[] = ["mark", "na", "pik"];
  const COVERAGE_CAVEATS: Array<{ ticker: string; until: string; metrics: MetricFamily[] }> = [
    { ticker: "CCAP", until: "2022-02-28", metrics: ALL_FAMILIES },
    { ticker: "OCSL", until: "2022-12-31", metrics: ALL_FAMILIES },
    { ticker: "FSK",  until: "2021-09-30", metrics: ["na", "pik"] },
    { ticker: "OBDC", until: "2022-03-31", metrics: ["pik"] },
    { ticker: "MFIC", until: "2025-11-30", metrics: ["na", "pik"] },
  ];
  const isReliable = (t: string, p: string, family: MetricFamily) =>
    !COVERAGE_CAVEATS.some(
      (c) => c.ticker === t && p <= c.until && c.metrics.includes(family),
    );

  type CQField =
    | "pct_non_accrual"
    | "pct_pik_total"
    | "pct_below_95"
    | "pct_below_90";
  function familyOfCQ(f: CQField): MetricFamily {
    if (f === "pct_non_accrual") return "na";
    if (f === "pct_pik_total")   return "pik";
    return "mark";
  }
  // Industry weighted-avg series for credit-quality metrics (position-weighted).
  function buildIndustryCQ(field: CQField) {
    const family = familyOfCQ(field);
    const m = new Map<string, { sumW: number; sumWV: number }>();
    for (const r of creditQuality) {
      if (!isReliable(r.ticker, r.period_end, family)) continue;
      const w = r.n_positions;
      if (!w) continue;
      const slot = m.get(r.period_end) ?? { sumW: 0, sumWV: 0 };
      slot.sumW += w;
      slot.sumWV += w * r[field];
      m.set(r.period_end, slot);
    }
    return new Map(
      Array.from(m.entries()).map(([k, s]) => [k, s.sumW ? s.sumWV / s.sumW : 0]),
    );
  }
  // Industry weighted-avg spread (weighted by parsed-position count).
  function buildIndustrySpread(field: "avg_spread_book_bps" | "avg_spread_new_bps",
                                wField: "n_positions_priced" | "n_new") {
    const m = new Map<string, { num: number; den: number }>();
    for (const r of spreadAnalysis) {
      if (!isReliable(r.ticker, r.period_end, "mark")) continue;
      const v = r[field];
      const w = r[wField];
      if (v === null || v === undefined || !w) continue;
      const slot = m.get(r.period_end) ?? { num: 0, den: 0 };
      slot.num += (v as number) * w;
      slot.den += w;
      m.set(r.period_end, slot);
    }
    return new Map(
      Array.from(m.entries()).map(([k, s]) => [k, s.den ? s.num / s.den : 0]),
    );
  }
  // Industry cash→PIK modification rate (cost-weighted).
  function buildIndustryModRate() {
    const m = new Map<string, { num: number; den: number }>();
    for (const r of modificationRate) {
      if (!isReliable(r.ticker, r.period_end, "pik")) continue;
      const slot = m.get(r.period_end) ?? { num: 0, den: 0 };
      slot.num += r.new_mods_cost;
      slot.den += r.total_cost;
      m.set(r.period_end, slot);
    }
    return new Map(
      Array.from(m.entries()).map(([k, s]) => [k, s.den ? (100 * s.num) / s.den : 0]),
    );
  }

  const naIndustry  = buildIndustryCQ("pct_non_accrual");
  const pikIndustry = buildIndustryCQ("pct_pik_total");
  const mkIndustry  = buildIndustryCQ("pct_below_95");
  const lt90Industry = buildIndustryCQ("pct_below_90");
  const bookSpInd   = buildIndustrySpread("avg_spread_book_bps", "n_positions_priced");
  const newSpInd    = buildIndustrySpread("avg_spread_new_bps", "n_new");
  const modRateInd  = buildIndustryModRate();

  // Build BDC + industry overlay series.
  const cmpFromCQ = (field: CQField,
                    industry: Map<string, number>): ComparisonPoint[] =>
    cqRows.map((r) => ({
      period_end: r.period_end,
      bdc: r[field],
      industry: industry.get(r.period_end) ?? null,
    }));
  const cmpFromSpread = (field: "avg_spread_book_bps" | "avg_spread_new_bps",
                         industry: Map<string, number>): ComparisonPoint[] =>
    spRows
      .filter((r) => r[field] !== null && r[field] !== undefined)
      .map((r) => ({
        period_end: r.period_end,
        bdc: r[field] as number,
        industry: industry.get(r.period_end) ?? null,
      }));

  const naCmp        = cmpFromCQ("pct_non_accrual", naIndustry);
  const pikCmp       = cmpFromCQ("pct_pik_total",   pikIndustry);
  const lt95Cmp      = cmpFromCQ("pct_below_95",    mkIndustry);
  const lt90Cmp      = cmpFromCQ("pct_below_90",    lt90Industry);
  const bookSpCmp    = cmpFromSpread("avg_spread_book_bps", bookSpInd);
  const newSpCmp     = cmpFromSpread("avg_spread_new_bps",  newSpInd);
  const modRateCmp   = modRateRows.map((r) => ({
    period_end: r.period_end,
    bdc: r.pct_new_cost,
    industry: modRateInd.get(r.period_end) ?? null,
  })) as ComparisonPoint[];

  // Composition stacked-area data (collapse "other" buckets)
  const compositionLine = acRows.map((r) => ({
    period_end: r.period_end,
    pct_first_lien:  r.pct_first_lien,
    pct_second_lien: r.pct_second_lien,
    pct_unsecured:   r.pct_unsecured,
    pct_subordinated: r.pct_subordinated,
    pct_structured_jv: r.pct_structured_jv,
    pct_equity:      r.pct_equity,
    pct_other:       r.pct_other_secured + r.pct_abf + r.pct_cash + r.pct_other + r.pct_unclassified,
  }));

  // Severity stacked bars: per-quarter cost-weighted percent (latest 12 quarters).
  const sevSeries = modRows.slice(-12).map((r) => ({
    period_end: r.period_end,
    minimal: r.pct_new_minimal_cost,
    moderate: r.pct_new_moderate_cost,
    severe: r.pct_new_severe_cost,
  }));

  // Helpers
  const fmtDelta = (curr?: number, prev?: number, decimals = 2) => {
    if (curr === undefined || prev === undefined || prev === null) return undefined;
    const d = curr - prev;
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d.toFixed(decimals)} pp Q/Q`;
  };
  const fmtDeltaBps = (curr?: number | null, prev?: number | null) => {
    if (curr === null || curr === undefined || prev === null || prev === undefined) return undefined;
    const d = curr - prev;
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d} bps Q/Q`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <Link href="/bdcs" className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors" style={{ color: "#8b8ba8" }}>
        <ArrowLeft size={14} /> Back to BDCs
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="px-2.5 py-1 rounded text-sm font-mono font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
              {bdc.ticker}
            </span>
            <span className="text-xs px-2 py-1 rounded border" style={{
              color: bdc.type === "Non-Traded" ? "#eab308" : "#22c55e",
              background: bdc.type === "Non-Traded" ? "rgba(234,179,8,0.1)" : "rgba(34,197,94,0.1)",
              borderColor: bdc.type === "Non-Traded" ? "rgba(234,179,8,0.2)" : "rgba(34,197,94,0.2)",
            }}>
              {bdc.type} BDC
            </span>
            <AlertBadge severity={softwareRisk as "Critical" | "High" | "Medium" | "Low"} label />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{bdc.name}</h1>
          <p className="text-sm" style={{ color: "#9ca3af" }}>Managed by {bdc.manager}</p>
        </div>
        {bdc.type === "Traded" && bdc.price && (
          <div className="rounded-xl border p-4 text-right" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Share Price</div>
            <div className="text-2xl font-bold text-white">${bdc.price.toFixed(2)}</div>
            <div className="text-xs mt-1" style={{ color: bdc.priceToNav && bdc.priceToNav >= 1 ? "#22c55e" : "#f97316" }}>
              {bdc.priceToNav && bdc.priceToNav >= 1 ? "+" : ""}{((bdc.priceToNav ?? 1) - 1) * 100 > 0 ? "+" : ""}{(((bdc.priceToNav ?? 1) - 1) * 100).toFixed(1)}% to NAV
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="rounded-xl border p-5 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <p className="text-sm leading-relaxed" style={{ color: "#d1d5db" }}>{bdc.description}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {bdc.topSectors.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded text-xs border" style={{ background: "rgba(99,102,241,0.08)", borderColor: "#2d2d50", color: "#a5b4fc" }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Investment Strategy Details */}
      <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-4">Investment Profile</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: "Manager", value: bdc.manager },
            { label: "Structure", value: `${bdc.type} BDC` },
            { label: "Focus", value: bdc.focus },
            { label: "Primary Loan Type", value: bdc.loanType },
            ...(bdc.aum ? [{ label: "Manager AUM", value: `$${bdc.aum}B` }] : []),
            ...(bdc.founded ? [{ label: "Founded", value: String(bdc.founded) }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>{label}</div>
              <div style={{ color: "#d1d5db" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>


      {/* Credit analysis (parsed SOI data) */}
      {hasCredit && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h2 className="text-lg font-semibold text-white">Credit analysis</h2>
            <span className="text-xs px-2 py-0.5 rounded border" style={{
              color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
            }}>
              Latest: {cqLatest.period_end}
            </span>
            <Link href="/credit" className="text-xs hover:text-white transition-colors" style={{ color: "#8b8ba8" }}>
              See cross-BDC view on /credit →
            </Link>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard
              label="Non-accrual % (cost)"
              value={`${cqLatest.pct_non_accrual.toFixed(2)}%`}
              color={cqLatest.pct_non_accrual >= 3 ? "#ef4444" : cqLatest.pct_non_accrual >= 1 ? "#eab308" : "#22c55e"}
              trend={cqPrior && cqLatest.pct_non_accrual > cqPrior.pct_non_accrual ? "up" : cqPrior && cqLatest.pct_non_accrual < cqPrior.pct_non_accrual ? "down" : undefined}
              trendLabel={cqPrior ? fmtDelta(cqLatest.pct_non_accrual, cqPrior.pct_non_accrual) : undefined}
            />
            <StatCard
              label="PIK % (cost)"
              value={`${cqLatest.pct_pik_total.toFixed(2)}%`}
              color={cqLatest.pct_pik_total >= 15 ? "#f97316" : cqLatest.pct_pik_total >= 5 ? "#eab308" : "#9ca3af"}
              trend={cqPrior && cqLatest.pct_pik_total > cqPrior.pct_pik_total ? "up" : cqPrior && cqLatest.pct_pik_total < cqPrior.pct_pik_total ? "down" : undefined}
              trendLabel={cqPrior ? fmtDelta(cqLatest.pct_pik_total, cqPrior.pct_pik_total) : undefined}
            />
            <StatCard
              label="% below 95¢ of par"
              value={`${cqLatest.pct_below_95.toFixed(1)}%`}
              color={cqLatest.pct_below_95 >= 15 ? "#ef4444" : cqLatest.pct_below_95 >= 5 ? "#eab308" : "#9ca3af"}
              trend={cqPrior && cqLatest.pct_below_95 > cqPrior.pct_below_95 ? "up" : cqPrior && cqLatest.pct_below_95 < cqPrior.pct_below_95 ? "down" : undefined}
              trendLabel={cqPrior ? fmtDelta(cqLatest.pct_below_95, cqPrior.pct_below_95, 1) : undefined}
            />
            {spLatest?.avg_spread_book_bps !== undefined && spLatest.avg_spread_book_bps !== null && (
              <StatCard
                label="Book spread"
                value={`${spLatest.avg_spread_book_bps} bps`}
                color="#22c55e"
                trend={spPrior?.avg_spread_book_bps !== undefined && spPrior.avg_spread_book_bps !== null
                  && (spLatest.avg_spread_book_bps > spPrior.avg_spread_book_bps ? "up" : spLatest.avg_spread_book_bps < spPrior.avg_spread_book_bps ? "down" : undefined) || undefined}
                trendLabel={spPrior ? fmtDeltaBps(spLatest.avg_spread_book_bps, spPrior.avg_spread_book_bps) : undefined}
              />
            )}
            {spLatest?.avg_spread_new_bps !== undefined && spLatest.avg_spread_new_bps !== null && (
              <StatCard
                label="New-loan spread"
                value={`${spLatest.avg_spread_new_bps} bps`}
                color="#a855f7"
                sub={spLatest.n_new ? `${spLatest.n_new} new loans` : undefined}
              />
            )}
            {acLatest && (
              <StatCard
                label="% first lien"
                value={`${acLatest.pct_first_lien.toFixed(1)}%`}
                color={acLatest.pct_first_lien >= 80 ? "#22c55e" : acLatest.pct_first_lien >= 60 ? "#eab308" : "#f97316"}
                sub={`${acLatest.pct_equity.toFixed(1)}% equity`}
              />
            )}
          </div>

          {/* Trajectory charts: BDC + industry overlay */}
          <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
            Solid line = <span style={{ color: "#a5b4fc" }}>{bdc.ticker}</span>. Dashed gray line = industry weighted average across reliable BDCs.
          </p>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="text-sm font-semibold text-white mb-1">Non-accrual % vs industry</div>
              <ComparisonChart data={naCmp} yLabel="% NA at cost" unit="%" bdcLabel={bdc.ticker} bdcColor="#ef4444" />
            </div>
            <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="text-sm font-semibold text-white mb-1">PIK % vs industry</div>
              <ComparisonChart data={pikCmp} yLabel="% PIK at cost" unit="%" bdcLabel={bdc.ticker} bdcColor="#f97316" />
            </div>
            <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="text-sm font-semibold text-white mb-1">Marks below 95¢ vs industry</div>
              <ComparisonChart data={lt95Cmp} yLabel="% below 95¢" unit="%" bdcLabel={bdc.ticker} bdcColor="#dc2626" />
            </div>
            <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="text-sm font-semibold text-white mb-1">Marks below 90¢ vs industry</div>
              <p className="text-xs mb-2" style={{ color: "#8b8ba8" }}>Deeper distress bucket — loans the BDC has written below 90¢ of par.</p>
              <ComparisonChart data={lt90Cmp} yLabel="% below 90¢" unit="%" bdcLabel={bdc.ticker} bdcColor="#b91c1c" />
            </div>
            {modRateCmp.length > 0 && (
              <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
                <div className="text-sm font-semibold text-white mb-1">Cash → PIK modification rate vs industry</div>
                <p className="text-xs mb-2" style={{ color: "#8b8ba8" }}>% of eligible-loan cost that flipped from cash-pay to PIK this quarter.</p>
                <ComparisonChart data={modRateCmp} yLabel="% modified (cost)" unit="%" bdcLabel={bdc.ticker} bdcColor="#a855f7" />
              </div>
            )}
            {bookSpCmp.length > 0 && (
              <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
                <div className="text-sm font-semibold text-white mb-1">Book spread (bps) vs industry</div>
                <ComparisonChart data={bookSpCmp} yLabel="Book spread (bps)" unit=" bps" bdcLabel={bdc.ticker} bdcColor="#22c55e" />
              </div>
            )}
            {newSpCmp.length > 0 && (
              <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
                <div className="text-sm font-semibold text-white mb-1">New-loan spread (bps) vs industry</div>
                <ComparisonChart data={newSpCmp} yLabel="New-loan spread (bps)" unit=" bps" bdcLabel={bdc.ticker} bdcColor="#a855f7" />
              </div>
            )}
          </div>

          {/* Two-up: asset composition + modifications by severity */}
          {(compositionLine.length > 0 || sevSeries.length > 0) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
              {compositionLine.length > 0 && (
                <AssetCompositionChart
                  data={compositionLine}
                  title="Asset composition over time"
                  subtitle="% of cost in each asset class, stacked to 100% per quarter."
                />
              )}
              {sevSeries.length > 0 && (
                <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
                  <div className="text-sm font-semibold text-white mb-1">Modifications by severity (last 12 quarters)</div>
                  <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
                    Cost of new cash → PIK flips each quarter as % of eligible-loan cost, bucketed by PIK severity.
                  </p>
                  <SeverityStackedBars data={sevSeries} yLabel="% of eligible cost" unit="%" />
                </div>
              )}
            </div>
          )}

          {/* Recent quarters table */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
              <h3 className="font-semibold text-white text-sm">Recent quarters — credit snapshot</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                  <tr>
                    {["Quarter", "Positions", "NA %", "PIK %", "Below 95¢", "Below 90¢", "Book bps", "New bps", "% 1st lien"].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap" style={{ color: "#8b8ba8" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...cqRows].reverse().slice(0, 12).map((r, i) => {
                    const sp = spRows.find((x) => x.period_end === r.period_end);
                    const ac = acRows.find((x) => x.period_end === r.period_end);
                    return (
                      <tr
                        key={r.period_end}
                        className="border-t"
                        style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-white">{r.period_end}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#d1d5db" }}>{r.n_positions.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: r.pct_non_accrual >= 3 ? "#ef4444" : r.pct_non_accrual >= 1 ? "#eab308" : "#9ca3af" }}>
                          {r.pct_non_accrual.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: r.pct_pik_total >= 15 ? "#f97316" : r.pct_pik_total >= 5 ? "#eab308" : "#9ca3af" }}>
                          {r.pct_pik_total.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: r.pct_below_95 >= 15 ? "#ef4444" : "#9ca3af" }}>
                          {r.pct_below_95.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: r.pct_below_90 >= 10 ? "#ef4444" : "#9ca3af" }}>
                          {r.pct_below_90.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#22c55e" }}>
                          {sp?.avg_spread_book_bps ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#a855f7" }}>
                          {sp?.avg_spread_new_bps ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#9ca3af" }}>
                          {ac ? `${ac.pct_first_lien.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Forward queue — validated 2Q early-warning score, this BDC vs industry,
          plus its top queued (pre-non-accrual) positions. Companion to the
          cash→PIK modification view on /credit. */}
      {(() => {
        const mine = ewsByBdc.find((r) => r.ticker === bdc.ticker);
        if (!mine) return null;
        const ind = ewsByBdc.find((r) => r.ticker === "industry");
        const peers = ewsByBdc.filter((r) => r.ticker !== "industry");
        const rank = peers.findIndex((r) => r.ticker === bdc.ticker) + 1;
        const queue = ewsTopByBdc.filter((r) => r.ticker === bdc.ticker);
        const vsInd = ind ? mine.implied_na_2q_pct / Math.max(ind.implied_na_2q_pct, 0.0001) : null;
        const tone = vsInd == null ? "#9ca3af" : vsInd >= 1.25 ? "#ef4444" : vsInd >= 1 ? "#f59e0b" : "#22c55e";
        return (
          <div className="rounded-xl border p-5 mb-8" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div>
                <h2 className="font-semibold text-white">
                  Forward queue: implied non-accrual formation{" "}
                  <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
                    next 2 quarters · as of {ewsMeta.as_of}
                  </span>
                </h2>
                <p className="text-xs mt-1 max-w-3xl" style={{ color: "#8b8ba8" }}>
                  Every pre-non-accrual loan scored on out-of-sample-validated signals, converted to
                  expected NA formation via measured bucket hit rates — the forward companion to the
                  cash→PIK modification view.{" "}
                  <Link href="/credit#forward-queue" className="text-indigo-400 hover:text-indigo-300">
                    All BDCs ranked →
                  </Link>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
              <div>
                <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Implied NA formation</div>
                <div className="text-xl font-bold" style={{ color: tone }}>
                  {mine.implied_na_2q_pct.toFixed(2)}%
                </div>
                <div className="text-xs" style={{ color: "#6b7280" }}>
                  of eligible book{ind ? ` · industry ${ind.implied_na_2q_pct.toFixed(2)}%` : ""}
                </div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Implied dollars</div>
                <div className="text-xl font-bold text-white">${mine.implied_na_2q_m.toFixed(0)}M</div>
                <div className="text-xs" style={{ color: "#6b7280" }}>over ~2 quarters</div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>High-score positions</div>
                <div className="text-xl font-bold text-white">{mine.n_hi}</div>
                <div className="text-xs" style={{ color: "#6b7280" }}>{mine.pct_book_hi.toFixed(1)}% of book at score ≥5</div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Rank among 19 BDCs</div>
                <div className="text-xl font-bold text-white">#{rank}</div>
                <div className="text-xs" style={{ color: "#6b7280" }}>#1 = most queued risk</div>
              </div>
            </div>
            {(() => {
              const mineH = ewsHistory.filter((r) => r.ticker === bdc.ticker);
              if (mineH.length < 4) return null;
              const indH = new Map(
                ewsHistory.filter((r) => r.ticker === "industry")
                  .map((r) => [r.period_end, r.implied_na_2q_pct]),
              );
              const trend = mineH.map((r) => ({
                period_end: r.period_end,
                bdc: r.implied_na_2q_pct,
                industry: indH.get(r.period_end) ?? null,
              }));
              return (
                <div className="mb-4">
                  <EwsTrendChart data={trend} ticker={bdc.ticker} />
                  <p className="text-xs mt-1" style={{ color: "#6b6b88" }}>
                    Today&apos;s fitted signal points applied across history (trend view; thin-coverage
                    quarters dropped). The out-of-sample validation applies to the score levels — the
                    early history is in-sample by construction.
                  </p>
                </div>
              );
            })()}
            {queue.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                    <tr>
                      {["Borrower", "Score", "Fired signals", "FV", "Mark"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((r, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                        <td className="px-3 py-2" style={{ color: "#d1d5db" }}>{r.borrower}</td>
                        <td className="px-3 py-2 font-bold" style={{ color: r.score >= 5 ? "#ef4444" : r.score >= 3 ? "#f97316" : "#eab308" }}>{r.score}</td>
                        <td className="px-3 py-2">
                          {r.signals.map((s) => (
                            <span key={s} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded text-xs"
                              style={{ background: "rgba(239,68,68,0.10)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
                              {s.replace(/_/g, " ")}
                            </span>
                          ))}
                        </td>
                        <td className="px-3 py-2" style={{ color: "#9ca3af" }}>${r.fv_m.toFixed(0)}M</td>
                        <td className="px-3 py-2 font-mono" style={{ color: "#9ca3af" }}>{r.mark == null ? "—" : `${Math.round(100 * r.mark)}¢`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
                  Top {queue.length} queued positions (score ≥2, not yet on non-accrual).{" "}
                  <Link href="/watchlist" className="text-indigo-400 hover:text-indigo-300">Full watchlist →</Link>
                </p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "#6b7280" }}>
                No positions currently score ≥2 — the cleanest possible queue this quarter.
              </p>
            )}
          </div>
        );
      })()}

      {/* Debt maturity profile */}
      {(() => {
        const order = ["<=2025", "2026", "2027", "2028", "2029", "2030", "2031", "2032", "2033+"];
        const mine = maturityByBdc.filter((r) => r.ticker === bdc.ticker);
        if (mine.length === 0) return null;
        const asOfYear = parseInt(maturityMeta.as_of.slice(0, 4), 10);
        const byB = new Map(mine.map((r) => [r.bucket, r]));
        const data = order.filter((b) => byB.has(b)).map((b) => byB.get(b)!);
        const totalCost = mine.reduce((s, r) => s + r.cost_m, 0);
        const near = mine.filter((r) => r.bucket === String(asOfYear) || r.bucket === String(asOfYear + 1))
          .reduce((s, r) => s + r.cost_m, 0);
        const nearPct = totalCost ? (near / totalCost) * 100 : 0;
        const fmtB = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${m.toFixed(0)}M`);
        return (
          <section className="mb-6">
            <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: "#1e1e2e" }}>
                <div>
                  <h2 className="text-lg font-semibold text-white">Portfolio maturity profile</h2>
                  <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
                    When the loans this BDC holds come due — its debt investments at amortized cost, by year the borrower
                    repays. Equity / structured positions (no fixed maturity) excluded.
                  </p>
                </div>
                <Link href="/maturity" className="text-xs hover:text-white" style={{ color: "#a5b4fc" }}>
                  Compare across BDCs →
                </Link>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-6 mb-4">
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: "#8b8ba8" }}>Loan book (dated)</div>
                    <div className="text-xl font-bold text-white tabular-nums">{fmtB(totalCost)}</div>
                  </div>
                  <div>
                    <div className="text-xs mb-0.5" style={{ color: "#8b8ba8" }}>Loans maturing {asOfYear}–{asOfYear + 1}</div>
                    <div className="text-xl font-bold tabular-nums" style={{ color: nearPct >= 18 ? "#f59e0b" : "#fafafa" }}>
                      {fmtB(near)} <span className="text-sm font-medium" style={{ color: "#8b8ba8" }}>· {nearPct.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <MaturityWallChart data={data} metric="cost_m" asOfYear={asOfYear} height={260} />
              </div>
            </div>
          </section>
        );
      })()}

      {/* Through Time — portfolio size + modifications flow + quarterly snapshot table */}
      {hasTimeline && tlLatest && tlEarliest && (
        <section className="mt-8">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h2 className="text-lg font-semibold text-white">{bdc.ticker} through time</h2>
            <span className="text-xs px-2 py-0.5 rounded border" style={{
              color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
            }}>
              {tlQuarters}Q · {tlEarliest.period_end.slice(0, 7)} → {tlLatest.period_end.slice(0, 7)}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard
              label="Coverage"
              value={`${tlQuarters}Q`}
              sub={`${tlEarliest.period_end.slice(0, 7)} → ${tlLatest.period_end.slice(0, 7)}`}
            />
            <StatCard
              label="Latest portfolio"
              value={`$${tlLatest.total_fv_b.toFixed(1)}B`}
              sub={`${tlLatest.n_positions.toLocaleString()} positions`}
            />
            <StatCard
              label="FV change since start"
              value={`${tlFvChangeB >= 0 ? "+" : ""}$${tlFvChangeB.toFixed(1)}B`}
              color={tlFvChangeB >= 0 ? "#22c55e" : "#ef4444"}
              trend={tlFvChangeB >= 0 ? "up" : "down"}
              trendLabel={tlEarliest.total_fv_b ? `${((tlFvChangeB / tlEarliest.total_fv_b) * 100).toFixed(0)}%` : undefined}
            />
            <StatCard
              label="Position change"
              value={`${tlPositionChg >= 0 ? "+" : ""}${tlPositionChg.toLocaleString()}`}
              color={tlPositionChg >= 0 ? "#22c55e" : "#ef4444"}
              sub={`${tlEarliest.n_positions} → ${tlLatest.n_positions}`}
            />
          </div>

          <BDCTimelineChart rows={timelineRows} modRows={timelineMods} ticker={bdc.ticker} hideCreditPanel />

          {/* Snapshot table */}
          <div
            className="rounded-xl border overflow-hidden mt-4"
            style={{ background: "#111118", borderColor: "#1e1e2e" }}
          >
            <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
              <h3 className="font-semibold text-white text-sm">Quarterly snapshots</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                  <tr>
                    {["Period end", "Positions", "Cost ($B)", "Fair value ($B)", "FV / Cost", "NA % (cost)", "PIK % (cost)"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap"
                        style={{ color: "#8b8ba8" }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...timelineRows].reverse().map((r, i) => {
                    const ratio = r.total_cost_b ? r.total_fv_b / r.total_cost_b : 0;
                    const ratioColor = ratio >= 1 ? "#22c55e" : ratio >= 0.97 ? "#eab308" : "#ef4444";
                    return (
                      <tr
                        key={r.period_end}
                        className="border-t"
                        style={{
                          borderColor: "#1a1a28",
                          background: i % 2 === 0 ? "#111118" : "#0f0f16",
                        }}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-white">{r.period_end}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#d1d5db" }}>
                          {r.n_positions.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#d1d5db" }}>
                          ${r.total_cost_b.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#d1d5db" }}>
                          ${r.total_fv_b.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: ratioColor }}>
                          {(ratio * 100).toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{
                          color: r.na_pct_at_cost >= 3 ? "#ef4444" : r.na_pct_at_cost >= 1 ? "#eab308" : "#9ca3af",
                        }}>
                          {r.na_pct_at_cost > 0 ? `${r.na_pct_at_cost.toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{
                          color: r.pik_pct_at_cost >= 15 ? "#f97316" : r.pik_pct_at_cost >= 5 ? "#eab308" : "#9ca3af",
                        }}>
                          {r.pik_pct_at_cost > 0 ? `${r.pik_pct_at_cost.toFixed(2)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Vintage mix & non-accrual performance — how much of the current book sits
          in each origination vintage, and how each vintage has aged on a non-accrual
          basis. Anchored to each cohort's latest observation; partials under-count. */}
      {(() => {
        const mine = vintageRows.filter((r) => r.ticker === bdc.ticker);
        if (mine.length === 0) return null;
        // Latest observation (max age) per vintage = the most current snapshot of
        // that cohort. Older-than-7yr cohorts are capped at their 7-year mark.
        const latest = new Map<number, (typeof mine)[number]>();
        for (const r of mine) {
          const prev = latest.get(r.vintage_year);
          if (!prev || r.age_quarters > prev.age_quarters) latest.set(r.vintage_year, r);
        }
        const picked = Array.from(latest.values());
        const totalAlive = picked.reduce((s, r) => s + r.alive_cost_b, 0);
        if (totalAlive <= 0) return null;
        // Industry baseline at the SAME (vintage, age) for an apples-to-apples delta.
        const indAt = (vy: number, ageQ: number) =>
          vintageRows.find((i) => i.ticker === "industry" && i.vintage_year === vy && i.age_quarters === ageQ);
        const mixRows: VintageMixRow[] = picked
          .filter((r) => r.alive_cost_b > 0)
          .map((r) => {
            const ind = indAt(r.vintage_year, r.age_quarters);
            return {
              vintage_year: r.vintage_year,
              pct_of_book: (100 * r.alive_cost_b) / totalAlive,
              alive_cost_b: r.alive_cost_b,
              entry_cost_b: r.cohort_entry_cost_b,
              age_years: r.age_years,
              n_loans: r.n_loans_cohort,
              pct_ever_na: r.pct_ever_na,
              pct_ever_default: r.pct_ever_default,
              ind_ever_na: ind ? ind.pct_ever_na : null,
              ind_ever_default: ind ? ind.pct_ever_default : null,
              is_partial: r.is_partial,
              period_end: r.period_end,
            };
          });
        if (mixRows.length === 0) return null;
        const asOf = picked.reduce((a, r) => (r.period_end > a ? r.period_end : a), "");
        return <BDCVintageMix ticker={bdc.ticker} asOf={asOf} rows={mixRows} />;
      })()}

      {/* Vintage Performance — this BDC's per-vintage curves vs the industry average */}
      {(() => {
        const bdcVintage = vintageRows.filter((r) => r.ticker === bdc.ticker && !r.is_partial);
        const industryVintage = vintageRows.filter((r) => r.ticker === "industry" && !r.is_partial);
        if (bdcVintage.length === 0) return null;

        // Pick the cumulative ever-NA % at each of years 1..5 per vintage, for
        // both this BDC and the industry baseline. "−" if the vintage hasn't aged that far.
        const vintageYears = Array.from(new Set(bdcVintage.map((r) => r.vintage_year))).sort();
        const ageYears = [1, 2, 3, 4, 5];

        // Prefer HC-restricted metric (HIGH+MED confidence vintage assignments
        // only — per the acq_date methodology investigation, disclosed
        // acquisition_date drifts forward for ~88% of amended loans, making
        // "any disclosure" a poor confidence signal). Falls back to all-loans
        // metric when the HC subset is too small for that cohort (<5 HC loans).
        const pickMetric = (
          rows: typeof bdcVintage,
          vy: number,
          age: number,
          metric: "pct_ever_default" | "pct_ever_modified" | "pct_ever_na" | "pct_ever_b80" | "pct_b90_alive",
        ): { value: number | null; restricted: boolean } => {
          const r = rows.find((x) => x.vintage_year === vy && x.age_quarters === age * 4);
          if (!r) return { value: null, restricted: false };
          const hcKey: Partial<Record<string, keyof typeof r>> = {
            pct_ever_default: "pct_ever_default_hc",
            pct_ever_modified: "pct_ever_modified_hc",
          };
          const hk = hcKey[metric];
          if (hk && r[hk] != null) {
            return { value: r[hk] as number, restricted: true };
          }
          return { value: r[metric] as number, restricted: false };
        };

        const deltaCell = (
          bdc: { value: number | null; restricted: boolean },
          ind: { value: number | null; restricted: boolean },
        ) => {
          if (bdc.value === null || ind.value === null) {
            return <td className="px-3 py-2 text-xs" style={{ color: "#444" }}>—</td>;
          }
          const diff = bdc.value - ind.value;
          const color = diff > 0.25 ? "#ef4444" : diff < -0.25 ? "#22c55e" : "#9ca3af";
          const arrow = diff > 0.25 ? "↑" : diff < -0.25 ? "↓" : "≈";
          return (
            <td className="px-3 py-2" title={bdc.restricted ? "HC-restricted (HIGH+MED tier loans only)" : "All loans"}>
              <div className="text-sm font-semibold flex items-center gap-1" style={{ color: "#d1d5db" }}>
                {bdc.value.toFixed(2)}%
                {bdc.restricted && <span className="text-[10px] px-1 py-0 rounded" style={{
                  background: "rgba(34,197,94,0.12)", color: "#22c55e",
                }}>HC</span>}
              </div>
              <div className="text-xs" style={{ color }}>
                {arrow} {Math.abs(diff).toFixed(2)}pp vs ind. {ind.value.toFixed(2)}%
              </div>
            </td>
          );
        };

        return (
          <section className="mt-8">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h2 className="text-lg font-semibold text-white">{bdc.ticker} vintage performance vs industry</h2>
              <span className="text-xs px-2 py-0.5 rounded border" style={{
                color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
              }}>
                {vintageYears.length} vintage{vintageYears.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
              Cumulative <span className="text-white">cost-weighted % ever defaulted</span> (on-book non-accrual OR exited in distress)
              at standard ages for each acquisition cohort, compared to the industry average. Cells tagged{" "}
              <span className="px-1 py-0 rounded text-[10px]" style={{
                background: "rgba(34,197,94,0.12)", color: "#22c55e",
              }}>HC</span>{" "}
              use HIGH+MED confidence-tier loans only (stable disclosed acq_date). Cells without the tag fall back to
              all-loans because the HC subset was too thin (&lt;5 loans). Green = this BDC&apos;s vintage outperformed peers;
              red = worse. Vintages predating our parser coverage are omitted.
            </p>

            <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Vintage</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Cohort</th>
                      {ageYears.map((y) => (
                        <th key={y} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Default at Y{y}</th>
                      ))}
                      <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }} title="HIGH+MED tier loans / total cohort loans">Hi-Conf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vintageYears.map((vy, i) => {
                      const cohort = bdcVintage.find((r) => r.vintage_year === vy);
                      return (
                        <tr key={vy} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                          <td className="px-3 py-2 font-semibold text-white">{vy}</td>
                          <td className="px-3 py-2 text-xs" style={{ color: "#9ca3af" }}>
                            {cohort ? `${cohort.n_loans_cohort} loans · $${cohort.cohort_entry_cost_b.toFixed(1)}B` : "—"}
                          </td>
                          {ageYears.map((yr) => {
                            const bdcV = pickMetric(bdcVintage, vy, yr, "pct_ever_default");
                            const indV = pickMetric(industryVintage, vy, yr, "pct_ever_default");
                            return <td key={yr} className="p-0">{deltaCell(bdcV, indV)}</td>;
                          })}
                          <td className="px-3 py-2 text-xs" style={{ color: "#6b6b88" }} title="HIGH+MED-tier loans in this BDC's cohort (stable acq_date)">
                            {cohort && cohort.n_loans_high_conf !== undefined
                              ? `${cohort.n_loans_high_conf}/${cohort.n_loans_cohort}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="text-xs mt-3" style={{ color: "#6b6b88" }}>
              See <Link href="/vintage" className="text-indigo-400 hover:underline">/vintage</Link> for the industry-wide curves and methodology.
            </div>
          </section>
        );
      })()}

      {(() => {
        const sectors = bdcSectorExposure
          .filter((e) => e.ticker === bdc.ticker)
          .sort((a, b) => b.total_cost - a.total_cost);
        if (sectors.length === 0) return null;
        const period = sectors[0].period_end;
        const totalCostB = sectors.reduce((s, e) => s + e.total_cost, 0) / 1e9;
        const software = sectors.find((e) => e.sector === "Software & IT");
        const unclassified = sectors.find((e) => e.sector === "Unclassified");
        const swPct = software ? software.share_of_bdc * 100 : 0;
        const uncPct = unclassified ? unclassified.share_of_bdc * 100 : 0;
        const maxShare = sectors[0].share_of_bdc;
        // Industry-coverage caveat: when a large share is Unclassified the
        // sector mix is only partial. MAIN discloses business descriptions we
        // don't parse; GBDC's industry column is mis-tagged (we route it
        // through cross-BDC consensus, leaving the rest unclassified).
        const lowCoverage = uncPct >= 25;
        return (
          <section className="mt-8">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h2 className="text-lg font-semibold text-white">Sector exposure</h2>
              <span className="text-xs px-2 py-0.5 rounded border" style={{
                color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
              }}>
                as of {period}
              </span>
              {lowCoverage && (
                <span className="text-xs px-2 py-0.5 rounded border" style={{
                  color: "#fbbf24", background: "rgba(251,191,36,0.08)", borderColor: "rgba(251,191,36,0.25)",
                }}>
                  partial — {uncPct.toFixed(0)}% unclassified
                </span>
              )}
            </div>
            <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
              {bdc.ticker}&apos;s latest-quarter portfolio mix across canonical sectors
              (${totalCostB.toFixed(2)}B at cost). Industries are taken from the SOI where
              disclosed, then filled via the enrichment layer (within-BDC carry, cross-BDC
              consensus, curated metadata, name keywords) for issuers that don&apos;t disclose.
              {lowCoverage && (
                <> {" "}<span style={{ color: "#fbbf24" }}>
                  A large share of {bdc.ticker}&apos;s book couldn&apos;t be placed into a sector
                  {bdc.ticker === "MAIN" ? " (MAIN discloses business descriptions our parser doesn't capture)"
                   : bdc.ticker === "GBDC" ? " (GBDC's disclosed industry column is mis-tagged; we use cross-BDC consensus where available)"
                   : ""}, so the mix below is partial.
                </span></>
              )}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <StatCard label="Software & IT" value={`${swPct.toFixed(1)}%`}
                color={swPct >= 25 ? "#a5b4fc" : undefined} />
              <StatCard label="Sectors represented" value={sectors.filter((e) => e.sector !== "Unclassified").length.toString()} />
              <StatCard label="Classified" value={`${(100 - uncPct).toFixed(0)}%`}
                color={uncPct >= 25 ? "#fbbf24" : "#22c55e"} />
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Sector</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Cost</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Positions</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectors.map((e, i) => {
                      const sharePct = e.share_of_bdc * 100;
                      const barW = maxShare > 0 ? (e.share_of_bdc / maxShare) * 100 : 0;
                      const muted = e.sector === "Unclassified" || e.sector === "Other";
                      return (
                        <tr key={e.sector} className="border-t" style={{
                          borderColor: "#1a1a28",
                          background: i % 2 === 0 ? "#111118" : "#0f0f16",
                        }}>
                          <td className="px-4 py-2.5 text-sm font-medium" style={{ color: muted ? "#6b6b88" : "#fff" }}>
                            {e.sector}
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-mono text-white">
                            ${(e.total_cost / 1e9).toFixed(2)}B
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-mono" style={{ color: "#9ca3af" }}>
                            {e.n_positions}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 max-w-[180px] h-2 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
                                <div style={{
                                  width: `${barW}%`,
                                  height: "100%",
                                  background: muted
                                    ? "linear-gradient(90deg, #4b5563, #6b7280)"
                                    : "linear-gradient(90deg, #6366f1, #a5b4fc)",
                                }} />
                              </div>
                              <span className="text-xs font-mono" style={{ color: "#d1d5db" }}>
                                {sharePct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
              Sectors normalized from free-text SOI industry strings. &quot;Other&quot; = an
              industry tag that didn&apos;t map to a canonical sector; &quot;Unclassified&quot; =
              no usable industry. See <Link href="/credit" className="text-indigo-400 hover:underline">/credit</Link> for
              the industry-wide sector credit view.
            </p>
          </section>
        );
      })()}

      {(() => {
        const exposure = bdcSponsorExposure
          .filter((e) => e.ticker === bdc.ticker)
          .sort((a, b) => b.total_fv - a.total_fv);
        if (exposure.length === 0) return null;
        const hhi = exposure.reduce((s, e) => s + e.share_of_bdc_fv ** 2, 0) * 10000;
        const top5Share = exposure.slice(0, 5).reduce((s, e) => s + e.share_of_bdc_fv, 0) * 100;
        const totalFvB = exposure.reduce((s, e) => s + e.total_fv, 0) / 1e9;
        const topN = exposure.slice(0, 15);
        const maxShare = topN[0]?.share_of_bdc_fv ?? 0;
        // HHI buckets — DOJ/FTC market-concentration thresholds, applied to
        // the sponsor-attributed slice of the BDC's portfolio.
        const hhiBucket =
          hhi < 1500 ? { label: "Diversified",     color: "#9ca3af" } :
          hhi < 2500 ? { label: "Moderate",        color: "#fbbf24" } :
                       { label: "Concentrated",    color: "#f87171" };
        return (
          <section className="mt-8">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h2 className="text-lg font-semibold text-white">Sponsor concentration</h2>
              <span className="text-xs px-2 py-0.5 rounded border" style={{
                color: hhiBucket.color,
                background: `${hhiBucket.color}14`,
                borderColor: `${hhiBucket.color}40`,
              }}>
                {hhiBucket.label}
              </span>
              <span className="text-xs px-2 py-0.5 rounded border" style={{
                color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
              }}>
                {exposure.length} sponsors attributed
              </span>
            </div>
            <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
              How {bdc.ticker}&apos;s sponsor-attributed exposure is distributed across PE firms.
              Shares are within the sponsor-attributed slice (${totalFvB.toFixed(2)}B FV across debt positions only —
              not the full portfolio). Sponsor mapping comes from bdctransparency.io&apos;s curated company list,
              joined via the entity matcher.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <StatCard label="HHI (sponsor-attributed)" value={Math.round(hhi).toLocaleString()}
                color={hhiBucket.color} />
              <StatCard label="Top-5 share" value={`${top5Share.toFixed(1)}%`} />
              <StatCard label="# sponsors" value={exposure.length.toString()} />
              <StatCard label="Sponsor-attributed FV" value={`$${totalFvB.toFixed(2)}B`} />
            </div>

            <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
                <h3 className="font-semibold text-white text-sm">Top sponsors by FV</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Sponsor</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>FV</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Positions</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topN.map((e, i) => {
                      const sharePct = e.share_of_bdc_fv * 100;
                      const barW = maxShare > 0 ? (e.share_of_bdc_fv / maxShare) * 100 : 0;
                      return (
                        <tr key={e.sponsor_slug} className="border-t" style={{
                          borderColor: "#1a1a28",
                          background: i % 2 === 0 ? "#111118" : "#0f0f16",
                        }}>
                          <td className="px-4 py-2.5">
                            <Link href={`/sponsors/${e.sponsor_slug}`}
                                  className="text-sm font-medium text-white hover:text-indigo-400">
                              {e.sponsor}
                            </Link>
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-mono text-white">
                            ${(e.total_fv / 1e6).toFixed(1)}M
                          </td>
                          <td className="px-3 py-2.5 text-right text-sm font-mono" style={{ color: "#9ca3af" }}>
                            {e.n_positions}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 max-w-[180px] h-2 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
                                <div style={{
                                  width: `${barW}%`,
                                  height: "100%",
                                  background: "linear-gradient(90deg, #6366f1, #a5b4fc)",
                                }} />
                              </div>
                              <span className="text-xs font-mono" style={{ color: "#d1d5db" }}>
                                {sharePct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
              HHI thresholds follow DOJ/FTC convention: &lt;1,500 diversified, 1,500–2,500 moderate,
              &gt;2,500 concentrated. Note: HHI here is computed only on sponsor-attributed
              positions, not on the BDC&apos;s full portfolio (un-mapped names are excluded).
              Click any sponsor for cross-BDC detail.
            </p>
          </section>
        );
      })()}
      {/* Full position list — the long tail, deliberately last */}
      <BDCHoldingsTable ticker={bdc.ticker} />

    </div>
  );
}
