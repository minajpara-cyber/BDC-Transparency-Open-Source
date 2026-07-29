"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, AlertTriangle, TrendingDown, Clock, Users } from "lucide-react";
import { siteMeta } from "@/data/site_meta";
import { bdcsHistory } from "@/data/bdcs_history";
import { creditQuality } from "@/data/credit_quality";
import { nonAccrualFlow } from "@/data/non_accrual_events";
import { ewsRows, ewsMeta } from "@/data/early_warning_scores";
import { maturityComparison } from "@/data/maturity";
import { sponsors } from "@/data/sponsors_index";

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
    const byKey = new Map<string, { ticker: string; company: string; fv: number }>();
    for (const f of newNAsRaw) {
      const key = `${f.ticker}|${f.company_norm}`;
      const cur = byKey.get(key) ?? { ticker: f.ticker, company: f.company, fv: 0 };
      cur.fv += f.prv_fv_m ?? f.cur_fv_m ?? 0;
      byKey.set(key, cur);
    }
    const newNAs = [...byKey.values()].sort((a, b) => b.fv - a.fv);
    const cured = nonAccrualFlow.filter(
      (f) => f.event === "cured" && f.period_end === latestPeriodOf(f.ticker),
    );
    const hotWatch = ewsRows.filter((r) => r.score >= 5);
    const oosTop = ewsMeta.validation_buckets[ewsMeta.validation_buckets.length - 1];
    return { totCost, naNow, naPrev, newNAs, nNewPositions: newNAsRaw.length, cured, hotWatch, oosTop };
  }, []);

  const naDeltaBp = Math.round((stats.naNow.pct_non_accrual - stats.naPrev.pct_non_accrual) * 100);
  const topNear = [...maturityComparison].sort((a, b) => b.pct_near24m - a.pct_near24m).slice(0, 4);
  const sponsorFlags = sponsors
    .filter((s) => s.n_exits >= 8)
    .sort((a, b) => b.pct_exits_distress - a.pct_exits_distress)
    .slice(0, 4);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Hero */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          BDC credit, straight from the filings — {siteMeta.latest_quarter}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8b8ba8" }}>
          Position-level data parsed from {siteMeta.n_filings} SEC filings across{" "}
          {siteMeta.n_bdcs} BDCs · latest quarter ends {siteMeta.latest_period} · refreshed{" "}
          {siteMeta.generated_at}
        </p>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Tracked portfolio (cost)", value: fmtB(stats.totCost), note: `${siteMeta.n_bdcs} BDCs, latest reported` },
          {
            label: "Industry non-accrual",
            value: `${stats.naNow.pct_non_accrual.toFixed(2)}%`,
            note: `${naDeltaBp >= 0 ? "+" : ""}${naDeltaBp}bp vs prior qtr (at cost)`,
          },
          {
            label: "New non-accrual borrowers this qtr",
            value: String(stats.newNAs.length),
            note: `${stats.nNewPositions} positions · ${fmtM(stats.newNAs.reduce((s, f) => s + f.fv, 0))} prior-qtr FV · ${stats.cured.length} cured`,
          },
          {
            label: "High early-warning scores",
            value: String(stats.hotWatch.length),
            note: `score ≥5 · ${stats.oosTop.hit_rate_pct.toFixed(1)}% went NA within 2q out-of-sample`,
          },
        ].map((s) => (
          <div key={s.label} style={card} className="p-4">
            <div className="text-xs" style={{ color: "#8b8ba8" }}>{s.label}</div>
            <div className="text-2xl font-bold text-white mt-1">{s.value}</div>
            <div className="text-xs mt-1" style={{ color: "#6b7280" }}>{s.note}</div>
          </div>
        ))}
      </div>

      {/* What changed */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Section
          title="New non-accruals this quarter"
          sub="Positions newly flagged NA in each BDC's latest reported quarter"
          href="/non-accruals"
          linkLabel="All non-accrual events"
        >
          <table className="w-full text-sm">
            <tbody>
              {stats.newNAs.slice(0, 8).map((f, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "#1e1e2e" }}>
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
              <span className="text-emerald-400">{stats.cured.length} cured</span>
              {": "}
              {stats.cured.slice(0, 3).map((c) => c.company.split("(")[0].trim()).join("; ")}
              {stats.cured.length > 3 ? "…" : ""}
            </p>
          )}
        </Section>

        <Section
          title="Early-warning leaders"
          sub="Out-of-sample validated 2-quarter score — signals fitted on pre-2024 data only"
          href="/watchlist"
          linkLabel="Full watchlist"
        >
          <table className="w-full text-sm">
            <tbody>
              {ewsRows.slice(0, 8).map((r, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "#1e1e2e" }}>
                  <td className="py-1.5 pr-2 font-mono text-xs text-indigo-300">{r.ticker}</td>
                  <td className="py-1.5 pr-2 text-gray-200">{r.borrower.slice(0, 36)}</td>
                  <td className="py-1.5 pr-2 text-right">
                    <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                      style={{ background: r.score >= 8 ? "rgba(239,68,68,.15)" : "rgba(245,158,11,.15)", color: r.score >= 8 ? "#f87171" : "#fbbf24" }}>
                      {r.score}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right text-gray-400">{fmtM(r.fv_m)}</td>
                  <td className="py-1.5 text-right text-gray-500 text-xs">{r.mark != null ? `${Math.round(r.mark * 100)}¢` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

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

        <Section
          title="Sponsor distress league"
          sub="% of completed exits ending in distress (≥8 exits in our panel)"
          href="/sponsors"
          linkLabel="All sponsors"
        >
          <table className="w-full text-sm">
            <tbody>
              {sponsorFlags.map((s) => (
                <tr key={s.sponsor} className="border-t" style={{ borderColor: "#1e1e2e" }}>
                  <td className="py-1.5 pr-2 text-gray-200">
                    <Link href={`/sponsors/${s.sponsor_slug}`} className="hover:text-indigo-300">{s.sponsor}</Link>
                  </td>
                  <td className="py-1.5 pr-2 text-right text-red-400 font-medium">{s.pct_exits_distress.toFixed(0)}%</td>
                  <td className="py-1.5 text-right text-gray-500 text-xs">{s.n_distress}/{s.n_exits} exits</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      {/* Deep-dive directory */}
      <div style={card} className="p-5">
        <h2 className="font-semibold text-white mb-3">Deep dives</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          {[
            { href: "/vintage", icon: TrendingDown, t: "Vintage analysis", d: "Cumulative default curves by origination year, validated against 85 documented deals" },
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
