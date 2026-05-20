"use client";
import Link from "next/link";
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
import { assetComposition } from "@/data/asset_composition";
import { spreadAnalysis } from "@/data/spread_analysis";
import { stressedPositions } from "@/data/stressed_positions";
import { borrowers } from "@/data/borrowers_index";
import { borrowerHistory } from "@/data/borrowers_history";
import { pikCascade } from "@/data/pik_cascade";
import { sectorCredit } from "@/data/sector_credit";
import { macroContext } from "@/data/macro_context";
import { sponsors } from "@/data/sponsors_index";

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
  // FSK mark-based metrics parse cleanly back to 2013 — only NA flag detection
  // breaks during the FSKR merger era (Q4 2019 – Q3 2021) where the parser
  // misreads merger-adjustment footnotes as non-accrual marks.
  { ticker: "FSK",  until: "2021-09-30", metrics: ["na", "pik"],
    reason: "FSK NA flag detection misfires during the FSKR-merger era (Q4 2019 – Q3 2021)" },
  // OBDC pre-XBRL: mark + NA parse cleanly, but PIK footnotes don't decode.
  { ticker: "OBDC", until: "2022-03-31", metrics: ["pik"],
    reason: "Pre-XBRL OBDC parser doesn't decode PIK footnotes" },
  // MFIC SOI doesn't carry per-position non-accrual / PIK footnotes ever.
  // Keep mark-based metrics visible.
  { ticker: "MFIC", until: "2025-11-30", metrics: ["na", "pik"],
    reason: "MFIC SOI lacks per-position non-accrual / PIK footnotes" },
  // (Historical) OTF parser column-mapping bug fixed in two passes via
  // scripts/74_fix_otf_pik_columns.py (51-col layout 2023-Q3 → 2024-Q4)
  // and scripts/75_fix_otf_48col_pik.py (48-col layout 2023-Q1/Q2 + 2025).
  // OTF PIK / mod data is now structurally correct across all quarters.
];

// Drop BDC-quarter rows with too few positions from industry aggregates and
// heatmap cells — stub/comparative filings can produce 10-position snapshots
// that aren't representative of the BDC's actual book.
const MIN_POSITIONS_FOR_RELIABLE = 30;

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
      value: r[field] as number,
      reliable,
    });
  }
  return m;
}

/**
 * Build an industry-wide series for a credit-quality metric. The aggregate is a
 * COUNT-weighted average of per-BDC percentages, weighting each BDC by its
 * n_positions in that quarter (size-weighted view of the industry). We use
 * positions rather than dollar cost because cost units differ by BDC and unit
 * multipliers aren't carried into the export.
 */
function buildIndustrySeries(field: NumericKeys): IndustryPoint[] {
  const family = metricFamilyOf(field);
  const byPeriod = new Map<string, { sumW: number; sumWV: number; coverage: number }>();
  for (const r of creditQuality) {
    if (!isQuarterEnd(r.period_end)) continue;
    if (!isReliable(r.ticker, r.period_end, family)) continue;
    if (r.ticker !== "industry" && r.n_positions < MIN_POSITIONS_FOR_RELIABLE) continue;
    const w = r.n_positions;
    if (!w) continue;
    if (!byPeriod.has(r.period_end))
      byPeriod.set(r.period_end, { sumW: 0, sumWV: 0, coverage: 0 });
    const slot = byPeriod.get(r.period_end)!;
    slot.sumW += w;
    slot.sumWV += w * (r[field] as number);
    slot.coverage += 1;
  }
  return Array.from(byPeriod.entries())
    .map(([period_end, { sumW, sumWV, coverage }]) => ({
      period_end,
      value: sumW ? sumWV / sumW : 0,
      coverage,
    }))
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
  const m = new Map<string, { value: number | null; reliable?: boolean }>();
  for (const r of modificationRate) {
    if (!isQuarterEnd(r.period_end)) continue;
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r.pct_new_cost,
      reliable: isReliable(r.ticker, r.period_end, "pik"),
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
  const byPeriod = new Map<
    string,
    { newCost: number; totalCost: number; coverage: number }
  >();
  for (const r of modificationRate) {
    if (!isQuarterEnd(r.period_end)) continue;
    if (!isReliable(r.ticker, r.period_end, "pik")) continue;
    if (!byPeriod.has(r.period_end))
      byPeriod.set(r.period_end, { newCost: 0, totalCost: 0, coverage: 0 });
    const slot = byPeriod.get(r.period_end)!;
    slot.newCost += r.new_mods_cost;
    slot.totalCost += r.total_cost;
    slot.coverage += 1;
  }
  return Array.from(byPeriod.entries())
    .map(([period_end, s]) => ({
      period_end,
      value: s.totalCost ? (100 * s.newCost) / s.totalCost : 0,
      coverage: s.coverage,
    }))
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

/** Industry-aggregate weighted-avg spread across BDCs each quarter.
 *  Weighted by the parsed-position count (n_positions_priced or n_new). */
function buildSpreadIndustry(field: "avg_spread_book_bps" | "avg_spread_new_bps",
                              weightField: "n_positions_priced" | "n_new"): IndustryPoint[] {
  const byPeriod = new Map<string, { num: number; den: number; coverage: number }>();
  for (const r of spreadAnalysis) {
    if (!isQuarterEnd(r.period_end)) continue;
    if (!isReliable(r.ticker, r.period_end, "mark")) continue;
    const v = r[field];
    const w = r[weightField];
    if (v === null || v === undefined || !w) continue;
    if (!byPeriod.has(r.period_end))
      byPeriod.set(r.period_end, { num: 0, den: 0, coverage: 0 });
    const s = byPeriod.get(r.period_end)!;
    s.num += (v as number) * w;
    s.den += w;
    s.coverage += 1;
  }
  return Array.from(byPeriod.entries())
    .map(([period_end, s]) => ({
      period_end,
      value: s.den ? s.num / s.den : 0,
      coverage: s.coverage,
    }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

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
  const bookSpreadLine = buildSpreadIndustry("avg_spread_book_bps", "n_positions_priced");
  const newSpreadLine  = buildSpreadIndustry("avg_spread_new_bps",  "n_new");

  const naMap   = buildCreditCellMap("pct_non_accrual");
  const lt95Map = buildCreditCellMap("pct_below_95");
  const lt90Map = buildCreditCellMap("pct_below_90");
  const modMap  = buildModCellMap();

  const naLine   = buildIndustrySeries("pct_non_accrual");
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
  const compareRows: CompareRow[] = creditQuality
    .filter((r) => r.ticker !== "industry" && isQuarterEnd(r.period_end))
    .map((r) => ({
      ticker: r.ticker,
      period_end: r.period_end,
      pct_non_accrual: r.pct_non_accrual,
      pct_below_95: r.pct_below_95,
      pct_below_90: r.pct_below_90,
      pct_pik_total: r.pct_pik_total,
      rel_na:  isReliable(r.ticker, r.period_end, "na")  && r.n_positions >= MIN_POSITIONS_FOR_RELIABLE,
      rel_mark: isReliable(r.ticker, r.period_end, "mark") && r.n_positions >= MIN_POSITIONS_FOR_RELIABLE,
      rel_pik: isReliable(r.ticker, r.period_end, "pik") && r.n_positions >= MIN_POSITIONS_FOR_RELIABLE,
    }));

  // Modifications-by-severity: industry-aggregated COST-weighted % per quarter.
  // Numerator = sum(new_*_cost) across BDCs; denominator = sum(total_cost) across BDCs.
  const sevByPeriod = new Map<string, {
    minimalCost: number; moderateCost: number; severeCost: number; totalCost: number;
  }>();
  for (const r of pikModifications) {
    if (!isQuarterEnd(r.period_end)) continue;
    if (!isReliable(r.ticker, r.period_end, "pik")) continue;
    if (!sevByPeriod.has(r.period_end))
      sevByPeriod.set(r.period_end, { minimalCost: 0, moderateCost: 0, severeCost: 0, totalCost: 0 });
    const s = sevByPeriod.get(r.period_end)!;
    s.minimalCost  += r.new_minimal_cost;
    s.moderateCost += r.new_moderate_cost;
    s.severeCost   += r.new_severe_cost;
    s.totalCost    += r.total_cost;
  }
  const severityIndustry = Array.from(sevByPeriod.entries())
    .map(([period_end, s]) => ({
      period_end,
      minimal:  s.totalCost ? (100 * s.minimalCost)  / s.totalCost : 0,
      moderate: s.totalCost ? (100 * s.moderateCost) / s.totalCost : 0,
      severe:   s.totalCost ? (100 * s.severeCost)   / s.totalCost : 0,
    }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));

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

  // ---------- PIK cascade (C.6) ----------
  // Loan-tranche-level cascade from data/pik_cascade.ts. The Python exporter
  // walks loan_history.loan_id and buckets each cash→PIK flip by its outcome
  // 4 quarters later (cured / still PIK at various mark levels / exited).
  // Flag the most recent year as "follow-up incomplete" — flips from then
  // haven't had time for the full T+4 lookforward.
  const cascadeMaxYear = pikCascade.length
    ? pikCascade[pikCascade.length - 1].year
    : "";
  const cascadeRows = pikCascade.map((r) => ({
    ...r,
    incomplete: r.year === cascadeMaxYear && r.pct_exited > 80,
  }));

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          (position-weighted across BDCs).{" "}
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
          non-accrual is muted through Q3 2021 (FSKR-merger era — parser misreads merger-adjustment
          footnotes as NA). MFIC&apos;s SOI doesn&apos;t carry per-position non-accrual or PIK
          footnotes, so those two columns stay muted; mark-based metrics for MFIC are reliable.
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
          description="Standard BDC credit metric. Cells colored 0% → 2% → 5% → ≥10%."
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
          <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>Position-weighted average across reporting BDCs each quarter.</p>
          <CreditLensChart
            data={naLine}
            yLabel="% non-accrual (industry)"
            color="#ef4444"
            overlay={{ series: hyOasSeries, label: "HY OAS", unit: "bps" }}
          />
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
          Loan modifications: cash → PIK <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· flow per quarter · payment-structure changes only</span>
        </h2>
        <CreditHeatmap
          title="% of cost flipped cash → PIK this quarter"
          description={
            "Loans that switched from cash-pay to PIK (payment-in-kind) interest this quarter. " +
            "STRICT cash/PIK structure changes only — excludes refinancings, partial sales, paydowns, and maturity extensions. " +
            "Each cell = (amortized cost of loans flipped cash → PIK) / (amortized cost of eligible loans). " +
            "Eligible = loans observed in a prior quarter. Cells colored 0% → 2% → 5% → ≥10%. " +
            "Loans whose first observation is already PIK are excluded — we can't tell if they originated PIK or were modified earlier."
          }
          periods={periods}
          tickers={tickers}
          cellMap={modMap}
          thresholds={[2, 5, 10]}
          flagKey="f_pik"
          metricLabel="Loans currently paying PIK"
          csvFilename="credit-mods-cash-to-pik"
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry rate of new cash → PIK flips (cost-weighted)</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
              Sum of newly-PIK cost across reporting BDCs divided by eligible-loan cost.
              Tracks payment-structure changes only. Refis, paydowns, maturity extensions excluded.
            </p>
            <CreditLensChart data={modPctLine} yLabel="% modified by cost" color="#f97316" />
          </div>
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry new modifications by severity (% of cost)</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
              Stacked share of eligible-loan cost flipping cash → PIK each quarter, bucketed by PIK severity
              (minimal &lt;20% / moderate 20–50% / severe ≥50% or all-PIK of total coupon).
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
            <h3 className="font-semibold text-white text-sm">Recent modifications by severity (last 8 quarters)</h3>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              Per-BDC share of eligible-loan cost flipping cash → PIK this quarter, by severity bucket.
              Rows sorted by quarter then severity.
            </p>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: 380 }}>
            <table className="w-full text-sm">
              <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e", position: "sticky", top: 0, zIndex: 1 }}>
                <tr>
                  {["Quarter", "BDC", "% modified (cost)", "Severe %", "Moderate %", "Minimal %", "# mods", "# cured", "Net #"].map((h) => (
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
                  const totalPct = r.pct_new_minimal_cost + r.pct_new_moderate_cost + r.pct_new_severe_cost;
                  const fmtPct = (v: number) => (v > 0 ? `${v.toFixed(2)}%` : "—");
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
                    <td className="px-4 py-2.5 text-xs" style={{ color: r.new_mods > 0 ? "#d1d5db" : "#6b6b88" }}>
                      {r.new_mods || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: r.cured > 0 ? "#22c55e" : "#6b6b88" }}>
                      {r.cured || "—"}
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
          Note on origination: we can only flag a loan as &quot;modified&quot; once we&apos;ve observed
          it in cash-pay state in a prior quarter. Loans that entered our dataset already PIK are not
          counted as modifications — they could either have originated PIK or been modified before we
          had coverage. As back-book parsing improves, more of these will resolve into modifications.
        </p>
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
          description={"Cost-weighted spread of the whole book each quarter. Parsed from the SOI's reference-rate-and-spread text (e.g. 'SOFR + 5.75%' → 575 bps). " +
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
            description="Same calc, but only on loans whose first observation in our dataset is this quarter (i.e., new originations / new commitments). Cells colored 400 → 525 → 625 → ≥750 bps."
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
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>Position-weighted average of book spread across reporting BDCs each quarter.</p>
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
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>Position-weighted average of new-loan spreads across reporting BDCs each quarter. The new-loan series leads the book — gives the cleanest read on spread compression / widening in primary direct lending.</p>
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
          Spread extracted from ref_rate_spread / ref_rate_combined / coupon_rate fields in the SOI.
          Floating-rate loans give a clean spread; fixed-rate notes fall through to coupon as a proxy
          (overstates spread, understates fixed-rate originations). Positions without parseable spread
          text are excluded from the weighted average.
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
                canonical sector. See <Link href="/methodology" className="hover:text-white underline" style={{ color: "#a5b4fc" }}>methodology</Link> for the mapping.
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
            { key: "pct_pik", label: "% PIK", align: "right", render: (r) => (
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
                bdctransparency.io.
              </p>
              <CsvDownloadButton
                filename="credit-by-sponsor"
                columns={["sponsor", "n_companies", "n_positions", "total_fv_usd", "pct_below_95", "pct_below_90", "pct_non_accrual", "pct_pik_now", "pct_modified"]}
                rows={topSponsors.map((s) => [
                  s.sponsor, s.n_companies, s.n_positions, s.total_fv,
                  s.pct_below_95, s.pct_below_90, s.pct_non_accrual, s.pct_pik_now, s.pct_modified,
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
            { key: "pct_pik_now", label: "% currently PIK", align: "right", render: (s) => (
              <span className="font-mono" style={{
                color: s.pct_pik_now >= 25 ? "#d8b4fe" : s.pct_pik_now >= 12 ? "#c4b5fd" : "#9ca3af",
              }}>{s.pct_pik_now.toFixed(2)}%</span>
            ) },
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
            · overlay multiple BDCs on the same metric
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
            · what happens to a loan 4 quarters after it flips cash → PIK
          </span>
        </h2>
        <SortableTable
          data={cascadeRows}
          rowKey={(r) => r.year}
          dense
          initialSort={{ key: "year", dir: "desc" }}
          emptyMessage="Insufficient longitudinal cash → PIK observations yet (need more quarters of consecutive loan-tranche data)."
          headerSlot={
            <div className="px-5 py-4 flex items-start justify-between gap-3">
              <p className="text-xs flex-1" style={{ color: "#8b8ba8" }}>
                For every loan-tranche we observed switching from cash-pay to PIK, where was it
                4 quarters later? Tracked at the <b>loan_id</b> level so a borrower with multiple
                tranches gets attributed to each tranche&apos;s separate fate.{" "}
                <b>Still PIK · distress</b> (mark &lt; 80¢) is the worst outcome; <b>cured</b> means
                the loan went back to cash-pay; <b>exited</b> means it left our parsed data (refi,
                write-off, sale, or paydown — we can&apos;t distinguish without realized-loss
                tracking). Cohorts with fewer than 10 flips omitted. Rows where the flip is too
                recent to have full T+4 follow-up are dimmed.
              </p>
              <CsvDownloadButton
                filename="credit-pik-cascade-by-year"
                columns={["flip_year", "n_tranches", "pct_cured", "pct_pik_strong", "pct_pik_weak", "pct_pik_distress", "pct_exited", "follow_up_incomplete"]}
                rows={cascadeRows.map((r) => [
                  r.year, r.flips, r.pct_cured, r.pct_pik_strong,
                  r.pct_pik_weak, r.pct_pik_distress, r.pct_exited,
                  r.incomplete ? 1 : 0,
                ])}
              />
            </div>
          }
          columns={[
            { key: "year", label: "Flip year", render: (r) => (
              <span style={{ opacity: r.incomplete ? 0.55 : 1 }}>
                <span className="font-mono" style={{ color: "#d1d5db" }}>{r.year}</span>
                {r.incomplete && <span className="ml-1 text-[10px]" style={{ color: "#fdba74" }}>(follow-up incomplete)</span>}
              </span>
            ) },
            { key: "flips", label: "# tranches", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#fafafa", opacity: r.incomplete ? 0.55 : 1 }}>{r.flips}</span>
            ) },
            { key: "pct_cured", label: "% cured", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#86efac", opacity: r.incomplete ? 0.55 : 1 }}>{r.pct_cured.toFixed(1)}%</span>
            ) },
            { key: "pct_pik_strong", label: "% PIK · steady (≥90¢)", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#fde68a", opacity: r.incomplete ? 0.55 : 1 }}>{r.pct_pik_strong.toFixed(1)}%</span>
            ) },
            { key: "pct_pik_weak", label: "% PIK · weak (80–90¢)", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#fdba74", opacity: r.incomplete ? 0.55 : 1 }}>{r.pct_pik_weak.toFixed(1)}%</span>
            ) },
            { key: "pct_pik_distress", label: "% PIK · distress (<80¢)", align: "right", render: (r) => (
              <span className="font-mono font-semibold" style={{ color: "#fca5a5", opacity: r.incomplete ? 0.55 : 1 }}>{r.pct_pik_distress.toFixed(1)}%</span>
            ) },
            { key: "pct_exited", label: "% exited", align: "right", render: (r) => (
              <span className="font-mono" style={{ color: "#9ca3af", opacity: r.incomplete ? 0.55 : 1 }}>{r.pct_exited.toFixed(1)}%</span>
            ) },
          ] as Column<typeof cascadeRows[number]>[]}
        />
      </section>

      <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
        Source: SEC EDGAR 10-K / 10-Q Schedule of Investments parsing.
        Non-accrual & PIK flags decoded from per-position SOI footnotes.
      </p>
    </div>
  );
}
