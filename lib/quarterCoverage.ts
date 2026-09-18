// Guard against exported quarters where a size field failed to parse and was
// written as 0 rather than left empty.
//
// bdcs_history has 26 rows where total_cost_b and/or total_fv_b is exactly 0
// while n_positions is in the hundreds — OCSL has eleven consecutive quarters
// (2020-06-30 .. 2022-12-31) with cost populated and fair value 0, OCIC seven
// (2023-03-31 .. 2024-09-30) with both 0 and 452-718 positions. A BDC that
// filed a schedule of investments never has zero cost or zero fair value, so
// these are unparsed values, not real ones.
//
// The distinction matters because 0 is a number: it renders as "$0.00" and a
// red "0.00%" mark, and it sums into industry totals as a real contribution of
// nothing. Both read as findings rather than as gaps. These helpers return
// null for such a value so callers can skip it or show it as missing.

import { bdcsHistory, type BDCQuarter } from "@/data/bdcs_history";
import { measured } from "@/lib/maybeNumber";

// The test is per ROW, not per field. Where one size field of a quarter failed
// to parse, its neighbours from the same parse are suspect too, and they do not
// announce themselves by being zero. OCSL's eleven zero-fair-value quarters
// also carry costs of $5.40B and $5.54B across 131 and 135 positions — about
// $41m per position against a normal $10m, and more cost than the fund holds
// today at a third of the positions. Reporting that cost as measured while
// dashing the fair value beside it would present the same failed parse as a
// fact. So a quarter is sized only when both its size fields came through.
//
// The export writes 0 for an unread size today and is being changed to write
// null instead, so both have to mean the same thing here. Returning the three
// values together rather than testing them separately is what lets callers use
// them without re-checking: a quarter is either sized, with all three numbers,
// or it is not.
function sizeOf(r: BDCQuarter): { n: number; cost: number; fv: number } | null {
  const n = measured(r.n_positions);
  const cost = measured(r.total_cost_b);
  const fv = measured(r.total_fv_b);
  if (n === null || cost === null || fv === null) return null;
  if (n <= 0 || cost <= 0 || fv <= 0) return null;
  return { n, cost, fv };
}

/** Amortized cost in $B, or null when the quarter's size did not parse. */
export function reportedCostB(r: BDCQuarter): number | null {
  return sizeOf(r)?.cost ?? null;
}

/** Fair value in $B, or null when the quarter's size did not parse. */
export function reportedFvB(r: BDCQuarter): number | null {
  return sizeOf(r)?.fv ?? null;
}

/** Position count, or null when the quarter's size did not parse. */
export function reportedPositions(r: BDCQuarter): number | null {
  return sizeOf(r)?.n ?? null;
}

/** FV / cost as a percentage, or null when either side did not parse. */
export function reportedMarkPct(r: BDCQuarter): number | null {
  const s = sizeOf(r);
  return s ? (s.fv / s.cost) * 100 : null;
}

/** True when the quarter's size parsed, i.e. the row can be aggregated on. */
export function hasReportedSize(r: BDCQuarter): boolean {
  return sizeOf(r) !== null;
}

// ---------------------------------------------------------------------------
// Series that never once fire
//
// A metric that is identically zero for a BDC across its whole history, while
// the same metric is populated for other BDCs, is not a measurement of zero —
// it is a signal that never reached this filer. bdcs_history.na_pct_at_cost is
// the live example: it reads 0.00 in all 35 of MFIC's quarters, while
// credit_quality.pct_non_accrual reads above zero in all 36 of them, latest
// 4.6%. The site showed MFIC at 0.00% non-accrual and a green "Low" risk on
// /bdcs, and left it out of the /non-accruals table, on the strength of the
// series that has nothing in it.
//
// Derived from the data rather than listed by hand, so it cannot go stale
// against a later export.

const neverObservedNa = new Set<string>(
  (() => {
    const byTicker = new Map<string, { any: boolean; n: number }>();
    for (const r of bdcsHistory) {
      const s = byTicker.get(r.ticker) ?? { any: false, n: 0 };
      s.any = s.any || (measured(r.na_pct_at_cost) ?? 0) > 0;
      s.n += 1;
      byTicker.set(r.ticker, s);
    }
    return Array.from(byTicker.entries())
      .filter(([, s]) => !s.any && s.n >= 4)
      .map(([t]) => t);
  })(),
);

/** True when this BDC's non-accrual rate never once fires in bdcs_history. */
export function naRateNeverObserved(ticker: string): boolean {
  return neverObservedNa.has(ticker);
}
