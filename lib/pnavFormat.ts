// Formatting shared by the Price/NAV page, its dividend explainer and the BDC
// detail page's price box. Plain functions (no "use client"), so server
// components can call them too.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-15" -> "Sep 15, 2026" (no Date(): avoids time-zone drift). */
export function fmtDay(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, dd] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${dd}, ${y}`;
}

/**
 * A per-share dividend amount: cents, or tenths of a cent when the amount has
 * them ($0.193, $0.045), so the parts of a total always add up on screen.
 */
export function fmtAmt(v: number): string {
  return `$${Math.round(Math.abs(v) * 1000) % 10 !== 0 ? v.toFixed(3) : v.toFixed(2)}`;
}
