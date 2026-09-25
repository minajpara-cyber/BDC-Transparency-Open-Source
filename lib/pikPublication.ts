export type PikPublicationStatus =
  | "fully_observed"
  | "bounded"
  | "unavailable"
  | "legacy_point_estimate"
  | "catalog_estimate"
  | string;

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
  if (value.status === "bounded" && Math.abs(value.upper - value.lower) > 10 ** -(digits + 1)) {
    return `${value.lower.toFixed(digits)}–${value.upper.toFixed(digits)}%`;
  }
  return `${value.lower.toFixed(digits)}%`;
}

export function pikPublicationLabel(value: PikPublication): string {
  if (value.status === "bounded") {
    const coverage = value.observationCoveragePct == null
      ? "partial observation coverage"
      : `${value.observationCoveragePct.toFixed(1)}% observed`;
    return `Bounded estimate · ${coverage}`;
  }
  if (value.status === CATALOG_ESTIMATE_STATUS) return CATALOG_ESTIMATE_LABEL;
  if (value.status === "fully_observed") return "Fully observed applicable PIK fields";
  if (value.status === "unavailable") return "PIK coverage unavailable";
  return "Legacy point estimate";
}

export function exactPikDelta(current: PikPublication, prior: PikPublication): number | null {
  if (current.status !== "fully_observed" || prior.status !== "fully_observed"
      || current.lower == null || prior.lower == null
      || current.upper !== current.lower || prior.upper !== prior.lower) return null;
  return current.lower - prior.lower;
}
