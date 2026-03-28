import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AlertBadge from "@/components/AlertBadge";
import StatCard from "@/components/StatCard";
import { portfolioCompanies } from "@/data/companies";
import { bdcs } from "@/data/bdcs";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return portfolioCompanies.map((c) => ({ slug: c.slug }));
}

export default async function CompanyDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const company = portfolioCompanies.find((c) => c.slug === slug);
  if (!company) notFound();

  const totalFV = company.holders.reduce((s, h) => s + h.fairValue, 0);
  const totalPrincipal = company.holders.reduce((s, h) => s + h.principalAmount, 0);
  const avgPrice = totalPrincipal > 0 ? (totalFV / totalPrincipal) * 100 : 0;
  const hasNonAccrual = company.holders.some((h) => h.status === "Non-Accrual");
  const hasPIK = company.holders.some((h) => h.status === "PIK");

  const priceColor = avgPrice >= 97 ? "#22c55e" : avgPrice >= 90 ? "#eab308" : "#ef4444";
  const statusLabel = hasNonAccrual ? "Non-Accrual" : hasPIK ? "PIK" : company.status;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/companies" className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors" style={{ color: "#8b8ba8" }}>
        <ArrowLeft size={14} /> Back to Portfolio Companies
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="text-xs px-2 py-0.5 rounded border" style={{ background: "rgba(99,102,241,0.08)", borderColor: "#2d2d50", color: "#a5b4fc" }}>
              {company.sector}
            </span>
            <span className="text-xs px-2 py-0.5 rounded border" style={{ background: "#1a1a28", borderColor: "#2d2d45", color: "#9ca3af" }}>
              {company.subsector}
            </span>
            {hasNonAccrual && <AlertBadge severity="Critical" label />}
            {hasPIK && !hasNonAccrual && <AlertBadge severity="High" label />}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{company.name}</h1>
          <p className="text-sm" style={{ color: "#9ca3af" }}>
            Sponsor: {company.sponsor}
            {company.country && ` · ${company.country}`}
            {company.founded && ` · Founded ${company.founded}`}
          </p>
        </div>
        <div className="flex gap-3">
          <div className="rounded-xl border p-4 text-center" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Avg Price</div>
            <div className="text-2xl font-bold" style={{ color: priceColor }}>{avgPrice.toFixed(1)}¢</div>
            <div className="text-xs mt-0.5" style={{ color: "#6b6b88" }}>on the dollar</div>
          </div>
          <div className="rounded-xl border p-4 text-center" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Status</div>
            <div className="text-sm font-bold" style={{ color: hasNonAccrual ? "#ef4444" : hasPIK ? "#f97316" : "#22c55e" }}>
              {statusLabel}
            </div>
            <div className="text-xs mt-0.5 flex justify-center">
              <AlertBadge severity={company.aiRisk === "Critical" ? "Critical" : company.aiRisk === "High" ? "High" : company.aiRisk === "Medium" ? "Medium" : "Low"} label />
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-xl border p-5 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "#d1d5db" }}>{company.description}</p>
        <div className="flex flex-wrap gap-2">
          {company.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded text-xs border" style={{ background: "rgba(99,102,241,0.08)", borderColor: "#2d2d50", color: "#a5b4fc" }}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Total Debt"
          value={`$${(company.totalDebt / 1000).toFixed(1)}B`}
          sub={`$${(company.seniorDebt / 1000).toFixed(1)}B senior`}
        />
        <StatCard
          label="ARR / Revenue"
          value={company.arr || company.revenue || "N/A"}
          sub={company.arrGrowth ? `${company.arrGrowth}% growth` : undefined}
          trend={company.arrGrowth ? (company.arrGrowth >= 10 ? "up" : company.arrGrowth >= 5 ? "neutral" : "down") : undefined}
        />
        <StatCard
          label="EBITDA"
          value={company.ebitda || "N/A"}
          sub={company.ebitdaMargin ? `${company.ebitdaMargin}% margin` : undefined}
        />
        <StatCard
          label="BDC Holders"
          value={String(company.holders.length)}
          sub={`$${(totalFV / 1000).toFixed(2)}B fair value`}
        />
      </div>

      {/* Loan Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Total Fair Value</div>
          <div className="text-xl font-bold text-white">${(totalFV / 1000).toFixed(2)}B</div>
          <div className="text-xs mt-0.5" style={{ color: "#6b6b88" }}>tracked in BDC portfolios</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Total Principal</div>
          <div className="text-xl font-bold text-white">${(totalPrincipal / 1000).toFixed(2)}B</div>
          <div className="text-xs mt-0.5" style={{ color: "#6b6b88" }}>outstanding principal</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Average Price to Face</div>
          <div className="text-xl font-bold" style={{ color: priceColor }}>{avgPrice.toFixed(2)}¢</div>
          <div className="text-xs mt-0.5" style={{ color: "#6b6b88" }}>
            {totalFV < totalPrincipal ? `$${((totalPrincipal - totalFV) / 1000).toFixed(2)}B haircut` : "at/above par"}
          </div>
        </div>
      </div>

      {/* AI Risk Assessment */}
      <div className="rounded-xl border p-5 mb-6" style={{
        background: company.aiRisk === "Critical" ? "#180505" : company.aiRisk === "High" ? "#1a0e05" : "#111118",
        borderColor: company.aiRisk === "Critical" ? "#7f1d1d" : company.aiRisk === "High" ? "#7c2d12" : "#1e1e2e"
      }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertBadge severity={company.aiRisk === "Critical" ? "Critical" : company.aiRisk === "High" ? "High" : company.aiRisk === "Medium" ? "Medium" : "Low"} label />
          <h2 className="font-semibold text-white">AI Disruption Risk Assessment</h2>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: "#d1d5db" }}>
          {company.aiRisk === "Critical" && "This company faces critical AI disruption risk. Its core product or service is highly susceptible to being replaced by AI-native alternatives. Lenders face meaningful credit risk from AI-driven revenue erosion."}
          {company.aiRisk === "High" && "This company faces high AI disruption risk. AI tools are emerging as direct competitors or are automating significant portions of the company's product functionality. Revenue growth is likely to be pressured."}
          {company.aiRisk === "Medium" && "This company faces moderate AI disruption risk. Some portions of its product may be automated or disrupted by AI, but the core platform has durable competitive advantages or switching costs."}
          {company.aiRisk === "Low" && "This company faces low AI disruption risk. Its business is in a regulated domain, provides infrastructure, or operates in a sector where AI substitution is not a near-term threat."}
        </p>
        {company.notes && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: "#2d2d45" }}>
            <div className="text-xs font-medium mb-1" style={{ color: "#8b8ba8" }}>Analyst Notes</div>
            <p className="text-sm" style={{ color: "#9ca3af" }}>{company.notes}</p>
          </div>
        )}
      </div>

      {/* BDC Holders Table */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">BDC Loan Holdings</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            {company.holders.length} BDC holders tracked · Total tracked FV: ${(totalFV / 1000).toFixed(2)}B
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["BDC", "Ticker", "Loan Type", "Spread (bps)", "Maturity", "Fair Value", "Principal", "Price/Face", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {company.holders.map((holder, i) => {
                const bdc = bdcs.find((b) => b.ticker === holder.bdc);
                const statusColor = holder.status === "Non-Accrual" ? "#ef4444" : holder.status === "PIK" ? "#f97316" : holder.status === "Restructured" ? "#eab308" : "#22c55e";
                const priceColor = holder.priceToFaceValue >= 97 ? "#22c55e" : holder.priceToFaceValue >= 90 ? "#eab308" : "#ef4444";
                return (
                  <tr key={holder.bdc} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-4 py-3">
                      <Link href={`/bdcs/${bdc?.slug ?? holder.bdc.toLowerCase()}`} className="text-sm font-medium text-white hover:text-indigo-400">
                        {holder.bdcName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>
                        {holder.bdc}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{holder.loanType}</td>
                    <td className="px-4 py-3 text-sm text-white">S+{holder.spread}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>
                      {new Date(holder.maturity).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-white">
                      ${holder.fairValue.toFixed(0)}M
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }}>
                      ${holder.principalAmount.toFixed(0)}M
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: priceColor }}>
                      {holder.priceToFaceValue.toFixed(1)}¢
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium" style={{ color: statusColor }}>
                        {holder.status}
                        {holder.pikPercent && holder.status === "PIK" ? ` (${holder.pikPercent}% PIK)` : ""}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Financial Profile */}
      <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-4">Financial Profile</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          {[
            { label: "Total Debt", value: `$${(company.totalDebt / 1000).toFixed(1)}B` },
            { label: "Senior Debt", value: `$${(company.seniorDebt / 1000).toFixed(1)}B` },
            { label: "Revenue", value: company.revenue || "N/A" },
            ...(company.arr ? [{ label: "ARR", value: company.arr }] : []),
            ...(company.ebitda ? [{ label: "EBITDA", value: company.ebitda }] : []),
            ...(company.ebitdaMargin ? [{ label: "EBITDA Margin", value: `${company.ebitdaMargin}%` }] : []),
            ...(company.arrGrowth ? [{ label: "ARR Growth", value: `${company.arrGrowth}%` }] : []),
            ...(company.ltvAtOrigination ? [{ label: "LTV at Origination", value: `${company.ltvAtOrigination}%` }] : []),
            { label: "Primary Sponsor", value: company.sponsor },
            { label: "Country", value: company.country },
            ...(company.founded ? [{ label: "Founded", value: String(company.founded) }] : []),
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
