// Display helpers for the four-quarter non-accrual projection (scripts/83).
//
// Every BDC with non-accrual data is shown. A projection whose model inputs are
// thinly observed is labelled "lower confidence" instead of being hidden, and
// "—" always means "no number", never zero. The generated file may add fields
// (for example an `estimate` flag) or rename statuses, so everything here reads
// the data defensively.
import { naFcMeta, type NaForecastRow } from "@/data/na_forecast";

export interface FormationQuartile {
  q: number;
  pred: number;
  actual: number | null;
  n: number;
}

/** One half of the walk-forward test, split at its middle forecast quarter. */
export interface FormationHalf {
  n: number;
  from: string;
  to: string;
  bias: number;
  mean_abs: number;
  corr: number | null;
}

/** One level group of the 80% range: misses of past forecasts at a similar level. */
export interface FormationBandLevel {
  from: number;
  to: number;
  /** Highest forecast the group covers (null: the top group). */
  upper: number | null;
  n: number;
  /** The published edges (subtract from the forecast): the wider of the group's own and the pooled. */
  band_lo: number;
  band_hi: number;
  /** The group's own 90th / 10th percentile misses. */
  own_lo?: number;
  own_hi?: number;
  /** Share of the group's past outcomes that came in above the forecast. */
  share_above?: number;
}

/** Coverage of one band rule in one leakage-free check (scripts/83 band_coverage). */
export interface BandCoverageRule {
  n?: number;
  all?: number;
  by_third?: readonly (number | null)[];
  n_by_third?: readonly number[];
}

/** One leakage-free coverage check: the ranges built only from misses that
 *  cannot share an outcome quarter with the quarter checked. */
export interface BandCoverageTest {
  quarters?: number;
  from?: string;
  to?: string;
  published?: BandCoverageRule;
  own_level?: BandCoverageRule;
  pooled?: BandCoverageRule;
}

export interface BandCoverage {
  min_train?: number;
  thirds_upper?: readonly number[];
  /** Ranges from quarters at least four quarters away on either side. */
  embargoed?: BandCoverageTest;
  /** Ranges from misses whose outcome was known at the time. */
  point_in_time?: BandCoverageTest;
}

/** What centring on the cross-section does (scripts/83 relative_effect). */
export interface RelativeEffect {
  period?: string;
  n_bdcs?: number;
  level?: number;
  slope?: number;
  blend_weight?: number;
  peer_effect_per_pp?: number | null;
  mean_estimate_by_quarter?: Record<string, number>;
  tested_from?: string | null;
  tested_to?: string | null;
  tested_max_quarterly_move_pp?: number | null;
  largest_later_move_pp?: number | null;
  reference_period?: string | null;
  since_reference?: {
    mean_before: number;
    mean_now: number;
    change_pp: number;
    held_still_forecast_effect_pp: number;
  };
  driver?: {
    feature: string;
    mean_change_pp: number;
    share_of_change: number | null;
    effect_by_ticker: Record<string, number>;
    without_sign: readonly string[];
    without_sign_effect_pp: number | null;
  };
  moves?: Record<string, { blend_then: number; blend_now: number; forecast_then: number; forecast_now: number }>;
}

/** The calibration fitted at the latest quarter (scripts/83 fit_calibration). */
export interface FormationCalibration {
  kind?: string;
  /** relative: realised formation the forecasts are centred on, % of cost. */
  level?: number;
  slope?: number;
  level_from?: string;
  level_to?: string;
  level_n?: number;
}

/** One calibration candidate scored on the rolling out-of-sample test. */
export interface CalibrationCandidate {
  n?: number;
  mean_abs?: number;
  bias?: number;
  corr?: number;
  rank_corr?: number;
  early?: FormationHalf;
  late?: FormationHalf;
  band_coverage?: BandCoverage;
  published_mean?: number;
  published_max?: number;
  published_above_tested?: number;
  setting?: Record<string, number | null>;
}

export interface LabelBasisScore {
  n?: number;
  actual_mean?: number;
  mean_abs?: number;
  relative_mean_abs?: number;
  corr?: number;
  rank_corr?: number;
  trailing_by_ticker?: Record<string, number | null>;
}

export interface FormationMeta {
  n?: number;
  horizon_q?: number;
  mean_abs?: number;
  corr?: number;
  bias?: number;
  actual_mean?: number;
  quartiles?: readonly FormationQuartile[];
  halves?: { early?: FormationHalf; late?: FormationHalf };
  /** The highest forecast the back-test scored (and the highest outcome). */
  max_tested_pred?: number;
  max_tested_actual?: number;
  /** The 80% range by forecast level (lowest group first). */
  band_levels?: readonly FormationBandLevel[];
  calibration?: FormationCalibration;
  /** Forecast quarters in the test. */
  test_quarters?: number;
  /** Each BDC's scored back-test forecasts: count, average miss (forecast - outcome). */
  backtest_by_ticker?: Record<string, { n: number; bias: number; share_below: number } | undefined>;
  relative_effect?: RelativeEffect;
  calibration_comparison?: {
    realised?: { latest_period?: string; latest_mean?: number; max_yoy_rise_pp?: number | null;
      by_quarter?: Record<string, number> };
    candidates?: Record<string, CalibrationCandidate | undefined>;
    shipped?: CalibrationCandidate;
  };
  label_basis_comparison?: {
    all?: LabelBasisScore;
    debt?: LabelBasisScore;
    debt_at_least_as_good?: boolean;
    shipped?: string;
  };
  observability?: {
    label_basis?: string;
    calibration_method?: string;
    publication_min_feature_coverage_pct?: number;
    training_embargo_quarters?: number;
    calibration_window_quarters?: number | null;
    slope_window_quarters?: number | null;
    model_features?: readonly string[];
    label_observation_coverage_pct?: number;
    unknown_label_borrowers?: number;
    mature_label_borrowers?: number;
  };
}

export interface HorizonMeta {
  n?: number;
  mean_abs?: number;
  naive_mean_abs?: number;
}

export interface DirectionMeta {
  n?: number;
  auc?: number;
  base_rate?: number;
  top_decile_hit?: number;
  top_decile_lift?: number;
}

type LooseMeta = {
  formation?: FormationMeta;
  horizons?: Record<string, HorizonMeta | undefined>;
  direction?: DirectionMeta;
};

const meta = naFcMeta as unknown as LooseMeta;

export const formationMeta: FormationMeta = meta.formation ?? {};
export const nextQuarterMeta: HorizonMeta | undefined = meta.horizons?.["1"];
export const directionMeta: DirectionMeta | undefined = meta.direction;

/** Cost-weighted share of model inputs that must be observed for standard confidence. */
export const coverageFloorPct: number | null =
  formationMeta.observability?.publication_min_feature_coverage_pct ?? null;

export type ForecastConfidence = "standard" | "lower" | "none";

const STANDARD_STATUSES = new Set(["complete", "imputed_with_indicators"]);

/** Scored back-test forecasts for this BDC (null: not in this data release). */
export function backtestCount(row: NaForecastRow): number | null {
  const n = (row as { form_backtest_n?: number | null }).form_backtest_n;
  return typeof n === "number" ? n : null;
}

/** True when the release says this BDC was never scored in the back-test. */
export function notBacktested(row: NaForecastRow): boolean {
  return backtestCount(row) === 0;
}

/**
 * standard: inputs meet the coverage floor and the BDC was back-tested.
 * lower:    the BDC is modelled, but fewer inputs are observed, it was never
 *           scored in the back-test, or the row is flagged as an estimate.
 *           Its number is shown with a label.
 * none:     the BDC cannot be modelled (for example, no loan-level status).
 */
export function forecastConfidence(
  row: NaForecastRow,
  floor: number | null = coverageFloorPct,
): ForecastConfidence {
  if (row.form_observation_status === "unavailable") return "none";
  const flaggedEstimate = (row as { estimate?: boolean }).estimate === true;
  const belowFloor = floor != null && row.form_feature_coverage_pct != null
    && row.form_feature_coverage_pct < floor;
  if (!STANDARD_STATUSES.has(row.form_observation_status) || belowFloor || flaggedEstimate
    || notBacktested(row)) {
    return "lower";
  }
  return "standard";
}

/** Why a modelled row is lower confidence, in plain English. */
export function lowerConfidenceReason(row: NaForecastRow, floor: number | null = coverageFloorPct): string | null {
  if (forecastConfidence(row, floor) !== "lower") return null;
  const belowFloor = floor != null && row.form_feature_coverage_pct != null
    && row.form_feature_coverage_pct < floor;
  if (!STANDARD_STATUSES.has(row.form_observation_status) || belowFloor) {
    return floor != null
      ? `less than ${floorText(floor)} of the model's inputs could be observed for this book`
      : "fewer of the model's inputs could be observed for this book";
  }
  if (notBacktested(row)) {
    return "the back-test never scored this BDC (its past outcomes could not all be observed), so no track record stands behind its number";
  }
  return "this number is flagged as an estimate";
}

/** This BDC's own back-test record as display text, or null when the release has none. */
export function backtestText(row: NaForecastRow, meta: FormationMeta = formationMeta): string | null {
  const n = backtestCount(row);
  if (n == null) return null;
  if (n === 0) return "Not back-tested";
  const of = meta.test_quarters != null ? ` of ${meta.test_quarters}` : "";
  const bias = (row as { form_backtest_bias?: number | null }).form_backtest_bias;
  const lean = bias != null && Math.abs(bias) >= 0.5
    ? `; ran ${Math.abs(bias).toFixed(2)}pp ${bias > 0 ? "above" : "below"} outcomes on average`
    : "";
  return `Back-tested in ${n}${of} quarters${lean}`;
}

/** Only rows that can be modelled may show a projection; unknown stays "—". */
export function projectionValue(row: NaForecastRow): number | null {
  return forecastConfidence(row) === "none" ? null : row.form_4q;
}

export function coverageText(row: NaForecastRow): string | null {
  return row.form_feature_coverage_pct == null
    ? null
    : `${row.form_feature_coverage_pct.toFixed(0)}% of inputs observed`;
}

export function confidenceLabel(row: NaForecastRow): string {
  const confidence = forecastConfidence(row);
  if (confidence === "standard") return "Standard confidence";
  if (confidence === "lower") return "Lower confidence";
  return "Not modelled";
}

/** Plain-English reason a BDC has no projection at all. */
export function notModelledReason(row: NaForecastRow): string {
  if (row.na_observation_status === "aggregate_only") {
    return "Reports non-accruals only as a total, so its loans can't be scored one by one.";
  }
  if (row.na_observation_status === "withheld_reconciliation") {
    return "Its non-accrual figures are still being reconciled to the filing.";
  }
  return "Model inputs are not available for this BDC.";
}

export function fmtPct(value: number | null | undefined, digits = 2): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(digits)}%`;
}

const FEATURE_LABELS: Record<string, string> = {
  xh: "a loan already on non-accrual at another BDC",
  m90: "loans marked 80–90¢ of par",
  m95: "loans marked 90–95¢ of par",
  pik_flip: "switched from cash interest to PIK while the BDC held it",
  pik_first_seen: "heavy PIK already there when we first saw the loan",
  pik_unclear: "heavy PIK whose history is unclear",
  any_mod: "loan terms modified",
  par_cut: "stressed cut to the loan amount",
  v45: "loan 4–5 years old",
  v6: "loan 6+ years old",
  ever_na_prior: "on non-accrual at this BDC before",
  is_eq: "equity or warrant position",
};

/** The model's borrower-level signals in plain English (missing-value indicators omitted). */
export function modelSignalLabels(features: readonly string[] | undefined): string[] {
  return (features ?? [])
    .filter((feature) => !feature.endsWith("_missing"))
    .map((feature) => FEATURE_LABELS[feature] ?? feature.replace(/_/g, " "));
}

/**
 * Rows sorted by projection (highest first). Rows without a number follow:
 * modelled-but-unnumbered rows alphabetically, then rows that can't be modelled.
 */
export function sortForecastRows(rows: readonly NaForecastRow[]): NaForecastRow[] {
  return [...rows].sort((a, b) => {
    const av = projectionValue(a);
    const bv = projectionValue(b);
    if (av != null && bv != null) return bv - av || a.ticker.localeCompare(b.ticker);
    if (av != null) return -1;
    if (bv != null) return 1;
    const an = forecastConfidence(a) === "none" ? 1 : 0;
    const bn = forecastConfidence(b) === "none" ? 1 : 0;
    return an - bn || a.ticker.localeCompare(b.ticker);
  });
}

/**
 * One sentence on the forecast's average signed miss, from the export: how
 * far below (or above) the outcome it ran over the whole test and in its newer
 * half. Null when the export has no bias, or the bias is negligible.
 */
export function biasText(meta: FormationMeta = formationMeta): string | null {
  const bias = meta.bias;
  if (bias == null || !Number.isFinite(bias) || Math.abs(bias) < 0.05) return null;
  const dir = bias < 0 ? "below" : "above";
  const late = meta.halves?.late;
  const lateText = late && Number.isFinite(late.bias)
    ? ` (${Math.abs(late.bias).toFixed(2)}pp ${late.bias < 0 ? "below" : "above"} in the newer half, forecasts made ${late.from.slice(0, 7)} to ${late.to.slice(0, 7)})`
    : "";
  return `On average the forecast ran ${Math.abs(bias).toFixed(2)}pp ${dir} what happened${lateText}.`;
}

/** True when the projection is above every forecast the back-test scored:
 *  the 80% range is built from misses at lower levels, so none is shown. */
export function beyondBacktest(row: NaForecastRow, meta: FormationMeta = formationMeta): boolean {
  const flagged = (row as unknown as { form_beyond_backtest?: boolean }).form_beyond_backtest;
  if (typeof flagged === "boolean") return flagged;
  const value = row.form_4q;
  return value != null && meta.max_tested_pred != null && value > meta.max_tested_pred;
}

/** The 80% range as display text, or why there is none. */
export function rangeText(row: NaForecastRow, value: number | null, meta: FormationMeta = formationMeta,
  joiner = "–"): string | null {
  if (value == null || row.form_lo == null || row.form_hi == null) return null;
  if (beyondBacktest(row, meta)) {
    return meta.max_tested_pred != null
      ? `above every forecast tested (max ${meta.max_tested_pred.toFixed(2)}%): no range`
      : "above every forecast tested: no range";
  }
  return `${row.form_lo.toFixed(2)}${joiner}${row.form_hi.toFixed(2)}`;
}

/** The coverage floor as display text, e.g. "66.7%". */
export function floorText(floor: number | null = coverageFloorPct): string | null {
  return floor == null ? null : `${floor.toFixed(1)}%`;
}

export interface QuartileReading {
  ordered: boolean;
  /** Realised rate in the highest-forecast bucket divided by the lowest. */
  spread: number | null;
  lowest: FormationQuartile | null;
  highest: FormationQuartile | null;
}

/** Does realised formation rise with each step up in forecast? */
export function readQuartiles(quartiles: readonly FormationQuartile[] | undefined): QuartileReading {
  const known = [...(quartiles ?? [])]
    .filter((q) => q.actual != null && Number.isFinite(q.actual))
    .sort((a, b) => a.q - b.q);
  if (known.length < 2) return { ordered: false, spread: null, lowest: null, highest: null };
  const ordered = known.every((q, i) => i === 0 || (q.actual as number) >= (known[i - 1].actual as number));
  const lowest = known[0];
  const highest = known[known.length - 1];
  const spread = (lowest.actual as number) > 0 ? (highest.actual as number) / (lowest.actual as number) : null;
  return { ordered, spread, lowest, highest };
}

/** Plain-English names of the calibration candidates (scripts/83 FORM_CALIBRATION_SPECS). */
export const CALIBRATION_NAMES: Record<string, string> = {
  all_history_line: "Straight line fitted on every past year",
  latest_4q_line: "Straight line fitted on the latest year only",
  recent_level_shift: "All-years line, level reset to the latest year",
  isotonic_capped: "Step mapping, flat past the tested range",
  relative: "Order from the model, level from what happened",
};

export interface CalibrationRow {
  key: string;
  name: string;
  shipped: boolean;
  candidate: CalibrationCandidate;
}

/** The compared calibrations in export order, the shipped one marked. */
export function calibrationRows(meta: FormationMeta = formationMeta): CalibrationRow[] {
  const candidates = meta.calibration_comparison?.candidates ?? {};
  const shippedKind = meta.observability?.calibration_method ?? meta.calibration?.kind;
  return Object.entries(candidates)
    .filter((entry): entry is [string, CalibrationCandidate] => entry[1] != null && entry[1].mean_abs != null)
    .map(([key, candidate]) => ({
      key, candidate,
      name: CALIBRATION_NAMES[key] ?? key.replace(/_/g, " "),
      shipped: key === shippedKind,
    }));
}

/** How the level of the projections is set, from the export; null when the
 *  release does not use the relative calibration. */
export function levelText(meta: FormationMeta = formationMeta): string | null {
  const cal = meta.calibration;
  if (cal?.kind !== "relative" || cal.level == null) return null;
  const quarters = meta.observability?.calibration_window_quarters;
  const span = cal.level_from && cal.level_to
    ? ` (${cal.level_from.slice(0, 7)} to ${cal.level_to.slice(0, 7)})`
    : "";
  return `The model sets the order; the level comes from what actually happened: across the BDCs, an average of ${fmtPct(cal.level)} of the performing book went on non-accrual within a year, over the latest ${quarters ?? ""}${quarters != null ? " " : ""}starting quarters whose year has fully passed${span}, and the projections are centred on that.`;
}

/** "a, b and c" (or "a; b; and c" with sep "; "). */
export function andJoin(items: readonly string[], sep = ", "): string {
  if (items.length <= 1) return items.join("");
  const last = sep === ", " ? " and " : `${sep}and `;
  return `${items.slice(0, -1).join(sep)}${last}${items[items.length - 1]}`;
}

const pct0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${Math.round(100 * v)}%`);

/** One leakage-free coverage check as text: "81% (100% / 73% / 71% from the lowest third to the highest, 102 forecasts)". */
function coverageClause(rule: BandCoverageRule | undefined): string | null {
  if (rule?.all == null) return null;
  const thirds = rule.by_third && rule.by_third.length === 3
    ? `${rule.by_third.map(pct0).join(" / ")} from the lowest third to the highest, `
    : "";
  return `${pct0(rule.all)} (${thirds}${rule.n ?? "?"} forecasts)`;
}

/** The 80% range rule in plain English, from the level groups in the export. */
export function bandText(meta: FormationMeta = formationMeta): string | null {
  const levels = meta.band_levels ?? [];
  if (levels.length < 2) {
    return meta.n != null ? `The 80% range is the 10th–90th percentile of these same ${meta.n} misses.` : null;
  }
  const cuts = levels.slice(0, -1).map((band) => band.upper).filter((v): v is number => v != null);
  const groups = levels.length === 3 ? "thirds" : `${levels.length} groups`;
  const floored = levels.some((band) => band.own_lo != null && band.own_hi != null
    && (Math.abs(band.band_lo - band.own_lo) > 1e-9 || Math.abs(band.band_hi - band.own_hi) > 1e-9));
  const widths = levels.map((band) => band.band_lo - band.band_hi);
  const widening = widths.every((w, i) => i === 0 || w > widths[i - 1] + 1e-9)
    ? " Higher forecasts missed by more, so their ranges are wider;"
    : widths[widths.length - 1] > Math.max(...widths.slice(0, -1)) + 1e-9
      ? " The highest forecasts missed by more, so their range is wider;"
      : "";
  const coverage = meta.calibration_comparison?.shipped?.band_coverage;
  const embargoed = coverageClause(coverage?.embargoed?.published);
  const pointInTime = coverageClause(coverage?.point_in_time?.published);
  const checked = embargoed
    ? ` Checked fairly — each past quarter's range built only from misses that share none of its four outcome quarters — it held the outcome ${embargoed}${pointInTime ? `; built only from misses already known at the time, ${pointInTime}` : ""}. That is a small test: ${meta.test_quarters ?? "a few"} quarters of forecasts whose outcome years overlap, so treat the 80% as approximate.`
    : "";
  return `The 80% range comes from the misses of past forecasts at a similar level: the ${meta.n ?? ""}${meta.n != null ? " " : ""}tested forecasts are split into ${groups} by level (cut at ${cuts.map((v) => fmtPct(v)).join(" and ")}), and each projection takes the 10th–90th percentile of its group's misses${floored ? `, but never a narrower range than all ${meta.n ?? "the"} misses together give (a group's own misses ran too tight when checked)` : ""}.${widening ? `${widening} the` : " The"} range is lopsided because a bad year can miss by far more than a good one.${checked}`;
}

/** How often past outcomes came in above the forecast, by level group; and
 *  which levels to read as "nearer the bottom" of what to expect. */
export function aboveShareText(meta: FormationMeta = formationMeta): string | null {
  const levels = (meta.band_levels ?? []).filter((band) => band.share_above != null);
  if (levels.length < 2) return null;
  const names = levels.length === 3 ? ["lowest", "middle", "top"] : levels.map((_, i) => `group ${i + 1}`);
  const shares = levels.map((band, i) => `${pct0(band.share_above)} of the ${names[i]}${levels.length === 3 ? " third" : ""}`);
  const low = levels.map((band, i) => ((band.share_above as number) >= 0.65 ? i : -1)).filter((i) => i >= 0);
  const even = levels.map((band, i) => (Math.abs((band.share_above as number) - 0.5) <= 0.15 ? i : -1)).filter((i) => i >= 0);
  const range = (band: FormationBandLevel, i: number) => (i === 0
    ? `below ${fmtPct(band.upper)}`
    : band.upper == null ? `above ${fmtPct(levels[i - 1].upper)}` : `${fmtPct(levels[i - 1].upper)}–${fmtPct(band.upper)}`);
  const lowText = low.length
    ? ` Read a projection ${low.map((i) => range(levels[i], i)).join(" or ")} as nearer the bottom of what to expect than the middle.`
    : "";
  const evenText = even.length
    ? ` ${low.length ? "Elsewhere" : "At every level"} outcomes fell about as often below the forecast as above it.`
    : "";
  return `In the back-test the outcome came in above the forecast for ${andJoin(shares)} of forecasts.${lowText}${evenText}`;
}
/** Whether loans-only labels were tested, and how they did, from the export. */
export function labelBasisText(meta: FormationMeta = formationMeta): string | null {
  const cmp = meta.label_basis_comparison;
  const all = cmp?.all;
  const debt = cmp?.debt;
  if (!all || !debt || all.relative_mean_abs == null || debt.relative_mean_abs == null) return null;
  const shippedDebt = (cmp?.shipped ?? meta.observability?.label_basis) === "debt";
  const [used, other] = shippedDebt ? [debt, all] : [all, debt];
  // one decimal when whole percents would read as a tie (49.5% vs 50.2%)
  const tie = Math.round(100 * (used.relative_mean_abs as number)) === Math.round(100 * (other.relative_mean_abs as number));
  const pct = (v: number | undefined) => (v == null ? "—" : `${(100 * v).toFixed(tie ? 1 : 0)}%`);
  const corr = (v: number | undefined) => (v == null ? "—" : v.toFixed(2));
  return shippedDebt
    ? `A borrower counts only when one of its loans goes on non-accrual (a preferred share or other equity going on non-accrual does not). On the same test this did at least as well as counting every investment: average miss ${pct(used.relative_mean_abs)} of the average outcome against ${pct(other.relative_mean_abs)}, rank correlation ${corr(used.rank_corr)} against ${corr(other.rank_corr)}.`
    : `A borrower counts once any of its investments goes on non-accrual, with everything the BDC holds in it. Counting only loans (a preferred share going on non-accrual would not count) was tested on the same back-test and did worse: average miss ${pct(other.relative_mean_abs)} of the average outcome against ${pct(used.relative_mean_abs)}, rank correlation ${corr(other.rank_corr)} against ${corr(used.rank_corr)}. So every investment counts.${labelGapText(meta)}`;
}

/** The BDCs whose trailing year differs by at least ``minGap`` pp between the
 *  two label rules, and how the cross-holder sign's narrower rule relates. */
export function labelGapText(meta: FormationMeta = formationMeta, minGap = 1): string {
  const all = meta.label_basis_comparison?.all?.trailing_by_ticker ?? {};
  const debt = meta.label_basis_comparison?.debt?.trailing_by_ticker ?? {};
  const gaps = Object.keys(all)
    .filter((t) => all[t] != null && debt[t] != null && Math.abs((all[t] as number) - (debt[t] as number)) >= minGap)
    .sort((a, b) => Math.abs((all[b] as number) - (debt[b] as number)) - Math.abs((all[a] as number) - (debt[a] as number)));
  const differ = gaps.length
    ? ` The two rules give a past year at least ${minGap}pp apart only for ${andJoin(gaps.map((t) => `${t} (${fmtPct(all[t])} counting every investment, ${fmtPct(debt[t])} counting loans only)`))}.`
    : Object.keys(all).length ? ` No BDC's past year differs by ${minGap}pp or more between the two rules.` : "";
  return `${differ} The warning sign for trouble at another lender is narrower: it counts a borrower only when one of its loans is on non-accrual at another BDC.`;
}

/** Projections at the 0% floor, and what to read into them; null when none. */
export function zeroFloorText(rows: readonly NaForecastRow[], meta: FormationMeta = formationMeta): string | null {
  const zero = rows.filter((row) => projectionValue(row) === 0);
  if (!zero.length) return null;
  const tops = zero.map((row) => row.form_hi).filter((v): v is number => v != null);
  const top = tops.length ? Math.max(...tops) : null;
  const tickers = zero.map((row) => row.ticker).join(", ");
  return `${tickers} ${zero.length === 1 ? "shows" : "show"} 0.00%: ${zero.length === 1 ? "its" : "their"} warning signs are so far below ${zero.length === 1 ? "its" : "their"} peers' that the method puts ${zero.length === 1 ? "it" : "them"} at the floor. Read that as "the lowest group", not as "no new non-accruals"${top != null ? `: the 80% range still runs up to ${fmtPct(top)}` : ""}${meta.band_levels?.length ? ", from the misses of other low forecasts" : ""}.`;
}

/** The calibration choice explained from the comparison in the export (no
 *  claim that the comparison does not support). */
export function whyThisOneText(meta: FormationMeta = formationMeta): string | null {
  const rows = calibrationRows(meta);
  const shipped = rows.find((row) => row.shipped);
  if (!shipped) return null;
  const others = rows.filter((row) => !row.shipped).map((row) => row.candidate);
  const s = shipped.candidate;
  const best = (pick: (c: CalibrationCandidate) => number | undefined) =>
    others.every((c) => pick(c) == null || (pick(s) as number) <= (pick(c) as number) + 1e-9);
  const early = s.early?.mean_abs;
  const late = s.late?.mean_abs;
  const halves = early != null && late != null && best((c) => c.early?.mean_abs) && best((c) => c.late?.mean_abs);
  const overall = s.mean_abs != null && best((c) => c.mean_abs);
  const bias = s.bias != null
    && others.every((c) => c.bias == null || Math.abs(s.bias as number) <= Math.abs(c.bias) + 1e-9);
  const missText = halves
    ? `It had the smallest average miss in both halves of the test (${(early as number).toFixed(2)} and ${(late as number).toFixed(2)}pp)`
    : overall
      ? `It had the smallest average miss over the whole test (${(s.mean_abs as number).toFixed(2)}pp), though not in both halves`
      : `It did not have the smallest average miss (${s.mean_abs?.toFixed(2) ?? "—"}pp)`;
  const biasText_ = bias ? " and the smallest average signed miss" : "";
  return `${missText}${biasText_}. It was picked on this same test of ${s.n ?? meta.n ?? "the"} forecasts, so that lead is not independent proof; it will be checked again as the next quarters' outcomes come in.`;
}

/** The "Changed October 2026" description of the level, in the same words as levelText. */
export function levelChangeText(meta: FormationMeta = formationMeta): string | null {
  const cal = meta.calibration;
  if (cal?.kind !== "relative" || cal.level == null) return null;
  const quarters = meta.observability?.calibration_window_quarters;
  const span = cal.level_from && cal.level_to ? ` (${cal.level_from.slice(0, 7)} to ${cal.level_to.slice(0, 7)})` : "";
  return `The last step now takes the order of the BDCs from the model and the level from what actually happened: the average share of the performing book that went on non-accrual within a year, over the latest ${quarters ?? ""}${quarters != null ? " " : ""}starting quarters whose year has fully passed${span}.`;
}

/** Projections resting on few tested cases: at or above each high
 *  projection, how many back-test forecasts there are and whose. */
export function testedTailText(rows: readonly NaForecastRow[], maxBdcs = 2): string | null {
  const thin = rows.filter((row) => {
    const value = projectionValue(row);
    const tickers = (row as { form_tested_above_tickers?: readonly string[] }).form_tested_above_tickers;
    const n = (row as { form_tested_above_n?: number | null }).form_tested_above_n;
    return value != null && !beyondBacktest(row) && n != null && n > 0 && tickers != null && tickers.length <= maxBdcs;
  });
  if (!thin.length) return null;
  const parts = thin.map((row) => {
    const tickers = (row as { form_tested_above_tickers?: readonly string[] }).form_tested_above_tickers ?? [];
    const n = (row as { form_tested_above_n?: number | null }).form_tested_above_n ?? 0;
    const own = tickers.length === 1 && tickers[0] === row.ticker;
    const whose = tickers.length === 1
      ? (own ? `${n === 1 ? "" : "all "}${row.ticker}'s own` : `${n === 1 ? "" : "all "}${tickers[0]}'s`)
      : `from ${andJoin([...tickers])} only`;
    return `at or above ${row.ticker}'s ${fmtPct(projectionValue(row))} the back-test has ${n} forecast${n === 1 ? "" : "s"}, ${whose}`;
  });
  return `The top of the ranking rests on very few tested cases: ${andJoin(parts, "; ")}. The 80% range there is built mostly from those BDCs' misses.`;
}

/** The relative method's side effect, with its size, from the export. */
export function relativeText(rows: readonly NaForecastRow[], meta: FormationMeta = formationMeta): string | null {
  const rel = meta.relative_effect;
  if (!rel || rel.level == null || rel.slope == null || rel.n_bdcs == null) return null;
  const others = rel.n_bdcs - 1;
  const parts: string[] = [];
  parts.push(`These projections are relative. Each is ${fmtPct(rel.level)} plus ${rel.slope.toFixed(2)} times how far the BDC's warning-sign score sits above or below the average score of the ${rel.n_bdcs} BDCs this quarter, so the average projection stays at the realised level, and when some BDCs' scores rise every other BDC's projection falls, even if its own score did not move${rel.peer_effect_per_pp != null ? ` (a 1pp rise in one BDC's score lowers each of the other ${others} by ${rel.peer_effect_per_pp.toFixed(2)}pp)` : ""}.`);
  const since = rel.since_reference;
  if (rel.reference_period && since) {
    const tested = rel.tested_max_quarterly_move_pp != null && rel.tested_from && rel.tested_to
      ? `; in the tested quarters (${rel.tested_from.slice(0, 7)} to ${rel.tested_to.slice(0, 7)}) it never moved more than ${rel.tested_max_quarterly_move_pp.toFixed(2)}pp in a quarter, so the method has not been tested on a move this size`
      : "";
    parts.push(`Since ${rel.reference_period.slice(0, 7)} the average score has ${since.change_pp >= 0 ? "risen" : "fallen"} ${Math.abs(since.change_pp).toFixed(2)}pp (from ${fmtPct(since.mean_before)} to ${fmtPct(since.mean_now)})${tested}. That move alone ${since.held_still_forecast_effect_pp <= 0 ? "lowers" : "raises"} the projection of a BDC whose score held still by ${Math.abs(since.held_still_forecast_effect_pp).toFixed(2)}pp.`);
    const driver = rel.driver;
    if (driver && driver.share_of_change != null && driver.share_of_change > 0) {
      const label = FEATURE_LABELS[driver.feature] ?? driver.feature.replace(/_/g, " ");
      const lifted = Object.entries(driver.effect_by_ticker)
        .filter(([, v]) => v >= 0.25).sort((a, b) => b[1] - a[1])
        .map(([t, v]) => `${t} ${v.toFixed(2)}pp`);
      const lowered = Object.values(driver.effect_by_ticker).filter((v) => v < 0);
      const worst = lowered.length ? Math.max(...lowered.map((v) => -v)) : null;
      parts.push(`${pct0(driver.share_of_change)} of that rise came from one warning sign, ${label}. Today it lifts ${lifted.length ? andJoin(lifted) : "no BDC by 0.25pp or more"} and lowers ${lowered.length} other${lowered.length === 1 ? "" : "s"}${worst != null ? ` by up to ${worst.toFixed(2)}pp` : ""}${driver.without_sign.length && driver.without_sign_effect_pp != null ? ` (${Math.abs(driver.without_sign_effect_pp).toFixed(2)}pp for the ${driver.without_sign.length} with none of it: ${andJoin([...driver.without_sign])})` : ""}.`);
    }
    const fell = Object.entries(rel.moves ?? {})
      .filter(([, m]) => m.blend_now >= m.blend_then - 0.05 && m.forecast_now <= m.forecast_then - 0.5)
      .sort((a, b) => (a[1].forecast_now - a[1].forecast_then) - (b[1].forecast_now - b[1].forecast_then))
      .map(([t, m]) => `${t} (score ${m.blend_then.toFixed(2)} → ${m.blend_now.toFixed(2)}, projection ${fmtPct(m.forecast_then)} → ${fmtPct(m.forecast_now)})`);
    if (fell.length) {
      parts.push(`So since ${rel.reference_period.slice(0, 7)} some projections fell by 0.5pp or more while the BDC's own score held or rose: ${andJoin(fell)}.`);
    }
  }
  const aboveRange = rows.filter((row) => projectionValue(row) != null && !beyondBacktest(row)
    && row.form_trailing != null && row.form_hi != null && row.form_trailing > row.form_hi)
    .map((row) => `${row.ticker} (${fmtPct(row.form_trailing)} against a range topping out at ${fmtPct(row.form_hi)})`);
  if (aboveRange.length) {
    parts.push(`For ${andJoin(aboveRange)} the BDC's own past year is above the top of its 80% range: the ranking puts it below its recent history.`);
  }
  return parts.join(" ");
}

/** Rank among published projections, ties sharing a rank (#1 = highest). */
export function tiedRank(ticker: string, values: readonly { ticker: string; value: number }[]):
  { rank: number; tiedWith: string[] } | null {
  const own = values.find((v) => v.ticker === ticker);
  if (!own) return null;
  return {
    rank: 1 + values.filter((v) => v.value > own.value).length,
    tiedWith: values.filter((v) => v.ticker !== ticker && v.value === own.value).map((v) => v.ticker),
  };
}
