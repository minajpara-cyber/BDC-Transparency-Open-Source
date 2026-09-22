import type { BDCQuarter } from "@/data/bdcs_history";

type NonAccrualSnapshot = Pick<BDCQuarter, "ticker" | "period_end" | "na_pct_at_cost">;

/** Select the actual latest reporting date, preserving unknowns and reported zeroes. */
export function latestNonAccrualSnapshots(
  history: readonly NonAccrualSnapshot[],
): NonAccrualSnapshot[] {
  const latest = new Map<string, NonAccrualSnapshot>();
  for (const row of history) {
    const previous = latest.get(row.ticker);
    if (!previous || row.period_end > previous.period_end) {
      latest.set(row.ticker, row);
    }
  }
  return [...latest.values()].sort((a, b) => a.ticker.localeCompare(b.ticker));
}
