"use client";
import Link from "next/link";
import CreditNav from "@/components/CreditNav";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import CreditHeatmap from "@/components/CreditHeatmap";
import CsvDownloadButton from "@/components/CsvDownloadButton";
import BDCComparePanel, { CompareRow } from "@/components/BDCComparePanel";
import SortableTable, { Column } from "@/components/SortableTable";
import CreditLensChart, { IndustryPoint } from "@/components/CreditLensChart";
import AssetCompositionChart from "@/components/AssetCompositionChart";
import SeverityStackedBars from "@/components/SeverityStackedBars";
import { creditQuality, CreditQuality } from "@/data/credit_quality";
import { modificationRate, ModificationRate } from "@/data/modification_rate";
import { pikModifications } from "@/data/pik_modifications";
import { modificationEvents } from "@/data/modification_events";
import { ewsByBdc, ewsMeta } from "@/data/early_warning_scores";
import { ewsLabelText, scoringSignals } from "@/lib/earlyWarningDisplay";
import { watchlistByTicker } from "@/data/early_warning_history";
import ModificationEventsTable from "@/components/ModificationEventsTable";
import { assetComposition } from "@/data/asset_composition";
import { spreadAnalysis } from "@/data/spread_analysis";
import { stressedPositions } from "@/data/stressed_positions";
import { borrowers } from "@/data/borrowers_index";
import { borrowerHistory } from "@/data/borrowers_history";
import { pikCascade, type PIKCascadeRow } from "@/data/pik_cascade";
import { sectorCredit } from "@/data/sector_credit";
import { macroContext } from "@/data/macro_context";
import { sponsors } from "@/data/sponsors_index";
import { creditPikPublication, formatPikPublication, pikRangeText, sponsorPikPublication } from "@/lib/pikPublication";
import { joinList } from "@/lib/joinList";

// Parser-coverage caveats grouped by metric family. Pre-XBRL parsers
// commonly capture mark-based fields (par / cost / fv) cleanly even when
// non-accrual / PIK footnotes don't decode — for those BDCs we only flag
// the broken metric family, which lets reliable historical data surface.
// Caveat-flagged cells are muted/italic and excluded from industry charts.
type MetricFamily = "mark" | "na" | "pik";
const ALL_FAMILIES: MetricFamily[] = ["mark", "na", "pik"];
// `from` is optional. Without it, the caveat applies through `until` (no
// lower bound). With it, the caveat covers a closed [from, until] window —
// useful when a parser breaks for a specific era of filings.
const COVERAGE_CAVEATS: Array<{
  ticker: string;
  from?: string;
  until: string;
  metrics: MetricFamily[];
  reason: string;
}> = [
  // CCAP pre-XBRL parsed financial-statement summary rows, not SOI positions —
  // every metric is unreliable.
  { ticker: "CCAP", until: "2022-02-28", metrics: ALL_FAMILIES,
    reason: "Pre-XBRL CCAP filings parsed financial-statement summary rows instead of SOI positions" },
  // OCSL pre-XBRL is patchy — par_amount missing for many quarters so the
  // mark-based metrics show as 0%. Keep all metrics flagged until XBRL kicks in.
  { ticker: "OCSL", until: "2022-12-31", metrics: ALL_FAMILIES,
    reason: "Pre-XBRL OCSL SOI extraction is patchy; par missing for many quarters" },
  // FSK mark-based metrics parse cleanly back to 2013. Its non-accrual rate is
  // on the funded basis (unfunded commitments out of both sides); filings before
  // 2022-06-30 don't tag unfunded commitments, so those rates are approximate and
  // never join the industry line (switching FSK in and out bent the series).
  { ticker: "FSK",  until: "2022-05-31", metrics: ["na"],
    reason: "Approximate: FSK filings before 2022-06-30 do not tag unfunded commitments, so the parsed book can include them" },
  // PIK footnotes misread during the FSKR merger era (Q4 2019 – Q3 2021).
  { ticker: "FSK",  until: "2021-09-30", metrics: ["pik"],
    reason: "FSK PIK flag detection misfires during the FSKR-merger era (Q4 2019 – Q3 2021)" },
  // OBDC pre-XBRL: mark + NA parse cleanly, but PIK footnotes don't decode.
  { ticker: "OBDC", until: "2022-03-31", metrics: ["pik"],
    reason: "Pre-XBRL OBDC parser doesn't decode PIK footnotes" },
  // MFIC marks non-accrual loans "(14) Non-accrual status" in its SOI; the
  // decoded rate matches its disclosed rate every quarter from 2022-03. Its
  // stub-parse quarters use the disclosed aggregate (scripts/76). No caveat
  // needed for MFIC.
  // (Historical) OTF parser column-mapping bug fixed in two passes via
  // scripts/74_fix_otf_pik_columns.py (51-col layout 2023-Q3 → 2024-Q4)
  // and scripts/75_fix_otf_48col_pik.py (48-col layout 2023-Q1/Q2 + 2025).
  // OTF PIK / mod data is now structurally correct across all quarters.
];

// Drop BDC-quarter rows with too few positions from industry aggregates and
// heatmap cells — stub/comparative filings can produce 10-position snapshots
// that aren't representative of the BDC's actual book.
const MIN_POSITIONS_FOR_RELIABLE = 30;

// Industry lines need a broad cohort: during reporting season the newest
// quarter starts with 1-2 early filers, and an industry point built from
// them alone is composition noise, not credit signal.
const MIN_BDCS_FOR_INDUSTRY = 10;

function isReliable(ticker: string, period_end: string, family: MetricFamily): boolean {
  for (const c of COVERAGE_CAVEATS) {
    if (c.ticker !== ticker) continue;
    if (period_end > c.until) continue;
    if (c.from !== undefined && period_end < c.from) continue;
    if (c.metrics.includes(family)) return false;
  }
  return true;
}

// Restrict the time-series view to calendar-quarter ends. BDCs with offset
// fiscal years (e.g. BCRED's mid-2021 stub) and partial-period filings can
// produce orphan period_ends like 2021-05-28 or 2022-02-28 that show up as
// noisy spikes on the line charts with a handful of positions.
const QUARTER_END_SUFFIXES = new Set(["03-31", "06-30", "09-30", "12-31"]);
function isQuarterEnd(period_end: string): boolean {
  return QUARTER_END_SUFFIXES.has(period_end.slice(5));
}

/** Why a BDC-quarter is not in the pooled industry non-accrual rate. */
function plainNaReason(status: string | null | undefined): string {
  switch (status) {
    case "disclosed_aggregate": return "rate shown as the BDC reports it, on a different basis from the pool";
    case "withheld_reconciliation": return "figures on hold while reconciled to the filing";
    case "unavailable_coverage": return "non-accrual flags incomplete";
    default: return status ? status.replace(/_/g, " ") : "no usable rate";
  }
}

// ----- helpers ----------------------------------------------------------------

type NumericKeys =
  | "pct_non_accrual"
  | "pct_below_95"
  | "pct_below_90";

// Map credit_quality numeric fields to their metric family for caveat
// resolution. Mark-based metrics (below_X) share the "mark" family; NA
// stands alone.
function metricFamilyOf(field: NumericKeys): MetricFamily {
  if (field === "pct_non_accrual") return "na";
  return "mark";
}

/** Heatmap cell map for a credit-quality metric. */
function buildCreditCellMap(field: NumericKeys) {
  const family = metricFamilyOf(field);
  const m = new Map<string, { value: number | null; reliable?: boolean }>();
  for (const r of creditQuality) {
    if (!isQuarterEnd(r.period_end)) continue;
    const reliable =
      isReliable(r.ticker, r.period_end, family) &&
      r.n_positions >= MIN_POSITIONS_FOR_RELIABLE;
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r[field],
      reliable,
    });
  }
  return m;
}

// The industry non-accrual line keeps every quarter with a usable pool, so its
// history reaches back as far as the data does; each point carries its pool
// size (n BDCs) for the tooltip. Two guards instead of the 10-BDC floor used
// by the other industry lines: at least MIN_BDCS_FOR_NA_HISTORY BDCs, and at
// least NA_POOL_DROP_LIMIT of the previous point's pool — early in a reporting
// season the newest quarter holds only a few early filers.
const MIN_BDCS_FOR_NA_HISTORY = 5;
const NA_POOL_DROP_LIMIT = 0.6;

function buildNaIndustrySeries(): IndustryPoint[] {
  const points = creditQuality
    .filter((r) => r.ticker === "industry" && isQuarterEnd(r.period_end) && r.pct_non_accrual != null)
    .map((r) => ({ period_end: r.period_end, value: r.pct_non_accrual as number, coverage: r.na_covered_bdcs ?? 0 }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const out: IndustryPoint[] = [];
  for (const p of points) {
    if (p.coverage < MIN_BDCS_FOR_NA_HISTORY) continue;
    const prev = out[out.length - 1];
    if (prev && p.coverage < NA_POOL_DROP_LIMIT * prev.coverage) continue;
    out.push(p);
  }
  return out;
}

/** Read the dollar-weighted industry rows produced by the canonical exporter. */
function buildIndustrySeries(field: NumericKeys): IndustryPoint[] {
  return creditQuality
    .filter((r) => r.ticker === "industry" && isQuarterEnd(r.period_end) && r[field] != null)
    .map((r) => ({
      period_end: r.period_end,
      value: r[field] as number,
      coverage: field === "pct_non_accrual" ? r.na_covered_bdcs : creditQuality.filter(
        (b) => b.ticker !== "industry" && b.period_end === r.period_end && b.n_positions >= MIN_POSITIONS_FOR_RELIABLE
      ).length,
    }))
    .filter((p) => p.coverage >= MIN_BDCS_FOR_INDUSTRY)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

/** Modification heatmap cell map. STRICT cash↔PIK structure changes only
 *  (pct_new_cost) — does NOT include par-haircuts (refis / partial sales /
 *  paydowns) or maturity extensions. The broader multi-signal aggregate
 *  (pct_any_mod_cost) is exported in modification_rate.ts and used as a
 *  cohort metric on /vintage; this credit-page chart is intentionally
 *  scoped to payment-structure changes only.
 */
function buildModCellMap() {
  const m = new Map<string, { value: number | null; reliable?: boolean; note?: string }>();
  for (const r of modificationRate) {
    if (!isQuarterEnd(r.period_end)) continue;
    // A rate that covers under half of the BDC's funded debt is muted and labelled.
    const lowCoverage = r.coverage_status === "low_coverage";
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r.pct_new_cost,
      reliable: isReliable(r.ticker, r.period_end, "pik") && !lowCoverage,
      note: lowCoverage
        ? `low coverage: rate covers ${r.coverage_pct == null ? "an unknown share" : `${r.coverage_pct.toFixed(0)}%`} of this BDC's funded debt`
        : undefined,
    });
  }
  return m;
}

/** Industry-aggregate cash→PIK modification series. Both numerator and
 *  denominator sum per-BDC USD-equivalent costs (export already applied
 *  UNIT_MULTIPLIER) so the cross-issuer aggregate is exact. Excludes
 *  par-haircuts and maturity extensions — see buildModCellMap above.
 */
function buildModIndustrySeries(): IndustryPoint[] {
  return modificationRate.filter((r) => r.ticker === "industry" && isQuarterEnd(r.period_end))
    .map((r) => ({ period_end: r.period_end, value: r.pct_new_cost,
      coverage: modificationRate.filter((b) => b.ticker !== "industry" &&
        b.period_end === r.period_end && b.industry_included).length }))
    .filter((p) => p.coverage >= MIN_BDCS_FOR_INDUSTRY)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

// ----- Asset composition + spread helpers ------------------------------------

/** Heatmap cell map for % first lien per BDC. */
function buildFirstLienCellMap() {
  const m = new Map<string, { value: number | null; reliable?: boolean }>();
  for (const r of assetComposition) {
    if (!isQuarterEnd(r.period_end)) continue;
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r.pct_first_lien,
      reliable: isReliable(r.ticker, r.period_end, "mark"),
    });
  }
  return m;
}

/** Heatmap cell map for % equity per BDC. */
function buildEquityCellMap() {
  const m = new Map<string, { value: number | null; reliable?: boolean }>();
  for (const r of assetComposition) {
    if (!isQuarterEnd(r.period_end)) continue;
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r.pct_equity,
      reliable: isReliable(r.ticker, r.period_end, "mark"),
    });
  }
  return m;
}

/** Per-BDC stacked-composition time series rolled to the chart's bucket model. */
function buildCompositionSeries(ticker: string) {
  return assetComposition
    .filter((r) => r.ticker === ticker && isQuarterEnd(r.period_end))
    .sort((a, b) => a.period_end.localeCompare(b.period_end))
    .map((r) => ({
      period_end: r.period_end,
      pct_first_lien: r.pct_first_lien,
      pct_second_lien: r.pct_second_lien,
      pct_unsecured: r.pct_unsecured,
      pct_subordinated: r.pct_subordinated,
      pct_structured_jv: r.pct_structured_jv,
      pct_equity: r.pct_equity,
      pct_other: r.pct_other_secured + r.pct_abf + r.pct_cash + r.pct_other + r.pct_unclassified,
    }));
}

/** Industry stacked-composition: cost-weighted average across BDCs. We don't
 *  have absolute dollar weights in asset_composition, so use n_positions from
 *  creditQuality as a proxy weight per BDC per quarter. */
function buildIndustryComposition() {
  const weightLookup = new Map<string, number>();
  for (const r of creditQuality) {
    weightLookup.set(`${r.ticker}|${r.period_end}`, r.n_positions);
  }
  const byPeriod = new Map<string, {
    weight: number; first: number; second: number; unsec: number; sub: number;
    sjv: number; eq: number; other: number;
  }>();
  for (const r of assetComposition) {
    if (!isQuarterEnd(r.period_end)) continue;
    if (!isReliable(r.ticker, r.period_end, "mark")) continue;
    const w = weightLookup.get(`${r.ticker}|${r.period_end}`) ?? 1;
    if (!byPeriod.has(r.period_end))
      byPeriod.set(r.period_end, { weight: 0, first: 0, second: 0, unsec: 0, sub: 0, sjv: 0, eq: 0, other: 0 });
    const s = byPeriod.get(r.period_end)!;
    s.weight += w;
    s.first += w * r.pct_first_lien;
    s.second += w * r.pct_second_lien;
    s.unsec += w * r.pct_unsecured;
    s.sub += w * r.pct_subordinated;
    s.sjv += w * r.pct_structured_jv;
    s.eq += w * r.pct_equity;
    s.other += w * (r.pct_other_secured + r.pct_abf + r.pct_cash + r.pct_other + r.pct_unclassified);
  }
  return Array.from(byPeriod.entries())
    .map(([period_end, s]) => ({
      period_end,
      pct_first_lien: s.weight ? s.first / s.weight : 0,
      pct_second_lien: s.weight ? s.second / s.weight : 0,
      pct_unsecured: s.weight ? s.unsec / s.weight : 0,
      pct_subordinated: s.weight ? s.sub / s.weight : 0,
      pct_structured_jv: s.weight ? s.sjv / s.weight : 0,
      pct_equity: s.weight ? s.eq / s.weight : 0,
      pct_other: s.weight ? s.other / s.weight : 0,
    }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

/** Heatmap cell map for book / new-loan spread (bps). */
function buildSpreadCellMap(field: "avg_spread_book_bps" | "avg_spread_new_bps") {
  const m = new Map<string, { value: number | null; reliable?: boolean }>();
  for (const r of spreadAnalysis) {
    if (!isQuarterEnd(r.period_end)) continue;
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r[field] as number | null,
      reliable: isReliable(r.ticker, r.period_end, "mark"),
    });
  }
  return m;
}

/** Industry-aggregate weighted-avg spread across BDCs each quarter — reads
 *  the exporter's pre-computed ticker:"industry" row, which is cost-weighted
 *  in USD terms (unit multipliers applied, so ARCC/FSK carry their real
 *  weight). The old client-side version weighted by parsed-position COUNT,
 *  which over-weighted many-small-position LMM/venture books. */
function buildSpreadIndustry(field: "avg_spread_book_bps" | "avg_spread_new_bps"): IndustryPoint[] {
  const pts: IndustryPoint[] = [];
  for (const r of spreadAnalysis) {
    if (r.ticker !== "industry") continue;
    if (!isQuarterEnd(r.period_end)) continue;
    const v = r[field];
    if (v === null || v === undefined) continue;
    pts.push({ period_end: r.period_end, value: v as number, coverage: r.n_bdcs ?? 0 });
  }
  return pts
    .filter((p) => p.coverage >= MIN_BDCS_FOR_INDUSTRY)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

// ----- PIK cascade ------------------------------------------------------------
// data/pik_cascade.ts buckets each cash → PIK switch by where the loan was a
// year later. Newer exports add "not yet seasoned", "mark unknown" and "status
// unknown" buckets (so each row adds to 100%); older ones fold unseasoned
// switches into "exited", so for those the switch years whose follow-up runs
// past the latest quarter are flagged instead.
type CascadeSource = PIKCascadeRow & Partial<Record<string, number | string | null>>;
type CascadeDisplayRow = {
  year: string; flips: number; pct_cured: number | null; pct_pik_strong: number | null;
  pct_pik_weak: number | null; pct_pik_distress: number | null; pct_mark_unknown: number | null;
  pct_exited: number | null; pct_pending: number | null; pct_unknown: number | null; incomplete: boolean;
};
const CASCADE_PENDING_KEYS = ["pending", "not_yet_seasoned", "not_yet_observable"] as const;
const CASCADE_MARK_UNKNOWN_KEYS = ["mark_unknown", "pik_mark_unknown", "pik_unknown"] as const;
// The BDC's filing four quarters later is not on file, or the PIK status in it can't be read.
const CASCADE_STATUS_UNKNOWN_KEYS = ["unknown", "status_unknown"] as const;

/** A bucket's share of the year's switches: the exported pct_ field, or count ÷ flips. */
function cascadeShare(r: CascadeSource, keys: readonly string[]): number | null {
  const rec = r as Record<string, unknown>;
  for (const k of keys) {
    const pct = rec[`pct_${k}`];
    if (typeof pct === "number" && Number.isFinite(pct)) return pct;
    const n = rec[k];
    if (typeof n === "number" && Number.isFinite(n) && r.flips > 0) return (100 * n) / r.flips;
  }
  return null;
}

function buildCascadeRows(latestQuarter: string): CascadeDisplayRow[] {
  return pikCascade.map((raw) => {
    const r = raw as CascadeSource;
    const pending = cascadeShare(r, CASCADE_PENDING_KEYS);
    const markUnknown = cascadeShare(r, CASCADE_MARK_UNKNOWN_KEYS);
    const statusUnknown = cascadeShare(r, CASCADE_STATUS_UNKNOWN_KEYS);
    // Without a pending bucket, a switch year is fully followed up only once
    // the end of the following year has been reported.
    const incomplete = pending != null ? pending >= 50 : `${Number(r.year) + 1}-12-31` > latestQuarter;
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      year: r.year, flips: r.flips, pct_cured: num(r.pct_cured), pct_pik_strong: num(r.pct_pik_strong),
      pct_pik_weak: num(r.pct_pik_weak), pct_pik_distress: num(r.pct_pik_distress), pct_mark_unknown: markUnknown,
      pct_exited: num(r.pct_exited), pct_pending: pending, pct_unknown: statusUnknown, incomplete,
    };
  });
}

const fmtCascade = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);

// ----- page -------------------------------------------------------------------

export default function CreditPage() {
  // Axes — union of period_ends across all datasets, ascending.
  // Restrict to calendar-quarter ends so off-quarter stubs don't show up
  // as empty columns on every heatmap.
  const periodSet = new Set<string>();
  creditQuality.forEach((r: CreditQuality) => periodSet.add(r.period_end));
  modificationRate.forEach((r: ModificationRate) => periodSet.add(r.period_end));
  assetComposition.forEach((r) => periodSet.add(r.period_end));
  spreadAnalysis.forEach((r) => periodSet.add(r.period_end));
  const periods = Array.from(periodSet).filter(isQuarterEnd).sort();
  const tickers = Array.from(new Set(creditQuality.map((r) => r.ticker))).sort();

  const firstLienMap = buildFirstLienCellMap();
  const equityMap    = buildEquityCellMap();
  const bookSpreadMap = buildSpreadCellMap("avg_spread_book_bps");
  const newSpreadMap  = buildSpreadCellMap("avg_spread_new_bps");

  const industryComposition = buildIndustryComposition();
  const bookSpreadLine = buildSpreadIndustry("avg_spread_book_bps");
  const newSpreadLine  = buildSpreadIndustry("avg_spread_new_bps");

  const naMap   = buildCreditCellMap("pct_non_accrual");
  const lt95Map = buildCreditCellMap("pct_below_95");
  const lt90Map = buildCreditCellMap("pct_below_90");
  const modMap  = buildModCellMap();

  const cascadeRows = buildCascadeRows(periods[periods.length - 1] ?? "");
  const cascadeHasPending = cascadeRows.some((r) => r.pct_pending != null);
  const cascadeHasMarkUnknown = cascadeRows.some((r) => r.pct_mark_unknown != null);
  const cascadeHasStatusUnknown = cascadeRows.some((r) => r.pct_unknown != null);
  const cascadeIncompleteYears = cascadeHasPending ? [] : cascadeRows.filter((r) => r.incomplete).map((r) => r.year);

  const naLine   = buildNaIndustrySeries();
  const naFirst  = naLine[0];
  const naLast   = naLine[naLine.length - 1];
  const naThin   = naLine.filter((p) => p.coverage < MIN_BDCS_FOR_INDUSTRY);
  // BDCs left out of the latest pooled point, with the exporter's reason.
  const naLatestPeriod = naLast?.period_end ?? "";
  const naLeftOut = creditQuality
    .filter((r) => r.ticker !== "industry" && r.period_end === naLatestPeriod && !(r.na_covered_bdcs > 0))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  const lt95Line = buildIndustrySeries("pct_below_95");
  const lt90Line = buildIndustrySeries("pct_below_90");
  const modPctLine = buildModIndustrySeries();

  // Macro overlays — HY OAS pairs naturally with mark-based metrics
  // (below 95/90, modifications); Fed Funds with spread series.
  const hyOasSeries = macroContext
    .filter((r) => isQuarterEnd(r.period_end))
    .map((r) => ({ period_end: r.period_end, value: r.hy_oas_bps }));
  const ffrSeries = macroContext
    .filter((r) => isQuarterEnd(r.period_end))
    .map((r) => ({ period_end: r.period_end, value: r.ffr_pct }));

  // ---------- Sponsor credit quality (C.7 follow-up) ----------
  // Top 20 PE sponsors by aggregate fair value, with their position-weighted
  // credit metrics. Exclude tiny sponsors (< 30 positions) — too thin a
  // sample to draw conclusions.
  const topSponsors = sponsors
    .filter((s) => s.n_positions >= 30)
    .sort((a, b) => b.total_fv - a.total_fv)
    .slice(0, 20);

  // Pre-computed rows for the BDC comparison panel (client component). We
  // do the reliability resolution here so the child component can stay
  // serialization-friendly.
  // Watchlist severity per (ticker, quarter) as a share of book fair value.
  // Cuts are CUMULATIVE ("Elevated or worse" contains High) for the same reason
  // below-95 contains below-90: a position sliding from Elevated into High must
  // not read as an improvement, which is what an isolated middle band would show.
  // Denominated in AMORTIZED COST, not fair value: on an FV basis the same
  // markdown that puts a loan on the watchlist shrinks both its numerator and
  // the book denominator, damping the very stress being measured. Cost is the
  // stable base and matches how the below-95¢ / below-90¢ heatmaps denominate.
  //
  // Tiers are disjoint, so a severity-or-worse cut is a plain sum — no double
  // counting. `wl_cost` is the authoritative total (the three tier fields are
  // each rounded to 0.1 independently, so summing them drifts up to ±0.1 $M).
  const wlByKey = new Map<string, { high: number; elevatedPlus: number; any: number }>();
  for (const w of watchlistByTicker) {
    if (!isQuarterEnd(w.period_end) || !w.book_cost_m) continue;
    wlByKey.set(`${w.key}|${w.period_end}`, {
      high: (100 * w.cost_High) / w.book_cost_m,
      elevatedPlus: (100 * (w.cost_High + w.cost_Elevated)) / w.book_cost_m,
      any: (100 * w.wl_cost) / w.book_cost_m,
    });
  }
  // Industry benchmark for the watchlist metrics. watchlistByTicker carries no
  // "industry" key, so aggregate it here: FV-weighted across BDCs that clear the
  // same caveat gate, held to the usual cohort floor so an early-filer quarter
  // can't masquerade as the industry.
  {
    const agg = new Map<string, { high: number; elev: number; all: number; book: number; n: number }>();
    for (const w of watchlistByTicker) {
      if (!isQuarterEnd(w.period_end) || !w.book_cost_m) continue;
      if (!isReliable(w.key, w.period_end, "mark")) continue;
      if (!isReliable(w.key, w.period_end, "pik")) continue;
      const s = agg.get(w.period_end) ?? { high: 0, elev: 0, all: 0, book: 0, n: 0 };
      s.high += w.cost_High;
      s.elev += w.cost_Elevated;
      s.all += w.wl_cost;
      s.book += w.book_cost_m;
      s.n += 1;
      agg.set(w.period_end, s);
    }
    for (const [period_end, s] of agg) {
      if (s.n < MIN_BDCS_FOR_INDUSTRY || !s.book) continue;
      wlByKey.set(`industry|${period_end}`, {
        high: (100 * s.high) / s.book,
        elevatedPlus: (100 * (s.high + s.elev)) / s.book,
        any: (100 * s.all) / s.book,
      });
    }
  }

  const compareRows: CompareRow[] = creditQuality
    .filter((r) => isQuarterEnd(r.period_end))
    .map((r) => {
      // The industry row is an aggregate, not a book — the position floor that
      // screens out stub filings doesn't apply to it.
      const enough = r.ticker === "industry" || r.n_positions >= MIN_POSITIONS_FOR_RELIABLE;
      const relMark = isReliable(r.ticker, r.period_end, "mark") && enough;
      const pik = creditPikPublication(r);
      const relPik = isReliable(r.ticker, r.period_end, "pik") && enough && pik.lower != null;
      const wl = wlByKey.get(`${r.ticker}|${r.period_end}`);
      return {
        ticker: r.ticker,
        period_end: r.period_end,
        pct_non_accrual: r.pct_non_accrual,
        pct_below_95: r.pct_below_95,
        pct_below_90: r.pct_below_90,
        pct_pik_total: pik.lower,
        pct_pik_total_upper: pik.upper,
        pik_observation_coverage_pct: pik.observationCoveragePct,
        pik_publication_status: pik.status,
        pik_publication_reason: pik.reason,
        pct_wl_high: wl?.high ?? null,
        pct_wl_elevated_plus: wl?.elevatedPlus ?? null,
        pct_wl_any: wl?.any ?? null,
        rel_na: isReliable(r.ticker, r.period_end, "na") && enough,
        rel_mark: relMark,
        rel_pik: relPik,
        // The watchlist score is driven by mark level/trajectory plus PIK and
        // par-cut signals, so it inherits both families' caveats.
        rel_watchlist: relMark && relPik,
      };
    });

  // Headline, severity and named events share the export's eligible debt cohort.
  const severityIndustry = pikModifications
    .filter((r) => r.ticker === "industry" && isQuarterEnd(r.period_end))
    .map((r) => ({ period_end: r.period_end, minimal: r.pct_new_minimal_cost,
      moderate: r.pct_new_moderate_cost, severe: r.pct_new_severe_cost,
      unknown: r.pct_new_unknown_cost }));

  // Per-(ticker, period) severity rows for the recent table (latest 8 quarters).
  const recentPeriods = Array.from(new Set(pikModifications.map((r) => r.period_end)))
    .filter(isQuarterEnd)
    .sort()
    .slice(-8);
  const severityTableRows = pikModifications
    .filter((r) => recentPeriods.includes(r.period_end) && isReliable(r.ticker, r.period_end, "pik"))
    .filter((r) => r.new_minimal + r.new_moderate + r.new_severe > 0)
    .sort((a, b) => (b.period_end.localeCompare(a.period_end)) || (b.new_severe - a.new_severe));

  // ---------- Stressed-loans table (C.3) ----------
  // Latest quarter present in the stressed-positions extract. Pick the top-20
  // positions by dollar markdown (cost - fv), which is the actionable view
  // for an analyst: "where is the most $$ being written down right now".
  const stressedLatestPeriod = stressedPositions
    .map((p) => p.period_end)
    .sort()
    .pop() ?? "";
  const topStressed = stressedPositions
    .filter((p) => p.period_end === stressedLatestPeriod)
    .map((p) => ({ ...p, markdown_m: p.cost_m - p.fv_m }))
    .sort((a, b) => b.markdown_m - a.markdown_m)
    .slice(0, 25);

  // ---------- Concentration (C.4) ----------
  // Top 15 borrowers by aggregate cost across the industry. borrowers_index
  // is already sorted by total_fv but we want total_cost (more stable basis
  // for concentration risk). Exclude obvious aggregator rows ("Total",
  // "Senior Direct Lending Program", JV vehicles).
  const AGGREGATOR_PATTERNS = [
    /^total\b/i, /joint venture/i, /^bcred emerald jv/i, /lending program/i,
    /^in joint/i, /cash and cash equivalents/i, /^shelf$/i, /^snoopy$/i,
    /^credit opportunities/i, /senior direct lending/i,
  ];
  const topByCost = borrowers
    .filter((b) => !AGGREGATOR_PATTERNS.some((p) => p.test(b.name)))
    .sort((a, b) => b.total_cost - a.total_cost)
    .slice(0, 15);
  const industryTotalCost = borrowers.reduce(
    (s, b) => s + (AGGREGATOR_PATTERNS.some((p) => p.test(b.name)) ? 0 : b.total_cost),
    0,
  );

  // ---------- Cross-BDC mark dispersion (C.5) ----------
  // For each borrower with ≥3 BDC holders in the latest available quarter,
  // compute the spread between max and min mark (fv/cost). Big dispersion
  // means BDCs disagree on the credit — worth investigating.
  const dispersionLatest = borrowerHistory
    .map((r) => r.period_end)
    .sort()
    .pop() ?? "";
  type DispersionRow = {
    slug: string; name: string;
    holders: Array<{ ticker: string; mark: number; cost: number; fv: number }>;
    min_mark: number; max_mark: number; spread: number; total_cost: number;
  };
  const borrowerNameBySlug = new Map(borrowers.map((b) => [b.slug, b.name]));
  const byBorrower = new Map<string, DispersionRow>();
  for (const r of borrowerHistory) {
    if (r.period_end !== dispersionLatest) continue;
    if (r.cost <= 0 || r.fv <= 0) continue;
    const mark = r.fv / r.cost;
    if (mark > 1.5 || mark < 0.0) continue;
    const name = borrowerNameBySlug.get(r.slug) ?? r.slug;
    if (AGGREGATOR_PATTERNS.some((p) => p.test(name))) continue;
    let row = byBorrower.get(r.slug);
    if (!row) {
      row = { slug: r.slug, name, holders: [], min_mark: 99, max_mark: -1, spread: 0, total_cost: 0 };
      byBorrower.set(r.slug, row);
    }
    row.holders.push({ ticker: r.ticker, mark, cost: r.cost, fv: r.fv });
    row.total_cost += r.cost;
    if (mark < row.min_mark) row.min_mark = mark;
    if (mark > row.max_mark) row.max_mark = mark;
  }
  const dispersionRows = Array.from(byBorrower.values())
    .filter((r) => r.holders.length >= 3)
    .map((r) => ({ ...r, spread: r.max_mark - r.min_mark }))
    .sort((a, b) => b.spread - a.spread)
    .slice(0, 15);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CreditNav />
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: "#8b8ba8" }}
      >
        <ArrowLeft size={14} /> Back to home
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="px-2.5 py-1 rounded text-sm font-bold" style={{
            background: "rgba(239,68,68,0.12)",
            color: "#fca5a5",
            border: "1px solid rgba(239,68,68,0.3)",
          }}>
            Credit
          </span>
          <span className="text-xs px-2 py-1 rounded border" style={{
            color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
          }}>
            Time Series · Beta
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Cross-BDC credit through time</h1>
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          BDCs as rows, quarter-ends as columns. Each cell is the metric expressed as a percent (or
          basis points for spreads); companion charts show the industry-wide aggregate
          (cost-weighted across BDCs; hover a point for how many BDCs it pools).{" "}
          <Link href="/methodology" className="hover:text-white" style={{ color: "#a5b4fc" }}>
            How is this computed? →
          </Link>
        </p>
      </div>

      {/* Section nav */}
      <div className="rounded-xl border mb-8 p-3 flex items-center gap-3 flex-wrap text-xs" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <span style={{ color: "#8b8ba8" }}>Jump to:</span>
        {[
          ["#na", "Non-accrual"],
          ["#below-95", "Below 95¢"],
          ["#below-90", "Below 90¢"],
          ["#mods", "Loan modifications"],
          ["#composition", "Asset mix"],
          ["#spread", "Spread"],
          ["#stressed-loans", "Stressed loans"],
          ["#sectors", "By sector"],
          ["#sponsors", "By sponsor"],
          ["#compare", "Compare BDCs"],
          ["#concentration", "Concentration"],
          ["#dispersion", "Mark dispersion"],
          ["#forward-queue", "Forward queue"],
          ["#pik-cascade", "PIK cascade"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="px-2.5 py-1 rounded border hover:text-white transition-colors"
            style={{ color: "#d1d5db", background: "rgba(99,102,241,0.06)", borderColor: "#2d2d50" }}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Coverage caveat banner */}
      <div className="rounded-lg border p-3 mb-8 flex items-start gap-2.5 text-xs" style={{
        background: "rgba(234,179,8,0.06)",
        borderColor: "rgba(234,179,8,0.25)",
        color: "#fde68a",
      }}>
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <span className="font-semibold">Partial coverage:</span>{" "}
          Caveats now apply per metric family rather than per BDC-quarter as a whole — mark-based
          data (below 95¢ / 90¢, asset mix, spread) surfaces back to 2013 for FSK and 2016 for OBDC
          because those parsers capture par / cost / fv cleanly even pre-XBRL. CCAP and OCSL
          pre-XBRL remain fully muted (parser was extracting summary rows / par missing). FSK&apos;s
          non-accrual before mid-2022 is muted as approximate: those filings don&apos;t mark unfunded
          commitments, so the rate can drift from FSK&apos;s own figure, and a quarter joins the industry
          line only when it is within 1pp of what FSK disclosed. A BDC&apos;s non-accrual rate is shown as unknown (&quot;—&quot;), never as zero,
          when its position flags are incomplete or its figures are on hold; those quarters are also left out
          of the industry non-accrual line, which shows how many BDCs each point pools.
          BDC-quarters with fewer than {MIN_POSITIONS_FOR_RELIABLE} parsed positions are also
          flagged. Only calendar quarter-ends shown.
        </div>
      </div>

      {/* Section 1 — Non-accrual */}
      <section id="na" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Non-accrual rate <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· % of amortized cost</span>
        </h2>
        <CreditHeatmap
          title="% of cost on non-accrual"
          description="Amortized cost of positions flagged non-accrual ÷ amortized cost of all positions in the filing's schedule (debt and equity alike). Where a BDC only reports a total, its reported rate is shown. A dash means the rate is unknown for that quarter, not zero. Cells colored 0% → 2% → 5% → ≥10%."
          periods={periods}
          tickers={tickers}
          cellMap={naMap}
          thresholds={[2, 5, 10]}
          flagKey="f_na"
          metricLabel="Non-accrual positions"
          csvFilename="credit-non-accrual"
        />
        <div className="rounded-xl border mt-4 p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-sm font-semibold text-white mb-1">Industry non-accrual rate</div>
          <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
            Dollar-weighted: total non-accrual cost ÷ total cost across the BDCs with a usable non-accrual rate
            that quarter. A BDC whose rate is unknown that quarter is left out of both sides rather than counted
            as zero, so the pool changes over time — hover a point for how many BDCs it holds.
          </p>
          <CreditLensChart
            data={naLine}
            yLabel="% non-accrual (industry)"
            color="#ef4444"
            overlay={{ series: hyOasSeries, label: "HY OAS", unit: "bps" }}
          />
          {naFirst && naLast && (
            <p className="text-xs mt-2" style={{ color: "#6b6b88" }} data-na-pool={`${naFirst.coverage}-${naLast.coverage}`}>
              Pool: {naFirst.coverage} BDCs in {naFirst.period_end.slice(0, 7)}, {naLast.coverage} in{" "}
              {naLast.period_end.slice(0, 7)}.
              {naThin.length > 0
                ? ` ${naThin.length} quarter${naThin.length === 1 ? "" : "s"} (${naThin[0].period_end.slice(0, 7)}${naThin.length > 1 ? ` to ${naThin[naThin.length - 1].period_end.slice(0, 7)}` : ""}) pool fewer than ${MIN_BDCS_FOR_INDUSTRY} BDCs, so read them as indicative.`
                : ""}
              {" "}Quarters with fewer than {MIN_BDCS_FOR_NA_HISTORY} BDCs are not plotted.
              {naLeftOut.length > 0
                ? ` Not in the ${naLast.period_end.slice(0, 7)} pool: ${naLeftOut.map((r) => `${r.ticker} (${plainNaReason(r.na_publication_status)})`).join(", ")}.`
                : ""}
            </p>
          )}
        </div>
      </section>

      {/* Section 2 — Below 95¢ */}
      <section id="below-95" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Marked below 95¢ of par <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· % of debt cost where FV / par &lt; 0.95</span>
        </h2>
        <CreditHeatmap
          title="% of debt cost marked below 95¢ of par"
          description="Debt positions whose fair value sits below 95% of face. Denominator is debt cost only — equity, warrants, JV and cash positions are excluded since par doesn't apply. Cells colored 0% → 5% → 15% → ≥30%."
          periods={periods}
          tickers={tickers}
          cellMap={lt95Map}
          thresholds={[5, 15, 30]}
          flagKey="f_below_95"
          metricLabel="Loans marked below 95¢ of par"
          csvFilename="credit-below-95"
        />
        <div className="rounded-xl border mt-4 p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-sm font-semibold text-white mb-1">Industry % below 95¢</div>
          <CreditLensChart
            data={lt95Line}
            yLabel="% below 95¢ (industry)"
            color="#f97316"
            overlay={{ series: hyOasSeries, label: "HY OAS", unit: "bps" }}
          />
        </div>
      </section>

      {/* Section 3 — Below 90¢ */}
      <section id="below-90" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Marked below 90¢ of par <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· deeper distress</span>
        </h2>
        <CreditHeatmap
          title="% of debt cost marked below 90¢ of par"
          description="More severe markdown bucket. Denominator is debt cost only. Cells colored 0% → 3% → 10% → ≥20%."
          periods={periods}
          tickers={tickers}
          cellMap={lt90Map}
          thresholds={[3, 10, 20]}
          flagKey="f_below_90"
          metricLabel="Loans marked below 90¢ of par"
          csvFilename="credit-below-90"
        />
        <div className="rounded-xl border mt-4 p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-sm font-semibold text-white mb-1">Industry % below 90¢</div>
          <CreditLensChart
            data={lt90Line}
            yLabel="% below 90¢ (industry)"
            color="#dc2626"
            overlay={{ series: hyOasSeries, label: "HY OAS", unit: "bps" }}
          />
        </div>
      </section>

      {/* Section 4 — Loan modifications */}
      <section id="mods" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Inferred loan changes: cash → PIK <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· flow per quarter · payment-structure changes only</span>
        </h2>
        <CreditHeatmap
          title="Material-rule cash → PIK signals (% of eligible cost)"
          description={
            "Inferred material-rule PIK changes, not confirmed disclosed amendments. " +
            "Numerator = current cost of identified debt meeting the shared cash-to-PIK event rule. " +
            "Denominator = positive-cost debt with observed PIK flags at adjacent calendar quarter-ends. " +
            "PIK events require two preceding cash quarters; persistence is provisional without the next quarter. " +
            "Unknown instruments, unfunded commitments and gaps are excluded. Coverage is partial."
          }
          periods={periods}
          tickers={tickers}
          cellMap={modMap}
          thresholds={[2, 5, 10]}
          flagKey="f_pik"
          metricLabel="PIK positions for context; not the modification event population"
          csvFilename="credit-mods-cash-to-pik"
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry rate of new cash → PIK flips (cost-weighted)</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
              Shared material-rule PIK event cost divided by eligible debt cost in USD.
              Includes provisional persistence and zero-event issuer quarters. Issuer quarters with
              PIK event cost of 30% or more are excluded as outliers; at least 10 issuers are required.
            </p>
            <CreditLensChart data={modPctLine} yLabel="% modified by cost" color="#f97316" />
          </div>
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry inferred PIK changes by severity (% of eligible cost)</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
              The same event population and denominator as the headline. Severity is the PIK share
              of total coupon: minimal &lt;20%, moderate 20–50%, severe ≥50% or all-PIK, or unknown.
              Newest observations can still have provisional persistence.
            </p>
            <SeverityStackedBars data={severityIndustry} yLabel="% of eligible cost" unit="%" />
          </div>
        </div>

        {/* Recent severity table */}
        <div
          className="rounded-xl border overflow-hidden mt-4"
          style={{ background: "#111118", borderColor: "#1e1e2e" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
            <h3 className="font-semibold text-white text-sm">Recent inferred PIK changes by severity (last 8 quarters)</h3>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              Per-BDC share of eligible debt cost, including unknown severity. Provisional counts
              are a subset of total signals. PIK → cash means an observed payment change, not a credit cure.
            </p>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: 380 }}>
            <table className="w-full text-sm">
              <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e", position: "sticky", top: 0, zIndex: 1 }}>
                <tr>
                  {["Quarter", "BDC", "% PIK signals", "Severe %", "Moderate %", "Minimal %", "Unknown %", "# signals", "# provisional", "# PIK → cash", "Net #"].map((h) => (
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
                {severityTableRows.map((r, i) => {
                  const totalPct = r.total_cost > 0 ? 100 * r.new_mods_cost / r.total_cost : 0;
                  const fmtPct = (v: number) => `${v.toFixed(2)}%`;
                  return (
                  <tr
                    key={`${r.ticker}-${r.period_end}-${i}`}
                    className="border-t"
                    style={{
                      borderColor: "#1a1a28",
                      background: i % 2 === 0 ? "#111118" : "#0f0f16",
                    }}
                  >
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#d1d5db" }}>{r.period_end}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="text-xs font-mono font-semibold hover:text-white" style={{ color: "#a5b4fc" }}>
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-white">{fmtPct(totalPct)}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: r.pct_new_severe_cost > 0 ? "#dc2626" : "#6b6b88" }}>
                      {fmtPct(r.pct_new_severe_cost)}
                    </td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: r.pct_new_moderate_cost > 0 ? "#f97316" : "#6b6b88" }}>
                      {fmtPct(r.pct_new_moderate_cost)}
                    </td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: r.pct_new_minimal_cost > 0 ? "#fde68a" : "#6b6b88" }}>
                      {fmtPct(r.pct_new_minimal_cost)}
                    </td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: r.pct_new_unknown_cost > 0 ? "#94a3b8" : "#6b6b88" }}>
                      {fmtPct(r.pct_new_unknown_cost)}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: r.new_mods > 0 ? "#d1d5db" : "#6b6b88" }}>
                      {r.new_mods}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: r.new_provisional > 0 ? "#fbbf24" : "#6b6b88" }}>
                      {r.new_provisional}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: r.cured > 0 ? "#22c55e" : "#6b6b88" }}>
                      {r.cured}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold" style={{
                      color: r.net > 0 ? "#ef4444" : r.net < 0 ? "#22c55e" : "#9ca3af",
                    }}>
                      {r.net > 0 ? "+" : ""}{r.net}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
          A first observation already paying PIK is not a newly observed cash → PIK event.
          Two consecutive prior cash quarters are required. Matching uses observed terms and
          borrower identity; refinancing, sales and amendments can remain ambiguous. The named
          table below includes additional inferred modification types, so its all-signal count
          exceeds the PIK-only count above. Filter it to cash → PIK for the same event population.
        </p>

        <ModificationEventsTable events={modificationEvents} />
      </section>

      {/* Section 4b — Forward queue: per-BDC implied NA formation.
          Companion to the cash→PIK table above: mods are the stress ACTIONS
          managers took this quarter; this is the FORWARD view, scored on
          signals tested out of sample (scripts/78). */}
      <section id="forward-queue" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Forward queue: implied non-accrual formation{" "}
          <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            next 2 quarters, as of {ewsMeta.as_of}
          </span>
        </h2>
        <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <p className="text-xs mb-4 max-w-4xl" style={{ color: "#9ca3af" }}>
            The modification tables above show the stress <span className="text-white">actions</span>{" "}
            managers took this quarter; this is a <span className="text-white">forward</span>{" "}view. Every loan
            not yet on non-accrual gets a score from the warning signals that carry points in the current fit
            ({joinList(scoringSignals())}). The score was fitted on data through {ewsMeta.trained_through} and then tested on{" "}
            {ewsMeta.validated.replace("..", " to ")}, which it had not seen: of the loans in each score bucket,{" "}
            {ewsMeta.validation_buckets.map((b) => `${b.hit_rate_pct}% (score ${b.bucket.replace("-+", "+")})`).join(", ")}{" "}
            went on non-accrual within two quarters, against {ewsMeta.validation_base_rate_pct}% overall.{" "}
            {ewsLabelText} Each BDC&apos;s implied figure applies those hit rates to its own scored loans; where a
            warning signal can&apos;t be observed it counts as not firing, so a BDC with signal coverage below 100% has
            a lower-bound figure. Per-loan queue on the{" "}
            <Link href="/watchlist" className="text-indigo-400 hover:text-indigo-300">Watchlist</Link>; the separate
            BDC-level projection table is at{" "}
            <Link href="/watchlist#gated-na-projections" className="text-indigo-400 hover:text-indigo-300">Watchlist → projections</Link>.
          </p>
          {(() => {
            const rows = ewsByBdc.filter((r) => r.ticker !== "industry");
            const ind = ewsByBdc.find((r) => r.ticker === "industry");
            const maxPct = Math.max(0.0001, ...rows.map((r) => r.implied_na_2q_pct ?? 0));
            const indPct = ind?.implied_na_2q_pct ?? null;
            const covOf = (r: (typeof ewsByBdc)[number]) =>
              typeof r.signal_coverage_pct === "number" && Number.isFinite(r.signal_coverage_pct) ? r.signal_coverage_pct : null;
            const isLowerBound = (r: (typeof ewsByBdc)[number]) => (covOf(r) ?? 0) < 100;
            return (
              <div className="space-y-1.5" data-forward-queue-rows={rows.length}>
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider" style={{ color: "#6b6b88" }}>
                  <span className="w-14">BDC</span>
                  <span className="flex-1">implied non-accrual formation, % of eligible debt</span>
                  <span className="w-16 text-right">rate</span>
                  <span className="w-24 text-right">$ implied</span>
                  <span className="w-20 text-right" title="share of the scored book whose signals could all be checked">signals seen</span>
                  <span className="hidden sm:inline w-44 text-right">high-score loans</span>
                </div>
                {rows.map((r) => {
                  const cov = covOf(r);
                  const lb = isLowerBound(r) ? "≥" : "";
                  return (
                    <div key={r.ticker} className="flex items-center gap-3 text-sm">
                      <Link href={`/bdcs/${r.ticker.toLowerCase()}`}
                        className="w-14 font-mono text-xs text-indigo-300 hover:text-indigo-200">
                        {r.ticker}
                      </Link>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
                        <div className="h-full rounded-full" style={{
                          width: `${(100 * (r.implied_na_2q_pct ?? 0)) / maxPct}%`,
                          background: indPct != null && r.implied_na_2q_pct >= indPct * 1.25
                            ? "#ef4444" : indPct != null && r.implied_na_2q_pct >= indPct
                            ? "#f59e0b" : "#6366f1",
                        }} />
                      </div>
                      <span className="w-16 text-right tabular-nums font-semibold text-white">
                        {r.implied_na_2q_pct == null ? "—" : `${lb}${r.implied_na_2q_pct.toFixed(2)}%`}
                      </span>
                      <span className="w-24 text-right tabular-nums text-xs" style={{ color: "#9ca3af" }}>
                        {r.implied_na_2q_m == null ? "—" : `${lb}$${r.implied_na_2q_m.toFixed(0)}M`}
                      </span>
                      <span className="w-20 text-right tabular-nums text-xs"
                        style={{ color: cov == null ? "#6b6b88" : cov < 80 ? "#fcd34d" : "#9ca3af" }}>
                        {cov == null ? "—" : `${cov.toFixed(0)}%`}
                      </span>
                      <span className="hidden sm:inline w-44 text-right tabular-nums text-xs whitespace-nowrap" style={{ color: "#6b7280" }}>
                        {r.n_hi} loans · {r.pct_book_hi.toFixed(1)}% of book
                      </span>
                    </div>
                  );
                })}
                {ind && (
                  <p className="text-xs pt-2" style={{ color: "#6b6b88" }}>
                    Industry reference: {ind.implied_na_2q_pct.toFixed(2)}% of the eligible (not yet
                    non-accrual) book, ${(ind.implied_na_2q_m / 1000).toFixed(1)}B implied across{" "}
                    {ind.n_scored.toLocaleString()} positions
                    {covOf(ind) != null ? `, with signals seen on ${covOf(ind)!.toFixed(0)}% of it` : ""}. Bars are % of
                    each BDC&apos;s own eligible debt book — red ≥1.25× industry, amber ≥ industry. &quot;Signals
                    seen&quot; is the share of the scored book whose signals could all be checked. A signal that
                    could not be checked counts as absent, so where it is below 100% the implied figure is a lower
                    bound (marked ≥). High-score loans score 5 or more.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* Section 5 — Asset composition (moved below modifications) */}
      <section id="composition" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Asset composition <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · 1st lien / 2nd lien / equity / other, as % of amortized cost
          </span>
        </h2>
        <CreditHeatmap
          title="% of cost in FIRST LIEN debt"
          description="Senior-secured first-lien exposure as a share of total amortized cost. Higher = more conservative. Cells colored 0% → 60% → 80% → ≥95%."
          periods={periods}
          tickers={tickers}
          cellMap={firstLienMap}
          thresholds={[60, 80, 95]}
          csvFilename="credit-first-lien"
        />
        <div className="mt-4">
          <CreditHeatmap
            title="% of cost in EQUITY (common, preferred, warrants)"
            description="Equity exposure across each book. Cells colored 0% → 3% → 8% → ≥15%."
            periods={periods}
            tickers={tickers}
            cellMap={equityMap}
            thresholds={[3, 8, 15]}
            csvFilename="credit-equity"
          />
        </div>
        <div className="mt-4">
          <AssetCompositionChart
            data={industryComposition}
            title="Industry composition mix over time"
            subtitle="Position-weighted average composition across reliable BDCs each quarter (stacked-area, normalized to 100%)."
          />
        </div>
      </section>

      {/* Section 6 — Spread (moved below modifications) */}
      <section id="spread" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Weighted-average spread <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · book vs new originations, basis points
          </span>
        </h2>
        <CreditHeatmap
          title="Book weighted-avg spread (bps)"
          description={"Cost-weighted spread of the whole debt book each quarter, on a SOFR-equivalent basis (Prime-based loans shifted +290bps; filers that print all-in rates converted using a base rate measured from the panel each quarter). " +
            "Cells colored 400 → 525 → 625 → ≥750 bps. Most direct-lending term loans live in the 500-650 range."}
          periods={periods}
          tickers={tickers}
          cellMap={bookSpreadMap}
          thresholds={[525, 625, 750]}
          unit=" bps"
          csvFilename="credit-book-spread"
        />
        <div className="mt-4">
          <CreditHeatmap
            title="Weighted-avg spread on NEW loans this quarter (bps)"
            description="Same calc, but only on loans first seen this quarter (new originations / new commitments). A BDC's first covered quarter and quarters right after a coverage gap count nothing as new, and a cell needs ≥3 new loans to print. Cells colored 400 → 525 → 625 → ≥750 bps."
            periods={periods}
            tickers={tickers}
            cellMap={newSpreadMap}
            thresholds={[525, 625, 750]}
            unit=" bps"
            csvFilename="credit-new-loan-spread"
          />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry book spread (bps)</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>Cost-weighted (USD) average of book spread across reporting BDCs each quarter.</p>
            <CreditLensChart
              data={bookSpreadLine}
              yLabel="Book spread (bps)"
              unit=""
              color="#22c55e"
              overlay={{ series: ffrSeries, label: "Fed Funds", unit: "%" }}
            />
          </div>
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry new-loan spread (bps)</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>Cost-weighted (USD) average of new-loan spreads across reporting BDCs each quarter. The new-loan series leads the book — gives the cleanest read on spread compression / widening in primary direct lending.</p>
            <CreditLensChart
              data={newSpreadLine}
              yLabel="New-loan spread (bps)"
              unit=""
              color="#a855f7"
              overlay={{ series: hyOasSeries, label: "HY OAS", unit: "bps" }}
            />
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
          Spreads parsed from each SOI&apos;s rate text and normalized to a SOFR/LIBOR-equivalent basis:
          Prime-based loans are shifted +290bps (Prime runs ~290bps above SOFR), and filings that print
          only the all-in rate next to an index (e.g. &quot;SOFR +&quot; / &quot;9.2%&quot;) are converted by subtracting
          the base rate observed that quarter from filers who print both the spread and the all-in rate.
          Fixed-rate notes, equity/preferred and hedges are excluded — as are BDC-quarters where fewer
          than 20 positions or less than 20% of debt cost parse to a usable spread.
        </p>
      </section>

      {/* Section 7 — Top stressed loans (latest quarter) */}
      <section id="stressed-loans" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Top stressed loans <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · {stressedLatestPeriod} · biggest absolute write-downs across the industry
          </span>
        </h2>
        <SortableTable
          data={topStressed}
          rowKey={(r) => `${r.ticker}-${r.company}-${r.investment_type ?? ""}-${r.maturity_date ?? ""}`}
          dense
          initialSort={{ key: "markdown_m", dir: "desc" }}
          headerSlot={
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <p className="text-xs flex-1" style={{ color: "#8b8ba8" }}>
                Ranked by absolute markdown (cost − fair value) in the most recent quarter we have
                position-level data for. Click any column header to sort.
              </p>
              <CsvDownloadButton
                filename={`credit-top-stressed-loans-${stressedLatestPeriod}`}
                columns={["ticker", "period_end", "company", "investment_type", "industry", "cost_m", "fv_m", "markdown_m", "mark_at_par", "f_na", "f_below_95", "f_below_90", "f_below_80", "f_pik"]}
                rows={topStressed.map((p) => [
                  p.ticker, p.period_end, p.company, p.investment_type, p.industry,
                  p.cost_m, p.fv_m, p.markdown_m, p.mark_at_par,
                  p.f_na, p.f_below_95, p.f_below_90, p.f_below_80, p.f_pik,
                ])}
              />
            </div>
          }
          columns={[
            { key: "ticker", label: "BDC", render: (r) => (
              <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="font-mono hover:text-white" style={{ color: "#a5b4fc" }}>{r.ticker}</Link>
            ) },
            { key: "company", label: "Borrower", render: (r) => (
              <span style={{ display: "inline-block", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.company}</span>
            ) },
            { key: "investment_type", label: "Type", render: (r) => (
              <span style={{ color: "#9ca3af" }}>{r.investment_type ?? "—"}</span>
            ) },
            { key: "cost_m", label: "Cost ($M)", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#fafafa" }}>{r.cost_m.toFixed(1)}</span>
            ) },
            { key: "fv_m", label: "FV ($M)", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#fafafa" }}>{r.fv_m.toFixed(1)}</span>
            ) },
            { key: "markdown_m", label: "Markdown ($M)", align: "right", render: (r) => (
              <span className="font-mono font-semibold" style={{ color: "#fca5a5" }}>{r.markdown_m.toFixed(1)}</span>
            ) },
            { key: "mark_at_par", label: "Mark", align: "right", render: (r) => (
              <span className="font-mono" style={{
                color: r.mark_at_par === null ? "#6b6b88" :
                  r.mark_at_par < 0.8 ? "#fca5a5" :
                  r.mark_at_par < 0.9 ? "#fdba74" : "#fde68a",
              }}>
                {r.mark_at_par === null ? "—" : `${(r.mark_at_par * 100).toFixed(0)}¢`}
              </span>
            ) },
            { key: "flags", label: "Flags", sortable: false, render: (r) => (
              <span className="flex gap-1 flex-wrap text-[10px]">
                {r.f_na === 1 && <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5" }}>NA</span>}
                {r.f_below_80 === 1 && <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(220,38,38,0.15)", color: "#fca5a5" }}>&lt;80¢</span>}
                {r.f_below_90 === 1 && r.f_below_80 === 0 && <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(249,115,22,0.15)", color: "#fdba74" }}>&lt;90¢</span>}
                {r.f_pik === 1 && <span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(168,85,247,0.15)", color: "#d8b4fe" }}>PIK</span>}
              </span>
            ) },
          ] as Column<typeof topStressed[number]>[]}
        />
      </section>

      {/* Section 7b — By sector */}
      <section id="sectors" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Credit metrics by sector <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · {sectorCredit[0]?.period_end ?? ""} · industry-wide
          </span>
        </h2>
        <SortableTable
          data={sectorCredit}
          rowKey={(r) => r.sector}
          dense
          initialSort={{ key: "total_cost_b", dir: "desc" }}
          headerSlot={
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <p className="text-xs flex-1" style={{ color: "#8b8ba8" }}>
                Free-text industry tags from each SOI normalized to ~10 canonical sectors.
                Mark-based metrics use the same debt-shape filter as the main heatmaps
                (par ≈ cost). &quot;Unclassified&quot; is positions whose SOI didn&apos;t carry
                an industry tag; &quot;Other&quot; is industry tags that didn&apos;t match any
                canonical sector. PIK is the known-positive lower bound because this legacy
                sector rollup does not yet publish an unknown-exposure upper bound. See <Link href="/methodology" className="hover:text-white underline" style={{ color: "#a5b4fc" }}>methodology</Link> for the mapping.
              </p>
              <CsvDownloadButton
                filename={`credit-by-sector-${sectorCredit[0]?.period_end ?? "latest"}`}
                columns={["sector", "period_end", "n_positions", "total_cost_b", "debt_cost_b", "pct_below_95", "pct_below_90", "pct_non_accrual", "pct_pik"]}
                rows={sectorCredit.map((r) => [
                  r.sector, r.period_end, r.n_positions, r.total_cost_b, r.debt_cost_b,
                  r.pct_below_95, r.pct_below_90, r.pct_non_accrual, r.pct_pik,
                ])}
              />
            </div>
          }
          columns={[
            { key: "sector", label: "Sector", render: (r) => (
              <span className="font-semibold" style={{
                color: "#d1d5db",
                opacity: r.sector === "Other" || r.sector === "Unclassified" ? 0.7 : 1,
              }}>{r.sector}</span>
            ) },
            { key: "n_positions", label: "# positions", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#9ca3af" }}>{r.n_positions.toLocaleString()}</span>
            ) },
            { key: "total_cost_b", label: "Cost ($B)", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#fafafa" }}>{r.total_cost_b.toFixed(1)}</span>
            ) },
            { key: "pct_non_accrual", label: "% non-accrual", align: "right", render: (r) => (
              <span className="font-mono" style={{
                color: r.pct_non_accrual >= 3 ? "#fca5a5" : r.pct_non_accrual >= 1 ? "#fde68a" : "#9ca3af",
              }}>{r.pct_non_accrual.toFixed(2)}%</span>
            ) },
            { key: "pct_below_95", label: "% below 95¢", align: "right", render: (r) => (
              <span className="font-mono" style={{
                color: r.pct_below_95 >= 20 ? "#fca5a5" : r.pct_below_95 >= 10 ? "#fdba74" : r.pct_below_95 >= 5 ? "#fde68a" : "#9ca3af",
              }}>{r.pct_below_95.toFixed(2)}%</span>
            ) },
            { key: "pct_below_90", label: "% below 90¢", align: "right", render: (r) => (
              <span className="font-mono" style={{
                color: r.pct_below_90 >= 10 ? "#fca5a5" : r.pct_below_90 >= 5 ? "#fdba74" : "#9ca3af",
              }}>{r.pct_below_90.toFixed(2)}%</span>
            ) },
            { key: "pct_pik", label: "% PIK lower", align: "right", render: (r) => (
              <span className="font-mono" style={{
                color: r.pct_pik >= 20 ? "#d8b4fe" : r.pct_pik >= 10 ? "#c4b5fd" : "#9ca3af",
              }}>{r.pct_pik.toFixed(2)}%</span>
            ) },
          ] as Column<typeof sectorCredit[number]>[]}
        />
      </section>

      {/* Section 7b2 — By sponsor */}
      <section id="sponsors" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Credit metrics by PE sponsor <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · top 20 by aggregate fair value · position-count weighted
          </span>
        </h2>
        <SortableTable
          data={topSponsors}
          rowKey={(s) => s.sponsor_slug}
          dense
          initialSort={{ key: "total_fv", dir: "desc" }}
          headerSlot={
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <p className="text-xs flex-1" style={{ color: "#8b8ba8" }}>
                For each PE sponsor in our mapping, every borrower we&apos;ve attributed to that
                sponsor — across all 19 BDCs — rolled up into a single credit snapshot. Sponsors
                with fewer than 30 positions across the universe are excluded as too thin a sample.
                Mark-based percentages are position-count weighted (not dollar-weighted) so a
                single mega-deal doesn&apos;t dominate. Sponsor → company mapping comes from
                bdctransparency.io. Current PIK is the share of positions known to pay PIK; where some
                positions&apos; PIK status is unknown and counting them all as PIK would add more than 1pp, the
                range is shown (hover for coverage).
              </p>
              <CsvDownloadButton
                filename="credit-by-sponsor"
                columns={["sponsor", "n_companies", "n_positions", "total_fv_usd", "pct_below_95", "pct_below_90", "pct_non_accrual", "pct_pik_now_lower", "pct_pik_now_upper", "pik_observation_coverage_pct", "pct_modified"]}
                rows={topSponsors.map((s) => [
                  s.sponsor, s.n_companies, s.n_positions, s.total_fv,
                  s.pct_below_95, s.pct_below_90, s.pct_non_accrual, s.pct_pik_now, s.pct_pik_now_upper ?? null,
                  s.pik_observation_coverage_pct ?? null, s.pct_modified,
                ])}
              />
            </div>
          }
          columns={[
            { key: "sponsor", label: "Sponsor", render: (s) => (
              <Link href={`/sponsors/${s.sponsor_slug}`} className="font-semibold hover:text-white" style={{ color: "#a5b4fc" }}>
                {s.sponsor}
              </Link>
            ) },
            { key: "n_companies", label: "# companies", align: "right", render: (s) => (
              <span className="font-mono" style={{ color: "#9ca3af" }}>{s.n_companies}</span>
            ) },
            { key: "n_positions", label: "# positions", align: "right", render: (s) => (
              <span className="font-mono" style={{ color: "#9ca3af" }}>{s.n_positions}</span>
            ) },
            { key: "total_fv", label: "Aggregate FV ($M)", align: "right", render: (s) => (
              <span className="font-mono" style={{ color: "#fafafa" }}>
                {(s.total_fv / 1e6).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            ) },
            { key: "pct_non_accrual", label: "% non-accrual", align: "right", render: (s) => (
              <span className="font-mono" style={{
                color: s.pct_non_accrual >= 3 ? "#fca5a5" : s.pct_non_accrual >= 1 ? "#fde68a" : "#9ca3af",
              }}>{s.pct_non_accrual.toFixed(2)}%</span>
            ) },
            { key: "pct_below_95", label: "% below 95¢", align: "right", render: (s) => (
              <span className="font-mono" style={{
                color: s.pct_below_95 >= 25 ? "#fca5a5" : s.pct_below_95 >= 15 ? "#fdba74" : s.pct_below_95 >= 8 ? "#fde68a" : "#9ca3af",
              }}>{s.pct_below_95.toFixed(2)}%</span>
            ) },
            { key: "pct_below_90", label: "% below 90¢", align: "right", render: (s) => (
              <span className="font-mono" style={{
                color: s.pct_below_90 >= 15 ? "#fca5a5" : s.pct_below_90 >= 8 ? "#fdba74" : "#9ca3af",
              }}>{s.pct_below_90.toFixed(2)}%</span>
            ) },
            { key: "pct_pik_now", label: "% currently PIK", align: "right", render: (s) => {
              const pik = sponsorPikPublication(s);
              const range = pikRangeText(pik);
              return (
                <span className="font-mono" style={{
                  color: (pik.lower ?? 0) >= 25 ? "#d8b4fe" : (pik.lower ?? 0) >= 12 ? "#c4b5fd" : "#9ca3af",
                }} title={[range ? `range ${range}` : null, pik.observationCoveragePct == null ? null
                  : `${pik.observationCoveragePct.toFixed(1)}% of positions observed`].filter(Boolean).join(" · ") || undefined}>
                  {formatPikPublication(pik)}
                </span>
              );
            } },
            { key: "pct_modified", label: "% modified cash→PIK", align: "right", render: (s) => (
              <span className="font-mono" style={{
                color: s.pct_modified >= 10 ? "#a855f7" : s.pct_modified >= 5 ? "#c084fc" : "#9ca3af",
              }}>{s.pct_modified.toFixed(2)}%</span>
            ) },
          ] as Column<typeof topSponsors[number]>[]}
        />
      </section>

      {/* Section 7c — Compare BDCs */}
      <section id="compare" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Compare BDCs <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · overlay any mix of BDCs and metrics, including watchlist severity
          </span>
        </h2>
        <BDCComparePanel rows={compareRows} tickers={tickers} />
      </section>

      {/* Section 8 — Concentration */}
      <section id="concentration" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Concentration <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · top borrowers by aggregate cost across all covered BDCs
          </span>
        </h2>
        <SortableTable
          data={topByCost.map((b) => ({
            ...b,
            pct_of_industry: (100 * b.total_cost) / industryTotalCost,
          }))}
          rowKey={(b) => b.slug}
          dense
          initialSort={{ key: "total_cost", dir: "desc" }}
          headerSlot={
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <p className="text-xs flex-1" style={{ color: "#8b8ba8" }}>
                Direct-lending borrowers ranked by total amortized cost summed across every BDC
                that holds them. The right-hand column shows what share of the entire
                universe&apos;s parsed cost the borrower represents. Obvious aggregator rows (JV
                vehicles, &quot;Senior Direct Lending Program&quot;, etc.) are excluded.
              </p>
              <CsvDownloadButton
                filename="credit-concentration-top-borrowers"
                columns={["name", "industry", "n_holders", "total_cost_usd", "pct_of_industry"]}
                rows={topByCost.map((b) => [
                  b.name, b.industry || "",
                  b.n_holders, b.total_cost,
                  (100 * b.total_cost) / industryTotalCost,
                ])}
              />
            </div>
          }
          columns={[
            { key: "name", label: "Borrower", render: (b) => (
              <Link href={`/borrowers/${b.slug}`} className="hover:text-white" style={{ color: "#a5b4fc" }}>
                {b.name}
              </Link>
            ) },
            { key: "industry", label: "Industry", render: (b) => (
              <span style={{ color: "#9ca3af" }}>{b.industry || "—"}</span>
            ) },
            { key: "n_holders", label: "BDC holders", align: "right", render: (b) => (
              <span className="font-mono" style={{ color: b.n_holders >= 5 ? "#fdba74" : "#d1d5db" }}>
                {b.n_holders}
              </span>
            ) },
            { key: "total_cost", label: "Aggregate cost ($M)", align: "right", render: (b) => (
              <span className="font-mono" style={{ color: "#fafafa" }}>{(b.total_cost / 1e6).toFixed(0)}</span>
            ) },
            { key: "pct_of_industry", label: "% of industry", align: "right", render: (b) => (
              <span className="font-mono" style={{ color: "#9ca3af" }}>{b.pct_of_industry.toFixed(2)}%</span>
            ) },
          ] as Column<typeof topByCost[number] & { pct_of_industry: number }>[]}
        />
      </section>

      {/* Section 9 — Cross-BDC mark dispersion */}
      <section id="dispersion" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Cross-BDC mark dispersion <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · {dispersionLatest} · same loan, different BDCs, different marks
          </span>
        </h2>
        <SortableTable
          data={dispersionRows.map((r) => ({
            ...r,
            n_holders: r.holders.length,
            spread_pp: r.spread * 100,
            holder_detail: r.holders
              .slice().sort((a, b) => a.mark - b.mark)
              .map((h) => `${h.ticker}: ${(h.mark * 100).toFixed(0)}¢`)
              .join(" · "),
          }))}
          rowKey={(r) => r.slug}
          dense
          initialSort={{ key: "spread_pp", dir: "desc" }}
          headerSlot={
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <p className="text-xs flex-1" style={{ color: "#8b8ba8" }}>
                When three or more BDCs hold the same borrower, their marks should agree
                (it&apos;s the same credit). Large dispersion means BDCs disagree on the credit
                quality — worth investigating. Marks are fair value / cost.
              </p>
              <CsvDownloadButton
                filename={`credit-mark-dispersion-${dispersionLatest}`}
                columns={["name", "n_holders", "min_mark", "max_mark", "spread_pp", "total_cost_usd", "holder_detail"]}
                rows={dispersionRows.map((r) => [
                  r.name, r.holders.length,
                  r.min_mark, r.max_mark, r.spread * 100,
                  r.total_cost,
                  r.holders.slice().sort((a, b) => a.mark - b.mark)
                    .map((h) => `${h.ticker}=${(h.mark * 100).toFixed(1)}c`).join("; "),
                ])}
              />
            </div>
          }
          columns={[
            { key: "name", label: "Borrower", render: (r) => (
              <Link href={`/borrowers/${r.slug}`} className="hover:text-white" style={{ color: "#a5b4fc" }}>
                {r.name}
              </Link>
            ) },
            { key: "n_holders", label: "Holders", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#d1d5db" }}>{r.n_holders}</span>
            ) },
            { key: "min_mark", label: "Min mark", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#fca5a5" }}>{(r.min_mark * 100).toFixed(1)}¢</span>
            ) },
            { key: "max_mark", label: "Max mark", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#86efac" }}>{(r.max_mark * 100).toFixed(1)}¢</span>
            ) },
            { key: "spread_pp", label: "Spread (pp)", align: "right", render: (r) => (
              <span className="font-mono font-semibold" style={{
                color: r.spread_pp > 15 ? "#fca5a5" : r.spread_pp > 5 ? "#fdba74" : "#9ca3af",
              }}>{r.spread_pp.toFixed(1)}</span>
            ) },
            { key: "total_cost", label: "Total cost ($M)", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#9ca3af" }}>{(r.total_cost / 1e6).toFixed(0)}</span>
            ) },
            { key: "holder_detail", label: "Detail", sortable: false, render: (r) => (
              <span className="text-[10px]" style={{ color: "#8b8ba8" }}>{r.holder_detail}</span>
            ) },
          ] as Column<typeof dispersionRows[number] & { n_holders: number; spread_pp: number; holder_detail: string }>[]}
        />
      </section>

      {/* Section 10 — PIK cascade (loan-tranche level) */}
      <section id="pik-cascade" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          PIK cascade <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · what happens to a loan a year after it switches from cash interest to PIK
          </span>
        </h2>
        <SortableTable
          data={cascadeRows}
          rowKey={(r) => r.year}
          dense
          initialSort={{ key: "year", dir: "desc" }}
          emptyMessage="Not enough loans have been followed from a cash → PIK switch yet."
          headerSlot={
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <p className="text-xs flex-1" style={{ color: "#8b8ba8" }}>
                For every loan we saw switch from cash-pay to PIK, where was it{" "}
                {cascadeHasPending ? "four calendar quarters later" : "at its fourth later filing (usually a year later)"}?
                Each loan tranche is followed on its own, so a borrower with several tranches counts once per
                tranche. <b>Back to cash-pay</b>{" "}means the loan was paying cash interest again.{" "}
                <b>Still PIK</b>{" "}is split by the loan&apos;s mark then; below 80¢ is the worst outcome.
                {cascadeHasMarkUnknown ? <> <b>Mark unknown</b>{" "}means it was still PIK but its mark could not be read.</> : null}{" "}
                <b>Left the book</b>{" "}means the BDC was filing but the loan was gone — a refinancing, repayment,
                sale or write-off; the filings do not say which.
                {cascadeHasStatusUnknown
                  ? <> <b>Status unknown</b>{" "}means the BDC&apos;s filing four quarters later is not on file, or the loan&apos;s PIK status in it can&apos;t be read — it is not counted as any outcome.</>
                  : null}
                {cascadeHasPending
                  ? <> <b>Not yet seasoned</b>{" "}means the four quarters have not passed yet; rows that are mostly unseasoned are dimmed.</>
                  : <> For switches in {cascadeIncompleteYears.length ? joinList(cascadeIncompleteYears) : "the latest year"} the year of follow-up has
                    not passed for every loan, so &quot;left the book&quot; there also includes loans not yet followed up;
                    those rows are dimmed.</>}{" "}
                Years with fewer than 10 switches are omitted.
              </p>
              <CsvDownloadButton
                filename="credit-pik-cascade-by-year"
                columns={["flip_year", "n_tranches", "pct_back_to_cash", "pct_pik_90_plus", "pct_pik_80_90",
                  "pct_pik_below_80", "pct_pik_mark_unknown", "pct_left_book", "pct_not_yet_seasoned", "pct_status_unknown",
                  "follow_up_incomplete"]}
                rows={cascadeRows.map((r) => [
                  r.year, r.flips, r.pct_cured, r.pct_pik_strong, r.pct_pik_weak, r.pct_pik_distress,
                  r.pct_mark_unknown, r.pct_exited, r.pct_pending, r.pct_unknown, r.incomplete ? 1 : 0,
                ])}
              />
            </div>
          }
          columns={([
            { key: "year", label: "Switch year", render: (r) => (
              <span style={{ opacity: r.incomplete ? 0.55 : 1 }}>
                <span className="font-mono" style={{ color: "#d1d5db" }}>{r.year}</span>
                {r.incomplete && <span className="ml-1 text-[10px]" style={{ color: "#fdba74" }}>(follow-up incomplete)</span>}
              </span>
            ) },
            { key: "flips", label: "# tranches", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#fafafa", opacity: r.incomplete ? 0.55 : 1 }}>{r.flips}</span>
            ) },
            { key: "pct_cured", label: "% back to cash-pay", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#86efac", opacity: r.incomplete ? 0.55 : 1 }}>{fmtCascade(r.pct_cured)}</span>
            ) },
            { key: "pct_pik_strong", label: "% still PIK · ≥90¢", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#fde68a", opacity: r.incomplete ? 0.55 : 1 }}>{fmtCascade(r.pct_pik_strong)}</span>
            ) },
            { key: "pct_pik_weak", label: "% still PIK · 80–90¢", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#fdba74", opacity: r.incomplete ? 0.55 : 1 }}>{fmtCascade(r.pct_pik_weak)}</span>
            ) },
            { key: "pct_pik_distress", label: "% still PIK · <80¢", align: "right", render: (r) => (
              <span className="font-mono font-semibold" style={{ color: "#fca5a5", opacity: r.incomplete ? 0.55 : 1 }}>{fmtCascade(r.pct_pik_distress)}</span>
            ) },
            ...(cascadeHasMarkUnknown ? [{ key: "pct_mark_unknown", label: "% still PIK · mark unknown", align: "right", render: (r: CascadeDisplayRow) => (
              <span className="font-mono" style={{ color: "#9ca3af", opacity: r.incomplete ? 0.55 : 1 }}>{fmtCascade(r.pct_mark_unknown)}</span>
            ) }] : []),
            { key: "pct_exited", label: "% left the book", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#9ca3af", opacity: r.incomplete ? 0.55 : 1 }}>{fmtCascade(r.pct_exited)}</span>
            ) },
            ...(cascadeHasPending ? [{ key: "pct_pending", label: "% not yet seasoned", align: "right", render: (r: CascadeDisplayRow) => (
              <span className="font-mono" style={{ color: "#6b6b88", opacity: r.incomplete ? 0.55 : 1 }}>{fmtCascade(r.pct_pending)}</span>
            ) }] : []),
            ...(cascadeHasStatusUnknown ? [{ key: "pct_unknown", label: "% status unknown", align: "right", render: (r: CascadeDisplayRow) => (
              <span className="font-mono" style={{ color: "#6b6b88", opacity: r.incomplete ? 0.55 : 1 }}>{fmtCascade(r.pct_unknown)}</span>
            ) }] : []),
          ] as Column<CascadeDisplayRow>[])}
        />
      </section>

      <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
        Source: SEC EDGAR 10-K / 10-Q Schedule of Investments parsing.
        Non-accrual & PIK flags decoded from per-position SOI footnotes.
      </p>
    </div>
  );
}
