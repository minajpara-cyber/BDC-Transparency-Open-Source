// Coverage caveats — (ticker, period_end<=until) combinations whose parsed
// values are partial or unreliable. Pages can filter these out of industry
// aggregations, or render them in a muted style. Lifted from /credit so other
// pages can share the same gate.

export interface CoverageCaveat {
  ticker: string;
  until: string;   // period_end <= this date is unreliable
  reason: string;
}

export const COVERAGE_CAVEATS: CoverageCaveat[] = [
  { ticker: "FSK",  until: "2022-05-31", reason: "Pre-XBRL FSK parser captures partial sections" },
  { ticker: "OBDC", until: "2022-05-31", reason: "Pre-XBRL OBDC parser captures partial sections" },
  { ticker: "MFIC", until: "2025-11-30", reason: "MFIC SOI lacks per-position non-accrual footnotes" },
];

export function isReliable(ticker: string, period_end: string): boolean {
  for (const c of COVERAGE_CAVEATS) {
    if (c.ticker === ticker && period_end <= c.until) return false;
  }
  return true;
}

// The 10 BDCs whose SOIs we parse from EDGAR.
export const COVERED_TICKERS = new Set<string>([
  "ARCC", "BXSL", "CGBD", "FSK", "GBDC", "MAIN", "MFIC", "OBDC", "OCSL", "TSLX",
]);
