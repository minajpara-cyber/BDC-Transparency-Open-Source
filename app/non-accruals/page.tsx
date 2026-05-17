"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import AlertBadge from "@/components/AlertBadge";
import { portfolioCompanies } from "@/data/companies";
import { recentAlerts } from "@/data/market";
import { enrichedBDCs } from "@/lib/enrichBDC";
import {
  currentNonAccruals,
  nonAccrualFlow,
  crossIssuerDisagreement,
} from "@/data/non_accrual_events";

type SortKey = "ticker" | "company" | "fv_m" | "cost_m" | "par_m" | "mark_at_par";

export default function NonAccrualsPage() {
  const [sortKey, setSortKey] = useState<SortKey>("fv_m");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tickerFilter, setTickerFilter] = useState<string>("All");

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const tickers = useMemo(
    () => Array.from(new Set(currentNonAccruals.map((r) => r.ticker))).sort(),
    [],
  );

  const filteredCurrent = useMemo(() => {
    let rows = currentNonAccruals;
    if (tickerFilter !== "All") rows = rows.filter((r) => r.ticker === tickerFilter);
    return [...rows].sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey];
      const bv = (b as unknown as Record<string, unknown>)[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "desc" ? bv - av : av - bv;
      return sortDir === "desc"
        ? String(bv ?? "").localeCompare(String(av ?? ""))
        : String(av ?? "").localeCompare(String(bv ?? ""));
    });
  }, [tickerFilter, sortKey, sortDir]);

  const totalFV   = filteredCurrent.reduce((s, r) => s + r.fv_m, 0);
  const totalCost = filteredCurrent.reduce((s, r) => s + r.cost_m, 0);
  const haircut   = totalCost - totalFV;
  const latestPeriod = currentNonAccruals.map((r) => r.period_end).sort().at(-1) ?? "—";

  // Sort/group flow events by event type and period.
  const newNAEvents = nonAccrualFlow
    .filter((e) => e.event === "new_na")
    .sort((a, b) => (b.cur_fv_m ?? 0) - (a.cur_fv_m ?? 0));
  const curedEvents = nonAccrualFlow
    .filter((e) => e.event === "cured")
    .sort((a, b) => (b.prv_fv_m ?? 0) - (a.prv_fv_m ?? 0));

  // Curated list (legacy 15-company filter)
  const curatedNonAccrualCompanies = portfolioCompanies.filter(
    (c) => c.holders.some((h) => h.status === "Non-Accrual"),
  );

  // BDC summary built from enriched data (real NA % at cost-weighted basis).
  const bdcSummary = enrichedBDCs()
    .filter((b) => b.parsed && b.nonAccrualRate >= 1.0)
    .sort((a, b) => b.nonAccrualRate - a.nonAccrualRate);

  const SortBtn = ({ k, label, align = "left" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <button
      className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider hover:text-white transition-colors ${
        align === "right" ? "justify-end ml-auto" : ""
      }`}
      style={{ color: sortKey === k ? "#a5b4fc" : "#8b8ba8" }}
      onClick={() => handleSort(k)}
    >
      {label} {sortKey === k ? (sortDir === "desc" ? "↓" : "↑") : "↕"}
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-2">
          <AlertBadge severity="Critical" label />
          <span className="text-xs" style={{ color: "#8b8ba8" }}>Parsed as of {latestPeriod}</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Non-Accruals — Cross-BDC View</h1>
        <p className="text-sm" style={{ color: "#8b8ba8" }}>
          Every individual non-accrual position parsed from the latest Schedule of Investments
          for the {tickers.length} traded BDCs in our coverage universe, plus QoQ flow (new vs cured)
          and cross-issuer disagreement. MFIC excluded — its SOI does not flag non-accrual per
          position.
        </p>
      </div>

      {/* Summary stats — built from parsed data */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <div className="rounded-xl border p-4" style={{ background: "#180505", borderColor: "#7f1d1d" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>NA Positions</div>
          <div className="text-2xl font-bold" style={{ color: "#ef4444" }}>{filteredCurrent.length}</div>
          <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>
            {tickerFilter === "All" ? `across ${tickers.length} BDCs` : tickerFilter}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Total NA Fair Value</div>
          <div className="text-2xl font-bold text-white">${(totalFV / 1000).toFixed(2)}B</div>
          <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>${(totalCost / 1000).toFixed(2)}B at cost</div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#1a0e05", borderColor: "#7c2d12" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>Implied Haircut</div>
          <div className="text-2xl font-bold" style={{ color: "#f97316" }}>
            -${(haircut / 1000).toFixed(2)}B
          </div>
          <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>
            -{totalCost > 0 ? (100 * haircut / totalCost).toFixed(1) : "0"}% of cost
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>QoQ Flow</div>
          <div className="text-2xl font-bold text-white">
            +{newNAEvents.length} / -{curedEvents.length}
          </div>
          <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>new NA / cured this quarter</div>
        </div>
      </div>

      {/* Ticker filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["All", ...tickers] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTickerFilter(t)}
            className="px-3 py-1.5 rounded-md text-xs font-mono font-bold border transition-all"
            style={{
              background: tickerFilter === t ? "rgba(99,102,241,0.15)" : "#111118",
              borderColor: tickerFilter === t ? "#6366f1" : "#2d2d45",
              color: tickerFilter === t ? "#a5b4fc" : "#9ca3af",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Current non-accrual positions */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#7f1d1d" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#7f1d1d", background: "#1a0505" }}>
          <h2 className="font-semibold" style={{ color: "#ef4444" }}>
            Currently Non-Accrual ({filteredCurrent.length} positions)
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            One row per position. Click ticker to drill into the BDC; click borrower to open its
            cross-BDC mark-history page.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                <th className="px-4 py-3 text-left"><SortBtn k="ticker" label="BDC" /></th>
                <th className="px-4 py-3 text-left"><SortBtn k="company" label="Borrower" /></th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Industry</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Type</th>
                <th className="px-4 py-3 text-right"><SortBtn k="fv_m" label="FV ($M)" align="right" /></th>
                <th className="px-4 py-3 text-right"><SortBtn k="cost_m" label="Cost ($M)" align="right" /></th>
                <th className="px-4 py-3 text-right"><SortBtn k="par_m" label="Par ($M)" align="right" /></th>
                <th className="px-4 py-3 text-right"><SortBtn k="mark_at_par" label="Mark" align="right" /></th>
              </tr>
            </thead>
            <tbody>
              {filteredCurrent.map((r, i) => {
                const markPct = r.mark_at_par != null ? r.mark_at_par * 100 : null;
                const markColor =
                  markPct == null ? "#9ca3af"
                  : markPct >= 90 ? "#eab308"
                  : markPct >= 70 ? "#f97316"
                  : "#ef4444";
                const borrowerSlug = r.company_norm.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
                return (
                  <tr key={`${r.ticker}-${i}`} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                    <td className="px-4 py-3">
                      <Link href={`/bdcs/${r.ticker.toLowerCase()}`}>
                        <span className="px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                          {r.ticker}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/borrowers/${borrowerSlug}`} className="text-sm font-medium text-white hover:text-red-400 transition-colors">
                        {r.company}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{r.industry ?? "—"}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{r.investment_type ?? "—"}</td>
                    <td className="px-4 py-3 text-right text-sm font-medium" style={{ color: "#ef4444" }}>${r.fv_m.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: "#9ca3af" }}>${r.cost_m.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-sm" style={{ color: "#9ca3af" }}>{r.par_m > 0 ? `$${r.par_m.toFixed(1)}` : "—"}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold" style={{ color: markColor }}>
                      {markPct != null ? `${markPct.toFixed(1)}¢` : "—"}
                    </td>
                  </tr>
                );
              })}
              {filteredCurrent.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-6 text-sm text-center" style={{ color: "#8b8ba8" }}>No non-accruals matching the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QoQ flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* New NA */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#7f1d1d" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "#7f1d1d", background: "#1a0505" }}>
            <h2 className="font-semibold" style={{ color: "#ef4444" }}>
              New Non-Accruals This Quarter ({newNAEvents.length})
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              Loans that flipped from accruing to non-accrual since the prior 10-Q / 10-K. Sorted by current fair value.
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: "#1a1a28" }}>
            {newNAEvents.slice(0, 25).map((e, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Link href={`/bdcs/${e.ticker.toLowerCase()}`}>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                      {e.ticker}
                    </span>
                  </Link>
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{e.company}</div>
                    <div className="text-xs" style={{ color: "#8b8ba8" }}>
                      {e.investment_type ?? "—"} {e.maturity_date ? `· Due ${new Date(e.maturity_date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}` : ""}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold" style={{ color: "#ef4444" }}>
                    ${(e.cur_fv_m ?? 0).toFixed(1)}M
                  </div>
                  <div className="text-xs" style={{ color: "#6b6b88" }}>FV</div>
                </div>
              </div>
            ))}
            {newNAEvents.length === 0 && (
              <div className="px-5 py-6 text-sm text-center" style={{ color: "#8b8ba8" }}>No new non-accruals this quarter.</div>
            )}
          </div>
        </div>

        {/* Cured */}
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#14532d" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "#14532d", background: "#05140a" }}>
            <h2 className="font-semibold" style={{ color: "#22c55e" }}>
              Cured or Removed ({curedEvents.length})
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              Loans that left non-accrual status — either restructured to performing, paid off, or written off entirely. Sorted by prior-quarter fair value.
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: "#1a1a28" }}>
            {curedEvents.slice(0, 25).map((e, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Link href={`/bdcs/${e.ticker.toLowerCase()}`}>
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                      {e.ticker}
                    </span>
                  </Link>
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{e.company}</div>
                    <div className="text-xs" style={{ color: "#8b8ba8" }}>
                      {e.investment_type ?? "—"} {e.maturity_date ? `· Due ${new Date(e.maturity_date).toLocaleDateString("en-US", { year: "numeric", month: "short" })}` : ""}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold" style={{ color: "#22c55e" }}>
                    ${(e.prv_fv_m ?? 0).toFixed(1)}M
                  </div>
                  <div className="text-xs" style={{ color: "#6b6b88" }}>was FV</div>
                </div>
              </div>
            ))}
            {curedEvents.length === 0 && (
              <div className="px-5 py-6 text-sm text-center" style={{ color: "#8b8ba8" }}>No cures or removals this quarter.</div>
            )}
          </div>
        </div>
      </div>

      {/* Cross-issuer disagreement */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#7c2d12" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#7c2d12", background: "#1a0e05" }}>
          <h2 className="font-semibold" style={{ color: "#f97316" }}>
            Cross-Issuer Disagreement ({crossIssuerDisagreement.length})
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
            Borrowers held by 2+ covered BDCs where at least one BDC flags non-accrual on at least
            one tranche and at least one does not. Names are normalized via the bdctransparency.io
            alias dictionary so divergent legal-entity strings roll up to a single operating company.
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: "#1a1a28" }}>
          {crossIssuerDisagreement.map((d) => (
            <div key={d.company_norm} className="px-5 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                <div>
                  <Link href={`/borrowers/${d.company_norm.replace(/[^a-z0-9]+/g, "-")}`} className="text-sm font-semibold text-white hover:text-orange-400 transition-colors">
                    {d.display_name}
                  </Link>
                  <div className="text-xs" style={{ color: "#8b8ba8" }}>
                    {d.n_holders_na} of {d.n_holders} BDCs flag this name non-accrual · {d.period_end}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold" style={{ color: "#f97316" }}>
                    ${d.total_fv_na_m.toFixed(1)}M flagged
                  </div>
                  <div className="text-xs" style={{ color: "#6b6b88" }}>of ${d.total_fv_m.toFixed(1)}M total FV</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                {d.holders.map((h) => (
                  <Link key={h.ticker} href={`/bdcs/${h.ticker.toLowerCase()}`}>
                    <span
                      className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-mono border"
                      style={{
                        background: h.is_non_accrual ? "rgba(239,68,68,0.10)" : "rgba(34,197,94,0.08)",
                        borderColor: h.is_non_accrual ? "rgba(239,68,68,0.30)" : "rgba(34,197,94,0.30)",
                        color: h.is_non_accrual ? "#ef4444" : "#22c55e",
                      }}
                    >
                      <span className="font-bold">{h.ticker}</span>
                      <span style={{ color: "#d1d5db" }}>${h.fv_m.toFixed(1)}M</span>
                      {h.mark_at_par != null && (
                        <span style={{ color: "#8b8ba8" }}>· {(h.mark_at_par * 100).toFixed(0)}¢</span>
                      )}
                      <span>{h.is_non_accrual ? "NA" : "perf"}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          {crossIssuerDisagreement.length === 0 && (
            <div className="px-5 py-6 text-sm text-center" style={{ color: "#8b8ba8" }}>
              No cross-issuer disagreements at the latest broadly-covered quarter — every shared borrower is consistently flagged across its holders.
            </div>
          )}
        </div>
      </div>

      {/* BDC summary (parsed) */}
      <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">BDCs by Non-Accrual % (cost-weighted, parsed)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                {["BDC", "Ticker", "Type", "Non-Accrual %", "PIK %", "As of", "Δ NA QoQ"].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap" style={{ color: "#8b8ba8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bdcSummary.map((bdc, i) => (
                <tr key={bdc.ticker} className="border-t" style={{ borderColor: "#1a1a28", background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                  <td className="px-4 py-3">
                    <Link href={`/bdcs/${bdc.slug}`} className="font-medium text-white hover:text-indigo-400">
                      {bdc.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.2)" }}>
                      {bdc.ticker}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#9ca3af" }}>{bdc.type}</td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold" style={{ color: bdc.nonAccrualRate >= 4 ? "#ef4444" : bdc.nonAccrualRate >= 2 ? "#f97316" : "#eab308" }}>
                      {bdc.nonAccrualRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-semibold" style={{ color: bdc.pikRate >= 12 ? "#f97316" : "#eab308" }}>
                      {bdc.pikRate.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: "#a5b4fc" }}>{bdc.asOf ?? "—"}</td>
                  <td className="px-4 py-3 text-xs" style={{
                    color: bdc.delta_na_pct == null ? "#6b6b88" : bdc.delta_na_pct > 0.005 ? "#ef4444" : bdc.delta_na_pct < -0.005 ? "#22c55e" : "#9ca3af",
                  }}>
                    {bdc.delta_na_pct == null ? "—" : `${bdc.delta_na_pct >= 0 ? "+" : ""}${bdc.delta_na_pct.toFixed(2)}pp`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Curated companies list (legacy) */}
      {curatedNonAccrualCompanies.length > 0 && (
        <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
            <h2 className="font-semibold text-white">Curated Software Names on Non-Accrual</h2>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              From the bdctransparency.io watchlist — these may overlap with the parsed list above.
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: "#1a1a28" }}>
            {curatedNonAccrualCompanies.map((company) => {
              const naHolders = company.holders.filter((h) => h.status === "Non-Accrual");
              const fv = naHolders.reduce((s, h) => s + h.fairValue, 0);
              return (
                <div key={company.slug} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <Link href={`/companies/${company.slug}`} className="text-sm font-medium text-white hover:text-red-400">
                      {company.name}
                    </Link>
                    <div className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
                      {naHolders.length} BDC holder{naHolders.length > 1 ? "s" : ""} · {company.subsector}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold" style={{ color: "#ef4444" }}>
                      ${fv.toFixed(0)}M FV
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent alerts */}
      <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white">All Market Alerts</h2>
        </div>
        <div className="divide-y" style={{ borderColor: "#1a1a28" }}>
          {recentAlerts.map((alert, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <AlertBadge severity={alert.severity} label />
                </div>
                <div>
                  <div className="text-sm font-medium text-white mb-1">{alert.title}</div>
                  <div className="text-sm leading-relaxed mb-2" style={{ color: "#9ca3af" }}>{alert.description}</div>
                  <div className="text-xs" style={{ color: "#6b6b88" }}>
                    {new Date(alert.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    {alert.bdc !== "Sector" && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(99,102,241,0.12)", color: "#a5b4fc" }}>
                        {alert.bdc}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
