export type PikPublicationStatus =
  | "fully_observed"
  | "near_complete"
  | "bounded"
  | "unavailable"
  | "legacy_point_estimate"
  | "catalog_estimate"
  | string;

// Display rules for the PIK lower/upper bounds. The lower bound counts only
// positions known to pay PIK; the upper bound also counts every position whose
// PIK status is unknown. Most bands are a few hundredths of a point wide, so:
//   - a band narrower than PIK_BOUNDED_MIN_PP is not called "bounded";
//   - a single number (the lower bound) is shown unless the band is wider than
//     PIK_RANGE_DISPLAY_PP, with the range kept for tooltips / secondary text;
//   - a quarter-on-quarter change is shown when both bands are narrower than
//     PIK_DELTA_MAX_BAND_PP.
export const PIK_BOUNDED_MIN_PP = 0.1;
export const PIK_RANGE_DISPLAY_PP = 1;
export const PIK_DELTA_MAX_BAND_PP = 0.25;

/** Width of the lower–upper band in percentage points, or null when unknown. */
export function pikBandPp(lower: number | null | undefined, upper: number | null | undefined): number | null {
  if (lower == null || upper == null || !Number.isFinite(lower) || !Number.isFinite(upper)) return null;
  return Math.max(0, upper - lower);
}

/** True when the band is wide enough that the range itself should be shown. */
export function showPikRange(lower: number | null | undefined, upper: number | null | undefined): boolean {
  const band = pikBandPp(lower, upper);
  return band != null && band > PIK_RANGE_DISPLAY_PP;
}

// BDCs we don't parse keep the hand-compiled figures from data/bdcs.ts, which
// was assembled in March 2026 from public disclosures. Their non-accrual and PIK
// values are shown with the same label so neither reads as a parsed number.
export const CATALOG_ESTIMATE_STATUS = "catalog_estimate";
export const CATALOG_AS_OF_LABEL = "Mar 2026";
export const CATALOG_ESTIMATE_LABEL = `Catalog estimate (as of ${CATALOG_AS_OF_LABEL})`;
export const CATALOG_ESTIMATE_REASON =
  `Hand-compiled catalog figure (as of ${CATALOG_AS_OF_LABEL}), not parsed from this BDC's filings; treat it as approximate.`;

export interface PikPublication {
  lower: number | null;
  upper: number | null;
  observationCoveragePct: number | null;
  status: PikPublicationStatus;
  reason: string;
  metricVersion: string | null;
}

interface HistoryPikFields {
  pik_pct_at_cost: number | null;
  pik_pct_at_cost_lower?: number | null;
  pik_pct_at_cost_upper?: number | null;
  pik_observation_coverage_pct?: number | null;
  pik_publication_status?: string;
  pik_publication_reason?: string;
  pik_metric_version?: string;
}

interface CreditPikFields {
  pct_pik_total: number | null;
  pct_pik_total_lower?: number | null;
  pct_pik_total_upper?: number | null;
  pik_observation_coverage_pct?: number | null;
  pik_publication_status?: string;
  pik_publication_reason?: string;
  pik_metric_version?: string;
}

interface SponsorPikFields {
  pct_pik_now: number | null;
  pct_pik_now_upper?: number | null;
  pik_observation_coverage_pct?: number | null;
  pik_publication_status?: string;
  pik_publication_reason?: string;
  pik_metric_version?: string;
}

interface EnrichedPikFields {
  pikRate: number | null;
  pikRateLower?: number | null;
  pikRateUpper?: number | null;
  pikObservationCoveragePct?: number | null;
  pikPublicationStatus?: string;
  pikPublicationReason?: string;
  pikMetricVersion?: string | null;
}

function normalized(
  legacy: number | null,
  lower: number | null | undefined,
  upper: number | null | undefined,
  coverage: number | null | undefined,
  status: string | undefined,
  reason: string | undefined,
  metricVersion: string | undefined,
): PikPublication {
  // Publication status is authoritative. Some generated artifacts retain a
  // numeric legacy alias (usually 0) even when no supported PIK estimate can
  // be published. Never let that compatibility value become a chart point or
  // headline through the explicit observability contract.
  if (status === "unavailable") return {
    lower: null,
    upper: null,
    observationCoveragePct: coverage ?? null,
    status,
    reason: reason ?? "PIK coverage is unavailable.",
    metricVersion: metricVersion ?? null,
  };

  const hasContract = status != null && lower !== undefined && upper !== undefined;
  if (!hasContract) return {
    lower: Number.isFinite(legacy) ? legacy : null,
    upper: Number.isFinite(legacy) ? legacy : null,
    observationCoveragePct: null,
    status: "legacy_point_estimate",
    reason: "This generated snapshot predates field-observability bounds.",
    metricVersion: null,
  };
  // A "bounded" row whose unknowns move the rate by less than
  // PIK_BOUNDED_MIN_PP is effectively observed; say so instead of "bounded".
  const band = pikBandPp(lower, upper);
  if (status === "bounded" && band != null && band < PIK_BOUNDED_MIN_PP) return {
    lower: lower ?? null,
    upper: upper ?? null,
    observationCoveragePct: coverage ?? null,
    status: "near_complete",
    reason: `A small amount of applicable cost has unknown PIK status; it moves the rate by less than ${PIK_BOUNDED_MIN_PP}pp.`,
    metricVersion: metricVersion ?? null,
  };
  return {
    lower: lower ?? null,
    upper: upper ?? null,
    observationCoveragePct: coverage ?? null,
    status,
    reason: reason ?? "",
    metricVersion: metricVersion ?? null,
  };
}

export function historyPikPublication(row: HistoryPikFields): PikPublication {
  return normalized(
    row.pik_pct_at_cost,
    row.pik_pct_at_cost_lower,
    row.pik_pct_at_cost_upper,
    row.pik_observation_coverage_pct,
    row.pik_publication_status,
    row.pik_publication_reason,
    row.pik_metric_version,
  );
}

export function creditPikPublication(row: CreditPikFields): PikPublication {
  return normalized(
    row.pct_pik_total,
    row.pct_pik_total_lower,
    row.pct_pik_total_upper,
    row.pik_observation_coverage_pct,
    row.pik_publication_status,
    row.pik_publication_reason,
    row.pik_metric_version,
  );
}

/** Sponsor rollups weight by position count rather than cost. */
export function sponsorPikPublication(row: SponsorPikFields): PikPublication {
  return normalized(
    row.pct_pik_now,
    row.pct_pik_now,
    row.pct_pik_now_upper,
    row.pik_observation_coverage_pct,
    row.pik_publication_status,
    row.pik_publication_reason,
    row.pik_metric_version,
  );
}

export function enrichedPikPublication(row: EnrichedPikFields): PikPublication {
  return normalized(
    row.pikRate,
    row.pikRateLower,
    row.pikRateUpper,
    row.pikObservationCoveragePct,
    row.pikPublicationStatus,
    row.pikPublicationReason,
    row.pikMetricVersion ?? undefined,
  );
}

export function formatPikPublication(value: PikPublication, digits = 2): string {
  if (value.status === "unavailable" || value.lower == null || value.upper == null) return "Unknown";
  if (showPikRange(value.lower, value.upper)) {
    return `${value.lower.toFixed(digits)}–${value.upper.toFixed(digits)}%`;
  }
  return `${value.lower.toFixed(digits)}%`;
}

/** The lower–upper range as text, for tooltips or secondary lines; null when
 *  there is no band worth mentioning (under PIK_BOUNDED_MIN_PP). */
export function pikRangeText(value: PikPublication, digits = 2): string | null {
  const band = pikBandPp(value.lower, value.upper);
  if (value.status === "unavailable" || band == null || band < PIK_BOUNDED_MIN_PP) return null;
  return `${value.lower!.toFixed(digits)}–${value.upper!.toFixed(digits)}%`;
}

export function pikPublicationLabel(value: PikPublication): string {
  const coverage = value.observationCoveragePct == null
    ? "partial observation coverage"
    : `${value.observationCoveragePct.toFixed(1)}% observed`;
  if (value.status === "bounded") {
    if (value.upper != null && !showPikRange(value.lower, value.upper)) {
      return `Up to ${value.upper.toFixed(2)}% if every unknown is PIK · ${coverage}`;
    }
    return `Range: unknowns counted as PIK at the top · ${coverage}`;
  }
  if (value.status === "near_complete") return `${coverage}; unknowns move it by under ${PIK_BOUNDED_MIN_PP}pp`;
  if (value.status === CATALOG_ESTIMATE_STATUS) return CATALOG_ESTIMATE_LABEL;
  if (value.status === "fully_observed") return "Fully observed applicable PIK fields";
  if (value.status === "unavailable") return "PIK coverage unavailable";
  return "Legacy point estimate";
}

/** Quarter-on-quarter change in the lower bound. Shown only when both
 *  quarters have a published value and a band narrower than
 *  PIK_DELTA_MAX_BAND_PP, so the change is not an artefact of unknowns. */
export function exactPikDelta(current: PikPublication, prior: PikPublication): number | null {
  const usable = (v: PikPublication) => v.status !== "unavailable" && v.status !== "legacy_point_estimate";
  const curBand = pikBandPp(current.lower, current.upper);
  const priorBand = pikBandPp(prior.lower, prior.upper);
  if (!usable(current) || !usable(prior) || curBand == null || priorBand == null
      || curBand >= PIK_DELTA_MAX_BAND_PP || priorBand >= PIK_DELTA_MAX_BAND_PP) return null;
  return current.lower! - prior.lower!;
}
