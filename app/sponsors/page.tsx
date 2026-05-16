import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { sponsors } from "@/data/sponsors_index";
import { borrowers } from "@/data/borrowers_index";

const fmtUSD = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export default function SponsorsIndexPage() {
  const rows = [...sponsors].sort((a, b) => b.total_fv - a.total_fv);
  const totalFV = rows.reduce((s, r) => s + r.total_fv, 0);
  const totalCompanies = rows.reduce((s, r) => s + r.n_companies, 0);
  const indexedWithSponsor = borrowers.filter((b) => b.sponsors).length;

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
            background: "rgba(168,85,247,0.12)",
            color: "#d8b4fe",
            border: "1px solid rgba(168,85,247,0.3)",
          }}>
            Sponsors
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">PE sponsor exposure</h1>
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          Borrowers in our index attributed to each private-equity sponsor. Sponsor mapping comes from
          bdctransparency.io&apos;s curated company list; we intersect with our SOI parsing to pull
          per-sponsor exposure across our 10 covered BDCs.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl p-4 border" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Sponsors with exposure</div>
          <div className="text-2xl font-bold text-white">{rows.length}</div>
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

      <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Sponsors by total exposure</h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            Sorted by aggregate latest-quarter FV across attributed borrowers.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Sponsor", "Companies", "Avg # holders", "Aggregate FV"].map((h) => (
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
              {rows.map((s, i) => (
                <tr
                  key={s.sponsor_slug}
                  className="border-t"
                  style={{
                    borderColor: "#1a1a28",
                    background: i % 2 === 0 ? "#111118" : "#0f0f16",
                  }}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/sponsors/${s.sponsor_slug}`}
                      className="text-sm font-medium text-white hover:text-indigo-400"
                    >
                      {s.sponsor}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-white">{s.n_companies}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#d1d5db" }}>
                    {s.avg_holders.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{fmtUSD(s.total_fv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
