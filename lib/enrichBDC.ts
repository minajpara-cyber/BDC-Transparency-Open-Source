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
// The 20 BDCs we don't cover pass through unchanged. The shape of the
// returned object is identical to the input BDC plus optional overlay fields.

import { bdcs, BDC } from "@/data/bdcs";
import { bdcsHistory, BDCQuarter } from "@/data/bdcs_history";
import { isReliable } from "@/lib/reliability";
import { hasReportedSize, naRateNeverObserved } from "@/lib/quarterCoverage";
import { creditQuality } from "@/data/credit_quality";

export interface BDCEnriched extends BDC {
  asOf?: string;                  // 'YYYY-MM-DD' from parsed data
  parsed?: boolean;               // true if overlay values came from our parser
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

export function enrichBDC(bdc: BDC, hist: Map<string, BDCQuarter[]>): BDCEnriched {
  const all = hist.get(bdc.ticker);
  if (!all || all.length === 0) return bdc;
  // Only quarters whose size parsed can stand in for the portfolio. An
  // unparsed quarter exports as 0, so taking it as "latest" would show the BDC
  // at $0.0B, and taking it as "prior" would make the QoQ change the whole
  // portfolio. ADS, MAIN, OCIC, OCSL, CCAP and BCRED each have such rows.
  const rows = all.filter(hasReportedSize);
  if (rows.length === 0) return bdc;
  const latest = rows[rows.length - 1];
  const prior = rows.length >= 2 ? rows[rows.length - 2] : null;

  // Where this BDC's non-accrual series never fires at all, it is a signal that
  // did not reach the filer rather than a clean book, so read the rate from
  // credit_quality, which does carry it. MFIC is the case: 0.00 in all 35
  // bdcs_history quarters, 4.6% in credit_quality for the same latest quarter.
  const naFromHistory = !naRateNeverObserved(bdc.ticker);
  const cqAt = (p: string) =>
    creditQuality.find((c) => c.ticker === bdc.ticker && c.period_end === p)?.pct_non_accrual;
  const naLatest = naFromHistory ? latest.na_pct_at_cost : cqAt(latest.period_end);
  const naPrior = prior
    ? (naFromHistory ? prior.na_pct_at_cost : cqAt(prior.period_end))
    : undefined;

  return {
    ...bdc,
    portfolioFairValue: latest.total_fv_b,
    // Falls back to the hand-entered figure when neither source measured it.
    nonAccrualRate: naLatest ?? bdc.nonAccrualRate,
    pikRate: latest.pik_pct_at_cost,
    asOf: latest.period_end,
    parsed: true,
    delta_fv_b:   prior ? latest.total_fv_b      - prior.total_fv_b      : null,
    delta_na_pct: naLatest !== undefined && naPrior !== undefined ? naLatest - naPrior : null,
    delta_pik_pct: prior ? latest.pik_pct_at_cost - prior.pik_pct_at_cost : null,
  };
}

export function enrichedBDCs(): BDCEnriched[] {
  const hist = indexHistory();
  return bdcs.map((b) => enrichBDC(b, hist));
}
