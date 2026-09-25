"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import AlertBadge from "@/components/AlertBadge";
import { bdcsHistory } from "@/data/bdcs_history";
import { enrichedBDCs, BDCEnriched, naPublicationDisplay } from "@/lib/enrichBDC";
import {
  CATALOG_AS_OF_LABEL, enrichedPikPublication, formatPikPublication, pikPublicationLabel,
} from "@/lib/pikPublication";

type FilterType = "All" | "Traded" | "Non-Traded";

const DeltaChip = ({
  delta,
  fmt,
  invert = false,
}: {
  delta: number | null | undefined;
  fmt: (v: number) => string;
  invert?: boolean;   // for $FV growth where + is good
}) => {
  if (delta == null || !isFinite(delta)) return null;
  const eps = 1e-4;
  const isUp = delta > eps;
  const isDown = delta < -eps;
  const good = invert ? isUp : isDown;
  const bad = invert ? isDown : isUp;
  const color = good ? "#22c55e" : bad ? "#ef4444" : "#6b6b88";
  const bg = good ? "rgba(34,197,94,0.10)" : bad ? "rgba(239,68,68,0.10)" : "rgba(107,107,136,0.10)";
  return (
    <span
      title="QoQ change vs prior quarter"
      className="px-1 py-0.5 rounded text-xs font-mono"
      style={{ color, background: bg, border: `1px solid ${color}33` }}
    >
      {fmt(delta)}
    </span>
  );
};

const SortBtn = ({ k, label, sortKey, sortDir, onSort }: {
  k: string;
  label: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
}) => (
  <button
    className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-white transition-colors whitespace-nowrap"
    style={{ color: sortKey === k ? "#a5b4fc" : "#8b8ba8" }}
    onClick={() => onSort(k)}
  >
    {label} {sortKey === k ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
  </button>
);

export default function BDCsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("All");
  const [sortKey, setSortKey] = useState<string>("portfolioFairValue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const bdcs: BDCEnriched[] = useMemo(() => enrichedBDCs(), []);
  const parsedCount = bdcs.filter((b) => b.parsed).length;
  const latestParsed = bdcs
    .filter((b) => b.asOf)
    .map((b) => b.asOf as string)
    .sort()
    .at(-1);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const filtered = bdcs
    .filter((b) => {
      if (typeFilter !== "All" && b.type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return b.name.toLowerCase().includes(s) || b.ticker.toLowerCase().includes(s) || b.manager.toLowerCase().includes(s);
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortKey];
      const bVal = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof aVal === "number" && typeof bVal === "number") return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      return sortDir === "desc" ? String(bVal ?? "").localeCompare(String(aVal ?? "")) : String(aVal ?? "").localeCompare(String(bVal ?? ""));
    });


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white mb-2">Business Development Companies</h1>
        <p className="text-sm" style={{ color: "#8b8ba8" }}>
          {bdcs.length} BDCs tracked · {parsedCount} with fair value, non-accrual and PIK read from their own SEC filings
          {latestParsed && ` (latest ${latestParsed})`}
          {bdcs.length > parsedCount && ` · the other ${bdcs.length - parsedCount} show catalog estimates as of ${CATALOG_AS_OF_LABEL}`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search BDC name, ticker, manager..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border outline-none"
            style={{ background: "#111118", borderColor: "#2d2d45", color: "#d1d5db" }}
          />
        </div>
        <div className="flex gap-2">
          {(["All", "Traded", "Non-Traded"] as FilterType[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className="px-3 py-2 rounded-lg text-sm font-medium border transition-all"
              style={{
                background: typeFilter === t ? "rgba(99,102,241,0.15)" : "#111118",
                borderColor: typeFilter === t ? "#6366f1" : "#2d2d45",
                color: typeFilter === t ? "#a5b4fc" : "#9ca3af",
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-lg p-3 border text-center" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-lg font-bold text-white">{filtered.length}</div>
          <div className="text-xs" style={{ color: "#8b8ba8" }}>BDCs shown</div>
        </div>
        <div className="rounded-lg p-3 border text-center" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-lg font-bold text-white">
            {(() => {
              const tickers = new Set(filtered.map((b) => b.ticker));
              const rows = bdcsHistory.filter((r) => r.period_end === latestParsed &&
                tickers.has(r.ticker) && r.na_pct_at_cost != null && r.na_eligible_cost_b > 0);
              const cost = rows.reduce((sum, r) => sum + r.na_eligible_cost_b, 0);
              const weighted = rows.reduce((sum, r) => sum + r.na_eligible_cost_b * r.na_pct_at_cost!, 0);
              return cost > 0 ? `${(weighted / cost).toFixed(2)}%` : "Unknown";
            })()}
          </div>
          <div className="text-xs" style={{ color: "#8b8ba8" }}>Cost-weighted non-accrual · parsed BDCs on a common basis</div>
        </div>
        <div className="rounded-lg p-3 border text-center" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-lg font-bold text-white">
            ${filtered.reduce((s, b) => s + b.portfolioFairValue, 0).toFixed(1)}B
          </div>
          <div className="text-xs" style={{ color: "#8b8ba8" }}>Total fair value</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#1e1e2e" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                <th className="px-4 py-3 text-left"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={handleSort} k="ticker" label="Ticker" /></th>
                <th className="px-4 py-3 text-left"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={handleSort} k="name" label="BDC Name" /></th>
                <th className="px-4 py-3 text-left"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={handleSort} k="manager" label="Manager" /></th>
                <th className="px-4 py-3 text-left"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={handleSort} k="type" label="Type" /></th>
                <th className="px-4 py-3 text-right"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={handleSort} k="portfolioFairValue" label="FV ($B)" /></th>
                <th className="px-4 py-3 text-right"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={handleSort} k="nonAccrualRate" label="Non-Accrual" /></th>
                <th className="px-4 py-3 text-right"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={handleSort} k="pikRate" label="PIK range" /></th>
                <th className="px-4 py-3 text-right"><SortBtn sortKey={sortKey} sortDir={sortDir} onSort={handleSort} k="portfolioCompanies" label="Companies" /></th>
                <th className="px-4 py-3 text-right" style={{ color: "#8b8ba8", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>As of</th>
                <th className="px-4 py-3 text-center" style={{ color: "#8b8ba8", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bdc, i) => {
                const risk = bdc.nonAccrualRate == null ? "Unknown" : bdc.nonAccrualRate >= 4 ? "Critical" : bdc.nonAccrualRate >= 2 ? "High" : bdc.nonAccrualRate >= 1 ? "Medium" : "Low";
                const naColor = bdc.nonAccrualRate == null ? "#8b8ba8" : bdc.nonAccrualRate >= 4 ? "#ef4444" : bdc.nonAccrualRate >= 2 ? "#f97316" : bdc.nonAccrualRate >= 1 ? "#eab308" : "#22c55e";
                const pik = enrichedPikPublication(bdc);
                const pikRisk = pik.upper ?? pik.lower;
                const pikColor = pikRisk == null ? "#8b8ba8" : pikRisk >= 12 ? "#ef4444" : pikRisk >= 9 ? "#f97316" : pikRisk >= 6 ? "#eab308" : "#22c55e";
                return (
                  <tr
                    key={bdc.ticker}
                    className="border-t"
                    style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}
                  >
                    <td className="px-4 py-3">
                      <Link href={`/bdcs/${bdc.slug}`}>
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold hover:opacity-80 cursor-pointer" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>
                          {bdc.ticker}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/bdcs/${bdc.slug}`} className="text-sm font-medium hover:text-indigo-400 transition-colors text-white">
                        {bdc.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#9ca3af" }}>{bdc.manager}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded border" style={{
                        color: bdc.type === "Non-Traded" ? "#eab308" : "#22c55e",
                        background: bdc.type === "Non-Traded" ? "rgba(234,179,8,0.1)" : "rgba(34,197,94,0.1)",
                        borderColor: bdc.type === "Non-Traded" ? "rgba(234,179,8,0.2)" : "rgba(34,197,94,0.2)",
                      }}>
                        {bdc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-white font-medium">
                      <div className="flex items-center justify-end gap-1.5">
                        <span>${bdc.portfolioFairValue.toFixed(2)}B</span>
                        <DeltaChip delta={bdc.delta_fv_b} fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}B`} invert />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-sm font-semibold" style={{ color: naColor }}>
                          {bdc.nonAccrualRate == null ? "Unknown" : `${bdc.nonAccrualRate.toFixed(2)}%`}
                        </span>
                        <DeltaChip delta={bdc.delta_na_pct} fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}pp`} />
                      </div>
                      <span className="block text-[10px] mt-1" style={{ color: "#8b8ba8" }}
                        title={naPublicationDisplay(bdc).description}
                        data-na-publication-status={bdc.na_publication_status ?? "unspecified"}>
                        {naPublicationDisplay(bdc).label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-sm font-semibold" style={{ color: pikColor }}>
                          {formatPikPublication(pik)}
                        </span>
                        <DeltaChip delta={bdc.delta_pik_pct} fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}pp`} />
                      </div>
                      <span className="block text-[10px] mt-1" style={{ color: "#8b8ba8" }}
                        title={pik.reason} data-pik-publication-status={pik.status}>
                        {pikPublicationLabel(pik)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: "#9ca3af" }}>
                      {bdc.portfolioCompanies.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: bdc.asOf ? "#a5b4fc" : "#6b6b88" }}>
                      {bdc.asOf ?? <span style={{ color: "#6b6b88" }} title="Hand-compiled catalog figures, not parsed from filings">
                        catalog · {CATALOG_AS_OF_LABEL}
                      </span>}
                    </td>
                    <td className="px-4 py-3 text-center"
                      title={bdc.catalogEstimate ? "Based on the catalog estimate of non-accruals" : undefined}>
                      <AlertBadge severity={risk} label />
                      {bdc.catalogEstimate && risk !== "Unknown" && (
                        <span className="block text-[10px] mt-1" style={{ color: "#6b6b88" }}>estimate</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs mt-4" style={{ color: "#6b6b88" }}>
        Data sourced from SEC Schedule of Investments filings and public BDC disclosures. Software exposure estimates based on BDC-reported industry classifications.
        Rows dated &ldquo;catalog&rdquo; are hand-compiled figures ({CATALOG_AS_OF_LABEL}), not read from each filing — treat their
        fair value, non-accrual, PIK and risk badge as approximate.
      </p>
    </div>
  );
}
