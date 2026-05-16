import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { borrowers } from "@/data/borrowers_index";

const fmtUSD = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export default function BorrowersIndexPage() {
  const rows = [...borrowers].sort((a, b) => b.total_fv - a.total_fv);
  const crossHeld = rows.filter((r) => r.n_holders >= 2);
  const totalFV = rows.reduce((s, r) => s + r.total_fv, 0);

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
          <span className="px-2.5 py-1 rounded text-sm font-bold" style={{
            background: "rgba(99,102,241,0.12)",
            color: "#a5b4fc",
            border: "1px solid rgba(99,102,241,0.3)",
          }}>
            Borrowers
          </span>
          <span className="text-xs px-2 py-1 rounded border" style={{
            color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.2)",
          }}>
            From own SOI parsing
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Tracked borrowers</h1>
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          Borrowers extracted from the Schedule of Investments of our 10 covered BDCs. Cross-held names
          (held by 2+ BDCs) are flagged — those are where mark-dispersion analysis becomes possible.
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Indexed borrowers</div>
          <div className="text-2xl font-bold text-white">{rows.length.toLocaleString()}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Cross-held (≥2 BDCs)</div>
          <div className="text-2xl font-bold" style={{ color: "#a5b4fc" }}>{crossHeld.length}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Aggregate latest FV</div>
          <div className="text-2xl font-bold text-white">{fmtUSD(totalFV)}</div>
        </div>
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Tail not shown</div>
          <div className="text-2xl font-bold" style={{ color: "#6b6b88" }}>~11,200</div>
          <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>single-holder long tail</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#1e1e2e" }}>
          <div>
            <h2 className="font-semibold text-white">Borrower index</h2>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              Sorted by latest aggregate fair value across holders.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Borrower", "Category / Industry", "Sponsor", "Holders", "Latest FV", "Latest period"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap"
                    style={{ color: "#8b8ba8" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((b, i) => (
                <tr
                  key={b.slug}
                  className="border-t"
                  style={{
                    borderColor: "#1a1a28",
                    background: i % 2 === 0 ? "#111118" : "#0f0f16",
                  }}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/borrowers/${b.slug}`}
                      className="text-sm font-medium text-white hover:text-indigo-400"
                    >
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: b.category ? "#a5b4fc" : "#9ca3af" }}>
                    {b.category || b.industry || "—"}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: b.sponsors ? "#d8b4fe" : "#6b6b88" }}>
                    {b.sponsors ? b.sponsors.split(";")[0].trim() + (b.sponsors.includes(";") ? " +" : "") : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className="font-mono"
                      style={{
                        color: b.n_holders >= 3 ? "#ef4444" : b.n_holders === 2 ? "#a5b4fc" : "#6b6b88",
                      }}
                    >
                      {b.n_holders}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{fmtUSD(b.total_fv)}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "#9ca3af" }}>
                    {b.latest_period}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs mt-6" style={{ color: "#6b6b88" }}>
        Showing all {crossHeld.length} cross-held borrowers plus the top 400 single-holder borrowers
        by latest fair value (~{fmtUSD(rows.filter((r) => r.n_holders === 1).reduce((s, r) => s + r.total_fv, 0))} of single-holder FV captured).
        The remaining single-holder tail (~11,200 borrowers) is in our database but not currently indexed
        in the dashboard.
      </p>
    </div>
  );
}
