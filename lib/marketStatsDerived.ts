// Derive the headline market stats shown on the home page from our own
// parsed SOI data (bdcsHistory + creditQuality), instead of the hand-entered
// constants in data/bdcs.ts.
//
// Coverage is the 10 traded BDCs we parse from EDGAR. The non-traded universe
// (BCRED / OCIC / HLEND / GCRED / etc.) is not in scope here, so the
// "totalBDCCount" + "Total BDC AUM" headline numbers stay sourced from the
// curated bdcs.ts list.

import { bdcsHistory } from "@/data/bdcs_history";
import { creditQuality } from "@/data/credit_quality";
import { isReliable } from "@/lib/reliability";

export interface DerivedMarketStats {
  latest_period: string;             // 'YYYY-MM-DD'  most recent quarter w/ broad coverage
  prior_period: string | null;       // 'YYYY-MM-DD'  one quarter back
  n_bdcs_latest: number;
  totalPortfolioFairValue_b: number; // sum of total_fv_b across covered BDCs, latest quarter
  totalCost_b: number;
  averageNonAccrualRate: number;     // cost-weighted across covered BDCs
  averagePikRate: number;            // cost-weighted across covered BDCs
  averageBelow95: number;            // cost-weighted from credit_quality (cost%-already)
  averageBelow90: number;
  delta_fv_b: number | null;         // QoQ
  delta_na: number | null;           // QoQ (percentage-point change)
  delta_pik: number | null;          // QoQ
}

function pickLatestPeriod(): string {
  // Use the latest period_end where the most BDCs reported. The naive max can
  // skew if just one BDC has filed its 10-Q ahead of others. Instead we pick
  // the latest period_end with the maximum count of reliable rows.
  const byPeriod = new Map<string, number>();
  for (const r of bdcsHistory) {
    if (!isReliable(r.ticker, r.period_end)) continue;
    byPeriod.set(r.period_end, (byPeriod.get(r.period_end) ?? 0) + 1);
  }
  const entries = Array.from(byPeriod.entries()).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  if (entries.length === 0) return "";
  // Walk from newest down until we hit the broadest-coverage quarter.
  let bestPeriod = entries[entries.length - 1][0];
  let bestCount = entries[entries.length - 1][1];
  for (let i = entries.length - 2; i >= entries.length - 4 && i >= 0; i--) {
    if (entries[i][1] > bestCount) {
      bestCount = entries[i][1];
      bestPeriod = entries[i][0];
    }
  }
  return bestPeriod;
}

function priorPeriodFor(period: string): string | null {
  const all = Array.from(
    new Set(bdcsHistory.filter((r) => isReliable(r.ticker, r.period_end)).map((r) => r.period_end)),
  ).sort();
  const idx = all.indexOf(period);
  if (idx <= 0) return null;
  return all[idx - 1];
}

function aggregate(period: string) {
  let totalCost = 0;
  let totalFV = 0;
  let naCostWeighted = 0;
  let pikCostWeighted = 0;
  let n = 0;
  for (const r of bdcsHistory) {
    if (r.period_end !== period) continue;
    if (!isReliable(r.ticker, r.period_end)) continue;
    totalCost += r.total_cost_b;
    totalFV   += r.total_fv_b;
    naCostWeighted  += r.total_cost_b * r.na_pct_at_cost;
    pikCostWeighted += r.total_cost_b * r.pik_pct_at_cost;
    n += 1;
  }
  // below_95 / below_90 from credit_quality (cost-weighted by total cost from bdcsHistory)
  let below95 = 0;
  let below90 = 0;
  let cqCost = 0;
  for (const cq of creditQuality) {
    if (cq.period_end !== period) continue;
    if (!isReliable(cq.ticker, cq.period_end)) continue;
    // weight by matching bdcsHistory total_cost_b
    const w = bdcsHistory.find(
      (b) => b.ticker === cq.ticker && b.period_end === cq.period_end,
    );
    if (!w) continue;
    below95 += w.total_cost_b * cq.pct_below_95;
    below90 += w.total_cost_b * cq.pct_below_90;
    cqCost  += w.total_cost_b;
  }
  return {
    totalCost,
    totalFV,
    n,
    naPct:  totalCost  ? naCostWeighted  / totalCost  : 0,
    pikPct: totalCost  ? pikCostWeighted / totalCost  : 0,
    pctBelow95: cqCost ? below95         / cqCost     : 0,
    pctBelow90: cqCost ? below90         / cqCost     : 0,
  };
}

export function computeDerivedMarketStats(): DerivedMarketStats {
  const period = pickLatestPeriod();
  const prior = priorPeriodFor(period);
  const cur = aggregate(period);
  const prv = prior ? aggregate(prior) : null;
  return {
    latest_period: period,
    prior_period: prior,
    n_bdcs_latest: cur.n,
    totalPortfolioFairValue_b: cur.totalFV,
    totalCost_b: cur.totalCost,
    averageNonAccrualRate: cur.naPct,
    averagePikRate: cur.pikPct,
    averageBelow95: cur.pctBelow95,
    averageBelow90: cur.pctBelow90,
    delta_fv_b:  prv ? cur.totalFV - prv.totalFV : null,
    delta_na:    prv ? cur.naPct   - prv.naPct   : null,
    delta_pik:   prv ? cur.pikPct  - prv.pikPct  : null,
  };
}
