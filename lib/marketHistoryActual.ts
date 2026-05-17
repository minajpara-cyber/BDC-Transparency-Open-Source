// Build industry-aggregate quarterly history series from our own parsed SOI
// data. Replaces the hand-entered 7-point series in data/market.ts for the
// /market page's "Non-Accrual Rate History" and "PIK Rate History" charts.
//
// Aggregation: cost-weighted across the covered BDCs each quarter. Both
// numerator (each BDC's cost-weighted percentage * total_cost_b) and
// denominator (total_cost_b) are billions of real USD, so cross-issuer
// aggregation is exact.

import { bdcsHistory } from "@/data/bdcs_history";
import { isReliable } from "@/lib/reliability";

export interface MarketHistoryPoint {
  date: string;       // 'YYYY-Qq' for display
  period_end: string; // 'YYYY-MM-DD' (raw)
  value: number;      // metric (0..100 for percentages)
  coverage: number;   // # BDCs contributing this quarter
}

function periodLabel(period_end: string): string {
  const [y, m] = period_end.split("-").map((p) => parseInt(p, 10));
  let q: number;
  if (m <= 3) q = 1;
  else if (m <= 6) q = 2;
  else if (m <= 9) q = 3;
  else q = 4;
  return `${y}-Q${q}`;
}

type Field = "na_pct_at_cost" | "pik_pct_at_cost";

function buildSeries(field: Field): MarketHistoryPoint[] {
  const byPeriod = new Map<
    string,
    { sumCostTimesPct: number; sumCost: number; coverage: number }
  >();
  for (const r of bdcsHistory) {
    if (!isReliable(r.ticker, r.period_end)) continue;
    if (!r.total_cost_b) continue;
    if (!byPeriod.has(r.period_end)) {
      byPeriod.set(r.period_end, { sumCostTimesPct: 0, sumCost: 0, coverage: 0 });
    }
    const slot = byPeriod.get(r.period_end)!;
    slot.sumCostTimesPct += r.total_cost_b * r[field];
    slot.sumCost += r.total_cost_b;
    slot.coverage += 1;
  }
  return Array.from(byPeriod.entries())
    .map(([period_end, s]) => ({
      period_end,
      date: periodLabel(period_end),
      value: s.sumCost ? s.sumCostTimesPct / s.sumCost : 0,
      coverage: s.coverage,
    }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

export function industryNonAccrualHistory(): MarketHistoryPoint[] {
  return buildSeries("na_pct_at_cost");
}

export function industryPikHistory(): MarketHistoryPoint[] {
  return buildSeries("pik_pct_at_cost");
}

// Aggregate fair value across the covered universe — useful for an "AUM
// over time" replacement (industry-wide parsed FV total).
export function industryFVHistory(): MarketHistoryPoint[] {
  const byPeriod = new Map<string, { sumFV: number; coverage: number }>();
  for (const r of bdcsHistory) {
    if (!isReliable(r.ticker, r.period_end)) continue;
    if (!byPeriod.has(r.period_end)) byPeriod.set(r.period_end, { sumFV: 0, coverage: 0 });
    const slot = byPeriod.get(r.period_end)!;
    slot.sumFV += r.total_fv_b;
    slot.coverage += 1;
  }
  return Array.from(byPeriod.entries())
    .map(([period_end, s]) => ({
      period_end,
      date: periodLabel(period_end),
      value: s.sumFV,
      coverage: s.coverage,
    }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

// Filter to quarters with broad coverage so the chart isn't pulled around by
// early periods where only 1-2 BDCs reported.
export function filterBroad(series: MarketHistoryPoint[], minCoverage = 6): MarketHistoryPoint[] {
  return series.filter((p) => p.coverage >= minCoverage);
}
