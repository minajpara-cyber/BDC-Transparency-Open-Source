// Dividend-support pressure badge. data/dividend_support.ts (scripts/93)
// counts six warning signs per BDC. Four are read straight off the filings:
// reported NII below 95% of the dividend, NII ex-PIK below 80% of it,
// under-covered with under a quarter of spillover, and NAV per share down more
// than 5% in a year. The fifth, severe PIK on debt that switched from cash to
// PIK while held above SWITCHED_PIK_FLAG_PCT_NII % of NII, is inferred from
// each loan's history and PIK rate (until 2026-09-26 it was PIK over 15% of NII
// with most of the PIK book severe, which counted preferred dividends and debt
// already PIK when first seen, and did not separate outcomes — scripts/93).
// The sixth — a shadow default rate above 7% — depends on the default-rate
// estimate, so here it is re-derived from data/default_rate.ts and counted
// only when that BDC's twelve-month window for the same quarter is fully
// observed. Pressure: 0–1 signs = low, 2–3 = elevated, 4+ = high.
import { isFullyObserved, withheldReason, type DefaultWindowLike } from "./defaultRatePublication";

export type Pressure = "low" | "elevated" | "high";

export const SHADOW_DEFAULT_FLAG_PCT = 7;
/** Must equal scripts/93 SWITCHED_PIK_FLAG_PCT_NII (dividendSupportMeta). */
export const SWITCHED_PIK_FLAG_PCT_NII = 4;
export const SHADOW_DEFAULT_FLAG = `shadow default rate above ${SHADOW_DEFAULT_FLAG_PCT}%`;
const SHADOW_FLAG_PATTERN = /shadow default/i;

export interface DividendSupportLike {
  ticker: string;
  period_end: string;
  flags: readonly string[];
}

export interface GatedDividendSupport {
  /** Shadow default rate from a fully observed window, else null. */
  shadow_default_observed: number | null;
  /** Hard default rate from the same window, else null. */
  hard_default_observed: number | null;
  /** Why the shadow rate is not shown ("" when shown). */
  shadow_default_note: string;
  gated_flags: string[];
  gated_n_flags: number;
  gated_pressure: Pressure;
}

export function pressureFromCount(n: number): Pressure {
  return n >= 4 ? "high" : n >= 2 ? "elevated" : "low";
}

export function gateDividendSupport<T extends DividendSupportLike>(
  row: T, windows: readonly DefaultWindowLike[],
): T & GatedDividendSupport {
  const window = windows.find((w) => w.ticker === row.ticker && w.period_end === row.period_end) ?? null;
  const observed = isFullyObserved(window) ? window : null;
  const shadow = observed?.default_rate ?? null;
  const flags = row.flags.filter((f) => !SHADOW_FLAG_PATTERN.test(f));
  if (shadow != null && shadow > SHADOW_DEFAULT_FLAG_PCT) flags.push(SHADOW_DEFAULT_FLAG);
  const note = observed
    ? ""
    : window
      ? `Not counted: ${withheldReason(window.window_observation_status)}.`
      : "Not counted: no default-rate window for this quarter.";
  return {
    ...row,
    shadow_default_observed: shadow,
    hard_default_observed: observed?.hard_rate ?? null,
    shadow_default_note: note,
    gated_flags: flags,
    gated_n_flags: flags.length,
    gated_pressure: pressureFromCount(flags.length),
  };
}
