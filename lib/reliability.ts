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
  // Non-traded BDCs — coverage starts when the issuer adopted XBRL tagging.
  { ticker: "BCRED", until: "2024-08-31", reason: "BCRED adopted XBRL tagging in Nov 2024; older filings not parsed" },
  // OCIC is currently UNRELIABLE on aggregate FV — the OBDC-derived parser
  // double-counts BOCIC SLF sub-fund rows. Per-position data is captured;
  // headline FV / NA% rollups are not. Hide the whole series until the
  // sub-fund de-dup is wired up.
  { ticker: "OCIC",  until: "2099-12-31", reason: "OCIC: parser double-counts sub-fund SOI rows; aggregate FV is inflated" },
  { ticker: "ADS",   until: "2022-08-31", reason: "ADS modern XBRL parser only covers 2022-11 onward" },
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
