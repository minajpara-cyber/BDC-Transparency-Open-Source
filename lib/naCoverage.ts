type CoverageRow = { ticker: string; period_end: string; na_eligible_cost_b: number };

/** A change in the pooled ratio is comparable only for the same covered issuers. */
export function sameNaCoverage(rows: readonly CoverageRow[], current?: string, prior?: string): boolean {
  if (!current || !prior) return false;
  const members = (period: string) => [...new Set(rows
    .filter((row) => row.ticker !== "industry" && row.period_end === period && row.na_eligible_cost_b > 0)
    .map((row) => row.ticker))].sort();
  const a = members(current);
  const b = members(prior);
  return a.length > 0 && a.length === b.length && a.every((ticker, index) => ticker === b[index]);
}
