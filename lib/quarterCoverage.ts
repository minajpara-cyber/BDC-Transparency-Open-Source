// Generated observation flags distinguish a missing parsed amount from a
// supported zero. Legacy exports without flags retain the positive-size guard.
import type { BDCQuarter } from "@/data/bdcs_history";

/** Amortized cost in $B, or null when the quarter's cost did not parse. */
export function reportedCostB(r: BDCQuarter): number | null {
  return r.n_positions > 0 && (r.total_cost_observed ?? r.total_cost_b > 0) ? r.total_cost_b : null;
}

/** Fair value in $B, or null when the quarter's fair value did not parse. */
export function reportedFvB(r: BDCQuarter): number | null {
  return r.n_positions > 0 && (r.total_fv_observed ?? r.total_fv_b > 0) ? r.total_fv_b : null;
}

/** FV / cost as a percentage, or null when either side did not parse. */
export function reportedMarkPct(r: BDCQuarter): number | null {
  const cost = reportedCostB(r);
  const fv = reportedFvB(r);
  return cost !== null && cost > 0 && fv !== null ? (fv / cost) * 100 : null;
}

/** True when both size fields parsed, i.e. the row can be aggregated on. */
export function hasReportedSize(r: BDCQuarter): boolean {
  return reportedCostB(r) !== null && reportedFvB(r) !== null;
}
