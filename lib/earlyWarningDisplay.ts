// Display helpers for the out-of-sample early-warning score (scripts/78) and
// the watchlist signal back-test (scripts/51). How each test labels a loan
// whose later status is unknown comes from the data files themselves
// (label_policy / label_note), so the page copy cannot drift from the export:
// both now leave such loans out rather than counting them as performing.
// Fields are read defensively because the generated files may gain new
// optional fields.
import { ewsByBdc, ewsMeta, type EwsRow } from "@/data/early_warning_scores";
import { signalBacktest, signalBacktestMeta, type BacktestRow } from "@/data/signal_backtest";

const SIGNAL_LABELS: Record<string, string> = {
  mark_below_90: "mark below 90¢",
  mark_drop_3pt: "mark down 3+ points in a quarter",
  pik_flip: "cash→PIK switch",
  modified: "loan modification",
  xholder_na: "non-accrual at another BDC",
  junior: "junior ranking (second lien or subordinated)",
};

export function signalLabel(key: string): string {
  return SIGNAL_LABELS[key] ?? key.replace(/_/g, " ");
}

/** A lower-bound score (some signals unobservable) prints as "≥N". */
export function scoreText(row: Pick<EwsRow, "score"> & { score_observation_status?: string }): string {
  return row.score_observation_status === "lower_bound" ? `≥${row.score}` : String(row.score);
}

interface Bucket { bucket: string; n: number; hit_rate_pct: number }

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
  validation_base_rate_pct?: number;
  signal_multipliers?: Record<string, number | null>;
  signal_points?: Record<string, number>;
  validation_buckets?: readonly Bucket[];
  precision_at_50_pct?: number;
  observability?: { nullable_signals?: readonly string[] };
};

export const ewsInfo = ewsMeta as unknown as LooseEwsMeta;
export const backtestInfo = signalBacktestMeta as unknown as LabelPolicyMeta;
/** Label policy of the out-of-sample score test (scripts/78). */
export const ewsLabelText = labelPolicyText(ewsInfo);
/** Label policy of the in-sample watchlist back-test (scripts/51). */
export const backtestLabelText = labelPolicyText(backtestInfo);

/** "2024-03-31..2025-09-30" → { from: "2024-03", to: "2025-09" }. */
export function validationWindow(range: string | undefined): { from: string; to: string } | null {
  if (!range) return null;
  const [from, to] = range.split("..");
  if (!from || !to) return null;
  return { from: from.slice(0, 7), to: to.slice(0, 7) };
}

/** The highest score bucket in the out-of-sample validation (e.g. "5-+"). */
export function topValidationBucket(): Bucket | null {
  const buckets = ewsInfo.validation_buckets ?? [];
  return buckets.length ? buckets[buckets.length - 1] : null;
}

export function bucketLabel(bucket: string): string {
  return bucket.endsWith("-+") ? `${bucket.slice(0, -2)}+` : bucket;
}

export const ewsIndustry = ewsByBdc.find((row) => row.ticker === "industry") ?? null;
export const ewsPeers = ewsByBdc.filter((row) => row.ticker !== "industry");

/** Signals the out-of-sample fit found weak (lift below 1.5×), with their points. */
export function weakSignals(): { key: string; multiplier: number; points: number | null }[] {
  const multipliers = ewsInfo.signal_multipliers ?? {};
  return Object.entries(multipliers)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] < 1.5)
    .map(([key, multiplier]) => ({ key, multiplier, points: ewsInfo.signal_points?.[key] ?? null }));
}

/** The signals that score points in the current fit, in plain words. */
export function scoringSignals(): string[] {
  return Object.entries(ewsInfo.signal_points ?? {})
    .filter(([, points]) => (points ?? 0) > 0)
    .map(([key]) => signalLabel(key));
}

/**
 * Signals the fit could not measure (fewer than 50 training loans carried
 * them), so they score no points. scripts/78 exports their multiplier as null.
 */
export function unmeasuredSignals(): string[] {
  return Object.entries(ewsInfo.signal_multipliers ?? {})
    .filter(([, multiplier]) => multiplier == null)
    .map(([key]) => key);
}

export const backtestBase: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal.startsWith("ALL"));
export const backtestHigh: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal === "tier: High");
export const backtestCrossHolder: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal === "NA at another BDC");
export const backtestCrossHolderStacked: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal.startsWith("NA elsewhere +"));
