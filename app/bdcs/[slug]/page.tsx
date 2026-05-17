import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Building2, LineChart } from "lucide-react";
import AlertBadge from "@/components/AlertBadge";
import StatCard from "@/components/StatCard";
import AssetCompositionChart from "@/components/AssetCompositionChart";
import SeverityStackedBars from "@/components/SeverityStackedBars";
import CreditLensChart from "@/components/CreditLensChart";
import { bdcs } from "@/data/bdcs";
import { bdcsHistory } from "@/data/bdcs_history";
import { portfolioCompanies } from "@/data/companies";
import { creditQuality } from "@/data/credit_quality";
import { modificationRate } from "@/data/modification_rate";
import { pikModifications } from "@/data/pik_modifications";
import { assetComposition } from "@/data/asset_composition";
import { spreadAnalysis } from "@/data/spread_analysis";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return bdcs.map((b) => ({ slug: b.slug }));
}

export default async function BDCDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const bdc = bdcs.find((b) => b.slug === slug);
  if (!bdc) notFound();

  // Find all portfolio companies held by this BDC
  const holdings = portfolioCompanies.flatMap((company) => {
    const holder = company.holders.find((h) => h.bdc === bdc.ticker);
    if (!holder) return [];
    return [{ company, holder }];
  });

  const totalFV = holdings.reduce((sum, h) => sum + h.holder.fairValue, 0);
  const totalPrincipal = holdings.reduce((sum, h) => sum + h.holder.principalAmount, 0);
  const nonAccruals = holdings.filter((h) => h.holder.status === "Non-Accrual");
  const pikHoldings = holdings.filter((h) => h.holder.status === "PIK");

  const softwareRisk = bdc.softwareExposure >= 50 ? "Critical" : bdc.softwareExposure >= 25 ? "High" : bdc.softwareExposure >= 15 ? "Medium" : "Low";

  const hasTimeline = bdcsHistory.some((r) => r.ticker === bdc.ticker);

  // ---- Build per-BDC credit slices from our parsed data ---------------------
  const cqRows = creditQuality
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const cqLatest = cqRows[cqRows.length - 1];
  const cqPrior  = cqRows[cqRows.length - 2];
  const hasCredit = !!cqLatest;

  const acRows = assetComposition
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const acLatest = acRows[acRows.length - 1];

  const spRows = spreadAnalysis
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const spLatest = spRows[spRows.length - 1];
  const spPrior  = spRows[spRows.length - 2];

  const modRows = pikModifications
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));
  const modRateRows = modificationRate
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));

  // Lines for charts
  const naLine = cqRows.map((r) => ({ period_end: r.period_end, value: r.pct_non_accrual, coverage: 1 }));
  const pikLine = cqRows.map((r) => ({ period_end: r.period_end, value: r.pct_pik_total, coverage: 1 }));
  const lt95Line = cqRows.map((r) => ({ period_end: r.period_end, value: r.pct_below_95, coverage: 1 }));
  const bookSpreadLine = spRows
    .filter((r) => r.avg_spread_book_bps !== null)
    .map((r) => ({ period_end: r.period_end, value: r.avg_spread_book_bps as number, coverage: 1 }));
  const newSpreadLine = spRows
    .filter((r) => r.avg_spread_new_bps !== null)
    .map((r) => ({ period_end: r.period_end, value: r.avg_spread_new_bps as number, coverage: 1 }));

  // Composition stacked-area data (collapse "other" buckets)
  const compositionLine = acRows.map((r) => ({
    period_end: r.period_end,
    pct_first_lien:  r.pct_first_lien,
    pct_second_lien: r.pct_second_lien,
    pct_unsecured:   r.pct_unsecured,
    pct_subordinated: r.pct_subordinated,
    pct_structured_jv: r.pct_structured_jv,
    pct_equity:      r.pct_equity,
    pct_other:       r.pct_other_secured + r.pct_abf + r.pct_cash + r.pct_other + r.pct_unclassified,
  }));

  // Severity stacked bars: per-quarter counts (latest 12 quarters)
  const sevSeries = modRows.slice(-12).map((r) => ({
    period_end: r.period_end,
    minimal: r.new_minimal,
    moderate: r.new_moderate,
    severe: r.new_severe,
  }));

  // Helpers
  const fmtDelta = (curr?: number, prev?: number, decimals = 2) => {
    if (curr === undefined || prev === undefined || prev === null) return undefined;
    const d = curr - prev;
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d.toFixed(decimals)} pp Q/Q`;
  };
  const fmtDeltaBps = (curr?: number | null, prev?: number | null) => {
    if (curr === null || curr === undefined || prev === null || prev === undefined) return undefined;
    const d = curr - prev;
    const sign = d >= 0 ? "+" : "";
    return `${sign}${d} bps Q/Q`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back button */}
      <Link href="/bdcs" className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors" style={{ color: "#8b8ba8" }}>
        <ArrowLeft size={14} /> Back to BDCs
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="px-2.5 py-1 rounded text-sm font-mono font-bold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
              {bdc.ticker}
            </span>
            <span className="text-xs px-2 py-1 rounded border" style={{
              color: bdc.type === "Non-Traded" ? "#eab308" : "#22c55e",
              background: bdc.type === "Non-Traded" ? "rgba(234,179,8,0.1)" : "rgba(34,197,94,0.1)",
              borderColor: bdc.type === "Non-Traded" ? "rgba(234,179,8,0.2)" : "rgba(34,197,94,0.2)",
            }}>
              {bdc.type} BDC
            </span>
            <AlertBadge severity={softwareRisk as "Critical" | "High" | "Medium" | "Low"} label />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{bdc.name}</h1>
          <p className="text-sm" style={{ color: "#9ca3af" }}>Managed by {bdc.manager}</p>
        </div>
        {bdc.type === "Traded" && bdc.price && (
          <div className="rounded-xl border p-4 text-right" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Share Price</div>
            <div className="text-2xl font-bold text-white">${bdc.price.toFixed(2)}</div>
            <div className="text-xs mt-1" style={{ color: bdc.priceToNav && bdc.priceToNav >= 1 ? "#22c55e" : "#f97316" }}>
              {bdc.priceToNav && bdc.priceToNav >= 1 ? "+" : ""}{((bdc.priceToNav ?? 1) - 1) * 100 > 0 ? "+" : ""}{(((bdc.priceToNav ?? 1) - 1) * 100).toFixed(1)}% to NAV
            </div>
          </div>
        )}
      </div>

      {/* Time-series CTA */}
      {hasTimeline && (
        <Link
          href={`/bdcs/${bdc.slug}/timeline`}
          className="group inline-flex items-center gap-2 mb-6 px-4 py-2.5 rounded-lg border transition-colors"
          style={{
            background: "rgba(99,102,241,0.08)",
            borderColor: "rgba(99,102,241,0.3)",
            color: "#a5b4fc",
          }}
        >
          <LineChart size={14} />
          <span className="text-sm font-medium">View {bdc.ticker} through time →</span>
          <span className="text-xs" style={{ color: "#8b8ba8" }}>
            Quarter-by-quarter portfolio composition
          </span>
        </Link>
      )}

      {/* Credit analysis (parsed SOI data) */}
      {hasCredit && (
        <section className="mb-8">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <h2 className="text-lg font-semibold text-white">Credit analysis</h2>
            <span className="text-xs px-2 py-0.5 rounded border" style={{
              color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
            }}>
              Latest: {cqLatest.period_end}
            </span>
            <Link href="/credit" className="text-xs hover:text-white transition-colors" style={{ color: "#8b8ba8" }}>
              See cross-BDC view on /credit →
            </Link>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatCard
              label="Non-accrual % (cost)"
              value={`${cqLatest.pct_non_accrual.toFixed(2)}%`}
              color={cqLatest.pct_non_accrual >= 3 ? "#ef4444" : cqLatest.pct_non_accrual >= 1 ? "#eab308" : "#22c55e"}
              trend={cqPrior && cqLatest.pct_non_accrual > cqPrior.pct_non_accrual ? "up" : cqPrior && cqLatest.pct_non_accrual < cqPrior.pct_non_accrual ? "down" : undefined}
              trendLabel={cqPrior ? fmtDelta(cqLatest.pct_non_accrual, cqPrior.pct_non_accrual) : undefined}
            />
            <StatCard
              label="PIK % (cost)"
              value={`${cqLatest.pct_pik_total.toFixed(2)}%`}
              color={cqLatest.pct_pik_total >= 15 ? "#f97316" : cqLatest.pct_pik_total >= 5 ? "#eab308" : "#9ca3af"}
              trend={cqPrior && cqLatest.pct_pik_total > cqPrior.pct_pik_total ? "up" : cqPrior && cqLatest.pct_pik_total < cqPrior.pct_pik_total ? "down" : undefined}
              trendLabel={cqPrior ? fmtDelta(cqLatest.pct_pik_total, cqPrior.pct_pik_total) : undefined}
            />
            <StatCard
              label="% below 95¢ of par"
              value={`${cqLatest.pct_below_95.toFixed(1)}%`}
              color={cqLatest.pct_below_95 >= 15 ? "#ef4444" : cqLatest.pct_below_95 >= 5 ? "#eab308" : "#9ca3af"}
              trend={cqPrior && cqLatest.pct_below_95 > cqPrior.pct_below_95 ? "up" : cqPrior && cqLatest.pct_below_95 < cqPrior.pct_below_95 ? "down" : undefined}
              trendLabel={cqPrior ? fmtDelta(cqLatest.pct_below_95, cqPrior.pct_below_95, 1) : undefined}
            />
            {spLatest?.avg_spread_book_bps !== undefined && spLatest.avg_spread_book_bps !== null && (
              <StatCard
                label="Book spread"
                value={`${spLatest.avg_spread_book_bps} bps`}
                color="#22c55e"
                trend={spPrior?.avg_spread_book_bps !== undefined && spPrior.avg_spread_book_bps !== null
                  && (spLatest.avg_spread_book_bps > spPrior.avg_spread_book_bps ? "up" : spLatest.avg_spread_book_bps < spPrior.avg_spread_book_bps ? "down" : undefined) || undefined}
                trendLabel={spPrior ? fmtDeltaBps(spLatest.avg_spread_book_bps, spPrior.avg_spread_book_bps) : undefined}
              />
            )}
            {spLatest?.avg_spread_new_bps !== undefined && spLatest.avg_spread_new_bps !== null && (
              <StatCard
                label="New-loan spread"
                value={`${spLatest.avg_spread_new_bps} bps`}
                color="#a855f7"
                sub={spLatest.n_new ? `${spLatest.n_new} new loans` : undefined}
              />
            )}
            {acLatest && (
              <StatCard
                label="% first lien"
                value={`${acLatest.pct_first_lien.toFixed(1)}%`}
                color={acLatest.pct_first_lien >= 80 ? "#22c55e" : acLatest.pct_first_lien >= 60 ? "#eab308" : "#f97316"}
                sub={`${acLatest.pct_equity.toFixed(1)}% equity`}
              />
            )}
          </div>

          {/* Two-up: NA% trend + Below-95 trend */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="text-sm font-semibold text-white mb-1">Non-accrual & PIK trajectory</div>
              <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>% of cost on non-accrual (red) and any-PIK (orange).</p>
              <div style={{ height: 220 }}>
                <CreditLensChart data={naLine} yLabel="% NA at cost" color="#ef4444" height={220} />
              </div>
              <div style={{ height: 220, marginTop: 8 }}>
                <CreditLensChart data={pikLine} yLabel="% PIK at cost" color="#f97316" height={220} />
              </div>
            </div>
            <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <div className="text-sm font-semibold text-white mb-1">Markdown stress</div>
              <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>% of cost where FV / par &lt; 0.95.</p>
              <div style={{ height: 220 }}>
                <CreditLensChart data={lt95Line} yLabel="% below 95¢" color="#ef4444" height={220} />
              </div>
              {(bookSpreadLine.length > 0 || newSpreadLine.length > 0) && (
                <>
                  <div className="text-sm font-semibold text-white mb-1 mt-3">Spread trajectory (bps)</div>
                  <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>Book spread (green) vs new-loan spread (purple).</p>
                  <div style={{ height: 220 }}>
                    {bookSpreadLine.length > 0 && (
                      <CreditLensChart data={bookSpreadLine} yLabel="bps" unit="" color="#22c55e" height={220} />
                    )}
                  </div>
                  {newSpreadLine.length > 0 && (
                    <div style={{ height: 220, marginTop: 8 }}>
                      <CreditLensChart data={newSpreadLine} yLabel="new bps" unit="" color="#a855f7" height={220} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Two-up: asset composition + modifications by severity */}
          {(compositionLine.length > 0 || sevSeries.length > 0) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-4">
              {compositionLine.length > 0 && (
                <AssetCompositionChart
                  data={compositionLine}
                  title="Asset composition over time"
                  subtitle="% of cost in each asset class, stacked to 100% per quarter."
                />
              )}
              {sevSeries.length > 0 && (
                <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
                  <div className="text-sm font-semibold text-white mb-1">Modifications by severity (last 12 quarters)</div>
                  <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
                    Count of new cash → PIK flips per quarter, bucketed by PIK severity.
                  </p>
                  <SeverityStackedBars data={sevSeries} />
                </div>
              )}
            </div>
          )}

          {/* Recent quarters table */}
          <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
              <h3 className="font-semibold text-white text-sm">Recent quarters — credit snapshot</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                  <tr>
                    {["Quarter", "Positions", "NA %", "PIK %", "Below 95¢", "Below 90¢", "Book bps", "New bps", "% 1st lien"].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap" style={{ color: "#8b8ba8" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...cqRows].reverse().slice(0, 12).map((r, i) => {
                    const sp = spRows.find((x) => x.period_end === r.period_end);
                    const ac = acRows.find((x) => x.period_end === r.period_end);
                    return (
                      <tr
                        key={r.period_end}
                        className="border-t"
                        style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-white">{r.period_end}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#d1d5db" }}>{r.n_positions.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: r.pct_non_accrual >= 3 ? "#ef4444" : r.pct_non_accrual >= 1 ? "#eab308" : "#9ca3af" }}>
                          {r.pct_non_accrual.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: r.pct_pik_total >= 15 ? "#f97316" : r.pct_pik_total >= 5 ? "#eab308" : "#9ca3af" }}>
                          {r.pct_pik_total.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: r.pct_below_95 >= 15 ? "#ef4444" : "#9ca3af" }}>
                          {r.pct_below_95.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: r.pct_below_90 >= 10 ? "#ef4444" : "#9ca3af" }}>
                          {r.pct_below_90.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#22c55e" }}>
                          {sp?.avg_spread_book_bps ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#a855f7" }}>
                          {sp?.avg_spread_new_bps ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: "#9ca3af" }}>
                          {ac ? `${ac.pct_first_lien.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* Description */}
      <div className="rounded-xl border p-5 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <p className="text-sm leading-relaxed" style={{ color: "#d1d5db" }}>{bdc.description}</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {bdc.topSectors.map((s) => (
            <span key={s} className="px-2 py-0.5 rounded text-xs border" style={{ background: "rgba(99,102,241,0.08)", borderColor: "#2d2d50", color: "#a5b4fc" }}>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Portfolio FV" value={`$${bdc.portfolioFairValue.toFixed(1)}B`} />
        <StatCard label="# Companies" value={bdc.portfolioCompanies.toString()} />
        <StatCard label="Software Exp." value={`${bdc.softwareExposure.toFixed(1)}%`} color="#6366f1" />
        <StatCard label="Non-Accrual" value={`${bdc.nonAccrualRate.toFixed(1)}%`} color={bdc.nonAccrualRate >= 3 ? "#ef4444" : "#22c55e"} />
        <StatCard label="PIK Rate" value={`${bdc.pikRate.toFixed(1)}%`} color={bdc.pikRate >= 10 ? "#f97316" : "#eab308"} />
        {bdc.dividendYield && <StatCard label="Div. Yield" value={`${bdc.dividendYield.toFixed(1)}%`} color="#22c55e" />}
      </div>

      {/* Software Exposure Detail */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Software Exposure Analysis</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Software Exposure</div>
            <div className="text-2xl font-bold mb-2" style={{ color: bdc.softwareExposure >= 30 ? "#f97316" : "#a5b4fc" }}>
              {bdc.softwareExposure.toFixed(1)}%
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
              <div className="h-full rounded-full" style={{ width: `${bdc.softwareExposure}%`, background: "#6366f1" }} />
            </div>
            <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>
              vs. 29.0% BDC average
            </div>
          </div>
          <div>
            <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Total Tech Exposure</div>
            <div className="text-2xl font-bold mb-2 text-white">{bdc.techExposure.toFixed(1)}%</div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
              <div className="h-full rounded-full" style={{ width: `${bdc.techExposure}%`, background: "#8b5cf6" }} />
            </div>
            <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>Software + adjacent tech</div>
          </div>
          <div>
            <div className="text-xs mb-2" style={{ color: "#8b8ba8" }}>Loan Structure</div>
            <div className="text-sm leading-relaxed" style={{ color: "#d1d5db" }}>{bdc.loanType}</div>
            <div className="text-xs mt-2" style={{ color: "#8b8ba8" }}>Investment Focus</div>
            <div className="text-sm mt-1" style={{ color: "#d1d5db" }}>{bdc.focus}</div>
          </div>
        </div>
      </div>

      {/* Tracked Holdings in this BDC */}
      {holdings.length > 0 && (
        <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#1e1e2e" }}>
            <div>
              <h2 className="font-semibold text-white">Tracked Software Holdings</h2>
              <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
                {holdings.length} companies shown · ${(totalFV / 1000).toFixed(2)}B fair value tracked
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                <tr>
                  {["Company", "Sector", "Loan Type", "Spread", "Maturity", "Fair Value", "Price/Face", "Status", "AI Risk"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {holdings.map(({ company, holder }, i) => {
                  const statusColor = holder.status === "Non-Accrual" ? "#ef4444" : holder.status === "PIK" ? "#f97316" : holder.status === "Restructured" ? "#eab308" : "#22c55e";
                  const priceColor = holder.priceToFaceValue >= 97 ? "#22c55e" : holder.priceToFaceValue >= 90 ? "#eab308" : "#ef4444";
                  return (
                    <tr key={company.slug} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                      <td className="px-4 py-3">
                        <Link href={`/companies/${company.slug}`} className="text-sm font-medium text-white hover:text-indigo-400">
                          {company.name}
                        </Link>
                        <div className="text-xs mt-0.5" style={{ color: "#6b6b88" }}>{company.sponsor}</div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{company.subsector}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{holder.loanType}</td>
                      <td className="px-4 py-3 text-sm text-white">S+{holder.spread}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>
                        {new Date(holder.maturity).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-white">
                        ${holder.fairValue.toFixed(0)}M
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: priceColor }}>
                        {holder.priceToFaceValue.toFixed(1)}¢
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium" style={{ color: statusColor }}>
                          {holder.status}
                          {holder.pikPercent && holder.status === "PIK" ? ` (${holder.pikPercent}%)` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <AlertBadge severity={company.aiRisk === "Critical" ? "Critical" : company.aiRisk === "High" ? "High" : company.aiRisk === "Medium" ? "Medium" : "Low"} label />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Non-Accruals */}
      {nonAccruals.length > 0 && (
        <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#7f1d1d" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "#7f1d1d", background: "#1a0505" }}>
            <h2 className="font-semibold" style={{ color: "#ef4444" }}>⚠ Non-Accrual Positions ({nonAccruals.length})</h2>
          </div>
          <div className="p-5 space-y-3">
            {nonAccruals.map(({ company, holder }) => (
              <div key={company.slug} className="flex items-center justify-between gap-4 p-3 rounded-lg" style={{ background: "#180505" }}>
                <div>
                  <Link href={`/companies/${company.slug}`} className="font-medium hover:text-red-300" style={{ color: "#ef4444" }}>
                    {company.name}
                  </Link>
                  <div className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>{holder.loanType} · S+{holder.spread} · due {new Date(holder.maturity).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold" style={{ color: "#ef4444" }}>{holder.priceToFaceValue.toFixed(1)}¢</div>
                  <div className="text-xs" style={{ color: "#8b8ba8" }}>${holder.fairValue}M FV / ${holder.principalAmount}M par</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investment Strategy Details */}
      <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-4">Investment Profile</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: "Manager", value: bdc.manager },
            { label: "Structure", value: `${bdc.type} BDC` },
            { label: "Focus", value: bdc.focus },
            { label: "Primary Loan Type", value: bdc.loanType },
            { label: "NAV Per Share", value: `$${bdc.navPerShare.toFixed(2)}` },
            ...(bdc.aum ? [{ label: "Manager AUM", value: `$${bdc.aum}B` }] : []),
            ...(bdc.founded ? [{ label: "Founded", value: String(bdc.founded) }] : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>{label}</div>
              <div style={{ color: "#d1d5db" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
