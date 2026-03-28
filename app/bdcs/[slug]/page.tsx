import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Building2 } from "lucide-react";
import AlertBadge from "@/components/AlertBadge";
import StatCard from "@/components/StatCard";
import { bdcs } from "@/data/bdcs";
import { portfolioCompanies } from "@/data/companies";

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
