import Link from "next/link";
import AlertBadge from "@/components/AlertBadge";
import { portfolioCompanies } from "@/data/companies";
import { recentAlerts } from "@/data/market";
import { bdcs } from "@/data/bdcs";

export default function NonAccrualsPage() {
  const nonAccrualCompanies = portfolioCompanies.filter(
    (c) => c.holders.some((h) => h.status === "Non-Accrual")
  );
  const pikCompanies = portfolioCompanies.filter(
    (c) => c.holders.some((h) => h.status === "PIK") && !c.holders.some((h) => h.status === "Non-Accrual")
  );
  const distressedCompanies = portfolioCompanies.filter(
    (c) => c.status === "Distressed" || c.creditRisk === "High" || c.creditRisk === "Distressed"
  );

  // BDCs with elevated non-accrual rates
  const highNaBDCs = bdcs
    .filter((b) => b.nonAccrualRate >= 2.0)
    .sort((a, b) => b.nonAccrualRate - a.nonAccrualRate);

  const totalNonAccrualFV = nonAccrualCompanies.reduce((sum, c) =>
    sum + c.holders.filter(h => h.status === "Non-Accrual").reduce((s, h) => s + h.fairValue, 0), 0
  );
  const totalNonAccrualPrincipal = nonAccrualCompanies.reduce((sum, c) =>
    sum + c.holders.filter(h => h.status === "Non-Accrual").reduce((s, h) => s + h.principalAmount, 0), 0
  );
  const impliedHaircut = totalNonAccrualPrincipal - totalNonAccrualFV;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <AlertBadge severity="Critical" label />
          <span className="text-xs" style={{ color: "#8b8ba8" }}>Updated Q3 2025</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Non-Accruals & Stressed Credits</h1>
        <p className="text-sm" style={{ color: "#8b8ba8" }}>
          Tracking software portfolio companies on non-accrual, PIK, or distressed status across BDC portfolios.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-xl border p-4" style={{ background: "#180505", borderColor: "#7f1d1d" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Non-Accrual Companies</div>
          <div className="text-2xl font-bold" style={{ color: "#ef4444" }}>{nonAccrualCompanies.length}</div>
          <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>in tracked portfolio</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#1a0e05", borderColor: "#7c2d12" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>PIK-Paying</div>
          <div className="text-2xl font-bold" style={{ color: "#f97316" }}>{pikCompanies.length}</div>
          <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>non-cash interest</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Non-Accrual FV</div>
          <div className="text-2xl font-bold text-white">${(totalNonAccrualFV / 1000).toFixed(1)}B</div>
          <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>${(totalNonAccrualPrincipal / 1000).toFixed(1)}B principal</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Implied Haircut</div>
          <div className="text-2xl font-bold" style={{ color: "#ef4444" }}>-${(impliedHaircut / 1000).toFixed(1)}B</div>
          <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>FV below par</div>
        </div>
      </div>

      {/* Non-Accrual Companies */}
      {nonAccrualCompanies.length > 0 && (
        <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#7f1d1d" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "#7f1d1d", background: "#1a0505" }}>
            <h2 className="font-semibold" style={{ color: "#ef4444" }}>Non-Accrual Companies ({nonAccrualCompanies.length})</h2>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              Loans on which BDCs have stopped accruing interest income
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                <tr>
                  {["Company", "Sector", "Sponsor", "BDC Holders (NA)", "Total FV", "Total Par", "Avg Price", "AI Risk"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nonAccrualCompanies.map((company, i) => {
                  const naHolders = company.holders.filter((h) => h.status === "Non-Accrual");
                  const fv = naHolders.reduce((s, h) => s + h.fairValue, 0);
                  const principal = naHolders.reduce((s, h) => s + h.principalAmount, 0);
                  const avgPx = principal > 0 ? (fv / principal) * 100 : 0;
                  return (
                    <tr key={company.slug} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                      <td className="px-4 py-3">
                        <Link href={`/companies/${company.slug}`} className="font-medium text-white hover:text-red-400">
                          {company.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{company.subsector}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{company.sponsor}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {naHolders.map((h) => (
                            <Link key={h.bdc} href={`/bdcs/${h.bdc.toLowerCase()}`}>
                              <span className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                                {h.bdc}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: "#ef4444" }}>${fv.toFixed(0)}M</td>
                      <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }}>${principal.toFixed(0)}M</td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: avgPx >= 80 ? "#eab308" : "#ef4444" }}>
                        {avgPx.toFixed(1)}¢
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
          {/* Detail rows */}
          <div className="border-t p-4" style={{ borderColor: "#7f1d1d", background: "#160404" }}>
            <div className="text-xs font-semibold mb-3" style={{ color: "#8b8ba8" }}>INDIVIDUAL LOAN BREAKDOWN</div>
            <div className="space-y-2">
              {nonAccrualCompanies.flatMap((company) =>
                company.holders
                  .filter((h) => h.status === "Non-Accrual")
                  .map((holder) => (
                    <div key={`${company.slug}-${holder.bdc}`} className="flex items-center justify-between gap-4 p-3 rounded-lg" style={{ background: "#1a0505" }}>
                      <div className="flex items-center gap-3">
                        <Link href={`/bdcs/${holder.bdc.toLowerCase()}`}>
                          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                            {holder.bdc}
                          </span>
                        </Link>
                        <div>
                          <Link href={`/companies/${company.slug}`} className="text-sm font-medium text-white hover:text-red-400">
                            {company.name}
                          </Link>
                          <div className="text-xs" style={{ color: "#8b8ba8" }}>
                            {holder.loanType} · S+{holder.spread} · Due {new Date(holder.maturity).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" style={{ color: "#ef4444" }}>{holder.priceToFaceValue.toFixed(1)}¢</div>
                        <div className="text-xs" style={{ color: "#8b8ba8" }}>
                          ${holder.fairValue}M FV / ${holder.principalAmount}M par
                          {" "}(${(holder.principalAmount - holder.fairValue).toFixed(0)}M haircut)
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PIK Companies */}
      {pikCompanies.length > 0 && (
        <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#7c2d12" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "#7c2d12", background: "#1a0e05" }}>
            <h2 className="font-semibold" style={{ color: "#f97316" }}>PIK-Paying Companies ({pikCompanies.length})</h2>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              Payment-in-kind: interest is added to principal balance rather than paid in cash. A leading indicator of credit stress.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
                <tr>
                  {["Company", "Sector", "Sponsor", "PIK Holders", "Avg PIK %", "Total FV", "Avg Price", "Earliest Maturity"].map((h) => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pikCompanies.map((company, i) => {
                  const pikHolders = company.holders.filter((h) => h.status === "PIK");
                  const avgPik = pikHolders.reduce((s, h) => s + (h.pikPercent ?? 0), 0) / pikHolders.length;
                  const fv = pikHolders.reduce((s, h) => s + h.fairValue, 0);
                  const avgPx = pikHolders.reduce((s, h) => s + h.priceToFaceValue, 0) / pikHolders.length;
                  const earliestMaturity = pikHolders.reduce((earliest, h) =>
                    !earliest || h.maturity < earliest ? h.maturity : earliest, "" as string
                  );
                  return (
                    <tr key={company.slug} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                      <td className="px-4 py-3">
                        <Link href={`/companies/${company.slug}`} className="font-medium text-white hover:text-orange-400">
                          {company.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{company.subsector}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{company.sponsor}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {pikHolders.map((h) => (
                            <Link key={h.bdc} href={`/bdcs/${h.bdc.toLowerCase()}`}>
                              <span className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: "rgba(249,115,22,0.12)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)" }}>
                                {h.bdc}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: "#f97316" }}>
                        {avgPik.toFixed(0)}%
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-white">${fv.toFixed(0)}M</td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: avgPx >= 90 ? "#eab308" : "#ef4444" }}>
                        {avgPx.toFixed(1)}¢
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>
                        {new Date(earliestMaturity).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BDCs with High Non-Accrual Rates */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">BDCs with Elevated Non-Accrual Rates (&ge;2%)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["BDC", "Ticker", "Type", "Non-Accrual Rate", "PIK Rate", "Software Exposure"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {highNaBDCs.map((bdc, i) => (
                <tr key={bdc.ticker} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                  <td className="px-4 py-3">
                    <Link href={`/bdcs/${bdc.slug}`} className="font-medium text-white hover:text-indigo-400">
                      {bdc.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>
                      {bdc.ticker}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{bdc.type}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold" style={{ color: bdc.nonAccrualRate >= 4 ? "#ef4444" : "#f97316" }}>
                      {bdc.nonAccrualRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold" style={{ color: bdc.pikRate >= 12 ? "#f97316" : "#eab308" }}>
                      {bdc.pikRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
                        <div className="h-full rounded-full" style={{ width: `${bdc.softwareExposure}%`, background: "#6366f1" }} />
                      </div>
                      <span className="text-sm text-white">{bdc.softwareExposure.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">All Market Alerts</h2>
        </div>
        <div className="divide-y" style={{ borderColor: "#1a1a28" }}>
          {recentAlerts.map((alert, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <AlertBadge severity={alert.severity} label />
                </div>
                <div>
                  <div className="text-sm font-medium text-white mb-1">{alert.title}</div>
                  <div className="text-sm leading-relaxed mb-2" style={{ color: "#9ca3af" }}>{alert.description}</div>
                  <div className="text-xs" style={{ color: "#6b6b88" }}>
                    {new Date(alert.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    {alert.bdc !== "Sector" && (
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
    </div>
  );
}
