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

type PoolRow = RateRow & {
  n_positions?: number;
  na_publication_status?: string;
  na_publication_reason?: string;
  na_covered_bdcs?: number;
  na_universe_bdcs?: number;
};

/** Why a BDC's rate is not in the pooled industry rate, in a few words. */
export function naPoolExclusionReason(row: PoolRow): string {
  const status = row.na_publication_status;
  if (status === "withheld_reconciliation") return "being reconciled";
  if (row.n_positions === 0) return "no accepted book this quarter";
  if (row.pct_non_accrual == null) {
    return status === "disclosed_aggregate" ? "only a fair-value figure is disclosed" : "status not decoded this quarter";
  }
  if ((row.na_publication_reason ?? "").startsWith("Approximate")) return "approximate rate";
  return "not on the pooled basis";
}

export interface IndustryNaPool {
  /** Latest quarter with an industry row. */
  latest: string;
  industry: PoolRow | null;
  /** BDCs with a book that quarter whose rate is not pooled, with the reason. */
  excluded: { ticker: string; reason: string }[];
}

/** Which BDCs the latest pooled industry non-accrual rate covers, straight from the data. */
export function industryNaPool(rows: readonly PoolRow[]): IndustryNaPool {
  const latest = rows
    .filter((row) => row.ticker === "industry")
    .reduce((max, row) => (row.period_end > max ? row.period_end : max), "");
  const industry = rows.find((row) => row.ticker === "industry" && row.period_end === latest) ?? null;
  const excluded = rows
    .filter((row) => row.ticker !== "industry" && row.period_end === latest && !(row.na_eligible_cost_b > 0))
    .map((row) => ({ ticker: row.ticker, reason: naPoolExclusionReason(row) }))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));
  return { latest, industry, excluded };
}

/** "left out: FSK (approximate rate), …" or "every BDC with a book that quarter is included". */
export function naPoolExclusionText(pool: IndustryNaPool): string {
  return pool.excluded.length > 0
    ? `left out: ${pool.excluded.map((e) => `${e.ticker} (${e.reason})`).join(", ")}; their own rates are on their BDC pages`
    : "every BDC with a book that quarter is included";
}
