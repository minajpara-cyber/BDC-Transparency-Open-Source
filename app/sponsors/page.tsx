"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { sponsors, SponsorIndex } from "@/data/sponsors_index";
import { borrowers } from "@/data/borrowers_index";

const fmtUSD = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

type SortDir = "asc" | "desc";
type SortKey = keyof SponsorIndex;

// Higher values are WORSE for credit metrics; flip the color scale on these.
const NEGATIVE_KEYS = new Set<SortKey>([
  "pct_below_95",
  "pct_below_90",
  "pct_non_accrual",
  "pct_pik_now",
  "pct_modified",
]);

// Sponsors with fewer than this many attributed borrowers get a muted /
// asterisked presentation. Their headline metrics often reflect a single
// concentrated holding rather than a franchise-wide pattern, so users should
// not over-interpret them.
const THIN_COVERAGE = 5;

function pctColor(value: number, key: SortKey, thin: boolean): string {
  if (thin) return "#6b6b88";
  if (!NEGATIVE_KEYS.has(key)) return "#d1d5db";
  if (value >= 25) return "#f87171";
  if (value >= 10) return "#fbbf24";
  if (value >= 3)  return "#fde68a";
  return "#9ca3af";
}

export default function SponsorsIndexPage() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_fv");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      // Non-numeric column defaults to ascending; numeric defaults to descending
      setSortDir(k === "sponsor" ? "asc" : "desc");
    }
  };

  const rows = useMemo(() => {
    const filtered = search
      ? sponsors.filter((s) => s.sponsor.toLowerCase().includes(search.toLowerCase()))
      : sponsors;
    const out = [...filtered].sort((a, b) => {
      const av = a[sortKey] as unknown;
      const bv = b[sortKey] as unknown;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "desc" ? bv - av : av - bv;
      }
      return sortDir === "desc"
        ? String(bv ?? "").localeCompare(String(av ?? ""))
        : String(av ?? "").localeCompare(String(bv ?? ""));
    });
    return out;
  }, [search, sortKey, sortDir]);

  const totalFV = rows.reduce((s, r) => s + r.total_fv, 0);
  const totalCompanies = rows.reduce((s, r) => s + r.n_companies, 0);
  const indexedWithSponsor = borrowers.filter((b) => b.sponsors).length;

  const SortBtn = ({
    k,
    label,
    align = "left",
  }: {
    k: SortKey;
    label: string;
    align?: "left" | "right";
  }) => (
    <button
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-white transition-colors whitespace-nowrap ${
        align === "right" ? "ml-auto" : ""
      }`}
      style={{ color: sortKey === k ? "#a5b4fc" : "#8b8ba8" }}
      onClick={() => handleSort(k)}
    >
      {label} {sortKey === k ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: "#8b8ba8" }}
      >
        <ArrowLeft size={14} /> Back to home
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span
            className="px-2.5 py-1 rounded text-sm font-bold"
            style={{
              background: "rgba(168,85,247,0.12)",
              color: "#d8b4fe",
              border: "1px solid rgba(168,85,247,0.3)",
            }}
          >
            Sponsors
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">PE sponsor exposure</h1>
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          Borrowers in our index attributed to each private-equity sponsor, with a
          credit lens layered on top. Sponsor mapping comes from bdctransparency.io&apos;s
          curated company list; we intersect with our SOI parsing across all 14 covered
          BDCs to pull per-sponsor exposure and credit metrics.
        </p>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Sponsors with exposure</div>
          <div className="text-2xl font-bold text-white">{sponsors.length}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Sponsor-attributed companies</div>
          <div className="text-2xl font-bold text-white">{indexedWithSponsor}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Aggregate FV</div>
          <div className="text-2xl font-bold text-white">{fmtUSD(totalFV)}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Sponsor-positions sum</div>
          <div className="text-2xl font-bold text-white">{totalCompanies}</div>
          <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>incl. co-sponsorships</div>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Filter sponsor name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm border outline-none"
            style={{ background: "#111118", borderColor: "#2d2d45", color: "#d1d5db" }}
          />
        </div>
        <div className="text-xs self-center" style={{ color: "#6b6b88" }}>
          {rows.length} of {sponsors.length} sponsors · position-count weighted
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: "#111118", borderColor: "#1e1e2e" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Sponsors by exposure &amp; credit lens</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            Click any column header to sort. Credit metrics are debt-only and weighted
            by position count across the latest snapshot per (BDC, borrower, loan).
            Higher = more stress on the credit columns.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                <th className="px-4 py-3 text-left">
                  <SortBtn k="sponsor" label="Sponsor" />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortBtn k="n_companies" label="Cos" align="right" />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortBtn k="n_positions" label="Positions" align="right" />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortBtn k="avg_holders" label="Avg holders" align="right" />
                </th>
                <th className="px-3 py-3 text-right">
                  <SortBtn k="total_fv" label="Agg FV" align="right" />
                </th>
                <th
                  className="px-3 py-3 text-right border-l"
                  style={{ borderColor: "#1e1e2e", background: "rgba(239,68,68,0.04)" }}
                  title="% of debt positions marked below 95¢ on the dollar"
                >
                  <SortBtn k="pct_below_95" label="< 95¢" align="right" />
                </th>
                <th
                  className="px-3 py-3 text-right"
                  style={{ background: "rgba(239,68,68,0.04)" }}
                  title="% of debt positions marked below 90¢ on the dollar"
                >
                  <SortBtn k="pct_below_90" label="< 90¢" align="right" />
                </th>
                <th
                  className="px-3 py-3 text-right"
                  style={{ background: "rgba(239,68,68,0.04)" }}
                  title="% of debt positions tagged non-accrual at the position level (MFIC excluded — aggregate-only NA reporting)"
                >
                  <SortBtn k="pct_non_accrual" label="Non-accrual" align="right" />
                </th>
                <th
                  className="px-3 py-3 text-right"
                  style={{ background: "rgba(239,68,68,0.04)" }}
                  title="% of debt positions currently paying any PIK"
                >
                  <SortBtn k="pct_pik_now" label="PIK now" align="right" />
                </th>
                <th
                  className="px-3 py-3 text-right"
                  style={{ background: "rgba(239,68,68,0.04)" }}
                  title="% of debt positions whose loan flipped from cash-pay to PIK during our observation window"
                >
                  <SortBtn k="pct_modified" label="Modified" align="right" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => {
                const thin = s.n_companies < THIN_COVERAGE;
                const nameColor = thin ? "#8b8ba8" : "#ffffff";
                const numColor  = thin ? "#6b6b88" : "#d1d5db";
                const fvColor   = thin ? "#8b8ba8" : "#ffffff";
                return (
                <tr
                  key={s.sponsor_slug}
                  className={`border-t ${thin ? "italic" : ""}`}
                  style={{
                    borderColor: "#1a1a28",
                    background: i % 2 === 0 ? "#111118" : "#0f0f16",
                  }}
                  title={thin
                    ? `Thin coverage: only ${s.n_companies} attributed borrower${s.n_companies === 1 ? "" : "s"} in our scope — sponsor-level metrics may reflect a single concentrated holding rather than a franchise pattern.`
                    : undefined}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/sponsors/${s.sponsor_slug}`}
                      className="text-sm font-medium hover:text-indigo-400"
                      style={{ color: nameColor }}
                    >
                      {s.sponsor}
                      {thin && <span style={{ color: "#6b6b88" }}>{" *"}</span>}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-right text-sm" style={{ color: nameColor }}>{s.n_companies}</td>
                  <td className="px-3 py-3 text-right text-sm" style={{ color: numColor }}>
                    {s.n_positions}
                  </td>
                  <td className="px-3 py-3 text-right text-xs" style={{ color: numColor }}>
                    {s.avg_holders.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-medium" style={{ color: fvColor }}>
                    {fmtUSD(s.total_fv)}
                  </td>
                  <td
                    className="px-3 py-3 text-right text-sm font-mono border-l"
                    style={{ borderColor: "#1a1a28", color: pctColor(s.pct_below_95, "pct_below_95", thin) }}
                  >
                    {s.pct_below_95.toFixed(1)}%
                  </td>
                  <td
                    className="px-3 py-3 text-right text-sm font-mono"
                    style={{ color: pctColor(s.pct_below_90, "pct_below_90", thin) }}
                  >
                    {s.pct_below_90.toFixed(1)}%
                  </td>
                  <td
                    className="px-3 py-3 text-right text-sm font-mono"
                    style={{ color: pctColor(s.pct_non_accrual, "pct_non_accrual", thin) }}
                    title={`${s.n_positions_na} position${s.n_positions_na === 1 ? "" : "s"} in NA-coverage denominator`}
                  >
                    {s.pct_non_accrual.toFixed(1)}%
                  </td>
                  <td
                    className="px-3 py-3 text-right text-sm font-mono"
                    style={{ color: pctColor(s.pct_pik_now, "pct_pik_now", thin) }}
                  >
                    {s.pct_pik_now.toFixed(1)}%
                  </td>
                  <td
                    className="px-3 py-3 text-right text-sm font-mono"
                    style={{ color: pctColor(s.pct_modified, "pct_modified", thin) }}
                    title={`${s.n_positions_mod} position${s.n_positions_mod === 1 ? "" : "s"} in modification-coverage denominator`}
                  >
                    {s.pct_modified.toFixed(1)}%
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
        Credit lens: position-count weighted across the latest snapshot per (BDC, borrower,
        investment type, maturity). Equity / preferred / warrants / partnership interests
        excluded from all credit metrics. Non-accrual denominator excludes MFIC because its
        SOI lacks per-position non-accrual tagging. Modified = loan flipped cash-pay → PIK
        within our observation window (from <code>loan_history.pik_modified_from_cash</code>).
      </p>
      <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
        <span style={{ color: "#8b8ba8" }}>*</span> Italicized / muted rows have fewer than {THIN_COVERAGE} attributed
        borrowers in our scope — headline metrics may reflect a single concentrated holding
        (e.g. Nordic Capital&apos;s Inovalon) rather than a sponsor-franchise pattern. Treat as
        directional only.
      </p>
    </div>
  );
}
