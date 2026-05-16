import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StatCard from "@/components/StatCard";
import { sponsors } from "@/data/sponsors_index";
import { borrowers } from "@/data/borrowers_index";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return sponsors.map((s) => ({ slug: s.sponsor_slug }));
}

const fmtUSD = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export default async function SponsorDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const s = sponsors.find((x) => x.sponsor_slug === slug);
  if (!s) notFound();

  // Borrowers attributed to this sponsor — match by exact substring within the
  // semicolon-separated sponsors field.
  const attributed = borrowers
    .filter((b) => {
      if (!b.sponsors) return false;
      return b.sponsors.split(";").map((x) => x.trim()).includes(s.sponsor);
    })
    .sort((a, b) => b.total_fv - a.total_fv);

  const totalFV = attributed.reduce((sum, b) => sum + b.total_fv, 0);
  const crossHeld = attributed.filter((b) => b.n_holders >= 2).length;
  const categories = Array.from(new Set(attributed.map((b) => b.category).filter(Boolean)));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/sponsors"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: "#8b8ba8" }}
      >
        <ArrowLeft size={14} /> Back to sponsors
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="px-2.5 py-1 rounded text-sm font-bold" style={{
            background: "rgba(168,85,247,0.12)",
            color: "#d8b4fe",
            border: "1px solid rgba(168,85,247,0.3)",
          }}>
            Sponsor
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{s.sponsor}</h1>
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          {attributed.length} portfolio companies in our index funded by BDCs we cover.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Companies" value={attributed.length.toString()} />
        <StatCard label="Cross-held (≥2 BDCs)" value={crossHeld.toString()} color="#a5b4fc" />
        <StatCard label="Aggregate FV" value={fmtUSD(totalFV)} />
        <StatCard label="Avg # holders" value={s.avg_holders.toFixed(1)} />
      </div>

      {categories.length > 0 && (
        <div className="rounded-lg border p-3 mb-6 flex items-center gap-2 flex-wrap text-xs"
             style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <span style={{ color: "#8b8ba8" }}>Software categories represented:</span>
          {categories.map((c) => (
            <span key={c} className="px-2 py-0.5 rounded border" style={{
              color: "#d1d5db",
              background: "rgba(99,102,241,0.08)",
              borderColor: "#2d2d50",
            }}>
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Portfolio companies</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Company", "Category", "Segment", "Holders", "Latest FV", "Latest period"].map((h) => (
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
              {attributed.map((b, i) => (
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
                  <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{b.category || "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{b.segment || "—"}</td>
                  <td className="px-4 py-3 text-sm" style={{
                    color: b.n_holders >= 3 ? "#ef4444" : b.n_holders === 2 ? "#a5b4fc" : "#6b6b88",
                  }}>
                    {b.n_holders}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-white">{fmtUSD(b.total_fv)}</td>
                  <td className="px-4 py-3 text-xs font-mono" style={{ color: "#9ca3af" }}>{b.latest_period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
