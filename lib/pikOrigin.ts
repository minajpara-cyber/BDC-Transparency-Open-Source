// Why a position pays severe PIK. "Severe" (half or more of the coupon paid
// in kind, or all of it) says how much, not why, and the why decides whether
// it is a warning. bdc_inventory/scripts/pik_origin.py puts every PIK position
// in one of four types; the four always add up to the severe total.
//
//   by_design   preferred stock / equity / convertible notes — the PIK dividend
//               or PIK coupon is written into the instrument
//   first_seen  debt already paying PIK the first time it appears in our data
//               and not cut from cash-pay debt the BDC held. Not necessarily at
//               origination: a loan restructured before our coverage of that
//               BDC starts, or a refinancing our loan history cannot link to the
//               loan it replaced, lands here too.
//   switched    debt that paid cash while held, then moved to PIK — the same
//               loan, or a new PIK loan cut from the BDC's cash-pay loans to the
//               same borrower at a restructuring. The stress signal.
//   unknown     debt whose history cannot tell; kept separate, never merged
//
// A floating loan's cash coupon counts its index (FLOATING_CASH_LEG_NOTE):
// Blue Owl's BDCs and FSK print the cash coupon as the spread over SOFR, so the
// quarter-end SOFR (EURIBOR, SONIA, …) is added before the PIK share is read.

export type PikOrigin = "by_design" | "first_seen" | "switched" | "unknown";

export const PIK_ORIGINS: readonly PikOrigin[] = ["by_design", "first_seen", "switched", "unknown"];

export const PIK_ORIGIN_LABEL: Record<PikOrigin, string> = {
  by_design: "Preferred, equity & convertibles",
  first_seen: "Debt already PIK when first seen",
  switched: "Debt switched cash → PIK",
  unknown: "Debt, history unclear",
};

/** The label as a phrase inside a sentence ("debt switched cash → PIK"). */
export function pikOriginPhrase(o: PikOrigin): string {
  const label = PIK_ORIGIN_LABEL[o];
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** What "severe" means, in one phrase, wherever it is defined on the site. */
export const SEVERE_DEFINITION = "half or more of a position's coupon paid in kind, or all of it";

export const PIK_ORIGIN_EXPLAIN: Record<PikOrigin, string> = {
  by_design: "Preferred stock, other equity and convertible notes. The PIK dividend or PIK coupon is built into the instrument — by design, not by itself a sign of trouble.",
  first_seen: "Debt that was already paying PIK the first time it appears in our data, and was not cut from cash-pay debt the BDC held the quarter before. That can be a loan made with PIK terms, a loan restructured before our coverage of that BDC begins, or a refinancing into a new PIK loan that our loan history cannot link to the loan it replaced (more than a quarter of new money came in, or the old loan was filed under another name) — so \"first seen\", not \"at origination\".",
  switched: "Debt that paid interest in cash while the BDC held it, then moved to paying at least a fifth of its coupon in kind: either the same loan (after at least two cash quarters, and still PIK at the next filing where there is one), or a new PIK loan cut from the BDC's cash-pay loans to the same borrower at a restructuring (the cash-pay loans shrank as the PIK loan appeared, with no more than a quarter of new money). Severe ones now pay half or more in kind; many still pay some cash. This is the stress signal.",
  unknown: "Debt whose history cannot tell: it was cash-pay when first seen but the move to PIK did not pass the switch test (only one cash quarter before, or PIK that grew from a small share), or its history has a gap.",
};

export const PIK_ORIGIN_COLOR: Record<PikOrigin, string> = {
  by_design: "#818cf8",
  first_seen: "#f59e0b",
  switched: "#dc2626",
  unknown: "#94a3b8",
};

/** Stacked-bar series for SeverityStackedBars: severe PIK by type. */
export const SEVERE_PIK_TYPE_SERIES = PIK_ORIGINS.map((o) => ({
  key: o,
  name: PIK_ORIGIN_LABEL[o],
  color: PIK_ORIGIN_COLOR[o],
}));

export interface SeverePikTypeFields {
  pct_pik_severe: number;
  pct_pik_severe_by_design?: number | null;
  pct_pik_severe_first_seen?: number | null;
  pct_pik_severe_switched?: number | null;
  pct_pik_severe_unknown?: number | null;
}

/** One chart point from a credit_quality row: each type as % of the book. */
export function severePikTypePoint(r: SeverePikTypeFields & { period_end: string }) {
  return {
    period_end: r.period_end,
    by_design: r.pct_pik_severe_by_design ?? 0,
    first_seen: r.pct_pik_severe_first_seen ?? 0,
    switched: r.pct_pik_severe_switched ?? 0,
    unknown: r.pct_pik_severe_unknown ?? 0,
  };
}

/**
 * Round parts so they add up to their rounded total (largest remainder), e.g.
 * shares of 27.6 / 40.6 / 26.3 / 5.5 → 28 / 41 / 26 / 5 rather than a 101%
 * that does not add up. `total` defaults to the sum of the parts.
 */
export function roundToTotal(parts: number[], decimals = 0, total?: number): number[] {
  const f = 10 ** decimals;
  const target = Math.round((total ?? parts.reduce((s, v) => s + v, 0)) * f);
  const scaled = parts.map((v) => v * f);
  const floors = scaled.map(Math.floor);
  let left = target - floors.reduce((s, v) => s + v, 0);
  const order = scaled.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  const out = [...floors];
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out.map((v) => v / f);
}

/** "by design 1.9%, first seen 2.4%, …" with parts that add up to the total. */
export function severeTypeList(point: Record<PikOrigin, number>, total: number, decimals = 1, unit = "%"): string {
  const parts = roundToTotal(PIK_ORIGINS.map((o) => point[o]), decimals, total);
  return PIK_ORIGINS.map((o, i) => `${pikOriginPhrase(o)} ${parts[i].toFixed(decimals)}${unit}`).join(", ");
}

/**
 * How a floating-rate cash coupon printed as a spread is read, in one or two
 * plain-English sentences (methodology, /credit).
 */
export const FLOATING_CASH_LEG_NOTE =
  "Some filers print a floating-rate loan's cash coupon as the spread over the reference rate: Blue Owl's "
  + "\"S+ | 2.75% | 2.75%\" means SOFR + 2.75% in cash plus 2.75% in kind. We add the reference rate at the "
  + "quarter end (SOFR, EURIBOR, SONIA and so on, raised to any floor the filing prints) to the cash coupon "
  + "before working out the PIK share: that loan pays 2.75% in kind out of SOFR + 5.50%, not out of 5.50%.";
