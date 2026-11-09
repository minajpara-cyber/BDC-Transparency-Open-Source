// Display helpers for the four-quarter non-accrual projection (scripts/83).
//
// Every BDC with non-accrual data is shown. A projection whose model inputs are
// thinly read is labelled "lower confidence" instead of being hidden, and
// "—" always means "no number", never zero. The generated file may add fields
// (for example an `estimate` flag) or rename statuses, so everything here reads
// the data defensively.
import { naFcMeta, naForecast, type NaForecastRow } from "@/data/na_forecast";

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

/** The calibration fitted at the latest quarter (scripts/83 fit_calibration). */
export interface FormationCalibration {
  kind?: string;
  /** relative: realised formation the forecasts are centred on, % of cost. */
  level?: number;
  slope?: number;
  level_from?: string;
  level_to?: string;
  level_n?: number;
  /** BDCs per starting quarter in the level (the newest can be fewer in a reporting season). */
  level_bdcs_by_quarter?: Record<string, number>;
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
  published_mean?: number;
  published_max?: number;
  published_above_tested?: number;
  setting?: Record<string, number | null>;
}

/** One label rule's back-test scores (on its own forecasts, or on `common`). */
export interface LabelBasisFigures {
  n?: number;
  actual_mean?: number;
  mean_abs?: number;
  relative_mean_abs?: number;
  bias?: number;
  corr?: number;
  rank_corr?: number;
  within_quarter_rank_corr?: number;
}

export interface LabelBasisScore extends LabelBasisFigures {
  auc?: number;
  capture_top_10pct?: number;
  test_n?: number;
  trailing_by_ticker?: Record<string, number | null>;
  trailing_flagged_by_ticker?: Record<string, number | null>;
  /** The same scores on the forecasts both rules scored: what the verdict is read on. */
  common?: LabelBasisFigures;
}

export interface FormationMeta {
  /** How the simulated 80% range did on every scored forecast (by_ticker: counts per BDC). */
  range_coverage?: { n?: number; inside?: number; above?: number; below?: number;
    by_third?: readonly number[]; mean_width_pp?: number;
    by_ticker?: Record<string, { n?: number; inside?: number; above?: number; below?: number } | undefined> };
  /** The average miss a forecast would have if every probability were exactly right. */
  unavoidable_miss_pp?: number;
  n?: number;
  horizon_q?: number;
  mean_abs?: number;
  corr?: number;
  bias?: number;
  actual_mean?: number;
  quartiles?: readonly FormationQuartile[];
  halves?: { early?: FormationHalf; late?: FormationHalf };
  calibration?: FormationCalibration;
  /** Forecast quarters in the test. */
  test_quarters?: number;
  /** Each BDC's scored back-test forecasts: count, average miss (forecast - outcome). */
  backtest_by_ticker?: Record<string, { n: number; bias: number; share_below: number } | undefined>;
  calibration_comparison?: {
    realised?: { latest_period?: string; latest_mean?: number; max_yoy_rise_pp?: number | null;
      by_quarter?: Record<string, number> };
    candidates?: Record<string, CalibrationCandidate | undefined>;
    shipped?: CalibrationCandidate;
  };
  label_basis_comparison?: {
    all?: LabelBasisScore;
    debt?: LabelBasisScore;
    /** Quarters one rule scored that the other did not (left out of `common`). */
    common_quarters_left_out?: { all?: readonly string[]; debt?: readonly string[] };
    /** Per measure on `common`: "debt", "all" or "tie". */
    better_on?: Record<string, string>;
    /** On `common`: loans only's relative miss no higher, correlation and rank correlation no lower. */
    debt_at_least_as_good?: boolean;
    /** Loans only's AUC 0.01 or more lower, or its relative miss 5% or more higher (scripts/83). */
    debt_clearly_worse?: boolean;
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
    /** What "% of signals read" counts (form_input_coverage_pct). */
    model_inputs?: readonly string[];
    /** The nullable families among them (form_model_input_coverage_pct). */
    model_input_families?: readonly string[];
    label_observation_coverage_pct?: number;
    unknown_label_borrowers?: number;
    mature_label_borrowers?: number;
  };
}

export interface HorizonMeta {
  n?: number;
  mean_abs?: number;
  naive_mean_abs?: number;
  /** The same back-test with its two settings re-chosen each quarter on earlier outcomes only. */
  point_in_time?: { n?: number; mean_abs?: number; naive_mean_abs?: number };
  /** How the 80% range, built each quarter from the misses known then, held. */
  range_coverage?: { n?: number; from?: string; to?: string; inside?: number; above?: number; below?: number };
}

/** How often BDCs at a rank (by the direction score) rose 0.5pp or more the next quarter. */
export interface RiseRankTier {
  tier: string;
  ranks_from: number;
  ranks_to: number | null;
  n: number;
  rose: number;
}

export interface DirectionMeta {
  n?: number;
  auc?: number;
  base_rate?: number;
  top_decile_hit?: number;
  top_decile_lift?: number;
  threshold_pp?: number;
  test_from?: string;
  test_to?: string;
  test_quarters?: number;
  rank_tiers?: readonly RiseRankTier[];
  /** Brier scores, point in time: the score itself, the base rate, its rank tier's record. */
  brier?: { n?: number; score?: number; base_rate?: number; rank_tier_record?: number;
    logistic_recalibration?: number };
}

type LooseMeta = {
  formation?: FormationMeta;
  horizons?: Record<string, HorizonMeta | undefined>;
  direction?: DirectionMeta;
  constants_chosen_on_backtest_window?: boolean;
};

const meta = naFcMeta as unknown as LooseMeta;

export const formationMeta: FormationMeta = meta.formation ?? {};
export const nextQuarterMeta: HorizonMeta | undefined = meta.horizons?.["1"];
export const directionMeta: DirectionMeta | undefined = meta.direction;
/** The next-quarter model's two settings were chosen on the window its back-test scores. */
export const nextQuarterSettingsInSample: boolean = meta.constants_chosen_on_backtest_window === true;

/** Cost-weighted share of the model's inputs that must be read for standard confidence. */
export const coverageFloorPct: number | null =
  formationMeta.observability?.publication_min_feature_coverage_pct ?? null;

/**
 * "% of signals read": the lower of the share of the model's inputs read
 * (form_input_coverage_pct) and of its nullable families (form_model_input_coverage_pct),
 * cost-weighted, which is what scripts/83 holds the floor on. A release without
 * them has only the older six-family figure (form_feature_coverage_pct).
 */
export function inputCoveragePct(row: NaForecastRow): number | null {
  const r = row as { form_input_coverage_pct?: number | null; form_model_input_coverage_pct?: number | null;
    form_feature_coverage_pct?: number | null };
  if (r.form_input_coverage_pct === undefined && r.form_model_input_coverage_pct === undefined) {
    return r.form_feature_coverage_pct ?? null;
  }
  const read = [r.form_input_coverage_pct, r.form_model_input_coverage_pct]
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return read.length ? Math.min(...read) : null;
}

/**
 * "% of signals read" as every page prints it: inputCoveragePct rounded down to a
 * whole percent, so 100 means every input that applies was read. Null when unknown.
 */
export function signalsReadPct(row: NaForecastRow | null | undefined): number | null {
  const read = row ? inputCoveragePct(row) : null;
  return read == null ? null : Math.floor(read + 1e-9);
}

/** The same figure for one BDC, from its forecast row (null: no row, or unknown). */
export function signalsReadFor(ticker: string, rows: readonly NaForecastRow[] = naForecast): number | null {
  return signalsReadPct(rows.find((row) => row.ticker === ticker));
}

/**
 * The same figure over several BDCs' books pooled: each share (all of the model's
 * inputs, and its nullable families) weighted by the BDC's at-risk cost, then the
 * lower of the two, rounded down. Null when no BDC has a figure.
 */
export function pooledSignalsReadPct(books: readonly { ticker: string; cost: number }[],
  rows: readonly NaForecastRow[] = naForecast): number | null {
  const pooled = (pick: (row: NaForecastRow) => number | null | undefined) => {
    let weight = 0;
    let sum = 0;
    for (const book of books) {
      const row = rows.find((r) => r.ticker === book.ticker);
      const value = row ? pick(row) : null;
      if (typeof value === "number" && Number.isFinite(value) && book.cost > 0) {
        weight += book.cost;
        sum += book.cost * value;
      }
    }
    return weight > 0 ? sum / weight : null;
  };
  const loose = (row: NaForecastRow) => row as { form_input_coverage_pct?: number | null;
    form_model_input_coverage_pct?: number | null };
  const hasInputs = rows.some((row) => loose(row).form_input_coverage_pct !== undefined
    || loose(row).form_model_input_coverage_pct !== undefined);
  // a release without the two input shares has only the older figure (inputCoveragePct)
  const shares = hasInputs
    ? [pooled((row) => loose(row).form_input_coverage_pct), pooled((row) => loose(row).form_model_input_coverage_pct)]
    : [pooled(inputCoveragePct)];
  const known = shares.filter((v): v is number => v != null);
  return known.length ? Math.floor(Math.min(...known) + 1e-9) : null;
}

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
  const read = inputCoveragePct(row);
  const belowFloor = floor != null && read != null && read < floor;
  if (!STANDARD_STATUSES.has(row.form_observation_status) || belowFloor || flaggedEstimate
    || notBacktested(row)) {
    return "lower";
  }
  return "standard";
}

/** Why a modelled row is lower confidence, in plain English. */
export function lowerConfidenceReason(row: NaForecastRow, floor: number | null = coverageFloorPct): string | null {
  if (forecastConfidence(row, floor) !== "lower") return null;
  const read = inputCoveragePct(row);
  const belowFloor = floor != null && read != null && read < floor;
  if (!STANDARD_STATUSES.has(row.form_observation_status) || belowFloor) {
    return floor != null
      ? `less than ${floorText(floor)} of the model's signals could be read for this book`
      : "fewer of the model's signals could be read for this book";
  }
  if (notBacktested(row)) {
    return "the back-test never scored this BDC (its past outcomes could not all be observed), so no track record stands behind its number";
  }
  return "this number is flagged as an estimate";
}

/** Quarter number of a quarter-end date ("2025-09-30" -> 2025 * 4 + 2). */
function quarterIndex(period: string): number {
  return Number(period.slice(0, 4)) * 4 + Math.floor((Number(period.slice(5, 7)) - 1) / 3);
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
  // the test's newest quarters, whose outcome this BDC has not filed yet (a reporting season)
  const lastTested = meta.halves?.late?.to;
  const waiting = lastTested && row.period_end && meta.test_quarters != null
    ? Math.min(meta.test_quarters - n,
      quarterIndex(lastTested) - (quarterIndex(row.period_end) - (meta.horizon_q ?? 4)))
    : 0;
  const pending = waiting === 1
    ? `; the newest is scored once it files ${row.q1_label}`
    : waiting > 1 ? `; the newest ${waiting} wait for its next filings` : "";
  return `Back-tested in ${n}${of} quarters${lean}${pending}`;
}

/** Only rows that can be modelled may show a projection; unknown stays "—". */
export function projectionValue(row: NaForecastRow): number | null {
  return forecastConfidence(row) === "none" ? null : row.form_4q;
}

export function coverageText(row: NaForecastRow): string | null {
  // rounded down, so 100% means every input that applies was read
  const read = signalsReadPct(row);
  return read == null ? null : `${read}% of signals read`;
}

/** The direction score as a rank among the BDCs scored ("#2 of 19"), or null. */
export function riseRankText(row: NaForecastRow): string | null {
  const r = row as { rise_rank?: number | null; rise_rank_of?: number | null };
  return r.rise_rank == null ? null : `#${r.rise_rank}${r.rise_rank_of != null ? ` of ${r.rise_rank_of}` : ""}`;
}

/** The BDCs a rank tier covers, in words ("BDCs ranked 2–5"). */
function tierRanks(tier: RiseRankTier | undefined, name: string | null | undefined): string {
  if (tier) {
    if (tier.ranks_to === tier.ranks_from) {
      return tier.ranks_from === 1 ? "the top-ranked BDC" : `the BDC ranked #${tier.ranks_from}`;
    }
    return tier.ranks_to == null ? `BDCs ranked #${tier.ranks_from} or lower`
      : `BDCs ranked #${tier.ranks_from}–${tier.ranks_to}`;
  }
  return name === "top" ? "the top-ranked BDC" : name ? `BDCs ranked ${name}` : "BDCs at that rank";
}

/** How often BDCs at this BDC's rank rose 0.5pp or more the next quarter in the back-test. */
export function riseRecordText(row: NaForecastRow, direction: DirectionMeta | undefined = directionMeta): string | null {
  const r = row as { rise_tier?: string | null; rise_tier_rose?: number | null; rise_tier_n?: number | null };
  if (r.rise_tier_rose == null || r.rise_tier_n == null) return null;
  const tier = direction?.rank_tiers?.find((t) => t.tier === r.rise_tier);
  return `${tierRanks(tier, r.rise_tier)} rose ${r.rise_tier_rose} of ${r.rise_tier_n} times`;
}

/** The rank tiers' records in one phrase, from the export. */
export function riseTiersText(direction: DirectionMeta | undefined = directionMeta): string | null {
  const tiers = direction?.rank_tiers ?? [];
  if (!tiers.length) return null;
  return andJoin(tiers.map((t) => `${t.rose} of ${t.n} times for ${tierRanks(t, t.tier)}`));
}

/** A borrower's chance as the watchlist prints it: whole percent, rounded down. */
export function nameChance(name: { probability_pct: number; score?: number | null }): number {
  return name.score ?? Math.floor(name.probability_pct + 1e-9);
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
  mark: "how far the BDC marks its loans below par",
  worst_mark: "the lowest mark any holder puts on the borrower",
  mark_drop_q: "the mark's move this quarter",
  mark_drop_y: "the mark's move over a year",
  cross_holder: "a loan already on non-accrual at another BDC",
  peer_gap: "the mark against other holders' marks",
  pik: "PIK interest, and a switch into it",
  equity: "the BDC's equity in the borrower written down",
  prior_na: "on non-accrual at this BDC before",
  maturity: "a maturity inside three years",
  spread: "the spread on its loans",
  age: "how old the loan is",
  size: "the size of the position",
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

/** The 80% range as display text, or why there is none. */
export function rangeText(row: NaForecastRow, value: number | null, _meta: FormationMeta = formationMeta,
  joiner = "–"): string | null {
  if (value == null || row.form_lo == null || row.form_hi == null) return null;
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
  relative: "Order from the model, level from what happened, added on",
  odds_level: "Order and proportions from the model, level from what happened",
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
 *  release does not take its level from realised formation. */
export function levelText(meta: FormationMeta = formationMeta): string | null {
  const cal = meta.calibration;
  if ((cal?.kind !== "relative" && cal?.kind !== "odds_level") || cal.level == null) return null;
  const quarters = meta.observability?.calibration_window_quarters;
  const fewer = cal.level_to ? outcomeInText(meta, cal.level_to) : null;
  const span = cal.level_from && cal.level_to
    ? ` (${cal.level_from.slice(0, 7)} to ${cal.level_to.slice(0, 7)}${fewer ? `; ${cal.level_to.slice(0, 7)} counts ${fewer}` : ""})`
    : "";
  return `The model sets the order and the proportions; the level comes from what actually happened: across the BDCs, an average of ${fmtPct(cal.level)} of the performing book went on non-accrual within a year, over the latest ${quarters ?? ""}${quarters != null ? " " : ""}starting quarters whose year has fully passed${span}, and the projections are centred on that.`;
}

/** "the 14 BDCs whose outcome is in" when fewer BDCs have the outcome of the
 *  starting quarter ``period`` than of the level's other quarters (a reporting
 *  season), from calibration.level_bdcs_by_quarter; null otherwise. */
export function outcomeInText(meta: FormationMeta, period: string): string | null {
  const counts = meta.calibration?.level_bdcs_by_quarter ?? {};
  const n = counts[period];
  const most = Math.max(0, ...Object.values(counts));
  return n != null && n < most ? `the ${n} BDCs whose outcome is in` : null;
}

/** "a, b and c" (or "a; b; and c" with sep "; "). */
export function andJoin(items: readonly string[], sep = ", "): string {
  if (items.length <= 1) return items.join("");
  const last = sep === ", " ? " and " : `${sep}and `;
  return `${items.slice(0, -1).join(sep)}${last}${items[items.length - 1]}`;
}

const pct0 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${Math.round(100 * v)}%`);

/** Where the outcomes above the 80% range came from (range_coverage.by_ticker): the
 *  fewest BDCs, most first, that hold more than half of them, when three or fewer do. */
export function aboveRangeText(cover: FormationMeta["range_coverage"]): string | null {
  const counts = Object.entries(cover?.by_ticker ?? {})
    .map(([ticker, c]) => ({ ticker, above: c?.above ?? 0 }))
    .filter((c) => c.above > 0)
    .sort((a, b) => b.above - a.above || a.ticker.localeCompare(b.ticker));
  const total = counts.reduce((s, c) => s + c.above, 0);
  if (total < 2) return null;
  const picked: typeof counts = [];
  let held = 0;
  for (const c of counts) {
    if (2 * held > total || picked.length === 3) break;
    picked.push(c);
    held += c.above;
  }
  if (2 * held <= total) return null;
  const at = andJoin(picked.map((c) => c.ticker));
  return held === total ? `all ${total} above it were at ${at}` : `${held} of the ${total} above it were at ${at}`;
}

/** The simulated range and the miss a perfect model would still have, from the export. */
export function simulatedRangeText(meta: FormationMeta = formationMeta): string | null {
  const cover = meta.range_coverage;
  if (!cover?.n) return null;
  const thirds = cover.by_third?.length === 3 ? ` (${cover.by_third.map(pct0).join(" / ")} from the lowest third of forecasts to the highest)` : "";
  const floor = meta.unavoidable_miss_pp != null && meta.mean_abs != null
    ? ` A year's new non-accruals at one BDC are a handful of lumpy names, so even if every borrower's chance were exactly right the average miss would still be about ${meta.unavoidable_miss_pp.toFixed(1)}pp, against ${meta.mean_abs.toFixed(1)}pp measured. Most of the miss is the lumpiness, not the model.`
    : "";
  const above = aboveRangeText(cover);
  return `The 80% range is simulated from each BDC's own borrowers: each one goes on non-accrual with its own chance, all of them moved together by a common bad-year or good-year shock whose size was set on this same test, so a book of a few large names gets a wider range than a granular one. In the back-test it held the outcome ${pct0(cover.inside)} of the time${thirds} across ${cover.n} forecasts; ${pct0(cover.above)} of outcomes came in above it and ${pct0(cover.below)} below${above ? `; ${above}` : ""}.${floor}`;
}

/** Whether loans-only labels were tested, and how they did, from the export:
 *  scored on the forecasts both rules scored (`common`), the verdict from
 *  debt_at_least_as_good and debt_clearly_worse (scripts/83 compare_label_bases). */
export function labelBasisText(meta: FormationMeta = formationMeta): string | null {
  const cmp = meta.label_basis_comparison;
  const common = cmp?.all?.common != null && cmp?.debt?.common != null;
  const all = common ? cmp?.all?.common : cmp?.all;
  const debt = common ? cmp?.debt?.common : cmp?.debt;
  if (!all || !debt || all.relative_mean_abs == null || debt.relative_mean_abs == null) return null;
  const shippedDebt = (cmp?.shipped ?? meta.observability?.label_basis) === "debt";
  // one decimal when whole percents would read as a tie (49.5% vs 50.2%)
  const tie = Math.round(100 * debt.relative_mean_abs) === Math.round(100 * all.relative_mean_abs);
  const pct = (v: number | undefined) => (v == null ? "—" : `${(100 * v).toFixed(tie ? 1 : 0)}%`);
  const corr = (v: number | undefined) => (v == null ? "—" : v.toFixed(2));
  const on = common
    ? `On the ${debt.n != null && debt.n === all.n ? `${debt.n} ` : ""}forecasts both rules were scored on`
    : "On each rule's own back-test";
  const figures = `average miss ${pct(debt.relative_mean_abs)} of the average outcome against ${pct(all.relative_mean_abs)}, rank correlation ${corr(debt.rank_corr)} against ${corr(all.rank_corr)}`;
  const atLeast = cmp?.debt_at_least_as_good ?? (debt.relative_mean_abs <= all.relative_mean_abs
    && (debt.corr ?? 0) >= (all.corr ?? 0) && (debt.rank_corr ?? 0) >= (all.rank_corr ?? 0));
  const clearlyWorse = cmp?.debt_clearly_worse;
  if (shippedDebt) {
    const verdict = atLeast
      ? "this did at least as well as counting every investment"
      : clearlyWorse === false
        ? "this did slightly worse than counting every investment, but not clearly worse (an average miss 5% or more higher, or an AUC 0.01 or more lower), so loans only still ships"
        : "counting every investment did better";
    return `A borrower counts only when one of its loans goes on non-accrual (a preferred share or other equity going on non-accrual does not). ${on}, ${verdict}: ${figures}.${labelGapText(meta)}`;
  }
  const verdict = atLeast
    ? "It did at least as well, but this release counts every investment."
    : clearlyWorse
      ? "It was clearly worse (an average miss 5% or more higher, or an AUC 0.01 or more lower), so every investment counts."
      : "It did worse on at least one of those measures, so every investment counts.";
  return `A borrower counts once any of its investments goes on non-accrual, with everything the BDC holds in it. Counting only loans (a preferred share going on non-accrual would not count) was tested too. ${on}, counting only loans against counting every investment: ${figures}. ${verdict}${labelGapText(meta)}`;
}

/** The BDCs whose trailing year differs by at least ``minGap`` pp between the
 *  two label rules, and how the cross-holder sign's rule relates. */
export function labelGapText(meta: FormationMeta = formationMeta, minGap = 1): string {
  const all = meta.label_basis_comparison?.all?.trailing_by_ticker ?? {};
  const debt = meta.label_basis_comparison?.debt?.trailing_by_ticker ?? {};
  const gaps = Object.keys(all)
    .filter((t) => all[t] != null && debt[t] != null && Math.abs((all[t] as number) - (debt[t] as number)) >= minGap)
    .sort((a, b) => Math.abs((all[b] as number) - (debt[b] as number)) - Math.abs((all[a] as number) - (debt[a] as number)));
  const differ = gaps.length
    ? ` The two rules give a past year at least ${minGap}pp apart only for ${andJoin(gaps.map((t) => `${t} (${fmtPct(all[t])} counting every investment, ${fmtPct(debt[t])} counting loans only)`))}.`
    : Object.keys(all).length ? ` No BDC's past year differs by ${minGap}pp or more between the two rules.` : "";
  const shippedDebt = (meta.label_basis_comparison?.shipped ?? meta.observability?.label_basis) === "debt";
  return `${differ} The warning sign for trouble at another lender ${shippedDebt ? "uses the same rule" : "is narrower"}: it counts a borrower only when one of its loans is on non-accrual at another BDC.`;
}

/** Calibrations that move a forecast by a straight line and floor it at zero
 *  (scripts/83 apply_calibration: the line kinds and "relative"). */
const SHIFTS_TO_ZERO = new Set(["all_history_line", "latest_4q_line", "recent_level_shift", "relative"]);

/** The calibration choice explained from the comparison in the export (no
 *  claim that the comparison does not support). */
export function whyThisOneText(meta: FormationMeta = formationMeta): string | null {
  const rows = calibrationRows(meta);
  const shipped = rows.find((row) => row.shipped);
  if (!shipped) return null;
  const others = rows.filter((row) => !row.shipped);
  const s = shipped.candidate;
  const best = (pick: (c: CalibrationCandidate) => number | undefined) =>
    others.every(({ candidate: c }) => pick(c) == null || (pick(s) as number) <= (pick(c) as number) + 1e-9);
  const early = s.early?.mean_abs;
  const late = s.late?.mean_abs;
  const halves = early != null && late != null && best((c) => c.early?.mean_abs) && best((c) => c.late?.mean_abs);
  const overall = s.mean_abs != null && best((c) => c.mean_abs);
  const n = s.n ?? meta.n ?? "the";
  if (!overall && s.mean_abs != null) {
    const ahead = others
      .filter(({ candidate: c }) => c.mean_abs != null && (c.mean_abs as number) < (s.mean_abs as number))
      .sort((a, b) => (a.candidate.mean_abs as number) - (b.candidate.mean_abs as number))[0];
    // what that option would do instead, from the export (no claim the comparison does not show)
    const reasons: string[] = [];
    if (SHIFTS_TO_ZERO.has(ahead.key)) reasons.push("can push a BDC to zero");
    const aheadMax = ahead.candidate.published_max;
    if (aheadMax != null && s.published_max != null && aheadMax > s.published_max + 0.005) {
      reasons.push(`would publish up to ${fmtPct(aheadMax)} today, against ${fmtPct(s.published_max)} for this one`);
    }
    const why = reasons.length ? `, and that option ${andJoin(reasons)}` : "";
    return `It did not have the smallest average miss: ${s.mean_abs.toFixed(2)}pp against ${ahead.candidate.mean_abs?.toFixed(2)}pp for "${ahead.name.toLowerCase()}". On ${n} forecasts that gap settles nothing${why}, so this one ships. It will be checked again as the next quarters' outcomes come in.`;
  }
  const bias = s.bias != null
    && others.every(({ candidate: c }) => c.bias == null || Math.abs(s.bias as number) <= Math.abs(c.bias) + 1e-9);
  const missText = halves
    ? `It had the smallest average miss in both halves of the test (${(early as number).toFixed(2)} and ${(late as number).toFixed(2)}pp)`
    : `It had the smallest average miss over the whole test (${(s.mean_abs as number).toFixed(2)}pp), though not in both halves`;
  const biasText_ = bias ? " and the smallest average signed miss" : "";
  return `${missText}${biasText_}. It was picked on this same test of ${n} forecasts, so that lead is not independent proof; it will be checked again as the next quarters' outcomes come in.`;
}

/** Projections resting on few tested cases: at or above each high
 *  projection, how many back-test forecasts there are and whose (none: it is
 *  above every forecast the back-test scored). */
export function testedTailText(rows: readonly NaForecastRow[], maxBdcs = 2): string | null {
  const thin = rows.filter((row) => {
    const value = projectionValue(row);
    const tickers = (row as { form_tested_above_tickers?: readonly string[] }).form_tested_above_tickers;
    const n = (row as { form_tested_above_n?: number | null }).form_tested_above_n;
    return value != null && n != null && tickers != null && tickers.length <= maxBdcs;
  });
  if (!thin.length) return null;
  const parts = thin.map((row) => {
    const tickers = (row as { form_tested_above_tickers?: readonly string[] }).form_tested_above_tickers ?? [];
    const n = (row as { form_tested_above_n?: number | null }).form_tested_above_n ?? 0;
    if (n === 0) return `${row.ticker}'s ${fmtPct(projectionValue(row))} is above every forecast the back-test scored`;
    const own = tickers.length === 1 && tickers[0] === row.ticker;
    const whose = tickers.length === 1
      ? (own ? `${n === 1 ? "" : "all "}${row.ticker}'s own` : `${n === 1 ? "" : "all "}${tickers[0]}'s`)
      : `from ${andJoin([...tickers])} only`;
    return `at or above ${row.ticker}'s ${fmtPct(projectionValue(row))} the back-test has ${n} forecast${n === 1 ? "" : "s"}, ${whose}`;
  });
  return `The top of the ranking rests on very few tested cases: ${andJoin(parts, "; ")}.`;
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
