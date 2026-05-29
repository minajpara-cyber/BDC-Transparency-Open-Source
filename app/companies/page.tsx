"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { borrowers } from "@/data/borrowers_index";
import { borrowerEnrichment } from "@/data/borrower_enrichment";
import { portfolioCompanies } from "@/data/companies";

const fmtUSD = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${(v / 1e3).toFixed(0)}K`;
};

interface WatchRow {
  slug: string;
  name: string;
  sector: string;
  sub_sector: string;
  n_holders: number;
  total_fv: number;
}

export default function CompaniesPage() {
  const watchlist = useMemo<WatchRow[]>(() => {
    return borrowers
      .filter((b) => borrowerEnrichment[b.slug])
      .map((b) => ({
        slug: b.slug,
        name: b.name,
        sector: borrowerEnrichment[b.slug].sector,
        sub_sector: borrowerEnrichment[b.slug].sub_sector,
        n_holders: b.n_holders,
        total_fv: b.total_fv,
      }))
      .sort((a, b) => b.total_fv - a.total_fv);
  }, []);

  const sectorCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of watchlist) m.set(r.sector, (m.get(r.sector) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [watchlist]);

  const [sector, setSector] = useState<string>("All");
  const rows = sector === "All" ? watchlist : watchlist.filter((r) => r.sector === sector);
  const totalFV = rows.reduce((s, r) => s + r.total_fv, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors" style={{ color: "#8b8ba8" }}>
        <ArrowLeft size={14} /> Back to home
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="px-2.5 py-1 rounded text-sm font-bold" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}>
            Watchlist
          </span>
          <span className="text-xs px-2 py-1 rounded border" style={{ color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)" }}>
            Curated profiles from parsed SOI
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Borrower watchlist by sector</h1>
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          The {watchlist.length} largest holdings we&apos;ve given a curated sector profile, filterable by sector.
          Each links to its borrower page for the full per-BDC mark history and credit flags.
        </p>
      </div>

      {/* Featured in-depth profiles (the legacy curated software deep-dives) */}
      <div className="rounded-xl border p-4 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="text-xs mb-2 uppercase tracking-wider" style={{ color: "#8b8ba8" }}>In-depth software profiles</div>
        <div className="flex flex-wrap gap-2">
          {portfolioCompanies.map((c) => (
            <Link key={c.slug} href={`/companies/${c.slug}`} className="px-2.5 py-1 rounded-md text-xs border transition-all hover:border-indigo-500"
              style={{ background: "#0f0f16", borderColor: "#2d2d45", color: "#d1d5db" }}>
              {c.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Profiled borrowers</div>
          <div className="text-2xl font-bold text-white">{watchlist.length}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Sectors</div>
          <div className="text-2xl font-bold" style={{ color: "#a5b4fc" }}>{sectorCounts.length}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>{sector === "All" ? "Aggregate FV" : `${sector} FV`}</div>
          <div className="text-2xl font-bold text-white">{fmtUSD(totalFV)}</div>
        </div>
      </div>

      {/* Sector filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setSector("All")} className="px-3 py-1.5 rounded-md text-xs font-semibold border transition-all"
          style={{ background: sector === "All" ? "rgba(99,102,241,0.15)" : "#111118", borderColor: sector === "All" ? "#6366f1" : "#2d2d45", color: sector === "All" ? "#a5b4fc" : "#9ca3af" }}>
          All ({watchlist.length})
        </button>
        {sectorCounts.map(([s, n]) => (
          <button key={s} onClick={() => setSector(s)} className="px-3 py-1.5 rounded-md text-xs font-semibold border transition-all"
            style={{ background: sector === s ? "rgba(99,102,241,0.15)" : "#111118", borderColor: sector === s ? "#6366f1" : "#2d2d45", color: sector === s ? "#a5b4fc" : "#9ca3af" }}>
            {s} ({n})
          </button>
        ))}
      </div>

      {/* Watchlist table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Borrower", "Sector / Sub-sector", "Holders", "Aggregate FV"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.slug} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                  <td className="px-4 py-3">
                    <Link href={`/borrowers/${r.slug}`} className="text-sm font-medium text-white hover:text-indigo-400">{r.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span style={{ color: "#a5b4fc" }}>{r.sector}</span>
                    <span style={{ color: "#6b6b88" }}> · {r.sub_sector}</span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono" style={{ color: r.n_holders >= 3 ? "#ef4444" : r.n_holders === 2 ? "#a5b4fc" : "#6b6b88" }}>{r.n_holders}</td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{fmtUSD(r.total_fv)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-6 text-sm text-center" style={{ color: "#8b8ba8" }}>No borrowers in this sector.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs mt-6" style={{ color: "#6b6b88" }}>
        Profiles are model-curated (sector, sub-sector, business description) for the largest holdings — no
        revenue / EBITDA figures are generated. The full borrower universe ({borrowers.length.toLocaleString()} names)
        is on the <Link href="/borrowers" className="text-indigo-400 hover:underline">borrowers index</Link>.
      </p>
    </div>
  );
}
