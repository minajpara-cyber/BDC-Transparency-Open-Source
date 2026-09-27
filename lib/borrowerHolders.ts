/**
 * Current vs exited holders of a borrower (borrower detail page).
 *
 * A holder is current when its last row for the borrower is its BDC's latest
 * book (the /borrowers index rule: each BDC's latest book, every position
 * summed). A BDC whose last row is older has exited the borrower: the page
 * lists it apart and leaves it out of the totals and the mark dispersion, so
 * the page's totals equal the index's (a 2021 CCAP mark at 129.7c once set
 * ExamWorks' "dispersion" and added $8M to its fair value).
 */
export function splitCurrentHolders<T extends { ticker: string; period_end: string; fv: number }>(
  lastRows: T[], latestBook: Record<string, string>,
): { current: T[]; exited: T[] } {
  const isCurrent = (r: T) => (latestBook[r.ticker] ?? r.period_end) === r.period_end;
  return {
    current: lastRows.filter(isCurrent).sort((a, b) => b.fv - a.fv),
    exited: lastRows.filter((r) => !isCurrent(r)).sort((a, b) => b.period_end.localeCompare(a.period_end)),
  };
}
