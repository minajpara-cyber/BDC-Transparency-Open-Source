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

export interface FormationMeta {
  n?: number;
  horizon_q?: number;
  mean_abs?: number;
  corr?: number;
  bias?: number;
  actual_mean?: number;
  quartiles?: readonly FormationQuartile[];
  observability?: {
    publication_min_feature_coverage_pct?: number;
    training_embargo_quarters?: number;
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
  xh: "already on non-accrual at another BDC",
  m90: "marked 80–90¢",
  m95: "marked 90–95¢",
  pik_flip: "switched from cash interest to PIK",
  pik_sev: "severe PIK of any type (preferred dividends included)",
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
