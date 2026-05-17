"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import AlertBadge from "@/components/AlertBadge";
import { enrichedBDCs, BDCEnriched } from "@/lib/enrichBDC";

type FilterType = "All" | "Traded" | "Non-Traded";

export default function BDCsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("All");
  const [sortKey, setSortKey] = useState<string>("softwareExposure");
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
        <h1 className="text-2xl font-bold text-white mb-2">Business Development Companies</h1>
        <p className="text-sm" style={{ color: "#8b8ba8" }}>
          {bdcs.length} BDCs tracked · {parsedCount} with FV / non-accrual / PIK overlaid from our SEC SOI parsers
          {latestParsed && ` · latest as of ${latestParsed}`}
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
            {(filtered.reduce((s, b) => s + b.softwareExposure, 0) / (filtered.length || 1)).toFixed(1)}%
          </div>
          <div className="text-xs" style={{ color: "#8b8ba8" }}>Avg software exp.</div>
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
                <th className="px-4 py-3 text-left"><SortBtn k="ticker" label="Ticker" /></th>
                <th className="px-4 py-3 text-left"><SortBtn k="name" label="BDC Name" /></th>
                <th className="px-4 py-3 text-left"><SortBtn k="manager" label="Manager" /></th>
                <th className="px-4 py-3 text-left"><SortBtn k="type" label="Type" /></th>
                <th className="px-4 py-3 text-right"><SortBtn k="portfolioFairValue" label="FV ($B)" /></th>
                <th className="px-4 py-3 text-right"><SortBtn k="softwareExposure" label="Sw. Exp %" /></th>
                <th className="px-4 py-3 text-right"><SortBtn k="nonAccrualRate" label="Non-Accrual" /></th>
                <th className="px-4 py-3 text-right"><SortBtn k="pikRate" label="PIK Rate" /></th>
                <th className="px-4 py-3 text-right"><SortBtn k="portfolioCompanies" label="Companies" /></th>
                <th className="px-4 py-3 text-right" style={{ color: "#8b8ba8", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>As of</th>
                <th className="px-4 py-3 text-center" style={{ color: "#8b8ba8", fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>Risk</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((bdc, i) => {
                const risk = bdc.softwareExposure >= 50 ? "Critical" : bdc.softwareExposure >= 25 ? "High" : bdc.softwareExposure >= 15 ? "Medium" : "Low";
                const naColor = bdc.nonAccrualRate >= 4 ? "#ef4444" : bdc.nonAccrualRate >= 2 ? "#f97316" : bdc.nonAccrualRate >= 1 ? "#eab308" : "#22c55e";
                const pikColor = bdc.pikRate >= 12 ? "#ef4444" : bdc.pikRate >= 9 ? "#f97316" : bdc.pikRate >= 6 ? "#eab308" : "#22c55e";
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
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-14 h-1.5 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
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
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-sm font-semibold" style={{ color: naColor }}>
                          {bdc.nonAccrualRate.toFixed(2)}%
                        </span>
                        <DeltaChip delta={bdc.delta_na_pct} fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}pp`} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-sm font-semibold" style={{ color: pikColor }}>
                          {bdc.pikRate.toFixed(2)}%
                        </span>
                        <DeltaChip delta={bdc.delta_pik_pct} fmt={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}pp`} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: "#9ca3af" }}>
                      {bdc.portfolioCompanies.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: bdc.asOf ? "#a5b4fc" : "#6b6b88" }}>
                      {bdc.asOf ?? <span style={{ color: "#6b6b88" }}>static</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <AlertBadge severity={risk as "Critical" | "High" | "Medium" | "Low"} label />
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
        Non-traded BDC data sourced from quarterly reports. Traded BDC data as of latest 10-Q.
      </p>
    </div>
  );
}
