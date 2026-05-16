import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import StatCard from "@/components/StatCard";
import BDCTimelineChart from "@/components/BDCTimelineChart";
import { bdcs } from "@/data/bdcs";
import { bdcsHistory } from "@/data/bdcs_history";
import { pikModifications } from "@/data/pik_modifications";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  // Only generate timeline pages for BDCs we actually have history for.
  const tickersWithHistory = new Set(bdcsHistory.map((r) => r.ticker));
  return bdcs
    .filter((b) => tickersWithHistory.has(b.ticker))
    .map((b) => ({ slug: b.slug }));
}

export default async function BDCTimelinePage({ params }: PageProps) {
  const { slug } = await params;
  const bdc = bdcs.find((b) => b.slug === slug);
  if (!bdc) notFound();

  const rows = bdcsHistory
    .filter((r) => r.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));

  if (rows.length === 0) notFound();

  const modRows = pikModifications
    .filter((m) => m.ticker === bdc.ticker)
    .sort((a, b) => a.period_end.localeCompare(b.period_end));

  const latest = rows[rows.length - 1];
  const earliest = rows[0];
  const fvChangeB = latest.total_fv_b - earliest.total_fv_b;
  const positionChange = latest.n_positions - earliest.n_positions;
  const quartersCovered = rows.length;
  const totalNewMods = modRows.reduce((s, r) => s + r.new_mods, 0);
  const totalCured = modRows.reduce((s, r) => s + r.cured, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href={`/bdcs/${bdc.slug}`}
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: "#8b8ba8" }}
      >
        <ArrowLeft size={14} /> Back to {bdc.ticker} overview
      </Link>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <span
            className="px-2.5 py-1 rounded text-sm font-mono font-bold"
            style={{
              background: "rgba(99,102,241,0.15)",
              color: "#a5b4fc",
              border: "1px solid rgba(99,102,241,0.3)",
            }}
          >
            {bdc.ticker}
          </span>
          <span className="text-xs px-2 py-1 rounded border" style={{
            color: "#a5b4fc",
            background: "rgba(99,102,241,0.08)",
            borderColor: "rgba(99,102,241,0.2)",
          }}>
            Time Series · Beta
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">{bdc.name} — Through Time</h1>
        <p className="text-sm" style={{ color: "#9ca3af" }}>
          Quarter-by-quarter SOI snapshots parsed from EDGAR 10-K and 10-Q filings.
        </p>
      </div>

      {/* Headline strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard
          label="Coverage"
          value={`${quartersCovered}Q`}
          sub={`${earliest.period_end.slice(0, 7)} → ${latest.period_end.slice(0, 7)}`}
        />
        <StatCard
          label="Latest portfolio"
          value={`$${latest.total_fv_b.toFixed(1)}B`}
          sub={`${latest.n_positions.toLocaleString()} positions`}
        />
        <StatCard
          label="FV change since start"
          value={`${fvChangeB >= 0 ? "+" : ""}$${fvChangeB.toFixed(1)}B`}
          color={fvChangeB >= 0 ? "#22c55e" : "#ef4444"}
          trend={fvChangeB >= 0 ? "up" : "down"}
          trendLabel={`${((fvChangeB / earliest.total_fv_b) * 100).toFixed(0)}%`}
        />
        <StatCard
          label="Position change"
          value={`${positionChange >= 0 ? "+" : ""}${positionChange.toLocaleString()}`}
          color={positionChange >= 0 ? "#22c55e" : "#ef4444"}
          sub={`${earliest.n_positions} → ${latest.n_positions}`}
        />
      </div>

      {totalNewMods > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <StatCard
            label="Cash → PIK flips (lifetime)"
            value={totalNewMods.toLocaleString()}
            color="#f97316"
            sub="Loans deteriorated to PIK"
          />
          <StatCard
            label="PIK cures (lifetime)"
            value={totalCured.toLocaleString()}
            color="#22c55e"
            sub="Loans returned to cash-pay"
          />
          <StatCard
            label="Net PIK migrations"
            value={`${totalNewMods - totalCured >= 0 ? "+" : ""}${(totalNewMods - totalCured).toLocaleString()}`}
            color={totalNewMods - totalCured > 0 ? "#ef4444" : "#22c55e"}
            sub="Flips minus cures"
          />
        </div>
      )}

      {/* Chart */}
      <BDCTimelineChart rows={rows} modRows={modRows} ticker={bdc.ticker} />

      {/* Table view */}
      <div
        className="rounded-xl border overflow-hidden mt-6"
        style={{ background: "#111118", borderColor: "#1e1e2e" }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">Quarterly snapshots</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["Period end", "Positions", "Cost ($B)", "Fair value ($B)", "FV / Cost", "NA % (cost)", "PIK % (cost)"].map((h) => (
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
              {[...rows].reverse().map((r, i) => {
                const ratio = r.total_cost_b ? r.total_fv_b / r.total_cost_b : 0;
                const ratioColor = ratio >= 1 ? "#22c55e" : ratio >= 0.97 ? "#eab308" : "#ef4444";
                return (
                  <tr
                    key={r.period_end}
                    className="border-t"
                    style={{
                      borderColor: "#1a1a28",
                      background: i % 2 === 0 ? "#111118" : "#0f0f16",
                    }}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-white">{r.period_end}</td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "#d1d5db" }}>
                      {r.n_positions.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "#d1d5db" }}>
                      ${r.total_cost_b.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: "#d1d5db" }}>
                      ${r.total_fv_b.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold" style={{ color: ratioColor }}>
                      {(ratio * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{
                      color: r.na_pct_at_cost >= 3 ? "#ef4444" : r.na_pct_at_cost >= 1 ? "#eab308" : "#9ca3af",
                    }}>
                      {r.na_pct_at_cost > 0 ? `${r.na_pct_at_cost.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{
                      color: r.pik_pct_at_cost >= 15 ? "#f97316" : r.pik_pct_at_cost >= 5 ? "#eab308" : "#9ca3af",
                    }}>
                      {r.pik_pct_at_cost > 0 ? `${r.pik_pct_at_cost.toFixed(2)}%` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs mt-6" style={{ color: "#6b6b88" }}>
        Source: SEC EDGAR 10-K / 10-Q Schedule of Investments parsing pipeline (own work).
        Coverage may be partial for older filings.
      </p>
    </div>
  );
}
