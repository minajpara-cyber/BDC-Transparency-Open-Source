// Publication rules for the trailing-twelve-month default rates in
// data/default_rate.ts (scripts/92). A BDC's window is shown only when every
// borrower in the starting cohort and every quarter of the outcome year has an
// observed non-accrual status ("fully_observed"). Every other window is shown
// as withheld, with the reason in plain English — never as a zero.

export interface DefaultWindowLike {
  ticker: string;
  period_end: string;
  window_observation_status: string;
  default_rate: number | null;
  hard_rate: number | null;
}

export const FULLY_OBSERVED = "fully_observed";

const WITHHELD_REASONS: Record<string, string> = {
  unknown_start_cohort: "non-accrual status unknown for the loans at the start of the year",
  unknown_outcome_status: "non-accrual status unknown in a quarter during the year",
  incomplete_quarter_window: "a quarter is missing inside the twelve months",
  withheld_reconciliation: "non-accrual figures held while the book is reconciled to the filing",
  structurally_unavailable: "reports non-accruals only as a total, not loan by loan",
  source_caveat: "the filing data for this window carries a known source problem",
};

export function isFullyObserved(row: Pick<DefaultWindowLike, "window_observation_status"> | null | undefined): boolean {
  return row?.window_observation_status === FULLY_OBSERVED;
}

/** Plain-English reason a window is withheld; empty for published windows. */
export function withheldReason(status: string | null | undefined): string {
  if (!status || status === FULLY_OBSERVED) return "";
  return WITHHELD_REASONS[status] ?? `withheld (${status.replace(/_/g, " ")})`;
}

/** Each BDC's most recent window, whatever its status. */
export function latestWindowByTicker<T extends DefaultWindowLike>(rows: readonly T[]): T[] {
  const m = new Map<string, T>();
  for (const r of rows) {
    const cur = m.get(r.ticker);
    if (!cur || r.period_end > cur.period_end) m.set(r.ticker, r);
  }
  return [...m.values()];
}

/** Each BDC's most recent fully observed window (used for "last published" hints). */
export function latestObservedWindowByTicker<T extends DefaultWindowLike>(rows: readonly T[]): Map<string, T> {
  const m = new Map<string, T>();
  for (const r of rows) {
    if (!isFullyObserved(r)) continue;
    const cur = m.get(r.ticker);
    if (!cur || r.period_end > cur.period_end) m.set(r.ticker, r);
  }
  return m;
}

/** The window for one BDC and quarter, if published. */
export function observedWindow<T extends DefaultWindowLike>(
  rows: readonly T[], ticker: string, periodEnd: string,
): T | null {
  const r = rows.find((w) => w.ticker === ticker && w.period_end === periodEnd);
  return r && isFullyObserved(r) ? r : null;
}
