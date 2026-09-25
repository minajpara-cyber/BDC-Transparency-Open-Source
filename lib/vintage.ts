import type { VintageRow } from "@/data/vintage_analysis";

/**
 * The oldest age EVERY loan in a cohort has reached (all loans counted).
 * BDC-vs-industry comparisons use this age so a comparison never rests on the
 * early-dated part of a cohort only. Age 0 always qualifies when published.
 */
export function fullySeasonedRow(rows: VintageRow[]): VintageRow | undefined {
  let best: VintageRow | undefined;
  for (const r of rows) {
    if (r.n_loans_eligible !== r.n_loans_cohort) continue;
    if (!best || r.age_quarters > best.age_quarters) best = r;
  }
  return best;
}

/** Share (0-100) of a cohort's entry cost dated by a LOW-tier estimate. */
export function lowTierShare(r: VintageRow): number {
  return r.cohort_entry_cost_b > 0 ? (100 * r.cohort_low_tier_b) / r.cohort_entry_cost_b : 0;
}

/** Cohorts mostly dated by estimate are labelled / greyed above this share. */
export const MOSTLY_ESTIMATED_PCT = 50;
