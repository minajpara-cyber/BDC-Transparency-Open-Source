import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import CreditHeatmap from "@/components/CreditHeatmap";
import CreditLensChart, { IndustryPoint } from "@/components/CreditLensChart";
import { creditQuality, CreditQuality } from "@/data/credit_quality";
import { modificationRate, ModificationRate } from "@/data/modification_rate";

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
      value: r.pct_new,
      reliable: isReliable(r.ticker, r.period_end),
    });
  }
  return m;
}

/** Industry total: sum of new_mods and cured across BDCs each quarter. */
function buildModIndustrySeries(): { count: IndustryPoint[]; pct: IndustryPoint[] } {
  const byPeriod = new Map<
    string,
    { newMods: number; cured: number; eligible: number; coverage: number }
  >();
  for (const r of modificationRate) {
    if (!isReliable(r.ticker, r.period_end)) continue;
    if (!byPeriod.has(r.period_end))
      byPeriod.set(r.period_end, { newMods: 0, cured: 0, eligible: 0, coverage: 0 });
    const slot = byPeriod.get(r.period_end)!;
    slot.newMods += r.new_mods;
    slot.cured += r.cured;
    slot.eligible += r.n_eligible;
    slot.coverage += 1;
  }
  const sorted = Array.from(byPeriod.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const count: IndustryPoint[] = sorted.map(([period_end, s]) => ({
    period_end,
    value: s.newMods,
    coverage: s.coverage,
  }));
  const pct: IndustryPoint[] = sorted.map(([period_end, s]) => ({
    period_end,
    value: s.eligible ? (100 * s.newMods) / s.eligible : 0,
    coverage: s.coverage,
  }));
  return { count, pct };
}

// ----- page -------------------------------------------------------------------

export default function CreditLensPage() {
  // Axes — union of period_ends across both datasets, ascending.
  const periodSet = new Set<string>();
  creditQuality.forEach((r: CreditQuality) => periodSet.add(r.period_end));
  modificationRate.forEach((r: ModificationRate) => periodSet.add(r.period_end));
  const periods = Array.from(periodSet).sort();
  const tickers = Array.from(new Set(creditQuality.map((r) => r.ticker))).sort();

  const naMap   = buildCreditCellMap("pct_non_accrual");
  const lt95Map = buildCreditCellMap("pct_below_95");
  const lt90Map = buildCreditCellMap("pct_below_90");
  const modMap  = buildModCellMap();

  const naLine   = buildIndustrySeries("pct_non_accrual");
  const lt95Line = buildIndustrySeries("pct_below_95");
  const lt90Line = buildIndustrySeries("pct_below_90");
  const { count: modCountLine, pct: modPctLine } = buildModIndustrySeries();

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
            Credit Lens
          </span>
          <span className="text-xs px-2 py-1 rounded border" style={{
            color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
          }}>
            Time Series · Beta
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Cross-BDC credit quality through time</h1>
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          BDCs as rows, quarter-ends as columns. Each cell is the metric expressed as a percent;
          companion line charts show the industry-wide aggregate (position-weighted across BDCs).
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
          title="% of eligible loans flipped cash → PIK this quarter"
          description={
            "Each cell = (# loans flipped cash → PIK this quarter) / (# loans with a prior observation this quarter). " +
            "Cells colored 0% → 2% → 5% → ≥10%. Loans whose first observation is already PIK are excluded — we can't tell if they originated PIK or were modified earlier."
          }
          periods={periods}
          tickers={tickers}
          cellMap={modMap}
          thresholds={[2, 5, 10]}
        />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry rate of new modifications</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
              Position-weighted % of eligible loans modified that quarter, across all reporting BDCs.
            </p>
            <CreditLensChart data={modPctLine} yLabel="% modified (industry)" color="#f97316" />
          </div>
          <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-sm font-semibold text-white mb-1">Industry total — loans modified per quarter</div>
            <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
              Raw count of loans flipping cash → PIK summed across all reporting BDCs each quarter.
            </p>
            <CreditLensChart data={modCountLine} yLabel="# loans modified" unit="" color="#dc2626" />
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
          Note on origination: we can only flag a loan as &quot;modified&quot; once we&apos;ve observed
          it in cash-pay state in a prior quarter. Loans that entered our dataset already PIK are not
          counted as modifications — they could either have originated PIK or been modified before we
          had coverage. As back-book parsing improves, more of these will resolve into modifications.
        </p>
      </section>

      <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
        Source: SEC EDGAR 10-K / 10-Q Schedule of Investments parsing.
        Non-accrual & PIK flags decoded from per-position SOI footnotes.
      </p>
    </div>
  );
}
