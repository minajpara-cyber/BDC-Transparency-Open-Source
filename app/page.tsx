import Link from "next/link";
import { ArrowRight, AlertTriangle, TrendingDown, DollarSign, BarChart3, Shield, Activity } from "lucide-react";
import StatCard from "@/components/StatCard";
import AlertBadge from "@/components/AlertBadge";
import { marketStats } from "@/data/bdcs";
import { recentAlerts, bdcSectorExposure, topBDCSoftwareExposure } from "@/data/market";
import { portfolioCompanies } from "@/data/companies";

export default function HomePage() {
  const nonAccrualCompanies = portfolioCompanies.filter(
    (c) => c.holders.some((h) => h.status === "Non-Accrual")
  );
  const pikCompanies = portfolioCompanies.filter(
    (c) => c.holders.some((h) => h.status === "PIK")
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
            Live Tracking
          </span>
          <span className="text-xs" style={{ color: "#8b8ba8" }}>Data as of Q3 2025 · {marketStats.totalBDCCount} BDCs tracked</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight">
          BDC Software Private Credit<br />
          <span style={{ color: "#6366f1" }}>Transparency Tracker</span>
        </h1>
        <p className="text-base sm:text-lg max-w-2xl" style={{ color: "#9ca3af" }}>
          Aggregating public data on software company exposure across all Business Development Companies.
          Track valuations, non-accruals, PIK loans, and AI disruption risk across ${marketStats.totalPortfolioFairValue}B of software private credit.
        </p>
        <div className="flex gap-3 mt-5">
          <Link
            href="/bdcs"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{ background: "#6366f1", color: "white" }}
          >
            Explore BDCs <ArrowRight size={14} />
          </Link>
          <Link
            href="/companies"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border"
            style={{ borderColor: "#2d2d50", color: "#a5b4fc", background: "rgba(99,102,241,0.08)" }}
          >
            Portfolio Companies
          </Link>
        </div>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total BDC AUM"
          value="$450B"
          sub="155 BDCs tracked"
          trend="up"
          trendLabel="4x since 2020"
          icon={<DollarSign size={16} />}
          highlight
        />
        <StatCard
          label="Software Exposure"
          value="29.0%"
          sub="of total BDC portfolios"
          trend="up"
          trendLabel="+7pp since 2022"
          icon={<BarChart3 size={16} />}
          color="#6366f1"
        />
        <StatCard
          label="Avg Price to Par"
          value="97.8¢"
          sub="software loan average"
          trend="neutral"
          icon={<Activity size={16} />}
          color="#22c55e"
        />
        <StatCard
          label="PIK Rate"
          value="12.8%"
          sub="of software loans"
          trend="down"
          trendLabel="from 13.5% peak"
          icon={<TrendingDown size={16} />}
          color="#eab308"
        />
      </div>

      {/* Second row stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Non-Accrual Rate"
          value="1.8%"
          sub="weighted avg BDC"
          trend="down"
          trendLabel="from 2.3% peak"
          color="#ef4444"
        />
        <StatCard
          label="Software Loans Tracked"
          value="$152.6B"
          sub="principal outstanding"
          trend="up"
          trendLabel="29% of BDC total"
          color="#8b5cf6"
        />
        <StatCard
          label="AI High-Risk Companies"
          value={String(portfolioCompanies.filter(c => c.aiRisk === "High" || c.aiRisk === "Critical").length)}
          sub="in tracked portfolio"
          trend="up"
          trendLabel="growing threat"
          icon={<AlertTriangle size={16} />}
          color="#f97316"
        />
        <StatCard
          label="Maturities Before 2028"
          value="10%"
          sub="of software loans"
          trend="neutral"
          trendLabel="near-term refi"
          color="#14b8a6"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent Alerts */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
            <h2 className="font-semibold text-white">Market Alerts</h2>
            <Link href="/non-accruals" className="text-xs hover:text-white transition-colors" style={{ color: "#6366f1" }}>
              View all →
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#1a1a28" }}>
            {recentAlerts.slice(0, 5).map((alert, i) => (
              <div key={i} className="px-5 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <AlertBadge severity={alert.severity} label />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white leading-snug mb-1">{alert.title}</div>
                    <div className="text-xs leading-relaxed" style={{ color: "#8b8ba8" }}>{alert.description}</div>
                    <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>
                      {new Date(alert.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {alert.bdc !== "Sector" && alert.bdc !== "Multiple" && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc" }}>
                          {alert.bdc}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sector Exposure Breakdown */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
            <h2 className="font-semibold text-white">BDC Sector Exposure</h2>
            <span className="text-xs" style={{ color: "#8b8ba8" }}>Weighted average</span>
          </div>
          <div className="p-5 space-y-3">
            {bdcSectorExposure.map((sector) => (
              <div key={sector.sector}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm" style={{ color: "#d1d5db" }}>{sector.sector}</span>
                  <span className="text-sm font-medium" style={{ color: sector.sector.includes("Software") ? "#a5b4fc" : "#9ca3af" }}>
                    {sector.percent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${sector.percent}%`, background: sector.color, transition: "width 0.5s ease" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Software Exposed BDCs */}
      <div className="rounded-xl border overflow-hidden mb-8" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <div>
            <h2 className="font-semibold text-white">Highest Software Exposure BDCs</h2>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>Ranked by % portfolio in software companies</p>
          </div>
          <Link href="/bdcs" className="text-xs hover:text-white transition-colors" style={{ color: "#6366f1" }}>
            Full BDC list →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #1a1a28" }}>
                {["Rank", "BDC", "Ticker", "Type", "Software Exposure", "Risk Level"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left" style={{ color: "#8b8ba8" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topBDCSoftwareExposure.map((bdc, i) => {
                const risk = bdc.softwareExposure >= 50 ? "Critical" : bdc.softwareExposure >= 25 ? "High" : bdc.softwareExposure >= 15 ? "Medium" : "Low";
                return (
                  <tr
                    key={bdc.ticker}
                    className="border-t"
                    style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}
                  >
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: "#6b6b88" }}>#{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link href={`/bdcs/${bdc.ticker.toLowerCase()}`} className="text-sm font-medium hover:text-indigo-400 transition-colors text-white">
                        {bdc.bdc}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>
                        {bdc.ticker}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: bdc.type === "Non-Traded" ? "#eab308" : "#22c55e" }}>
                      {bdc.type}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(bdc.softwareExposure, 100)}%`,
                              background: bdc.softwareExposure >= 50 ? "#ef4444" : bdc.softwareExposure >= 25 ? "#f97316" : "#6366f1",
                            }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-white">{bdc.softwareExposure.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AlertBadge severity={risk as "Critical" | "High" | "Medium" | "Low"} label />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Non-Accruals & PIK Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Non-Accruals */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-red-400" />
              <h2 className="font-semibold text-white">Non-Accrual Companies</h2>
            </div>
            <Link href="/non-accruals" className="text-xs hover:text-white" style={{ color: "#6366f1" }}>
              Full list →
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "#1a1a28" }}>
            {nonAccrualCompanies.map((company) => {
              const naHolders = company.holders.filter((h) => h.status === "Non-Accrual");
              const totalNaFV = naHolders.reduce((sum, h) => sum + h.fairValue, 0);
              const totalPrincipal = naHolders.reduce((sum, h) => sum + h.principalAmount, 0);
              const avgPrice = totalPrincipal > 0 ? (totalNaFV / totalPrincipal) * 100 : 0;
              return (
                <div key={company.slug} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <Link href={`/companies/${company.slug}`} className="text-sm font-medium text-white hover:text-indigo-400">
                      {company.name}
                    </Link>
                    <div className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
                      {naHolders.length} BDC holder{naHolders.length > 1 ? "s" : ""} · {company.subsector}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold" style={{ color: "#ef4444" }}>
                      {avgPrice.toFixed(1)}¢
                    </div>
                    <div className="text-xs" style={{ color: "#8b8ba8" }}>
                      ${(totalNaFV / 1000).toFixed(1)}B FV
                    </div>
                  </div>
                </div>
              );
            })}
            {nonAccrualCompanies.length === 0 && (
              <div className="px-5 py-6 text-sm text-center" style={{ color: "#8b8ba8" }}>No non-accruals in tracked portfolio</div>
            )}
          </div>
        </div>

        {/* PIK Companies */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-orange-400" />
              <h2 className="font-semibold text-white">PIK-Paying Companies</h2>
            </div>
            <span className="text-xs" style={{ color: "#8b8ba8" }}>Payment-in-Kind</span>
          </div>
          <div className="divide-y" style={{ borderColor: "#1a1a28" }}>
            {pikCompanies.map((company) => {
              const pikHolders = company.holders.filter((h) => h.status === "PIK");
              const avgPik = pikHolders.reduce((sum, h) => sum + (h.pikPercent ?? 0), 0) / pikHolders.length;
              const avgPrice = pikHolders.reduce((sum, h) => sum + h.priceToFaceValue, 0) / pikHolders.length;
              return (
                <div key={company.slug} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <Link href={`/companies/${company.slug}`} className="text-sm font-medium text-white hover:text-indigo-400">
                      {company.name}
                    </Link>
                    <div className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
                      {avgPik.toFixed(0)}% PIK · {pikHolders.length} BDC holder{pikHolders.length > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold" style={{ color: "#eab308" }}>
                      {avgPrice.toFixed(1)}¢
                    </div>
                    <div className="text-xs" style={{ color: "#8b8ba8" }}>avg price</div>
                  </div>
                </div>
              );
            })}
            {pikCompanies.length === 0 && (
              <div className="px-5 py-6 text-sm text-center" style={{ color: "#8b8ba8" }}>No PIK companies in tracked portfolio</div>
            )}
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg px-5 py-4 text-xs border" style={{ background: "#0f0f16", borderColor: "#1e1e2e", color: "#6b6b88" }}>
        <strong className="text-white">Disclaimer:</strong> Data sourced from public SEC filings, BDC quarterly reports, Schedule of Investments disclosures, and published industry research.
        This site is for informational purposes only and does not constitute investment advice. All valuations, exposure estimates, and credit assessments are based on publicly available information and may not reflect current conditions.
        Data is as of Q3 2025 unless otherwise noted.
      </div>
    </div>
  );
}
