"use client";
import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import AlertBadge from "@/components/AlertBadge";
import { portfolioCompanies } from "@/data/companies";

type StatusFilter = "All" | "Active" | "Distressed" | "Non-Accrual" | "PIK";
type AIFilter = "All" | "Critical" | "High" | "Medium" | "Low";

export default function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [aiFilter, setAIFilter] = useState<AIFilter>("All");
  const [sortKey, setSortKey] = useState("totalDebt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = portfolioCompanies
    .filter((c) => {
      if (search) {
        const s = search.toLowerCase();
        if (!c.name.toLowerCase().includes(s) && !c.sponsor.toLowerCase().includes(s) && !c.subsector.toLowerCase().includes(s)) return false;
      }
      if (statusFilter === "Non-Accrual" && !c.holders.some((h) => h.status === "Non-Accrual")) return false;
      if (statusFilter === "PIK" && !c.holders.some((h) => h.status === "PIK")) return false;
      if (statusFilter === "Distressed" && c.status !== "Distressed" && !c.holders.some((h) => h.status === "Non-Accrual" || h.status === "PIK")) return false;
      if (statusFilter === "Active" && c.status !== "Active") return false;
      if (aiFilter !== "All" && c.aiRisk !== aiFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortKey];
      const bVal = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      return sortDir === "desc" ? String(bVal ?? "").localeCompare(String(aVal ?? "")) : String(aVal ?? "").localeCompare(String(bVal ?? ""));
    });

  const SortBtn = ({ k, label }: { k: string; label: string }) => (
    <button
      className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-white transition-colors whitespace-nowrap"
      style={{ color: sortKey === k ? "#a5b4fc" : "#8b8ba8" }}
      onClick={() => handleSort(k)}
    >
      {label} {sortKey === k ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white mb-2">Software Portfolio Companies</h1>
        <p className="text-sm" style={{ color: "#8b8ba8" }}>
          {portfolioCompanies.length} tracked companies · Held across {new Set(portfolioCompanies.flatMap(c => c.holders.map(h => h.bdc))).size} BDCs ·
          Total debt: ${(portfolioCompanies.reduce((s, c) => s + c.totalDebt, 0) / 1000).toFixed(1)}B
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search companies, sponsors, sectors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border outline-none"
            style={{ background: "#111118", borderColor: "#2d2d45", color: "#d1d5db" }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1">
            {(["All", "Active", "Distressed", "Non-Accrual", "PIK"] as StatusFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className="px-2.5 py-1.5 rounded text-xs font-medium border transition-all"
                style={{
                  background: statusFilter === f ? "rgba(99,102,241,0.15)" : "#111118",
                  borderColor: statusFilter === f ? "#6366f1" : "#2d2d45",
                  color: statusFilter === f ? "#a5b4fc" : "#9ca3af",
                }}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <span className="self-center text-xs" style={{ color: "#6b6b88" }}>AI:</span>
            {(["All", "Critical", "High", "Medium", "Low"] as AIFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setAIFilter(f)}
                className="px-2 py-1.5 rounded text-xs font-medium border transition-all"
                style={{
                  background: aiFilter === f ? "rgba(99,102,241,0.15)" : "#111118",
                  borderColor: aiFilter === f ? "#6366f1" : "#2d2d45",
                  color: aiFilter === f ? "#a5b4fc" : "#9ca3af",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e1e2e" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                <th className="px-4 py-3 text-left"><SortBtn k="name" label="Company" /></th>
                <th className="px-4 py-3 text-left"><SortBtn k="subsector" label="Sector" /></th>
                <th className="px-4 py-3 text-left"><SortBtn k="sponsor" label="Sponsor" /></th>
                <th className="px-4 py-3 text-right"><SortBtn k="totalDebt" label="Total Debt" /></th>
                <th className="px-4 py-3 text-right"><SortBtn k="arr" label="ARR / Rev" /></th>
                <th className="px-4 py-3 text-right" style={{ color: "#8b8ba8", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>BDC Holders</th>
                <th className="px-4 py-3 text-right" style={{ color: "#8b8ba8", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Avg Price</th>
                <th className="px-4 py-3 text-center" style={{ color: "#8b8ba8", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Status</th>
                <th className="px-4 py-3 text-center" style={{ color: "#8b8ba8", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>AI Risk</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((company, i) => {
                const avgPrice = company.holders.length > 0
                  ? company.holders.reduce((s, h) => s + h.priceToFaceValue, 0) / company.holders.length
                  : 0;
                const priceColor = avgPrice >= 97 ? "#22c55e" : avgPrice >= 90 ? "#eab308" : "#ef4444";
                const hasNonAccrual = company.holders.some((h) => h.status === "Non-Accrual");
                const hasPIK = company.holders.some((h) => h.status === "PIK");
                const statusLabel = hasNonAccrual ? "Non-Accrual" : hasPIK ? "PIK" : company.status;
                const statusColor = hasNonAccrual ? "#ef4444" : hasPIK ? "#f97316" : "#22c55e";

                return (
                  <tr
                    key={company.slug}
                    className="border-t"
                    style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/companies/${company.slug}`} className="font-medium text-white hover:text-indigo-400 transition-colors">
                        {company.name}
                      </Link>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {company.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-xs px-1.5 py-0 rounded" style={{ background: "#1a1a28", color: "#8b8ba8" }}>{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{company.subsector}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{company.sponsor}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-white">
                      ${(company.totalDebt / 1000).toFixed(1)}B
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: "#d1d5db" }}>
                      {company.arr || company.revenue || "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: "#9ca3af" }}>
                      {company.holders.length}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: priceColor }}>
                      {avgPrice > 0 ? `${avgPrice.toFixed(1)}¢` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-xs font-medium" style={{ color: statusColor }}>{statusLabel}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <AlertBadge severity={company.aiRisk === "Critical" ? "Critical" : company.aiRisk === "High" ? "High" : company.aiRisk === "Medium" ? "Medium" : "Low"} label />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm" style={{ color: "#8b8ba8" }}>No companies match your filters.</div>
        )}
      </div>

      <p className="text-xs mt-4" style={{ color: "#6b6b88" }}>
        Companies shown are those tracked in public BDC Schedule of Investments filings.
        This is a subset of total BDC software holdings. Total BDC software exposure is ~$152.6B across ~155 BDCs.
      </p>
    </div>
  );
}
