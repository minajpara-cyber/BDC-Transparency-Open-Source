type CoverageRow = { ticker: string; period_end: string; na_eligible_cost_b: number };
type RateRow = CoverageRow & { pct_non_accrual: number | null };

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

/** The calendar quarter-end before `period` ("2026-06-30" → "2026-03-31"); undefined if not a quarter-end. */
export function priorQuarterEnd(period?: string): string | undefined {
  const ends: Record<string, string> = { "03-31": "12-31", "06-30": "03-31", "09-30": "06-30", "12-31": "09-30" };
  if (!period || !/^\d{4}-\d{2}-\d{2}$/.test(period)) return undefined;
  const monthDay = period.slice(5);
  const prior = ends[monthDay];
  if (!prior) return undefined;
  const year = Number(period.slice(0, 4)) - (monthDay === "03-31" ? 1 : 0);
  return `${year}-${prior}`;
}

/** Fewest BDCs a like-for-like industry change may rest on (same bar as the industry charts). */
export const MIN_MATCHED_NA_BDCS = 12;

export interface MatchedNaChange {
  /** Pooled NA % in each quarter over the BDCs covered in both. */
  current: number;
  prior: number;
  /** current − prior, in percentage points. */
  deltaPp: number;
  nBdcs: number;
  /** True when both quarters' pooled rates already cover the same BDCs. */
  sameMembership: boolean;
}

/**
 * Like-for-like change in the pooled non-accrual rate: re-pool both quarters over
 * the BDCs whose rate is covered in both, weighting each BDC by its covered cost.
 * Returns null when either quarter is missing or fewer than `minBdcs` BDCs match,
 * so an unknown change stays unknown instead of reading as zero.
 */
export function matchedNaChange(
  rows: readonly RateRow[], current?: string, prior?: string, minBdcs = MIN_MATCHED_NA_BDCS,
): MatchedNaChange | null {
  if (!current || !prior) return null;
  const covered = (period: string) => new Map(rows
    .filter((row) => row.ticker !== "industry" && row.period_end === period
      && row.na_eligible_cost_b > 0 && row.pct_non_accrual != null)
    .map((row) => [row.ticker, row]));
  const now = covered(current);
  const before = covered(prior);
  const common = [...now.keys()].filter((ticker) => before.has(ticker));
  if (common.length < minBdcs) return null;
  const pooled = (members: Map<string, RateRow>) => {
    let cost = 0;
    let naCost = 0;
    for (const ticker of common) {
      const row = members.get(ticker) as RateRow;
      cost += row.na_eligible_cost_b;
      naCost += row.na_eligible_cost_b * (row.pct_non_accrual as number);
    }
    return naCost / cost;
  };
  const currentRate = pooled(now);
  const priorRate = pooled(before);
  return {
    current: currentRate,
    prior: priorRate,
    deltaPp: currentRate - priorRate,
    nBdcs: common.length,
    sameMembership: common.length === now.size && common.length === before.size,
  };
}
