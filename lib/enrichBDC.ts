// Overlay our parsed SOI data onto the hand-entered bdcs.ts entries.
//
// For each BDC ticker we cover (see COVERED_TICKERS), the latest reliable
// row from bdcsHistory replaces:
//   portfolioFairValue  ← total_fv_b
//   nonAccrualRate      ← na_pct_at_cost
//   pikRate             ← pik_pct_at_cost
// We also surface the as-of date and Δ vs prior quarter, so the table can
// show "as of YYYY-MM-DD" + green/red Δ chips.
//
// BDCs without usable parsed history keep their hand-compiled catalog figures.
// Non-accrual and PIK are both labelled "catalog estimate (as of …)" so neither
// reads as a number parsed from the filings.

import { bdcs, BDC } from "@/data/bdcs";
import { bdcsHistory, BDCQuarter } from "@/data/bdcs_history";
import { isReliable } from "@/lib/reliability";
import { hasReportedSize } from "@/lib/quarterCoverage";
import {
  CATALOG_ESTIMATE_LABEL,
  CATALOG_ESTIMATE_REASON,
  CATALOG_ESTIMATE_STATUS,
  exactPikDelta,
  historyPikPublication,
} from "@/lib/pikPublication";

// Optional while older generated snapshots are still in use.
export interface NonAccrualPublicationMetadata {
  na_basis?: string;
  na_publication_status?: string;
  na_publication_reason?: string;
}

export function naPublicationDisplay(metadata: NonAccrualPublicationMetadata = {}) {
  const status = metadata.na_publication_status;
  if (status === CATALOG_ESTIMATE_STATUS) return {
    label: CATALOG_ESTIMATE_LABEL,
    description: metadata.na_publication_reason ?? CATALOG_ESTIMATE_REASON,
  };
  if (status === "withheld_reconciliation") return {
    label: "Reconciliation pending",
    description: metadata.na_publication_reason ?? "The non-accrual ratio is withheld while its numerator and denominator are reconciled.",
  };
  if (status === "disclosed_aggregate" || metadata.na_basis === "issuer_reported_total_investments") return {
    label: status === "unavailable_coverage" ? "Disclosure unavailable" : metadata.na_basis === "issuer_reported_investments_excluding_cash" ? "Issuer disclosure · excludes cash" : "Issuer disclosure",
    description: metadata.na_publication_reason ?? "Issuer-disclosed non-accrual share of total investments; no position-level status is inferred.",
  };
  if (status === "derived_panel") return {
    label: "Parsed positions",
    description: metadata.na_publication_reason ?? "Decoded non-accrual cost divided by positive-cost parsed investments across investment classes; issuer disclosures may use a different scope.",
  };
  if (status === "unavailable_coverage") return {
    label: "Coverage incomplete",
    description: metadata.na_publication_reason ?? "Missing position status or denominator prevents a supported ratio.",
  };
  return { label: "Basis not specified", description: "This snapshot does not supply non-accrual basis metadata." };
}

export interface BDCEnriched extends Omit<BDC, "nonAccrualRate" | "pikRate">, NonAccrualPublicationMetadata {
  nonAccrualRate: number | null;
  pikRate: number | null;
  pikRateLower?: number | null;
  pikRateUpper?: number | null;
  pikObservationCoveragePct?: number | null;
  pikPublicationStatus?: string;
  pikPublicationReason?: string;
  pikMetricVersion?: string | null;
  asOf?: string;                  // 'YYYY-MM-DD' from parsed data
  parsed?: boolean;               // true if overlay values came from our parser
  catalogEstimate?: boolean;      // true if NA / PIK / FV are hand-compiled catalog figures
  delta_fv_b?: number | null;     // QoQ change in total_fv_b
  delta_na_pct?: number | null;   // QoQ change in na_pct_at_cost
  delta_pik_pct?: number | null;  // QoQ change in pik_pct_at_cost
}

// Index bdcsHistory by ticker once, sorted ascending by period_end.
function indexHistory(): Map<string, BDCQuarter[]> {
  const m = new Map<string, BDCQuarter[]>();
  for (const r of bdcsHistory) {
    if (!isReliable(r.ticker, r.period_end)) continue;
    if (!m.has(r.ticker)) m.set(r.ticker, []);
    m.get(r.ticker)!.push(r);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.period_end.localeCompare(b.period_end));
  }
  return m;
}

function catalogEstimate(bdc: BDC): BDCEnriched {
  const nonAccrualRate = Number.isFinite(bdc.nonAccrualRate) ? bdc.nonAccrualRate : null;
  const pikRate = Number.isFinite(bdc.pikRate) ? bdc.pikRate : null;
  return {
    ...bdc,
    nonAccrualRate,
    na_basis: "static_catalog",
    na_publication_status: CATALOG_ESTIMATE_STATUS,
    na_publication_reason: CATALOG_ESTIMATE_REASON,
    pikRate,
    pikRateLower: pikRate,
    pikRateUpper: pikRate,
    pikObservationCoveragePct: null,
    pikPublicationStatus: CATALOG_ESTIMATE_STATUS,
    pikPublicationReason: CATALOG_ESTIMATE_REASON,
    pikMetricVersion: null,
    parsed: false,
    catalogEstimate: true,
  };
}

export function enrichBDC(bdc: BDC, hist: Map<string, BDCQuarter[]>): BDCEnriched {
  const all = hist.get(bdc.ticker);
  if (!all || all.length === 0) return catalogEstimate(bdc);
  // Only quarters whose size parsed can stand in for the portfolio. An
  // unparsed quarter exports as 0, so taking it as "latest" would show the BDC
  // at $0.0B, and taking it as "prior" would make the QoQ change the whole
  // portfolio. ADS, MAIN, OCIC, OCSL, CCAP and BCRED each have such rows.
  const rows = all.filter(hasReportedSize);
  if (rows.length === 0) return catalogEstimate(bdc);
  const latest = rows[rows.length - 1] as BDCQuarter & NonAccrualPublicationMetadata;
  const prior = rows.length >= 2 ? rows[rows.length - 2] as BDCQuarter & NonAccrualPublicationMetadata : null;
  const comparableNaBasis = latest.na_basis === prior?.na_basis;
  const latestPik = historyPikPublication(latest);
  const priorPik = prior ? historyPikPublication(prior) : null;
  return {
    ...bdc,
    portfolioFairValue: latest.total_fv_b,
    nonAccrualRate: latest.na_pct_at_cost,
    na_basis: latest.na_basis,
    na_publication_status: latest.na_publication_status,
    na_publication_reason: latest.na_publication_reason,
    // The sortable legacy field follows the published lower bound. An
    // unavailable observation stays null instead of reverting to its numeric
    // compatibility alias.
    pikRate: latestPik.lower,
    pikRateLower: latestPik.lower,
    pikRateUpper: latestPik.upper,
    pikObservationCoveragePct: latestPik.observationCoveragePct,
    pikPublicationStatus: latestPik.status,
    pikPublicationReason: latestPik.reason,
    pikMetricVersion: latestPik.metricVersion,
    asOf: latest.period_end,
    parsed: true,
    delta_fv_b:   prior ? latest.total_fv_b      - prior.total_fv_b      : null,
    delta_na_pct: prior && comparableNaBasis && latest.na_pct_at_cost != null && prior.na_pct_at_cost != null
      ? latest.na_pct_at_cost - prior.na_pct_at_cost : null,
    delta_pik_pct: priorPik ? exactPikDelta(latestPik, priorPik) : null,
  };
}

export function enrichedBDCs(): BDCEnriched[] {
  const hist = indexHistory();
  return bdcs.map((b) => enrichBDC(b, hist));
}
