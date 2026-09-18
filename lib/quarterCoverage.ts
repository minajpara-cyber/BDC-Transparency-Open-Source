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

import type { BDCQuarter } from "@/data/bdcs_history";

/** Amortized cost in $B, or null when the quarter's cost did not parse. */
export function reportedCostB(r: BDCQuarter): number | null {
  return r.n_positions > 0 && r.total_cost_b > 0 ? r.total_cost_b : null;
}

/** Fair value in $B, or null when the quarter's fair value did not parse. */
export function reportedFvB(r: BDCQuarter): number | null {
  return r.n_positions > 0 && r.total_fv_b > 0 ? r.total_fv_b : null;
}

/** FV / cost as a percentage, or null when either side did not parse. */
export function reportedMarkPct(r: BDCQuarter): number | null {
  const cost = reportedCostB(r);
  const fv = reportedFvB(r);
  return cost !== null && fv !== null ? (fv / cost) * 100 : null;
}

/** True when both size fields parsed, i.e. the row can be aggregated on. */
export function hasReportedSize(r: BDCQuarter): boolean {
  return reportedCostB(r) !== null && reportedFvB(r) !== null;
}
