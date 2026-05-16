import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StatCard from "@/components/StatCard";
import BorrowerHistoryChart from "@/components/BorrowerHistoryChart";
import { borrowers } from "@/data/borrowers_index";
import { borrowerHistory } from "@/data/borrowers_history";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return borrowers.map((b) => ({ slug: b.slug }));
}

const fmtUSD = (v: number) => {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

export default async function BorrowerDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const b = borrowers.find((x) => x.slug === slug);
  if (!b) notFound();

  const rows = borrowerHistory.filter((h) => h.slug === slug);
  if (rows.length === 0) notFound();

  const tickers = Array.from(new Set(rows.map((r) => r.ticker))).sort();
  const periods = Array.from(new Set(rows.map((r) => r.period_end))).sort();

  // Build wide-format datasets for the two charts (FV and cost over time per ticker)
  type WideRow = Record<string, string | number | null>;
  const fvByPeriod = new Map<string, WideRow>();
  const costByPeriod = new Map<string, WideRow>();
  for (const p of periods) {
    fvByPeriod.set(p, { period_end: p });
    costByPeriod.set(p, { period_end: p });
  }
  for (const h of rows) {
    fvByPeriod.get(h.period_end)![h.ticker] = h.fv;
    costByPeriod.get(h.period_end)![h.ticker] = h.cost;
  }
  const fvData = Array.from(fvByPeriod.values());
  const costData = Array.from(costByPeriod.values());

  // Latest per-holder snapshot
  type Snapshot = {
    ticker: string;
    cost: number;
    fv: number;
    par: number;
    period_end: string;
    is_non_accrual: number | null;
    has_pik: number | null;
  };
  const latestByTicker = new Map<string, Snapshot>();
  for (const h of rows) {
    const prev = latestByTicker.get(h.ticker);
    if (!prev || h.period_end > prev.period_end) latestByTicker.set(h.ticker, h);
  }
  const latestRows = Array.from(latestByTicker.values()).sort((a, b) => b.fv - a.fv);
  const latestTotalFV = latestRows.reduce((s, r) => s + r.fv, 0);
  const latestTotalCost = latestRows.reduce((s, r) => s + r.cost, 0);

  // Mark dispersion at latest quarter (cents/par if par > 0, else cents/cost)
  const dispersion = latestRows
    .map((r) => {
      const denom = r.par > 0 ? r.par : r.cost;
      return denom > 0 ? (100 * r.fv) / denom : null;
    })
    .filter((v): v is number => v !== null);
  const minMark = dispersion.length ? Math.min(...dispersion) : null;
  const maxMark = dispersion.length ? Math.max(...dispersion) : null;
  const spreadBps = minMark !== null && maxMark !== null ? Math.round((maxMark - minMark) * 100) : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/borrowers"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: "#8b8ba8" }}
      >
        <ArrowLeft size={14} /> Back to borrowers
      </Link>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span className="px-2.5 py-1 rounded text-sm font-bold" style={{
            background: "rgba(99,102,241,0.12)",
            color: "#a5b4fc",
            border: "1px solid rgba(99,102,241,0.3)",
          }}>
            Borrower
          </span>
          {b.n_holders >= 2 && (
            <span className="text-xs px-2 py-1 rounded border" style={{
              color: "#fca5a5",
              background: "rgba(239,68,68,0.08)",
              borderColor: "rgba(239,68,68,0.25)",
            }}>
              Cross-held · {b.n_holders} BDCs
            </span>
          )}
          {b.category && (
            <span className="text-xs px-2 py-1 rounded border" style={{
              color: "#a5b4fc",
              background: "rgba(99,102,241,0.10)",
              borderColor: "rgba(99,102,241,0.3)",
            }}>
              {b.category}
            </span>
          )}
          {b.segment && (
            <span className="text-xs px-2 py-1 rounded border" style={{
              color: "#d1d5db",
              background: "#1a1a28",
              borderColor: "#2d2d50",
            }}>
              {b.segment}
            </span>
          )}
          {b.system_type && (
            <span className="text-xs px-2 py-1 rounded border" style={{
              color: "#d1d5db",
              background: "#1a1a28",
              borderColor: "#2d2d50",
            }}>
              {b.system_type}
            </span>
          )}
          {!b.category && b.industry && (
            <span className="text-xs px-2 py-1 rounded border" style={{
              color: "#d1d5db",
              background: "#1a1a28",
              borderColor: "#2d2d50",
            }}>
              {b.industry}
            </span>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{b.name}</h1>
        {b.sponsors && (
          <div className="text-sm mt-1 flex items-center gap-2 flex-wrap" style={{ color: "#d8b4fe" }}>
            <span style={{ color: "#8b8ba8" }}>Sponsor{b.sponsors.includes(";") ? "s" : ""}:</span>
            {b.sponsors.split(";").map((sp) => {
              const name = sp.trim();
              const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
              return (
                <Link key={name} href={`/sponsors/${slug}`}
                      className="font-medium hover:text-white transition-colors">
                  {name}
                </Link>
              );
            })}
          </div>
        )}
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          {tickers.length} holder{tickers.length === 1 ? "" : "s"} · {periods.length} quarter{periods.length === 1 ? "" : "s"} of history
          · {periods[0]} → {periods[periods.length - 1]}
        </p>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Aggregate FV (latest)" value={fmtUSD(latestTotalFV)} />
        <StatCard label="Aggregate cost (latest)" value={fmtUSD(latestTotalCost)} />
        <StatCard
          label="FV / cost"
          value={`${latestTotalCost ? ((100 * latestTotalFV) / latestTotalCost).toFixed(1) : "—"}%`}
          color={latestTotalCost && latestTotalFV / latestTotalCost >= 0.98 ? "#22c55e" : latestTotalFV / latestTotalCost >= 0.9 ? "#eab308" : "#ef4444"}
        />
        {b.n_holders >= 2 && spreadBps !== null && (
          <StatCard
            label="Mark dispersion (latest)"
            value={`${spreadBps} bps`}
            sub={`${minMark?.toFixed(1)}¢ → ${maxMark?.toFixed(1)}¢`}
            color={spreadBps > 500 ? "#ef4444" : spreadBps > 200 ? "#eab308" : "#9ca3af"}
          />
        )}
      </div>

      {/* Per-holder latest snapshot */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Latest position by holder</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["BDC", "Period", "Cost", "Fair value", "FV / cost", "Mark¢", "Non-accrual", "PIK"].map((h) => (
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
              {latestRows.map((r, i) => {
                const fvc = r.cost ? (100 * r.fv) / r.cost : 0;
                const fvcColor = fvc >= 98 ? "#22c55e" : fvc >= 90 ? "#eab308" : "#ef4444";
                const denom = r.par > 0 ? r.par : r.cost;
                const markCent = denom ? (100 * r.fv) / denom : null;
                return (
                  <tr
                    key={r.ticker}
                    className="border-t"
                    style={{
                      borderColor: "#1a1a28",
                      background: i % 2 === 0 ? "#111118" : "#0f0f16",
                    }}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/bdcs/${r.ticker.toLowerCase()}`}
                        className="font-mono font-semibold text-white hover:text-indigo-400"
                      >
                        {r.ticker}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: "#9ca3af" }}>
                      {r.period_end}
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{fmtUSD(r.cost)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-white">{fmtUSD(r.fv)}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: fvcColor }}>
                      {fvc.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#d1d5db" }}>
                      {markCent !== null ? `${markCent.toFixed(1)}¢` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{
                      color: r.is_non_accrual === 1 ? "#ef4444" : r.is_non_accrual === 0 ? "#9ca3af" : "#6b6b88",
                    }}>
                      {r.is_non_accrual === 1 ? "YES" : r.is_non_accrual === 0 ? "no" : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{
                      color: r.has_pik === 1 ? "#f97316" : r.has_pik === 0 ? "#9ca3af" : "#6b6b88",
                    }}>
                      {r.has_pik === 1 ? "YES" : r.has_pik === 0 ? "no" : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fair value over time per holder */}
      <div className="rounded-xl border p-5 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-1">Fair value over time, by holder</h2>
        <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
          Position size as marked. Divergence between BDCs is the differentiating signal here.
        </p>
        <BorrowerHistoryChart data={fvData} tickers={tickers} yLabel="Fair value (USD)" />
      </div>

      {/* Cost over time per holder */}
      {tickers.length > 0 && (
        <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white mb-1">Amortized cost over time, by holder</h2>
          <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>
            Reference series — what each BDC paid for the position. Compare with fair-value chart above
            to see write-downs and write-ups.
          </p>
          <BorrowerHistoryChart data={costData} tickers={tickers} yLabel="Amortized cost (USD)" />
        </div>
      )}

      <p className="text-xs mt-6" style={{ color: "#6b6b88" }}>
        Source: SEC EDGAR 10-K / 10-Q Schedule of Investments parsing across our 10 covered BDCs.
        Borrower-name dedup strips trailing footnote tokens (e.g. &quot;(2)(3)&quot;) so multiple
        loans to the same borrower roll up.
      </p>
    </div>
  );
}
