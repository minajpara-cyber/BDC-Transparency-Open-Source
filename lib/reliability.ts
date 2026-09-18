// Coverage caveats — (ticker, period_end<=until) combinations whose parsed
// values are partial or unreliable. Pages can filter these out of industry
// aggregations, or render them in a muted style. Lifted from /credit so other
// pages can share the same gate.

export interface CoverageCaveat {
  ticker: string;
  until: string;   // period_end <= this date is unreliable
  reason: string;
  /** True when the caveat is about the parse capturing part of the schedule,
   *  so the quarter's own size (positions, cost, fair value) is affected and
   *  not just one metric derived from it. */
  affectsSize?: boolean;
}

export const COVERAGE_CAVEATS: CoverageCaveat[] = [
  { ticker: "FSK",  until: "2022-05-31", reason: "Pre-XBRL FSK parser captures partial sections", affectsSize: true },
  { ticker: "OBDC", until: "2022-05-31", reason: "Pre-XBRL OBDC parser captures partial sections", affectsSize: true },
  { ticker: "MFIC", until: "2025-11-30", reason: "MFIC SOI lacks per-position non-accrual footnotes" },
  // Non-traded BDCs — coverage starts when the issuer adopted XBRL tagging.
  { ticker: "BCRED", until: "2024-08-31", reason: "BCRED adopted XBRL tagging in Nov 2024; older filings not parsed", affectsSize: true },
  { ticker: "OCIC",  until: "2022-05-31", reason: "OCIC pre-XBRL filings not parsed", affectsSize: true },
  { ticker: "ADS",   until: "2022-08-31", reason: "ADS modern XBRL parser only covers 2022-11 onward", affectsSize: true },
];

export function isReliable(ticker: string, period_end: string): boolean {
  for (const c of COVERAGE_CAVEATS) {
    if (c.ticker === ticker && period_end <= c.until) return false;
  }
  return true;
}

// The 14 BDCs whose SOIs we parse from EDGAR (10 traded + 4 non-traded).
export const COVERED_TICKERS = new Set<string>([
  "ARCC", "BXSL", "CGBD", "FSK", "GBDC", "MAIN", "MFIC", "OBDC", "OCSL", "TSLX",
  "BCRED", "ASIF", "ADS", "OCIC",
]);

/**
 * The caveat covering this quarter's SIZE, or null when none does. MFIC's
 * caveat is about missing non-accrual footnotes, not about the parse missing
 * positions, so it does not qualify.
 *
 * This matters because a partial parse does not look partial. BCRED's cost
 * runs 1.88x to 1.94x the total BCRED itself files with the SEC for the eight
 * quarters up to 2024-06-30 — $98.4B against a filed $51.0B at 2023-12-31 —
 * and then steps to 1.12x when its position count jumps from 933 to 1,499.
 * Cost and fair value are inflated together, so the mark still reads 0.99 and
 * nothing internal to the row gives it away.
 */
export function sizeCaveatFor(ticker: string, period_end: string): CoverageCaveat | null {
  return (
    COVERAGE_CAVEATS.find(
      (c) => c.affectsSize && c.ticker === ticker && period_end <= c.until,
    ) ?? null
  );
}
