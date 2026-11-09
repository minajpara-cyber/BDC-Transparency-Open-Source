// Display helpers for the hazard model's probabilities (scripts/na_hazard_model.py
// through scripts/78) and the watchlist signal back-test (scripts/51). How each test labels a loan
// whose later status is unknown comes from the data files themselves
// (label_policy / label_note), so the page copy cannot drift from the export:
// both leave such loans out rather than counting them as performing, and the
// hazard test (scripts/83 derive_formation_outcomes) counts a single unread
// quarter between two quarters read as performing as performing.
// Fields are read defensively because the generated files may gain new
// optional fields.
import { ewsByBdc, ewsMeta, type EwsRow } from "@/data/early_warning_scores";
import { signalBacktest, signalBacktestMeta, type BacktestRow } from "@/data/signal_backtest";

/** Reasons come from the export as plain words ("marked 72¢"). */
export function signalLabel(key: string): string {
  return key.replace(/_/g, " ");
}

/** A borrower's chance of non-accrual within a year. */
export function scoreText(row: Pick<EwsRow, "score">): string {
  return `${row.score}%`;
}

interface Bucket {
  bucket: string; n: number; hit_rate_pct: number; avg_probability_pct?: number;
  cost_per_quarter_bn?: number; share_of_later_na_cost_pct?: number | null;
}

/** How a hit-rate test labels its outcomes (ewsMeta / signalBacktestMeta). */
export type LabelPolicyMeta = {
  label_policy?: string;
  label_note?: string;
  n_excluded_unknown_start?: number;
  n_excluded_unknown_outcome?: number;
  n_excluded_borrower_already_na?: number;
};

/**
 * One plain-English sentence on how loans with an unknown status are treated,
 * read from the export. Unknown status is never described as "no non-accrual"
 * unless the export says it was labelled that way.
 */
export function labelPolicyText(meta: LabelPolicyMeta | undefined): string {
  if (meta?.label_policy === "unknown_status_windows_excluded_one_gap_bridged") {
    // the hazard model's test (scripts/78 from na_hazard_model.py): borrowers, one gap bridged
    const unknown = (meta.n_excluded_unknown_start ?? 0) + (meta.n_excluded_unknown_outcome ?? 0);
    const sameBdc = meta.n_excluded_borrower_already_na ?? 0;
    return "Borrowers whose non-accrual status we could not see are left out rather than counted as performing"
      + `${unknown > 0 ? ` (${unknown.toLocaleString()} borrower-quarters)` : ""}, except that a single unread quarter `
      + "between two quarters read as performing counts as performing"
      + (sameBdc > 0
        ? `; borrowers already on non-accrual at the same BDC are left out too (${sameBdc.toLocaleString()}).`
        : ".");
  }
  if (meta?.label_policy === "unknown_status_windows_excluded") {
    const unknown = (meta.n_excluded_unknown_start ?? 0) + (meta.n_excluded_unknown_outcome ?? 0);
    const sameBdc = meta.n_excluded_borrower_already_na ?? 0;
    return "Loans whose non-accrual status we could not see, at the start or at any later quarter of the test, "
      + `are left out rather than counted as performing${unknown > 0 ? ` (${unknown.toLocaleString()} loan-quarters)` : ""}`
      + (sameBdc > 0
        ? `, and so are loans whose borrower was already on non-accrual at the same BDC (${sameBdc.toLocaleString()}).`
        : ".");
  }
  return meta?.label_note ?? "The export does not record how loans with an unknown later status were labelled.";
}

type LooseEwsMeta = LabelPolicyMeta & {
  as_of?: string;
  trained_through?: string;
  validated?: string;
  /** The first quarter whose chances are calibrated against what actually happened. */
  calibrated_from?: string;
  validation_base_rate_pct?: number;
  validation_buckets?: readonly Bucket[];
  precision_at_50_pct?: number;
  auc?: number;
  auc_cost_weighted?: number;
  capture_top_5pct?: number;
  capture_top_10pct?: number;
  marks_only_auc?: number;
  n_labeled?: number;
  test_quarters?: number;
  horizon_quarters?: number;
  tiers?: Record<string, number>;
};

/** Severe-PIK lift by type in one period of the back-test (scripts/51). */
interface TypeLift { n: number; rate_na: number | null; lift_na: number | null }
interface PeriodLifts { n: number; base_rate_na: number | null; types: Record<string, TypeLift> }

type LooseBacktestMeta = LabelPolicyMeta & {
  evidence_note?: string;
  n_tier_rows?: number;
  tier_base_rate_na?: number | null;
  /** The tier rows' first start quarter: the first with calibrated chances. */
  tier_calibrated_from?: string | null;
  severe_pik_type_lift_by_period?: Record<string, PeriodLifts>;
};

export const ewsInfo = ewsMeta as unknown as LooseEwsMeta;
export const backtestInfo = signalBacktestMeta as unknown as LooseBacktestMeta;
/** Label policy of the out-of-sample test (scripts/78). */
export const ewsLabelText = labelPolicyText(ewsInfo);
/** Label policy of the watchlist signal back-test (scripts/51). */
export const backtestLabelText = labelPolicyText(backtestInfo);

/** "2024-03-31..2025-09-30" → { from: "2024-03", to: "2025-09" }. */
export function validationWindow(range: string | undefined): { from: string; to: string } | null {
  if (!range) return null;
  const [from, to] = range.split("..");
  if (!from || !to) return null;
  return { from: from.slice(0, 7), to: to.slice(0, 7) };
}

/** The highest probability band in the out-of-sample test. */
export function topValidationBucket(): Bucket | null {
  const buckets = ewsInfo.validation_buckets ?? [];
  return buckets.length ? buckets[buckets.length - 1] : null;
}

export function bucketLabel(bucket: string): string {
  return bucket;
}

export const ewsIndustry = ewsByBdc.find((row) => row.ticker === "industry") ?? null;
export const ewsPeers = ewsByBdc.filter((row) => row.ticker !== "industry");

/** One severe-PIK type's lift in start quarters to 2023 and from 2024 on. */
export function pikTypeLift(type: string): { early: TypeLift | null; late: TypeLift | null } {
  const byPeriod = backtestInfo.severe_pik_type_lift_by_period ?? {};
  return { early: byPeriod.to_2023?.types?.[type] ?? null, late: byPeriod.from_2024?.types?.[type] ?? null };
}

export const backtestBase: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal.startsWith("ALL"));
export const backtestHigh: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal === "tier: High");
export const backtestCrossHolder: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal === "NA at another BDC");
export const backtestCrossHolderStacked: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal.startsWith("NA elsewhere +"));
