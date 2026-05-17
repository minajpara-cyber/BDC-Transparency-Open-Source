import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import CreditHeatmap from "@/components/CreditHeatmap";
import CreditLensChart, { IndustryPoint } from "@/components/CreditLensChart";
import AssetCompositionChart from "@/components/AssetCompositionChart";
import SeverityStackedBars from "@/components/SeverityStackedBars";
import { creditQuality, CreditQuality } from "@/data/credit_quality";
import { modificationRate, ModificationRate } from "@/data/modification_rate";
import { pikModifications } from "@/data/pik_modifications";
import { assetComposition } from "@/data/asset_composition";
import { spreadAnalysis } from "@/data/spread_analysis";

// Known parser-coverage caveats — cells from these (ticker, period_end<=cutoff)
// combinations show in muted/italic style and are excluded from industry charts.
const COVERAGE_CAVEATS: Array<{ ticker: string; until: string; reason: string }> = [
  { ticker: "FSK", until: "2022-05-31", reason: "Pre-XBRL FSK parser captures partial sections" },
  { ticker: "OBDC", until: "2022-05-31", reason: "Pre-XBRL OBDC parser captures partial sections" },
  { ticker: "MFIC", until: "2025-11-30", reason: "MFIC SOI lacks per-position non-accrual footnotes" },
];

function isReliable(ticker: string, period_end: string): boolean {
  for (const c of COVERAGE_CAVEATS) {
    if (c.ticker === ticker && period_end <= c.until) return false;
  }
  return true;
}

// ----- helpers ----------------------------------------------------------------

type NumericKeys =
  | "pct_non_accrual"
  | "pct_below_95"
  | "pct_below_90";

/** Heatmap cell map for a credit-quality metric. */
function buildCreditCellMap(field: NumericKeys) {
  const m = new Map<string, { value: number | null; reliable?: boolean }>();
  for (const r of creditQuality) {
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r[field] as number,
      reliable: isReliable(r.ticker, r.period_end),
    });
  }
  return m;
}

/**
 * Build an industry-wide series for a credit-quality metric. The aggregate is a
 * COUNT-weighted average of per-BDC percentages, weighting each BDC by its
 * n_positions in that quarter (size-weighted view of the industry). We use
 * positions rather than dollar cost because cost units differ by BDC and unit
 * multipliers aren't carried into the export.
 */
function buildIndustrySeries(field: NumericKeys): IndustryPoint[] {
  const byPeriod = new Map<string, { sumW: number; sumWV: number; coverage: number }>();
  for (const r of creditQuality) {
    if (!isReliable(r.ticker, r.period_end)) continue;
    const w = r.n_positions;
    if (!w) continue;
    if (!byPeriod.has(r.period_end))
      byPeriod.set(r.period_end, { sumW: 0, sumWV: 0, coverage: 0 });
    const slot = byPeriod.get(r.period_end)!;
    slot.sumW += w;
    slot.sumWV += w * (r[field] as number);
    slot.coverage += 1;
  }
  return Array.from(byPeriod.entries())
    .map(([period_end, { sumW, sumWV, coverage }]) => ({
      period_end,
      value: sumW ? sumWV / sumW : 0,
      coverage,
    }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

/** Modification heatmap cell map (% new modifications this quarter). */
function buildModCellMap() {
  const m = new Map<string, { value: number | null; reliable?: boolean }>();
  for (const r of modificationRate) {
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r.pct_new_cost,
      reliable: isReliable(r.ticker, r.period_end),
    });
  }
  return m;
}

/**
 * Industry-aggregate modification series. Both numerators and denominators
 * sum the per-BDC USD-equivalent costs (the export has already applied each
 * BDC's unit multiplier) so the cross-issuer aggregate is exact.
 */
function buildModIndustrySeries(): IndustryPoint[] {
  const byPeriod = new Map<
    string,
    { newCost: number; totalCost: number; coverage: number }
  >();
  for (const r of modificationRate) {
    if (!isReliable(r.ticker, r.period_end)) continue;
    if (!byPeriod.has(r.period_end))
      byPeriod.set(r.period_end, { newCost: 0, totalCost: 0, coverage: 0 });
    const slot = byPeriod.get(r.period_end)!;
    slot.newCost += r.new_mods_cost;
    slot.totalCost += r.total_cost;
    slot.coverage += 1;
  }
  return Array.from(byPeriod.entries())
    .map(([period_end, s]) => ({
      period_end,
      value: s.totalCost ? (100 * s.newCost) / s.totalCost : 0,
      coverage: s.coverage,
    }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

// ----- Asset composition + spread helpers ------------------------------------

/** Heatmap cell map for % first lien per BDC. */
function buildFirstLienCellMap() {
  const m = new Map<string, { value: number | null; reliable?: boolean }>();
  for (const r of assetComposition) {
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r.pct_first_lien,
      reliable: isReliable(r.ticker, r.period_end),
    });
  }
  return m;
}

/** Heatmap cell map for % equity per BDC. */
function buildEquityCellMap() {
  const m = new Map<string, { value: number | null; reliable?: boolean }>();
  for (const r of assetComposition) {
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r.pct_equity,
      reliable: isReliable(r.ticker, r.period_end),
    });
  }
  return m;
}

/** Per-BDC stacked-composition time series rolled to the chart's bucket model. */
function buildCompositionSeries(ticker: string) {
  return assetComposition
    .filter((r) => r.ticker === ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end))
    .map((r) => ({
      period_end: r.period_end,
      pct_first_lien: r.pct_first_lien,
      pct_second_lien: r.pct_second_lien,
      pct_unsecured: r.pct_unsecured,
      pct_subordinated: r.pct_subordinated,
      pct_structured_jv: r.pct_structured_jv,
      pct_equity: r.pct_equity,
      pct_other: r.pct_other_secured + r.pct_abf + r.pct_cash + r.pct_other + r.pct_unclassified,
    }));
}

/** Industry stacked-composition: cost-weighted average across BDCs. We don't
 *  have absolute dollar weights in asset_composition, so use n_positions from
 *  creditQuality as a proxy weight per BDC per quarter. */
function buildIndustryComposition() {
  const weightLookup = new Map<string, number>();
  for (const r of creditQuality) {
    weightLookup.set(`${r.ticker}|${r.period_end}`, r.n_positions);
  }
  const byPeriod = new Map<string, {
    weight: number; first: number; second: number; unsec: number; sub: number;
    sjv: number; eq: number; other: number;
  }>();
  for (const r of assetComposition) {
    if (!isReliable(r.ticker, r.period_end)) continue;
    const w = weightLookup.get(`${r.ticker}|${r.period_end}`) ?? 1;
    if (!byPeriod.has(r.period_end))
      byPeriod.set(r.period_end, { weight: 0, first: 0, second: 0, unsec: 0, sub: 0, sjv: 0, eq: 0, other: 0 });
    const s = byPeriod.get(r.period_end)!;
    s.weight += w;
    s.first += w * r.pct_first_lien;
    s.second += w * r.pct_second_lien;
    s.unsec += w * r.pct_unsecured;
    s.sub += w * r.pct_subordinated;
    s.sjv += w * r.pct_structured_jv;
    s.eq += w * r.pct_equity;
    s.other += w * (r.pct_other_secured + r.pct_abf + r.pct_cash + r.pct_other + r.pct_unclassified);
  }
  return Array.from(byPeriod.entries())
    .map(([period_end, s]) => ({
      period_end,
      pct_first_lien: s.weight ? s.first / s.weight : 0,
      pct_second_lien: s.weight ? s.second / s.weight : 0,
      pct_unsecured: s.weight ? s.unsec / s.weight : 0,
      pct_subordinated: s.weight ? s.sub / s.weight : 0,
      pct_structured_jv: s.weight ? s.sjv / s.weight : 0,
      pct_equity: s.weight ? s.eq / s.weight : 0,
      pct_other: s.weight ? s.other / s.weight : 0,
    }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

/** Heatmap cell map for book / new-loan spread (bps). */
function buildSpreadCellMap(field: "avg_spread_book_bps" | "avg_spread_new_bps") {
  const m = new Map<string, { value: number | null; reliable?: boolean }>();
  for (const r of spreadAnalysis) {
    m.set(`${r.ticker}|${r.period_end}`, {
      value: r[field] as number | null,
      reliable: isReliable(r.ticker, r.period_end),
    });
  }
  return m;
}

/** Industry-aggregate weighted-avg spread across BDCs each quarter.
 *  Weighted by the parsed-position count (n_positions_priced or n_new). */
function buildSpreadIndustry(field: "avg_spread_book_bps" | "avg_spread_new_bps",
                              weightField: "n_positions_priced" | "n_new"): IndustryPoint[] {
  const byPeriod = new Map<string, { num: number; den: number; coverage: number }>();
  for (const r of spreadAnalysis) {
    if (!isReliable(r.ticker, r.period_end)) continue;
    const v = r[field];
    const w = r[weightField];
    if (v === null || v === undefined || !w) continue;
    if (!byPeriod.has(r.period_end))
      byPeriod.set(r.period_end, { num: 0, den: 0, coverage: 0 });
    const s = byPeriod.get(r.period_end)!;
    s.num += (v as number) * w;
    s.den += w;
    s.coverage += 1;
  }
  return Array.from(byPeriod.entries())
    .map(([period_end, s]) => ({
      period_end,
      value: s.den ? s.num / s.den : 0,
      coverage: s.coverage,
    }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
}

// ----- page -------------------------------------------------------------------

export default function CreditPage() {
  // Axes — union of period_ends across all datasets, ascending.
  const periodSet = new Set<string>();
  creditQuality.forEach((r: CreditQuality) => periodSet.add(r.period_end));
  modificationRate.forEach((r: ModificationRate) => periodSet.add(r.period_end));
  assetComposition.forEach((r) => periodSet.add(r.period_end));
  spreadAnalysis.forEach((r) => periodSet.add(r.period_end));
  const periods = Array.from(periodSet).sort();
  const tickers = Array.from(new Set(creditQuality.map((r) => r.ticker))).sort();

  const firstLienMap = buildFirstLienCellMap();
  const equityMap    = buildEquityCellMap();
  const bookSpreadMap = buildSpreadCellMap("avg_spread_book_bps");
  const newSpreadMap  = buildSpreadCellMap("avg_spread_new_bps");

  const industryComposition = buildIndustryComposition();
  const bookSpreadLine = buildSpreadIndustry("avg_spread_book_bps", "n_positions_priced");
  const newSpreadLine  = buildSpreadIndustry("avg_spread_new_bps",  "n_new");

  const naMap   = buildCreditCellMap("pct_non_accrual");
  const lt95Map = buildCreditCellMap("pct_below_95");
  const lt90Map = buildCreditCellMap("pct_below_90");
  const modMap  = buildModCellMap();

  const naLine   = buildIndustrySeries("pct_non_accrual");
  const lt95Line = buildIndustrySeries("pct_below_95");
  const lt90Line = buildIndustrySeries("pct_below_90");
  const modPctLine = buildModIndustrySeries();

  // Modifications-by-severity: industry-aggregated counts per quarter.
  const sevByPeriod = new Map<string, { minimal: number; moderate: number; severe: number }>();
  for (const r of pikModifications) {
    if (!isReliable(r.ticker, r.period_end)) continue;
    if (!sevByPeriod.has(r.period_end))
      sevByPeriod.set(r.period_end, { minimal: 0, moderate: 0, severe: 0 });
    const s = sevByPeriod.get(r.period_end)!;
    s.minimal  += r.new_minimal;
    s.moderate += r.new_moderate;
    s.severe   += r.new_severe;
  }
  const severityIndustry = Array.from(sevByPeriod.entries())
    .map(([period_end, s]) => ({ period_end, ...s }))
    .sort((a, b) => a.period_end.localeCompare(b.period_end));

  // Per-(ticker, period) severity rows for the recent table (latest 8 quarters).
  const recentPeriods = Array.from(new Set(pikModifications.map((r) => r.period_end)))
    .sort()
    .slice(-8);
  const severityTableRows = pikModifications
    .filter((r) => recentPeriods.includes(r.period_end) && isReliable(r.ticker, r.period_end))
    .filter((r) => r.new_minimal + r.new_moderate + r.new_severe > 0)
    .sort((a, b) => (b.period_end.localeCompare(a.period_end)) || (b.new_severe - a.new_severe));

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: "#8b8ba8" }}
      >
        <ArrowLeft size={14} /> Back to home
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="px-2.5 py-1 rounded text-sm font-bold" style={{
            background: "rgba(239,68,68,0.12)",
            color: "#fca5a5",
            border: "1px solid rgba(239,68,68,0.3)",
          }}>
            Credit
          </span>
          <span className="text-xs px-2 py-1 rounded border" style={{
            color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
          }}>
            Time Series · Beta
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Cross-BDC credit through time</h1>
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          BDCs as rows, quarter-ends as columns. Each cell is the metric expressed as a percent (or
          basis points for spreads); companion charts show the industry-wide aggregate
          (position-weighted across BDCs).
        </p>
      </div>

      {/* Section nav */}
      <div className="rounded-xl border mb-8 p-3 flex items-center gap-3 flex-wrap text-xs" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <span style={{ color: "#8b8ba8" }}>Jump to:</span>
        {[
          ["#na", "Non-accrual"],
          ["#below-95", "Below 95¢"],
          ["#below-90", "Below 90¢"],
          ["#mods", "Loan modifications"],
          ["#composition", "Asset mix"],
          ["#spread", "Spread"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="px-2.5 py-1 rounded border hover:text-white transition-colors"
            style={{ color: "#d1d5db", background: "rgba(99,102,241,0.06)", borderColor: "#2d2d50" }}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Coverage caveat banner */}
      <div className="rounded-lg border p-3 mb-8 flex items-start gap-2.5 text-xs" style={{
        background: "rgba(234,179,8,0.06)",
        borderColor: "rgba(234,179,8,0.25)",
        color: "#fde68a",
      }}>
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <span className="font-semibold">Partial coverage:</span>{" "}
          The SOI parsing pipeline has known gaps for some pre-2022 filings (especially FSK and OBDC).
          Cells from those quarters appear in italics and muted color and are excluded from the
          industry-aggregate line charts. MFIC&apos;s SOI does not flag non-accrual at the position
          level, so its non-accrual column is also flagged.
        </div>
      </div>

      {/* Section 1 — Non-accrual */}
      <section id="na" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Non-accrual rate <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· % of amortized cost</span>
        </h2>
        <CreditHeatmap
          title="% of cost on non-accrual"
          description="Standard BDC credit metric. Cells colored 0% → 2% → 5% → ≥10%."
          periods={periods}
          tickers={tickers}
          cellMap={naMap}
          thresholds={[2, 5, 10]}
        />
        <div className="rounded-xl border mt-4 p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-sm font-semibold text-white mb-1">Industry non-accrual rate</div>
          <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>Position-weighted average across reporting BDCs each quarter.</p>
          <CreditLensChart data={naLine} yLabel="% non-accrual (industry)" color="#ef4444" />
        </div>
      </section>

      {/* Section 2 — Below 95¢ */}
      <section id="below-95" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Marked below 95¢ of par <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· % of cost where FV / par &lt; 0.95</span>
        </h2>
        <CreditHeatmap
          title="% of cost marked below 95¢ of par"
          description="Includes loans where the BDC has written the fair value below 95% of face. Cells colored 0% → 5% → 15% → ≥30%."
          periods={periods}
          tickers={tickers}
          cellMap={lt95Map}
          thresholds={[5, 15, 30]}
        />
        <div className="rounded-xl border mt-4 p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-sm font-semibold text-white mb-1">Industry % below 95¢</div>
          <CreditLensChart data={lt95Line} yLabel="% below 95¢ (industry)" color="#f97316" />
        </div>
      </section>

      {/* Section 3 — Below 90¢ */}
      <section id="below-90" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Marked below 90¢ of par <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· deeper distress</span>
        </h2>
        <CreditHeatmap
          title="% of cost marked below 90¢ of par"
          description="More severe markdown bucket. Cells colored 0% → 3% → 10% → ≥20%."
          periods={periods}
          tickers={tickers}
          cellMap={lt90Map}
          thresholds={[3, 10, 20]}
        />
        <div className="rounded-xl border mt-4 p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-sm font-semibold text-white mb-1">Industry % below 90¢</div>
          <CreditLensChart data={lt90Line} yLabel="% below 90¢ (industry)" color="#dc2626" />
        </div>
      </section>

      {/* Section 4 — Loan modifications */}
      <section id="mods" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Loan modifications: cash-pay → PIK <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· flow per quarter</span>
        </h2>
        <CreditHeatmap
          title="% of cost flipped cash → PIK this quarter"
          description={
            "Each cell = (amortized cost of loans flipped cash → PIK this quarter) / (amortized cost of all eligible loans this quarter). " +
            "Eligible = loans we observed in a prior quarter. Cells colored 0% → 2% → 5% → ≥10%. Loans whose first observation is already PIK are excluded — we can't tell if they originated PIK or were modified earlier."
          }
          periods={periods}
          tickers={tickers}
          cellMap={modMap}
          thresholds={[2, 5, 10]}
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry rate of new modifications (cost-weighted)</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
              (Sum of new-modification cost across reporting BDCs) / (sum of eligible-loan cost across reporting BDCs) each quarter.
            </p>
            <CreditLensChart data={modPctLine} yLabel="% modified by cost" color="#f97316" />
          </div>
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry new modifications by severity</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
              Stacked count of new cash → PIK modifications each quarter, bucketed by PIK severity
              (minimal &lt;20% / moderate 20–50% / severe ≥50% or all-PIK of total coupon).
            </p>
            <SeverityStackedBars data={severityIndustry} />
          </div>
        </div>

        {/* Recent severity table */}
        <div
          className="rounded-xl border overflow-hidden mt-4"
          style={{ background: "#111118", borderColor: "#1e1e2e" }}
        >
          <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
            <h3 className="font-semibold text-white text-sm">Recent modifications by severity (last 8 quarters)</h3>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              Per-BDC counts of new cash → PIK flips this quarter, by severity bucket. Rows sorted by quarter then severity.
            </p>
          </div>
          <div className="overflow-x-auto" style={{ maxHeight: 380 }}>
            <table className="w-full text-sm">
              <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e", position: "sticky", top: 0, zIndex: 1 }}>
                <tr>
                  {["Quarter", "BDC", "New mods", "Severe", "Moderate", "Minimal", "Cured", "Net"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap"
                      style={{ color: "#8b8ba8" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {severityTableRows.map((r, i) => (
                  <tr
                    key={`${r.ticker}-${r.period_end}-${i}`}
                    className="border-t"
                    style={{
                      borderColor: "#1a1a28",
                      background: i % 2 === 0 ? "#111118" : "#0f0f16",
                    }}
                  >
                    <td className="px-4 py-2.5 text-xs font-mono" style={{ color: "#d1d5db" }}>{r.period_end}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="text-xs font-mono font-semibold hover:text-white" style={{ color: "#a5b4fc" }}>
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold text-white">{r.new_mods}</td>
                    <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: r.new_severe > 0 ? "#dc2626" : "#6b6b88" }}>
                      {r.new_severe || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: r.new_moderate > 0 ? "#f97316" : "#6b6b88" }}>
                      {r.new_moderate || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: r.new_minimal > 0 ? "#fde68a" : "#6b6b88" }}>
                      {r.new_minimal || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm" style={{ color: r.cured > 0 ? "#22c55e" : "#6b6b88" }}>
                      {r.cured || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-sm font-semibold" style={{
                      color: r.net > 0 ? "#ef4444" : r.net < 0 ? "#22c55e" : "#9ca3af",
                    }}>
                      {r.net > 0 ? "+" : ""}{r.net}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
          Note on origination: we can only flag a loan as &quot;modified&quot; once we&apos;ve observed
          it in cash-pay state in a prior quarter. Loans that entered our dataset already PIK are not
          counted as modifications — they could either have originated PIK or been modified before we
          had coverage. As back-book parsing improves, more of these will resolve into modifications.
        </p>
      </section>

      {/* Section 5 — Asset composition (moved below modifications) */}
      <section id="composition" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Asset composition <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · 1st lien / 2nd lien / equity / other, as % of amortized cost
          </span>
        </h2>
        <CreditHeatmap
          title="% of cost in FIRST LIEN debt"
          description="Senior-secured first-lien exposure as a share of total amortized cost. Higher = more conservative. Cells colored 0% → 60% → 80% → ≥95%."
          periods={periods}
          tickers={tickers}
          cellMap={firstLienMap}
          thresholds={[60, 80, 95]}
        />
        <div className="mt-4">
          <CreditHeatmap
            title="% of cost in EQUITY (common, preferred, warrants)"
            description="Equity exposure across each book. Cells colored 0% → 3% → 8% → ≥15%."
            periods={periods}
            tickers={tickers}
            cellMap={equityMap}
            thresholds={[3, 8, 15]}
          />
        </div>
        <div className="mt-4">
          <AssetCompositionChart
            data={industryComposition}
            title="Industry composition mix over time"
            subtitle="Position-weighted average composition across reliable BDCs each quarter (stacked-area, normalized to 100%)."
          />
        </div>
      </section>

      {/* Section 6 — Spread (moved below modifications) */}
      <section id="spread" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Weighted-average spread <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>
            · book vs new originations, basis points
          </span>
        </h2>
        <CreditHeatmap
          title="Book weighted-avg spread (bps)"
          description={"Cost-weighted spread of the whole book each quarter. Parsed from the SOI's reference-rate-and-spread text (e.g. 'SOFR + 5.75%' → 575 bps). " +
            "Cells colored 400 → 525 → 625 → ≥750 bps. Most direct-lending term loans live in the 500-650 range."}
          periods={periods}
          tickers={tickers}
          cellMap={bookSpreadMap}
          thresholds={[525, 625, 750]}
          unit=" bps"
        />
        <div className="mt-4">
          <CreditHeatmap
            title="Weighted-avg spread on NEW loans this quarter (bps)"
            description="Same calc, but only on loans whose first observation in our dataset is this quarter (i.e., new originations / new commitments). Cells colored 400 → 525 → 625 → ≥750 bps."
            periods={periods}
            tickers={tickers}
            cellMap={newSpreadMap}
            thresholds={[525, 625, 750]}
            unit=" bps"
          />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry book spread (bps)</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>Position-weighted average of book spread across reporting BDCs each quarter.</p>
            <CreditLensChart data={bookSpreadLine} yLabel="Book spread (bps)" unit="" color="#22c55e" />
          </div>
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry new-loan spread (bps)</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>Position-weighted average of new-loan spreads across reporting BDCs each quarter. The new-loan series leads the book — gives the cleanest read on spread compression / widening in primary direct lending.</p>
            <CreditLensChart data={newSpreadLine} yLabel="New-loan spread (bps)" unit="" color="#a855f7" />
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
          Spread extracted from ref_rate_spread / ref_rate_combined / coupon_rate fields in the SOI.
          Floating-rate loans give a clean spread; fixed-rate notes fall through to coupon as a proxy
          (overstates spread, understates fixed-rate originations). Positions without parseable spread
          text are excluded from the weighted average.
        </p>
      </section>

      <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
        Source: SEC EDGAR 10-K / 10-Q Schedule of Investments parsing.
        Non-accrual & PIK flags decoded from per-position SOI footnotes.
      </p>
    </div>
  );
}
