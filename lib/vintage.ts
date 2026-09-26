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

/**
 * Share (0-100) of a cohort's entry cost dated by an ESTIMATE (long-tail name
 * match, sibling facility, DERA floor, tenor model or first sighting) rather
 * than by a disclosed acquisition date. Not the LOW confidence tier, which
 * also holds disclosed dates that drifted between quarters or holders.
 */
export function estimatedShare(r: VintageRow): number {
  return r.cohort_entry_cost_b > 0 ? (100 * (r.cohort_estimated_b ?? 0)) / r.cohort_entry_cost_b : 0;
}

/** Cohorts mostly dated by estimate are labelled / greyed above this share. */
export const MOSTLY_ESTIMATED_PCT = 50;

/**
 * High-confidence (HIGH+MED) figures are published only when those loans carry
 * at least this share of the counted cost (scripts/vintage_engine.py
 * MIN_HC_COST_PCT); below it the HC field is null and the all-dated figure is
 * used, untagged.
 */
export const MIN_HC_COST_PCT = 25;

/** "2018–2019" for the thin-coverage vintage years in the industry rows. */
export function thinVintageRange(rows: VintageRow[]): string | null {
  const years = Array.from(new Set(rows.filter((r) => r.ticker === "industry" && r.is_partial)
    .map((r) => r.vintage_year))).sort((a, b) => a - b);
  if (years.length === 0) return null;
  return years.length === 1 ? String(years[0]) : `${years[0]}–${years[years.length - 1]}`;
}
