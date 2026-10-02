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
  band_lo: number;
  band_hi: number;
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
  band_coverage?: {
    level?: { all?: number; by_third?: readonly number[] };
    pooled?: { all?: number; by_third?: readonly number[] };
  };
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
  calibration_comparison?: {
    realised?: { latest_period?: string; latest_mean?: number; max_yoy_rise_pp?: number | null };
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

/**
 * standard: inputs meet the coverage floor.
 * lower:    the BDC is modelled, but fewer inputs are observed (or the row is
 *           flagged as an estimate). Its number is shown with a label.
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
  if (!STANDARD_STATUSES.has(row.form_observation_status) || belowFloor || flaggedEstimate) {
    return "lower";
  }
  return "standard";
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

/** The 80% range rule in plain English, from the level groups in the export. */
export function bandText(meta: FormationMeta = formationMeta): string | null {
  const levels = meta.band_levels ?? [];
  if (levels.length < 2) {
    return meta.n != null ? `The 80% range is the 10th–90th percentile of these same ${meta.n} misses.` : null;
  }
  const cuts = levels.slice(0, -1).map((band) => band.upper).filter((v): v is number => v != null);
  const groups = levels.length === 3 ? "thirds" : `${levels.length} groups`;
  const coverage = meta.calibration_comparison?.shipped?.band_coverage;
  const byLevel = coverage?.level?.by_third;
  const pooled = coverage?.pooled?.by_third;
  const held = byLevel && byLevel.length === levels.length
    ? ` Checked by leaving each quarter out, it held the outcome ${byLevel.map((v) => `${Math.round(100 * v)}%`).join(" / ")} of the time from the lowest group to the highest`
      + (pooled && pooled.length === levels.length
        ? `; one range for every level would have held ${Math.round(100 * pooled[0])}% at the bottom and only ${Math.round(100 * pooled[pooled.length - 1])}% at the top.`
        : ".")
    : "";
  const widths = levels.map((band) => band.band_lo - band.band_hi);
  const widening = widths.every((w, i) => i === 0 || w > widths[i - 1])
    ? " Higher forecasts missed by more, so their ranges are wider;"
    : "";
  return `The 80% range comes from the misses of past forecasts at a similar level: the ${meta.n ?? ""}${meta.n != null ? " " : ""}tested forecasts are split into ${groups} by level (cut at ${cuts.map((v) => fmtPct(v)).join(" and ")}), and each projection takes the 10th–90th percentile of its group's misses.${widening ? `${widening} the` : " The"} range is lopsided because a bad year can miss by far more than a good one.${held}`;
}

/** Whether loans-only labels were tested, and how they did, from the export. */
export function labelBasisText(meta: FormationMeta = formationMeta): string | null {
  const cmp = meta.label_basis_comparison;
  const all = cmp?.all;
  const debt = cmp?.debt;
  if (!all || !debt || all.relative_mean_abs == null || debt.relative_mean_abs == null) return null;
  const shippedDebt = (cmp?.shipped ?? meta.observability?.label_basis) === "debt";
  const [used, other] = shippedDebt ? [debt, all] : [all, debt];
  const pct = (v: number | undefined) => (v == null ? "—" : `${Math.round(100 * v)}%`);
  const corr = (v: number | undefined) => (v == null ? "—" : v.toFixed(2));
  return shippedDebt
    ? `A borrower counts only when one of its loans goes on non-accrual (a preferred share or other equity going on non-accrual does not). On the same test this did at least as well as counting every investment: average miss ${pct(used.relative_mean_abs)} of the average outcome against ${pct(other.relative_mean_abs)}, rank correlation ${corr(used.rank_corr)} against ${corr(other.rank_corr)}.`
    : `A borrower counts once any of its investments goes on non-accrual, with everything the BDC holds in it. Counting only loans (a preferred share going on non-accrual would not count) was tested on the same back-test and did worse: average miss ${pct(other.relative_mean_abs)} of the average outcome against ${pct(used.relative_mean_abs)}, rank correlation ${corr(other.rank_corr)} against ${corr(used.rank_corr)}. So every investment counts.`;
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
