// Why a position pays severe PIK. "Severe" (more than half of the coupon paid
// in kind, or all of it) says how much, not why, and the why decides whether
// it is a warning. bdc_inventory/scripts/pik_origin.py puts every PIK position
// in one of four types; the four always add up to the severe total.
//
//   by_design   preferred stock / equity / convertible notes — the PIK dividend
//               or PIK coupon is written into the instrument
//   first_seen  debt already paying PIK the first time it appears in our data.
//               Not necessarily at origination: a loan restructured before our
//               coverage of that BDC starts lands here too.
//   switched    debt that paid cash while held, then switched to PIK — the
//               stress signal
//   unknown     debt whose history cannot tell; kept separate, never merged

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

export const PIK_ORIGIN_EXPLAIN: Record<PikOrigin, string> = {
  by_design: "Preferred stock, other equity and convertible notes. The PIK dividend or PIK coupon is built into the instrument — by design, not by itself a sign of trouble.",
  first_seen: "Debt that was already paying PIK the first time it appears in our data. Usually a loan written with PIK from the start, but a loan restructured before our coverage of that BDC begins lands here too — so \"first seen\", not \"at origination\".",
  switched: "Debt that paid interest in cash while the BDC held it, then switched to paying in kind (PIK at least a fifth of the coupon, after at least two cash quarters, and still PIK at the next filing where there is one). This is the stress signal.",
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
