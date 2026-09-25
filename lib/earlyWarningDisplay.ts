// Display helpers for the out-of-sample early-warning score (scripts/78) and
// the watchlist signal back-test (scripts/51). Both label an unknown future
// status as "no non-accrual", so their hit rates lean conservative; the copy
// that uses these helpers says so. Fields are read defensively because the
// generated files may gain new optional fields.
import { ewsByBdc, ewsMeta, type EwsRow } from "@/data/early_warning_scores";
import { signalBacktest, type BacktestRow } from "@/data/signal_backtest";

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

type LooseEwsMeta = {
  as_of?: string;
  trained_through?: string;
  validated?: string;
  validation_base_rate_pct?: number;
  signal_multipliers?: Record<string, number>;
  signal_points?: Record<string, number>;
  validation_buckets?: readonly Bucket[];
  precision_at_50_pct?: number;
  observability?: { nullable_signals?: readonly string[] };
};

export const ewsInfo = ewsMeta as unknown as LooseEwsMeta;

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
    .filter(([, multiplier]) => multiplier < 1.5)
    .map(([key, multiplier]) => ({ key, multiplier, points: ewsInfo.signal_points?.[key] ?? null }));
}

export const backtestBase: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal.startsWith("ALL"));
export const backtestHigh: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal === "tier: High");
export const backtestCrossHolder: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal === "NA at another BDC");
export const backtestCrossHolderStacked: BacktestRow | undefined =
  signalBacktest.find((row) => row.signal.startsWith("NA elsewhere +"));
