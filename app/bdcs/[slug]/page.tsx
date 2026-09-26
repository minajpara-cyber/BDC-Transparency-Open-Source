import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AlertBadge from "@/components/AlertBadge";
import StatCard from "@/components/StatCard";
import AssetCompositionChart from "@/components/AssetCompositionChart";
import SeverityStackedBars from "@/components/SeverityStackedBars";
import { SEVERE_DEFINITION, SEVERE_PIK_TYPE_SERIES, severePikTypePoint, severeTypeList, spreadOnlyNote } from "@/lib/pikOrigin";
import ComparisonChart, { ComparisonPoint } from "@/components/ComparisonChart";
import BDCTimelineChart from "@/components/BDCTimelineChart";
import BDCHoldingsTable from "@/components/BDCHoldingsTable";
import { bdcs } from "@/data/bdcs";
import { bdcsHistory } from "@/data/bdcs_history";
import { hasReportedSize, reportedCostB, reportedFvB, reportedMarkPct } from "@/lib/quarterCoverage";
import { naPublicationDisplay, type NonAccrualPublicationMetadata } from "@/lib/enrichBDC";
import { creditPikPublication, exactPikDelta, formatPikPublication, historyPikPublication, pikPublicationLabel } from "@/lib/pikPublication";
import { ewsByBdc, ewsTopByBdc, ewsHistory } from "@/data/early_warning_scores";
import { holdingsAsOfByTicker } from "@/data/bdc_holdings";
import EwsTrendChart from "@/components/EwsTrendChart";
import NaForecastSummary from "@/components/NaForecastSummary";
import { ewsInfo, ewsLabelText, scoreText, signalLabel, validationWindow } from "@/lib/earlyWarningDisplay";
import { creditQuality } from "@/data/credit_quality";
import { modificationRate } from "@/data/modification_rate";
import { pikModifications } from "@/data/pik_modifications";
import { assetComposition } from "@/data/asset_composition";
import { spreadAnalysis } from "@/data/spread_analysis";
import { repaymentDynamics } from "@/data/repayment_dynamics";
import SpreadLifecycleChart from "@/components/SpreadLifecycleChart";
import RepaymentChart from "@/components/RepaymentChart";
import { vintageExposure } from "@/data/vintage_exposure";
import { vintageRows } from "@/data/vintage_analysis";
import { fullySeasonedRow, estimatedShare, MOSTLY_ESTIMATED_PCT, MIN_HC_COST_PCT } from "@/lib/vintage";
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
  const tlQuarters     = timelineRows.length;
  // Size comparisons run over the quarters whose cost and fair value actually
  // parsed. Several BDCs open (or, at OCSL and OCIC, run for years) on rows
  // where a size field came out 0, and measuring "change since start" from one
  // of those reports the whole portfolio as growth.
  const tlSized        = timelineRows.filter(hasReportedSize);
  const tlSizedFirst   = tlSized[0];
  const tlSizedLast    = tlSized[tlSized.length - 1];
  const tlFvChangeB    = tlSizedFirst && tlSizedLast ? tlSizedLast.total_fv_b - tlSizedFirst.total_fv_b : 0;
  const tlPositionChg  = tlSizedFirst && tlSizedLast ? tlSizedLast.n_positions - tlSizedFirst.n_positions : 0;

  // ---- Build per-BDC credit slices from our parsed data ---------------------
  const cqRows = creditQuality
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const cqLatest = cqRows[cqRows.length - 1];
  const cqPrior  = cqRows[cqRows.length - 2];
  const hasCredit = !!cqLatest;
  const cqNaMetadata = cqLatest as (typeof cqLatest & NonAccrualPublicationMetadata) | undefined;
  const comparableNaBasis = cqNaMetadata?.na_basis === (cqPrior as NonAccrualPublicationMetadata | undefined)?.na_basis;
  const cqLatestPik = cqLatest ? creditPikPublication(cqLatest) : null;
  const cqPriorPik = cqPrior ? creditPikPublication(cqPrior) : null;
  const cqPikDelta = cqLatestPik && cqPriorPik ? exactPikDelta(cqLatestPik, cqPriorPik) : null;

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
  type CQField =
    | "pct_non_accrual"
    | "pct_pik_total"
    | "pct_below_95"
    | "pct_below_90";
  // Use the same dollar-weighted export as the credit and home pages.
  function buildIndustryCQ(field: CQField) {
    const values = new Map<string, number>();
    for (const r of creditQuality) {
      if (r.ticker !== "industry") continue;
      if (field === "pct_non_accrual" && r.na_covered_bdcs < 12) continue;
      const value = field === "pct_pik_total"
        ? creditPikPublication(r).lower
        : r[field];
      if (value != null) values.set(r.period_end, value);
    }
    return values;
  }
  // Industry spread: read the pre-computed COST-weighted industry row from
  // the export (ticker:"industry"), gated on coverage — hide quarters where
  // fewer than 12 of 19 BDCs were priced, so the wide, biased early-coverage
  // quarters (e.g. 2020 had only ~8 wide-spread BDCs parsed) don't render a
  // misleading ~630bps industry line. (The page used to weight per-BDC books
  // by position COUNT client-side, which over-weighted many-small-position
  // LMM/venture books.)
  const MIN_BDCS_FOR_INDUSTRY = 12;
  function buildIndustrySpread(field: "avg_spread_book_bps" | "avg_spread_new_bps" | "avg_spread_exit_bps") {
    const m = new Map<string, number>();
    for (const r of spreadAnalysis) {
      if (r.ticker !== "industry") continue;
      if ((r.n_bdcs ?? 0) < MIN_BDCS_FOR_INDUSTRY) continue;
      const v = r[field];
      if (v === null || v === undefined) continue;
      m.set(r.period_end, v as number);
    }
    return m;
  }
  // Industry cash→PIK modification rate (cost-weighted).
  function buildIndustryModRate() {
    return new Map(modificationRate.filter((r) => r.ticker === "industry")
      .map((r) => [r.period_end, r.pct_new_cost]));
  }

  const naIndustry  = buildIndustryCQ("pct_non_accrual");
  const pikIndustry = buildIndustryCQ("pct_pik_total");
  const mkIndustry  = buildIndustryCQ("pct_below_95");
  const lt90Industry = buildIndustryCQ("pct_below_90");
  const bookSpInd   = buildIndustrySpread("avg_spread_book_bps");
  const newSpInd    = buildIndustrySpread("avg_spread_new_bps");
  const exitSpInd   = buildIndustrySpread("avg_spread_exit_bps");
  const modRateInd  = buildIndustryModRate();

  // Build BDC + industry overlay series.
  const cmpFromCQ = (field: CQField,
                    industry: Map<string, number>): ComparisonPoint[] =>
    cqRows.map((r) => ({
      period_end: r.period_end,
      bdc: field === "pct_pik_total" ? creditPikPublication(r).lower : r[field],
      industry: industry.get(r.period_end) ?? null,
    }));
  const cmpFromSpread = (field: "avg_spread_book_bps" | "avg_spread_new_bps" | "avg_spread_exit_bps",
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
  // Spread lifecycle for THIS BDC: whole book vs new originations vs exits.
  const spLifecycle = spRows
    .filter((r) => r.avg_spread_book_bps !== null || r.avg_spread_new_bps !== null || r.avg_spread_exit_bps !== null)
    .map((r) => ({
      period_end: r.period_end,
      book: r.avg_spread_book_bps,
      origination: r.avg_spread_new_bps,
      exit: r.avg_spread_exit_bps ?? null,
    }));
  void exitSpInd;
  // Repayment / turnover for THIS BDC.
  const repayIndDeployed = new Map(
    repaymentDynamics.filter((r) => r.ticker === "industry")
      .map((r) => [r.period_end, r.deployed_pct]),
  );
  const repayIndOutflow = new Map(
    repaymentDynamics.filter((r) => r.ticker === "industry")
      .map((r) => [r.period_end, r.repaid_pct + r.distressed_pct]),
  );
  const repayRows = repaymentDynamics
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end))
    .map((r) => ({ period_end: r.period_end, deployed: r.deployed_pct,
      repaid: r.repaid_pct, distressed: r.distressed_pct,
      indDeployed: repayIndDeployed.get(r.period_end) ?? null,
      indOutflow: repayIndOutflow.get(r.period_end) ?? null }));
  const repayLatest = repayRows[repayRows.length - 1];
  const repayNetAvg = repayRows.length
    ? repayRows.reduce((s, r) => s + (r.deployed - r.repaid - r.distressed), 0) / repayRows.length : 0;
  // Latest quarter's rate may cover only part of the funded debt book (e.g.
  // CGBD rows without an instrument label cannot be confirmed as debt).
  const modRateLatest = modRateRows[modRateRows.length - 1];
  const modRateLowCoverage = modRateLatest?.coverage_status === "low_coverage";
  // Quarters in a known partial-PIK-decoding era (pik_decode_caveat) have no
  // readable cash->PIK rate: a gap, never a 0% flip rate.
  const modRateCmp   = modRateRows.map((r) => ({
    period_end: r.period_end,
    bdc: r.pik_decode_caveat ? null : r.pct_new_cost,
    industry: modRateInd.get(r.period_end) ?? null,
  })) as ComparisonPoint[];
  const modRateCaveatUntil = modRateRows.filter((r) => r.pik_decode_caveat).map((r) => r.period_end).sort().pop();

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
    unknown: r.pct_new_unknown_cost,
    moderate: r.pct_new_moderate_cost,
    severe: r.pct_new_severe_cost,
  }));

  // Severe PIK held in the book, by type (credit_quality, last 12 quarters):
  // why the severe PIK is paid in kind. The four types add up to severe PIK.
  const sevTypeSeries = cqRows.slice(-12).map(severePikTypePoint);
  const sevTypeLatest = sevTypeSeries[sevTypeSeries.length - 1];
  const sevTypeRow = cqRows[cqRows.length - 1];
  const sevTypeTotal = sevTypeLatest ? sevTypeRow.pct_pik_severe : 0;
  const sevSpreadNote = spreadOnlyNote(sevTypeRow, `${bdc.ticker}'s`);

  // Helpers
  const fmtDelta = (curr?: number | null, prev?: number | null, decimals = 2) => {
    if (curr == null || prev == null) return undefined;
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
        <ArrowLeft size={14} />{" "}Back to BDCs
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
              {bdc.type}{" "}BDC
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

      {bdc.ticker === "FSK" && (
        <p className="text-xs mb-6" style={{ color: "#8b8ba8" }}>
          FSK&apos;s portfolio totals follow the filing&apos;s adjustment for unfunded commitments (money promised
          to borrowers but not yet lent). PIK percentages are measured on gross position balances, so don&apos;t
          apply them to those net totals.
          {cqLatest && cqLatest.pct_non_accrual == null &&
            " Its non-accrual rate is not shown yet while the drawn-loan scope is reconciled to the filing."}
        </p>
      )}

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

          {cqNaMetadata?.na_publication_reason && (cqLatest.pct_non_accrual == null || cqNaMetadata.na_publication_status === "disclosed_aggregate") && (
            <p className="text-xs mb-4" style={{ color: "#a5b4fc" }}
              data-na-publication-status={cqNaMetadata.na_publication_status}>
              <strong>{cqLatest.pct_non_accrual == null ? "Non-accrual ratio unavailable." : naPublicationDisplay(cqNaMetadata).label + "."}</strong>{" "}{cqNaMetadata.na_publication_reason}
              {" "}Reported non-accrual holdings remain available in the
              <Link href="/non-accruals" className="underline"> position evidence</Link>.
            </p>
          )}
          {/* Stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard
              label="Non-accrual % (cost)"
              sub={naPublicationDisplay(cqNaMetadata).label}
              value={cqLatest.pct_non_accrual == null ? "Unknown" : `${cqLatest.pct_non_accrual.toFixed(2)}%`}
              color={cqLatest.pct_non_accrual == null ? "#8b8ba8" : cqLatest.pct_non_accrual >= 3 ? "#ef4444" : cqLatest.pct_non_accrual >= 1 ? "#eab308" : "#22c55e"}
              trend={!comparableNaBasis || cqLatest.pct_non_accrual == null || cqPrior?.pct_non_accrual == null ? undefined : cqLatest.pct_non_accrual > cqPrior.pct_non_accrual ? "up" : cqLatest.pct_non_accrual < cqPrior.pct_non_accrual ? "down" : undefined}
              trendLabel={cqPrior && comparableNaBasis ? fmtDelta(cqLatest.pct_non_accrual, cqPrior.pct_non_accrual) : undefined}
            />
            <StatCard
              label="PIK % (cost)"
              sub={cqLatestPik ? pikPublicationLabel(cqLatestPik) : undefined}
              value={cqLatestPik ? formatPikPublication(cqLatestPik) : "Unknown"}
              color={(cqLatestPik?.upper ?? cqLatestPik?.lower ?? 0) >= 15 ? "#f97316" : (cqLatestPik?.upper ?? cqLatestPik?.lower ?? 0) >= 5 ? "#eab308" : "#9ca3af"}
              trend={cqPikDelta == null ? undefined : cqPikDelta > 0 ? "up" : cqPikDelta < 0 ? "down" : undefined}
              trendLabel={cqPikDelta == null ? undefined : `${cqPikDelta >= 0 ? "+" : ""}${cqPikDelta.toFixed(2)}pp`}
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
              <div className="text-sm font-semibold text-white mb-1">PIK lower bound vs industry</div>
              <ComparisonChart data={pikCmp} yLabel="% known PIK at cost (lower bound)" unit="%" bdcLabel={bdc.ticker} bdcColor="#f97316" connectNulls={false} />
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
                {modRateCaveatUntil && (
                  <p className="text-xs mb-2" style={{ color: "#6b6b88" }} data-pik-caveat>
                    No rate through {modRateCaveatUntil}: {bdc.ticker}&apos;s filings from that era could not be read for PIK
                    reliably, so those quarters are left blank rather than shown as 0%.
                  </p>
                )}
                {modRateLowCoverage && (
                  <p className="text-xs mb-2" style={{ color: "#fbbf24" }}>
                    Low coverage: in {modRateLatest.period_end} this rate covers only{" "}
                    {modRateLatest.coverage_pct == null ? "part" : `${modRateLatest.coverage_pct.toFixed(0)}%`} of{" "}
                    {bdc.ticker}&apos;s funded debt, because most of its rows carry no instrument label and
                    cannot be confirmed as debt. Treat it as indicative.
                  </p>
                )}
                <ComparisonChart data={modRateCmp} yLabel="% modified (cost)" unit="%" bdcLabel={bdc.ticker} bdcColor="#a855f7" />
              </div>
            )}
            {bookSpCmp.length > 0 && (
              <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
                <div className="text-sm font-semibold text-white mb-1">Book spread (bps) vs industry</div>
                <p className="text-xs mb-2" style={{ color: "#8b8ba8" }}>
                  Cost-weighted credit spread over the base rate. Industry line is cost-weighted across
                  BDCs and hidden in thin early-coverage quarters.
                </p>
                <ComparisonChart data={bookSpCmp} yLabel="Book spread (bps)" unit=" bps" bdcLabel={bdc.ticker} bdcColor="#22c55e" />
              </div>
            )}
            {spLifecycle.length >= 3 && (spLifecycle.some((p) => p.origination != null) || spLifecycle.some((p) => p.exit != null)) && (
              <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
                <div className="text-sm font-semibold text-white mb-1">Origination vs exit spread</div>
                <p className="text-xs mb-2" style={{ color: "#8b8ba8" }}>
                  Where new loans are being written (purple) and what the loans that left the book this
                  quarter carried (amber), against the whole book (green) — all on a SOFR-equivalent
                  basis. New below book = writing tighter than the legacy book; exits above book = the
                  wide legacy paper is the part rolling off. Points need ≥3 loans to print.
                </p>
                <SpreadLifecycleChart data={spLifecycle} />
              </div>
            )}
            {repayRows.length >= 3 && (
              <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
                <div className="flex items-baseline justify-between mb-1">
                  <div className="text-sm font-semibold text-white">Portfolio flows — deployment vs repayment</div>
                  {repayLatest && (
                    <div className="text-xs" style={{ color: "#8b8ba8" }}>
                      latest net{" "}
                      <span className="font-semibold" style={{ color: (repayLatest.deployed - repayLatest.repaid - repayLatest.distressed) >= 0 ? "#a5b4fc" : "#ef4444" }}>
                        {(repayLatest.deployed - repayLatest.repaid - repayLatest.distressed >= 0 ? "+" : "")}
                        {(repayLatest.deployed - repayLatest.repaid - repayLatest.distressed).toFixed(1)}%
                      </span>
                      {" "}· avg {repayNetAvg >= 0 ? "+" : ""}{repayNetAvg.toFixed(1)}%
                    </div>
                  )}
                </div>
                <p className="text-xs mb-2" style={{ color: "#8b8ba8" }}>
                  Each quarter as a % of the prior book: capital <span style={{ color: "#a5b4fc" }}>deployed</span>{" "}(new
                  originations, above zero) vs capital leaving — <span style={{ color: "#22c55e" }}>repaid/refinanced</span> and{" "}
                  <span style={{ color: "#ef4444" }}>distressed exits</span>{" "}(below zero). Net = book growth or run-off.
                  Dashed lines are the industry averages on each side.
                </p>
                <RepaymentChart data={repayRows} />
              </div>
            )}
          </div>

          {/* Two-up: asset composition + modifications by severity */}
          {(compositionLine.length > 0 || sevSeries.length > 0 || sevTypeTotal > 0) && (
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
                    Every bar is debt switching from cash to PIK while held.
                  </p>
                  <SeverityStackedBars data={sevSeries} yLabel="% of eligible cost" unit="%" />
                </div>
              )}
              {sevTypeLatest && sevTypeTotal > 0 && (
                <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}
                  data-severe-pik-types={bdc.ticker}>
                  <div className="text-sm font-semibold text-white mb-1">Severe PIK held, by type (last 12 quarters)</div>
                  <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
                    Severe PIK — {SEVERE_DEFINITION} — as % of the book at cost, split by why. At{" "}
                    {sevTypeLatest.period_end.slice(0, 7)}{" "}it was{" "}
                    {sevTypeTotal.toFixed(1)}% of {bdc.ticker}&apos;s book:{" "}
                    {severeTypeList(sevTypeLatest, sevTypeTotal)}.
                    Only the red layer — debt that switched from cash to PIK while held, the same loan or a new PIK
                    loan cut from it at a restructuring — shows a borrower that moved to paying half or more of its
                    interest in kind (many still pay some cash); preferred and convertible PIK is built into the
                    instrument, and &quot;first seen&quot; debt was already PIK when it first appeared in our data.
                    {sevSpreadNote && ` ${sevSpreadNote}`}
                  </p>
                  <SeverityStackedBars data={sevTypeSeries} yLabel="% of book at cost" unit="%" series={SEVERE_PIK_TYPE_SERIES} />
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
                    {["Quarter", "Positions", "NA %", "PIK % / range", "Below 95¢", "Below 90¢", "Book bps", "New bps", "Exit bps", "% 1st lien"].map((h) => (
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
                    const pik = creditPikPublication(r);
                    return (
                      <tr
                        key={r.period_end}
                        className="border-t"
                        style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-white">{r.period_end}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#d1d5db" }}>{r.n_positions.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: r.pct_non_accrual == null ? "#8b8ba8" : r.pct_non_accrual >= 3 ? "#ef4444" : r.pct_non_accrual >= 1 ? "#eab308" : "#9ca3af" }}>
                          {r.pct_non_accrual == null ? "Unknown" : `${r.pct_non_accrual.toFixed(2)}%`}
                        </td>
                        <td className="px-4 py-2.5 text-xs" title={pik.reason}
                          data-pik-publication-status={pik.status}
                          style={{ color: (pik.upper ?? pik.lower ?? 0) >= 15 ? "#f97316" : (pik.upper ?? pik.lower ?? 0) >= 5 ? "#eab308" : "#9ca3af" }}>
                          {formatPikPublication(pik)}
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
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#f59e0b" }}>
                          {sp?.avg_spread_exit_bps ?? "—"}
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

      {/* This BDC's row from the four-quarter non-accrual projection (scripts/83). */}
      <NaForecastSummary ticker={bdc.ticker} />

      {/* Forward queue — out-of-sample-tested 2Q early-warning score, this BDC vs
          industry, plus its top queued (pre-non-accrual) positions. */}
      {(() => {
        const mine = ewsByBdc.find((r) => r.ticker === bdc.ticker);
        if (!mine) return null;
        const ind = ewsByBdc.find((r) => r.ticker === "industry");
        const peers = ewsByBdc
          .filter((r) => r.ticker !== "industry")
          .sort((a, b) => b.implied_na_2q_pct - a.implied_na_2q_pct);
        const rank = peers.findIndex((r) => r.ticker === bdc.ticker) + 1;
        const queue = ewsTopByBdc.filter((r) => r.ticker === bdc.ticker);
        const vsInd = ind ? mine.implied_na_2q_pct / Math.max(ind.implied_na_2q_pct, 0.0001) : null;
        const tone = vsInd == null ? "#9ca3af" : vsInd >= 1.25 ? "#ef4444" : vsInd >= 1 ? "#f59e0b" : "#22c55e";
        const oosWindow = validationWindow(ewsInfo.validated);
        const partialCoverage = mine.signal_coverage_pct < 100;
        const nullableSignals = ewsInfo.observability?.nullable_signals ?? [];
        return (
          <div className="rounded-xl border p-5 mb-8" style={{ background: "#111118", borderColor: "#1e1e2e" }}
            id="forward-queue">
            <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
              <div>
                <h2 className="font-semibold text-white">
                  Forward queue: loans likely to go non-accrual{" "}
                  <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
                    next 2 quarters · as of {holdingsAsOfByTicker[bdc.ticker] ?? ewsInfo.as_of ?? "—"}
                  </span>
                </h2>
                <p className="text-xs mt-1 max-w-3xl" style={{ color: "#8b8ba8" }}>
                  Every loan not yet on non-accrual is scored on warning signs whose weights were fitted on data
                  through {ewsInfo.trained_through ?? "—"}{" "}and then tested
                  {oosWindow ? ` on ${oosWindow.from} to ${oosWindow.to} data` : " on later data"}{" "}the fit never saw.
                  Each score is turned into the share of similar loans that went non-accrual within two quarters in
                  that test; adding those up gives the dollars queued for non-accrual.{" "}
                  <Link href="/credit#forward-queue" className="text-indigo-400 hover:text-indigo-300">
                    All BDCs ranked →
                  </Link>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4 text-sm">
              <div>
                <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Implied new NA</div>
                <div className="text-xl font-bold" style={{ color: tone }}>
                  {mine.implied_na_2q_pct.toFixed(2)}%
                </div>
                <div className="text-xs" style={{ color: "#6b7280" }}>
                  of book scored{ind ? ` · industry ${ind.implied_na_2q_pct.toFixed(2)}%` : ""}
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
                <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Rank among {peers.length} BDCs</div>
                <div className="text-xl font-bold text-white">{rank > 0 ? `#${rank}` : "—"}</div>
                <div className="text-xs" style={{ color: "#6b7280" }}>#1 = most queued risk</div>
              </div>
              <div>
                <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Signal coverage</div>
                <div className="text-xl font-bold" style={{ color: partialCoverage ? "#fbbf24" : "#fafafa" }}>
                  {mine.signal_coverage_pct.toFixed(0)}%
                </div>
                <div className="text-xs" style={{ color: "#6b7280" }}>
                  {nullableSignals.length > 0
                    ? `${nullableSignals.map(signalLabel).join(" and ")} signals observed, by value`
                    : "signals observed, by value"}
                </div>
              </div>
            </div>
            <p className="text-xs mb-4" style={{ color: "#6b6b88" }}>
              {partialCoverage
                ? "Where a signal can't be observed it counts as not firing, so with coverage below 100% these figures are lower bounds. "
                : ""}
              {ewsLabelText}
            </p>
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
                    Today&apos;s signal weights applied to past quarters, as a trend view (quarters with fewer than
                    50 scored positions are dropped). Only quarters after{" "}
                    {ewsInfo.trained_through ?? "the training period"}{" "}were unseen by the fit; earlier points are
                    in-sample.
                  </p>
                </div>
              );
            })()}
            {queue.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                    <tr>
                      {["Borrower", "Score", "Fired signals", "Reported FV", "Mark"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((r, i) => (
                      <tr key={i} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                        <td className="px-3 py-2" style={{ color: "#d1d5db" }}>{r.borrower}</td>
                        <td className="px-3 py-2 font-bold" style={{ color: r.score >= 5 ? "#ef4444" : r.score >= 3 ? "#f97316" : "#eab308" }}>{scoreText(r)}</td>
                        <td className="px-3 py-2">
                          {r.signals.map((s) => (
                            <span key={s} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded text-xs"
                              style={{ background: "rgba(239,68,68,0.10)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.2)" }}>
                              {signalLabel(s)}
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
                  Top {queue.length}{" "}positions by score, not yet on non-accrual. A &ldquo;≥&rdquo; score had some
                  signals we couldn&apos;t observe.{" "}
                  <Link href="/watchlist" className="text-indigo-400 hover:text-indigo-300">Full watchlist →</Link>
                </p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "#6b7280" }}>
                No positions currently score high enough to be queued.
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
              value={tlSizedLast ? `$${tlSizedLast.total_fv_b.toFixed(1)}B` : "—"}
              sub={tlSizedLast ? `${tlSizedLast.n_positions.toLocaleString()} positions` : "not reported"}
            />
            <StatCard
              label="FV change since start"
              value={tlSizedFirst && tlSizedLast ? `${tlFvChangeB >= 0 ? "+" : ""}$${tlFvChangeB.toFixed(1)}B` : "—"}
              color={tlFvChangeB >= 0 ? "#22c55e" : "#ef4444"}
              trend={tlFvChangeB >= 0 ? "up" : "down"}
              trendLabel={tlSizedFirst ? `${((tlFvChangeB / tlSizedFirst.total_fv_b) * 100).toFixed(0)}%` : undefined}
              sub={tlSizedFirst ? `since ${tlSizedFirst.period_end.slice(0, 7)}` : undefined}
            />
            <StatCard
              label="Position change"
              value={tlSizedFirst && tlSizedLast ? `${tlPositionChg >= 0 ? "+" : ""}${tlPositionChg.toLocaleString()}` : "—"}
              color={tlPositionChg >= 0 ? "#22c55e" : "#ef4444"}
              sub={tlSizedFirst && tlSizedLast ? `${tlSizedFirst.n_positions} → ${tlSizedLast.n_positions}` : undefined}
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
                    {["Period end", "Positions", "Cost ($B)", "Fair value ($B)", "FV / Cost", "NA % (cost)", "PIK % / range (cost)"].map((h) => (
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
                    // A quarter whose cost or fair value did not parse comes
                    // through as 0. Show it as missing rather than as a real
                    // $0.00 marked at 0% of cost.
                    const costB = reportedCostB(r);
                    const fvB = reportedFvB(r);
                    const markPct = reportedMarkPct(r);
                    const pik = historyPikPublication(r);
                    const ratioColor = markPct === null
                      ? "#6b7280"
                      : markPct >= 100 ? "#22c55e" : markPct >= 97 ? "#eab308" : "#ef4444";
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
                        <td className="px-4 py-2.5 text-xs" style={{ color: costB === null ? "#6b7280" : "#d1d5db" }}>
                          {costB === null ? "—" : `$${costB.toFixed(2)}`}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: fvB === null ? "#6b7280" : "#d1d5db" }}>
                          {fvB === null ? "—" : `$${fvB.toFixed(2)}`}
                        </td>
                        <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: ratioColor }}>
                          {markPct === null ? "—" : `${markPct.toFixed(2)}%`}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{
                          color: r.na_pct_at_cost == null ? "#8b8ba8" : r.na_pct_at_cost >= 3 ? "#ef4444" : r.na_pct_at_cost >= 1 ? "#eab308" : "#9ca3af",
                        }}>
                          {r.na_pct_at_cost == null ? "Unknown" : `${r.na_pct_at_cost.toFixed(2)}%`}
                        </td>
                        <td className="px-4 py-2.5 text-xs" title={pik.reason}
                          data-pik-publication-status={pik.status} style={{
                          color: (pik.upper ?? pik.lower ?? 0) >= 15 ? "#f97316" : (pik.upper ?? pik.lower ?? 0) >= 5 ? "#eab308" : "#9ca3af",
                        }}>
                          {formatPikPublication(pik)}
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
          in each vintage year, and how each vintage has done, read at the oldest
          age every loan in this BDC's cohort has reached. */}
      {(() => {
        const exp = vintageExposure.filter((r) => r.ticker === bdc.ticker);
        if (exp.length === 0) return null;
        const mine = vintageRows.filter((r) => r.ticker === bdc.ticker);
        const asOf = exp.reduce((a, r) => (r.period_end > a ? r.period_end : a), "");
        const total = exp.reduce((s, r) => s + r.cost_b, 0);
        // Years before 2018 are small legacy tails: pool them into one row.
        const groups = new Map<string, typeof exp>();
        for (const r of exp) {
          const k = r.vintage_year == null ? "undated" : r.vintage_year < 2018 ? "old" : String(r.vintage_year);
          groups.set(k, [...(groups.get(k) ?? []), r]);
        }
        const mixRows: VintageMixRow[] = Array.from(groups.entries()).map(([k, rs]) => {
          const cost = rs.reduce((s, r) => s + r.cost_b, 0);
          const est = rs.reduce((s, r) => s + r.cost_estimated_b, 0);
          const vy = k === "undated" ? null : k === "old" ? 2017 : Number(k);
          const cmp = k === "undated" || k === "old" ? undefined : fullySeasonedRow(mine.filter((r) => r.vintage_year === vy));
          // Same baseline as the performance table below: a thin industry
          // cohort (one that predates most of our coverage) is no baseline.
          const ind = cmp ? vintageRows.find((i) => i.ticker === "industry" && !i.is_partial && i.vintage_year === cmp.vintage_year && i.age_quarters === cmp.age_quarters) : undefined;
          return {
            vintage_year: vy,
            label: k === "old" ? "≤2017" : undefined,
            pct_of_book: total > 0 ? (100 * cost) / total : 0,
            current_cost_b: cost,
            estimated_pct: cost > 0 ? (100 * est) / cost : 0,
            entry_cost_b: cmp ? cmp.cohort_entry_cost_b : null,
            age_years: cmp ? cmp.age_years : null,
            n_loans: cmp ? cmp.n_loans_cohort : null,
            pct_ever_na: cmp ? cmp.pct_ever_na : null,
            pct_ever_default: cmp ? cmp.pct_ever_default : null,
            ind_ever_na: ind ? ind.pct_ever_na : null,
            ind_ever_default: ind ? ind.pct_ever_default : null,
            is_partial: cmp ? cmp.is_partial : false,
            na_partial: cmp ? cmp.na_partial : false,
          };
        });
        return <BDCVintageMix ticker={bdc.ticker} asOf={asOf} rows={mixRows} />;
      })()}

      {/* Vintage performance vs industry: cumulative default at Y1-Y5, shown only
          at ages EVERY loan in this BDC's cohort has reached. */}
      {(() => {
        const bdcVintage = vintageRows.filter((r) => r.ticker === bdc.ticker && !r.is_partial);
        const industryVintage = vintageRows.filter((r) => r.ticker === "industry" && !r.is_partial);
        if (bdcVintage.length === 0) return null;
        const vintageYears = Array.from(new Set(bdcVintage.map((r) => r.vintage_year))).sort();
        const ageYears = [1, 2, 3, 4, 5];
        // Prefer the high-confidence (HIGH+MED) rate when the cohort has enough
        // such loans, and compare it with the industry's high-confidence rate.
        const pick = (vy: number, age: number) => {
          const r = bdcVintage.find((x) => x.vintage_year === vy && x.age_quarters === age * 4);
          if (!r) return { value: null as number | null, ind: null as number | null, restricted: false, reached: false, partial: false, hcShare: null as number | null };
          const reached = r.n_loans_eligible === r.n_loans_cohort;
          const ir = industryVintage.find((x) => x.vintage_year === vy && x.age_quarters === age * 4);
          // No industry cohort for this vintage (it predates most of our
          // coverage): still show this BDC's own figure, HC when it has one.
          const restricted = r.pct_ever_default_hc != null && (ir == null || ir.pct_ever_default_hc != null);
          return {
            value: reached ? (restricted ? r.pct_ever_default_hc : r.pct_ever_default) : null,
            ind: ir ? (restricted ? ir.pct_ever_default_hc : ir.pct_ever_default) : null,
            restricted, reached, partial: r.na_partial, hcShare: restricted ? r.hc_cost_share : null,
          };
        };
        return (
          <section className="mt-8">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <h2 className="text-lg font-semibold text-white">{bdc.ticker} vintage performance vs industry</h2>
              <span className="text-xs px-2 py-0.5 rounded border" style={{ color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)" }}>
                {vintageYears.length} vintage{vintageYears.length === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
              Cumulative <span className="text-white">cost-weighted % ever defaulted</span>{" "}(on-book non-accrual OR a distressed exit)
              at standard ages for each vintage, next to the industry at the same age. A cell appears only once <span className="text-white">every
              loan</span> in {bdc.ticker}&apos;s cohort is old enough to have reached that age. Cells tagged{" "}
              <span className="px-1 py-0 rounded text-[10px]" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>HC</span>{" "}
              compare high-confidence (HIGH+MED) dates only, against the industry&apos;s HC rate; untagged cells use all dated loans because
              the HC subset was too thin (under 15 loans, or under {MIN_HC_COST_PCT}% of the cohort&apos;s counted cost). Rows marked{" "}
              <span className="text-white">mostly estimated</span>{" "}have more than {MOSTLY_ESTIMATED_PCT}% of their entry cost dated by an
              estimate rather than a disclosed date — estimated the same way as the &ldquo;Dated by estimate&rdquo; column above, which
              measures today&apos;s book rather than the cohort at entry. * = non-accrual status partly unknown. Cohorts under 30 loans and
              vintages predating our coverage of {bdc.ticker}{" "}are omitted; for vintages before most of our coverage there is no industry
              figure, so {bdc.ticker}&apos;s own rate is shown alone (&ldquo;no industry baseline&rdquo;).
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
                      const est = cohort ? estimatedShare(cohort) : 0;
                      const mostlyEst = est > MOSTLY_ESTIMATED_PCT;
                      return (
                        <tr key={vy} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16", opacity: mostlyEst ? 0.75 : 1 }}>
                          <td className="px-3 py-2 font-semibold text-white whitespace-nowrap">
                            {vy}
                            {mostlyEst && <span className="ml-1.5 px-1.5 py-0 rounded text-[10px]" style={{ background: "rgba(107,107,136,0.15)", color: "#9ca3af" }} title={`${est.toFixed(0)}% of this cohort's entry cost is dated by an estimate rather than a disclosed date`}>mostly estimated</span>}
                          </td>
                          <td className="px-3 py-2 text-xs" style={{ color: "#9ca3af" }}>
                            {cohort ? `${cohort.n_loans_cohort} loans · $${cohort.cohort_entry_cost_b.toFixed(1)}B` : "—"}
                          </td>
                          {ageYears.map((yr) => {
                            const c = pick(vy, yr);
                            if (c.value == null) {
                              return (
                                <td key={yr} className="px-3 py-2 text-xs" style={{ color: "#444" }}
                                    title="Not every loan in this cohort has reached this age yet">—</td>
                              );
                            }
                            if (c.ind == null) {
                              return (
                                <td key={yr} className="px-3 py-2" title={`${c.restricted ? `High-confidence dates only (HIGH+MED; ${c.hcShare?.toFixed(0) ?? "?"}% of the counted cost)` : "All dated loans"} · the industry cohort for this vintage predates most of our filing coverage, so there is no industry figure to compare`}>
                                  <div className="text-sm font-semibold flex items-center gap-1" style={{ color: "#d1d5db" }}>
                                    {c.value.toFixed(2)}%{c.partial ? "*" : ""}
                                    {c.restricted && <span className="text-[10px] px-1 py-0 rounded" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>HC</span>}
                                  </div>
                                  <div className="text-xs" style={{ color: "#6b6b88" }}>no industry baseline</div>
                                </td>
                              );
                            }
                            const diff = c.value - c.ind;
                            const color = diff > 0.25 ? "#ef4444" : diff < -0.25 ? "#22c55e" : "#9ca3af";
                            const arrow = diff > 0.25 ? "↑" : diff < -0.25 ? "↓" : "≈";
                            return (
                              <td key={yr} className="px-3 py-2" title={c.restricted ? `High-confidence dates only (HIGH+MED; ${c.hcShare?.toFixed(0) ?? "?"}% of the counted cost), vs industry HC` : "All dated loans"}>
                                <div className="text-sm font-semibold flex items-center gap-1" style={{ color: "#d1d5db" }}>
                                  {c.value.toFixed(2)}%{c.partial ? "*" : ""}
                                  {c.restricted && <span className="text-[10px] px-1 py-0 rounded" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>HC</span>}
                                </div>
                                <div className="text-xs" style={{ color }}>{arrow} {Math.abs(diff).toFixed(2)}pp vs ind. {c.ind.toFixed(2)}%</div>
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-xs" style={{ color: "#6b6b88" }} title="HIGH+MED-tier loans in this BDC's cohort">
                            {cohort ? `${cohort.n_loans_high_conf}/${cohort.n_loans_cohort}` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="text-xs mt-3" style={{ color: "#6b6b88" }}>
              See <Link href="/vintage" className="text-indigo-400 hover:underline">/vintage</Link>{" "}for the industry curves, the dating
              method and the stricter &ldquo;disclosed dates only&rdquo; view.
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
              no usable industry. See <Link href="/credit" className="text-indigo-400 hover:underline">/credit</Link>{" "}for
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
                {exposure.length}{" "}sponsors attributed
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
