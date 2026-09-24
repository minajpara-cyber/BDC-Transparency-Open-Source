"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, AlertTriangle, TrendingDown, Clock, Users } from "lucide-react";
import { siteMeta } from "@/data/site_meta";
import { dataReleaseId, longTailReportingDate } from "@/lib/dataRelease";
import { sameNaCoverage } from "@/lib/naCoverage";
import { bdcsHistory } from "@/data/bdcs_history";
import { creditQuality } from "@/data/credit_quality";
import { nonAccrualFlow } from "@/data/non_accrual_events";
import { maturityComparison } from "@/data/maturity";
import OutcomeEvidenceNotice from "@/components/OutcomeEvidenceNotice";

const card: React.CSSProperties = {
  background: "#12121c",
  border: "1px solid #1e1e2e",
  borderRadius: 12,
};

function Section({
  title, sub, href, linkLabel, children,
}: {
  title: string; sub?: string; href: string; linkLabel: string; children: React.ReactNode;
}) {
  return (
    <div style={card} className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          {sub && <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>{sub}</p>}
        </div>
        <Link href={href} className="flex items-center gap-1 text-xs whitespace-nowrap text-indigo-400 hover:text-indigo-300">
          {linkLabel} <ArrowRight size={12} />
        </Link>
      </div>
      {children}
    </div>
  );
}

const fmtPct = (v: number | null | undefined) => v == null ? "—" : `${v.toFixed(2)}%`;
const fmtB = (v: number) => `$${v.toFixed(1)}B`;
const fmtM = (v: number | null) =>
  v == null ? "—" : v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${v.toFixed(0)}M`;

export default function HomePage() {
  const stats = useMemo(() => {
    // Latest reported quarter per BDC (fiscal-year filers can lag a quarter)
    const latestByTicker = new Map<string, (typeof bdcsHistory)[number]>();
    for (const r of bdcsHistory) {
      const prev = latestByTicker.get(r.ticker);
      if (!prev || r.period_end > prev.period_end) latestByTicker.set(r.ticker, r);
    }
    const totCost = [...latestByTicker.values()].reduce((s, r) => s + r.total_cost_b, 0);

    const ind = creditQuality
      .filter((r) => r.ticker === "industry")
      .sort((a, b) => a.period_end.localeCompare(b.period_end));
    const naNow = ind[ind.length - 1];
    const naPrev = ind[ind.length - 2];

    // Events at each BDC's OWN latest quarter — during reporting season a
    // single global latest_period would show only the early filers' events
    // and hide the other BDCs' most recent flips.
    const latestPeriodOf = (tk: string) => latestByTicker.get(tk)?.period_end;
    const newNAsRaw = nonAccrualFlow.filter(
      (f) => f.event === "new_na" && f.period_end === latestPeriodOf(f.ticker),
    );
    // One borrower often flips several tranches at once — collapse to
    // (ticker, borrower) for the briefing table, summing FV.
    const byKey = new Map<string, { key: string; ticker: string; company: string; fv: number | null }>();
    for (const f of newNAsRaw) {
      const key = `${f.ticker}|${f.company_norm}`;
      const cur = byKey.get(key) ?? { key, ticker: f.ticker, company: f.company, fv: 0 };
      cur.fv = cur.fv == null || f.cur_fv_m == null ? null : cur.fv + f.cur_fv_m;
      byKey.set(key, cur);
    }
    const newNAs = [...byKey.values()].sort((a, b) => (b.fv ?? -Infinity) - (a.fv ?? -Infinity));
    const cured = nonAccrualFlow.filter(
      (f) => f.event === "cured" && f.period_end === latestPeriodOf(f.ticker),
    );
    const unresolved = nonAccrualFlow.filter((f) => f.period_end === latestPeriodOf(f.ticker));
    const firstObserved = unresolved.filter((f) => f.event === "first_observed_na").length;
    const removedUnknown = unresolved.filter((f) => f.event === "removed_unknown").length;
    const unknownStatus = unresolved.filter((f) => f.event === "unknown_status").length;
    const newFV = newNAs.some((f) => f.fv == null) ? null : newNAs.reduce((sum, f) => sum + (f.fv ?? 0), 0);
    const comparableNaCoverage = sameNaCoverage(creditQuality, naNow?.period_end, naPrev?.period_end);
    return { totCost, naNow, naPrev, comparableNaCoverage, newNAs, nNewGroups: newNAsRaw.length, cured, firstObserved, removedUnknown, unknownStatus, newFV };
  }, []);

  const naDeltaBp = !stats.comparableNaCoverage || stats.naNow?.pct_non_accrual == null || stats.naPrev?.pct_non_accrual == null
    ? null : Math.round((stats.naNow.pct_non_accrual - stats.naPrev.pct_non_accrual) * 100);
  const topNear = [...maturityComparison].sort((a, b) => b.pct_near24m - a.pct_near24m).slice(0, 4);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          BDC credit, straight from the filings — {siteMeta.latest_quarter}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8b8ba8" }}>
          Position-level data from {siteMeta.n_filings} selected SEC filings across{" "}
          {siteMeta.n_bdcs} BDCs · latest accepted quarter ends {siteMeta.latest_period} · data release{" "}
          {siteMeta.generated_at}
        </p>
        {dataReleaseId && <p className="text-xs mt-2 text-gray-500">
          Extended borrower coverage has a separate reporting cutoff{longTailReportingDate ? `: ${longTailReportingDate}` : " that is currently unknown"}.
          {" "}<a href="/data-release.json" className="underline">Release details and data versions</a>
        </p>}
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Tracked portfolio (cost)", value: fmtB(stats.totCost), note: `${siteMeta.n_bdcs} BDCs, latest reported` },
          {
            label: "Industry non-accrual",
            value: fmtPct(stats.naNow?.pct_non_accrual),
            note: `${!stats.comparableNaCoverage ? "Coverage changed; change not estimated" : naDeltaBp == null ? "Change unavailable" : `${naDeltaBp >= 0 ? "+" : ""}${naDeltaBp}bp vs prior covered period`} · ${stats.naNow?.na_covered_bdcs ?? 0} BDCs with matched NA coverage`,
          },
          {
            label: "Borrowers with new NA groups",
            value: String(stats.newNAs.length),
            note: `${stats.nNewGroups} borrower/instrument groups · ${fmtM(stats.newFV)} current FV · ${stats.cured.length} observed returns`,
          },
          {
            label: "Unresolved status groups",
            value: String(stats.unknownStatus),
            note: "Latest observed transitions; missing status remains unknown",
          },
        ].map((s) => (
          <div key={s.label} style={card} className="p-4">
            <div className="text-xs" style={{ color: "#8b8ba8" }}>{s.label}</div>
            <div className="text-2xl font-bold text-white mt-1">{s.value}</div>
            <div className="text-xs mt-1" style={{ color: "#6b7280" }}>{s.note}</div>
          </div>
        ))}
      </div>

      <p className="text-xs" style={{ color: "#8b8ba8" }}>
        Industry NA uses {stats.naNow ? fmtB(stats.naNow.na_eligible_cost_b) : "—"} of matched, fully decoded cost.
        Aggregate-only disclosures, unresolved portfolio-scope reconciliations and incomplete position flags are excluded from this industry ratio.
        Unknown rates display as —; supported zero rates display as 0.00%.
      </p>

      {/* What changed */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Section
          title="New non-accruals this quarter"
          sub="Observed borrower/instrument changes in each BDC's latest quarter; current group FV"
          href="/non-accruals"
          linkLabel="All non-accrual events"
        >
          <table className="w-full text-sm">
            <tbody>
              {stats.newNAs.slice(0, 8).map((f) => (
                <tr key={f.key} className="border-t" style={{ borderColor: "#1e1e2e" }}>
                  <td className="py-1.5 pr-2 font-mono text-xs text-indigo-300">{f.ticker}</td>
                  <td className="py-1.5 pr-2 text-gray-200">{f.company.slice(0, 44)}</td>
                  <td className="py-1.5 text-right text-gray-400">{fmtM(f.fv)}</td>
                </tr>
              ))}
              {stats.newNAs.length === 0 && (
                <tr><td className="py-2 text-gray-500 text-xs">None detected in the latest quarter.</td></tr>
              )}
            </tbody>
          </table>
          {stats.cured.length > 0 && (
            <p className="text-xs mt-2" style={{ color: "#6b7280" }}>
              <span className="text-emerald-400">{stats.cured.length} observed returns to accrual</span>
              {": "}
              {stats.cured.slice(0, 3).map((c) => c.company.split("(")[0].trim()).join("; ")}
              {stats.cured.length > 3 ? "…" : ""}
            </p>
          )}
          <p className="text-xs mt-2" style={{ color: "#8b8ba8" }}>
            Separately: {stats.firstObserved} first observed NA · {stats.removedUnknown} removed with outcome unknown · {stats.unknownStatus} unresolved status.
            Groups can include several facilities; these are observed status changes. Missing positions do not establish cures.
          </p>
        </Section>

        <OutcomeEvidenceNotice title="Forecast validation in progress">
          Predicted non-accrual rates and fitted early-warning rankings are withheld while their event labels and historical observation coverage are reviewed.
          {" "}<Link href="/watchlist" className="text-indigo-400 underline">Review observed credit signals</Link>.
        </OutcomeEvidenceNotice>

        <Section
          title="Nearest maturity walls"
          sub="Share of loan book due within 24 months (cost-weighted)"
          href="/maturity"
          linkLabel="Maturity walls"
        >
          <table className="w-full text-sm">
            <tbody>
              {topNear.map((m) => (
                <tr key={m.ticker} className="border-t" style={{ borderColor: "#1e1e2e" }}>
                  <td className="py-1.5 pr-2 font-mono text-xs text-indigo-300 w-14">{m.ticker}</td>
                  <td className="py-1.5 pr-2">
                    <div className="h-2 rounded-full" style={{ background: "#1e1e2e" }}>
                      <div className="h-2 rounded-full" style={{ width: `${Math.min(m.pct_near24m * 3, 100)}%`, background: "#f59e0b" }} />
                    </div>
                  </td>
                  <td className="py-1.5 text-right text-gray-300 w-16">{m.pct_near24m.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <OutcomeEvidenceNotice title="Sponsor outcomes pending source review">
          Distress-exit rankings require verified exits and recoveries. A missing holding or its last reported mark does not establish a realized loss.
          {" "}<Link href="/sponsors" className="text-indigo-400 underline">Explore sponsor exposure</Link>.
        </OutcomeEvidenceNotice>
      </div>

      {/* Deep-dive directory */}
      <div style={card} className="p-5">
        <h2 className="font-semibold text-white mb-3">Deep dives</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          {[
            { href: "/vintage", icon: TrendingDown, t: "Vintage analysis", d: "Dated holding cohorts, quarter-end non-accrual bounds and explicit coverage" },
            { href: "/credit", icon: AlertTriangle, t: "Credit quality", d: "Non-accruals, marks and PIK trends quarterly since 2018, with a 160-fund industry blend" },
            { href: "/maturity", icon: Clock, t: "Maturity walls", d: "When each BDC's borrowers must repay or refinance" },
            { href: "/borrowers", icon: Users, t: "Borrower universe", d: "1,900+ entity-resolved borrowers with cross-holder marks and history" },
          ].map((x) => (
            <Link key={x.href} href={x.href} className="p-3 rounded-lg border transition-colors hover:border-indigo-500/50" style={{ borderColor: "#1e1e2e" }}>
              <x.icon size={15} className="text-indigo-400 mb-1.5" />
              <div className="text-white font-medium">{x.t}</div>
              <div className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>{x.d}</div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
