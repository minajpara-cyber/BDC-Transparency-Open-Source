import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StatCard from "@/components/StatCard";
import BorrowerHistoryChart from "@/components/BorrowerHistoryChart";
import { borrowers } from "@/data/borrowers_index";
import { borrowerHistory, latestBookByTicker } from "@/data/borrowers_history";
import { borrowerEnrichment } from "@/data/borrower_enrichment";
import { splitCurrentHolders } from "@/lib/borrowerHolders";

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
  type Snapshot = (typeof rows)[number];
  const lastByTicker = new Map<string, Snapshot>();
  for (const h of rows) {
    const prev = lastByTicker.get(h.ticker);
    if (!prev || h.period_end > prev.period_end) lastByTicker.set(h.ticker, h);
  }
  // Current holders: the borrower is in the BDC's latest book (the same rule
  // as the /borrowers index). A BDC whose last row is older has exited; it is
  // listed apart and left out of the totals and the mark dispersion.
  const { current: latestRows, exited: exitedRows } = splitCurrentHolders(
    Array.from(lastByTicker.values()), latestBookByTicker);
  const latestTotalFV = latestRows.reduce((s, r) => s + r.fv, 0);
  const latestTotalCost = latestRows.reduce((s, r) => s + r.cost, 0);

  // Debt-mark spread at the latest quarter: each current holder's DEBT mark
  // (fair value ÷ par of its loans, data/borrowers_history debt_mark). Equity,
  // preferred and holders with no usable par are left out — never fair value
  // ÷ cost in cents, never equity over the loans' par.
  const dispersion = latestRows
    .map((r) => (r.debt_mark != null ? 100 * r.debt_mark : null))
    .filter((v): v is number => v !== null);
  const minMark = dispersion.length ? Math.min(...dispersion) : null;
  const maxMark = dispersion.length ? Math.max(...dispersion) : null;
  const spreadBps = minMark !== null && maxMark !== null ? Math.round((maxMark - minMark) * 100) : null;
  const anyEquity = latestRows.some((r) => r.equity_fv !== 0 || r.equity_cost > 0);
  const noMarkReason = (r: Snapshot) => r.mark_status === "no_debt"
    ? "This BDC holds no loans to the borrower here (equity or other interests only), so there is no mark in cents of par."
    : "This BDC's loans to the borrower have no usable par in US dollars (missing, in another currency, or the whole commitment of a partly drawn facility), so no mark is shown.";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/borrowers"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: "#8b8ba8" }}
      >
        <ArrowLeft size={14} />{" "}Back to borrowers
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
              Cross-held · {b.n_holders}{" "}BDCs
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
          {latestRows.length} current holder{latestRows.length === 1 ? "" : "s"}
          {exitedRows.length > 0 && <> · {exitedRows.length}{" "}exited</>}
          {" "}· {periods.length} quarter{periods.length === 1 ? "" : "s"}{" "}of history
          · {periods[0]} → {periods[periods.length - 1]}
        </p>
        {(() => {
          const enr = borrowerEnrichment[slug];
          if (!enr) return null;
          return (
            <div className="mt-3 rounded-lg border p-3" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <p className="text-sm" style={{ color: "#d1d5db" }}>{enr.description}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-xs font-medium border" style={{
                  color: "#a5b4fc", background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.25)",
                }}>
                  {enr.sector}
                </span>
                <span className="px-2 py-0.5 rounded text-xs border" style={{
                  color: "#9ca3af", background: "#0f0f16", borderColor: "#2d2d45",
                }}>
                  {enr.sub_sector}
                </span>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "#6b6b88" }}>
                  curated profile
                </span>
              </div>
            </div>
          );
        })()}
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
        {dispersion.length >= 2 && spreadBps !== null && (
          <StatCard
            label="Loan mark spread (latest)"
            value={`${spreadBps} bps`}
            sub={`${minMark?.toFixed(1)}¢ → ${maxMark?.toFixed(1)}¢ of par, ${dispersion.length} holders`}
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
                {[
                  ["BDC", ""], ["Period", ""], ["Cost", "Every instrument the BDC holds in the borrower"],
                  ["Fair value", "Every instrument the BDC holds in the borrower"],
                  ["FV / cost", "Fair value as % of cost, every instrument"],
                  ["Loan mark", "Fair value ÷ par of the BDC's loans to the borrower, in cents per dollar of par. Equity and preferred are not in it."],
                  ["Equity & other", "Preferred, common, warrants, units and fund interests: fair value, and fair value as % of cost"],
                  ["Non-accrual", "Whether a loan is on non-accrual"],
                  ["PIK", "Whether a loan pays interest in kind"],
                ].map(([h, tip]) => (
                  <th
                    key={h}
                    title={tip || undefined}
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
                const markCent = r.debt_mark != null ? 100 * r.debt_mark : null;
                const eqPct = r.equity_cost > 0 ? (100 * r.equity_fv) / r.equity_cost : null;
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
                    <td className="px-4 py-3 text-sm" style={{ color: "#d1d5db" }}
                        title={markCent === null ? noMarkReason(r) : undefined}>
                      {markCent !== null ? `${markCent.toFixed(1)}¢` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "#d1d5db" }}>
                      {r.equity_fv !== 0 || r.equity_cost > 0
                        ? `${fmtUSD(r.equity_fv)}${eqPct !== null ? ` · ${eqPct.toFixed(0)}% of cost` : ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{
                      color: r.is_non_accrual === 1 ? "#ef4444" : r.is_non_accrual === 0 ? "#9ca3af" : "#6b6b88",
                    }}>
                      {r.is_non_accrual === 1 ? "YES" : r.is_non_accrual === 0 ? "no" : "—"}
                      {r.equity_na === 1 && (
                        <div className="text-[10px] font-normal" style={{ color: "#f97316" }}
                             title="A preferred or other equity holding is on non-accrual; the loans are judged on their own">
                          equity on non-accrual
                        </div>
                      )}
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
        <p className="px-5 py-3 text-xs border-t" style={{ color: "#8b8ba8", borderColor: "#1e1e2e" }}>
          Loan mark = fair value ÷ par of each BDC&apos;s loans to the borrower, in cents per dollar of par, over the
          loans that have a par in US dollars (a non-dollar par is converted at the balance-sheet date&apos;s rate).
          &quot;—&quot; means no such mark: the BDC holds only equity, or its loans have no usable par.
          {anyEquity && (
            <>
              {" "}Preferred stock, common equity, warrants, units and fund interests are never in the loan mark; they are
              shown in &quot;Equity &amp; other&quot; at fair value and as a % of what the BDC paid.
            </>
          )}
        </p>
        {exitedRows.length > 0 && (
          <p className="px-5 py-3 text-xs border-t" style={{ color: "#8b8ba8", borderColor: "#1e1e2e" }}>
            Exited (not in the BDC&apos;s latest book, left out of the totals above):{" "}
            {exitedRows.map((r, i) => (
              <span key={r.ticker}>
                {i > 0 && ", "}
                <span className="font-mono text-white">{r.ticker}</span>{" "}(last seen {r.period_end}, {fmtUSD(r.fv)}{" "}fair value)
              </span>
            ))}
          </p>
        )}
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
        Source: SEC EDGAR 10-K / 10-Q Schedule of Investments parsing across our 19 covered BDCs.
        Borrower-name dedup strips trailing footnote tokens (e.g. &quot;(2)(3)&quot;) so multiple
        loans to the same borrower roll up.
      </p>
    </div>
  );
}
