"use client";
// Credit > PIK & dividends. How much of each BDC's reported earnings arrives as
// PIK (interest paid by growing the loan rather than in cash), and whether the
// dividend is covered by the income that actually arrived in cash.
//
// Data: data/income_coverage.ts (bdc_inventory/scripts/91). NII and total
// investment income come off each filing's statement of operations,
// distributions off its statement of changes in net assets, and PIK / accretion
// off its CASH-FLOW statement — the non-cash adjustments every BDC must print to
// reconcile net increase in net assets to operating cash.
import { useMemo, useState } from "react";
import OutcomeEvidenceNotice from "@/components/OutcomeEvidenceNotice";
import CreditNav from "@/components/CreditNav";
import StatCard from "@/components/StatCard";
import CreditHeatmap from "@/components/CreditHeatmap";
import IncomeTrendChart from "@/components/IncomeTrendChart";
import DividendCoverageTable from "@/components/DividendCoverageTable";
import IncomeMixChart from "@/components/IncomeMixChart";
import { incomeTtm, incomeQuarterly, incomeUniverse, incomeMeta } from "@/data/income_coverage";
import DividendSupportTable from "@/components/DividendSupportTable";
import NavPerShareChart from "@/components/NavPerShareChart";
import { dividendSupport, navPerShare } from "@/data/dividend_support";

type HeatMetric = "pik_pct_nii" | "pik_pct_tii" | "noncash_pct_nii" | "gap";

const HEAT: Record<HeatMetric, { label: string; desc: string; thresholds: [number, number, number] }> = {
  pik_pct_nii: {
    label: "PIK % of NII",
    desc: "PIK income as a share of net investment income, trailing four quarters. Colored 10% → 25% → 40%+.",
    thresholds: [10, 25, 40],
  },
  pik_pct_tii: {
    label: "PIK % of total income",
    desc: "PIK income as a share of total investment income (before expenses), trailing four quarters. Colored 5% → 12% → 20%+.",
    thresholds: [5, 12, 20],
  },
  noncash_pct_nii: {
    label: "PIK + accretion % of NII",
    desc: "All non-cash income — PIK plus net accretion of discount — as a share of NII, trailing four quarters. Colored 15% → 30% → 45%+.",
    thresholds: [15, 30, 45],
  },
  gap: {
    label: "Dividend not covered in cash",
    desc: "Share of distributions declared NOT covered by NII excluding PIK: 100 × (1 − cash coverage). Zero or below = fully covered in cash. Colored 0% → 20% → 40%+.",
    thresholds: [0, 20, 40],
  },
};

export default function IncomePage() {
  const [metric, setMetric] = useState<HeatMetric>("pik_pct_nii");

  const latest = useMemo(() => {
    const m = new Map<string, (typeof incomeTtm)[number]>();
    for (const r of incomeTtm) {
      const cur = m.get(r.ticker);
      if (!cur || r.period_end > cur.period_end) m.set(r.ticker, r);
    }
    return [...m.values()];
  }, []);

  const periods = useMemo(
    () => Array.from(new Set(incomeTtm.map((r) => r.period_end))).filter((p) => p >= "2015-12-31").sort(),
    [],
  );
  const tickers = useMemo(
    () => [...latest].sort((a, b) => (b.pik_pct_nii ?? -1) - (a.pik_pct_nii ?? -1)).map((r) => r.ticker),
    [latest],
  );
  const cellMap = useMemo(() => {
    const m = new Map<string, { value: number | null; reliable?: boolean }>();
    for (const r of incomeTtm) {
      const v = metric === "gap"
        ? (r.cov_ex_pik == null ? null : 100 * (1 - r.cov_ex_pik))
        : r[metric];
      m.set(`${r.ticker}|${r.period_end}`, { value: v ?? null });
    }
    return m;
  }, [metric]);

  // headline stats
  const uLatest = incomeUniverse[incomeUniverse.length - 1];
  const u3y = incomeUniverse.find((u) => u.period_end === shiftYears(uLatest.period_end, -3));
  const u2019 = incomeUniverse.find((u) => u.period_end === "2019-12-31");
  const top = [...latest].sort((a, b) => (b.pik_pct_nii ?? 0) - (a.pik_pct_nii ?? 0))[0];
  const nUncovered = latest.filter((r) => (r.cov_ex_pik ?? 9) < 1).length;
  const nReportedUncovered = latest.filter((r) => (r.nii_cov ?? 9) < 1).length;
  const worstCash = [...latest].sort((a, b) => (a.cov_ex_pik ?? 9) - (b.cov_ex_pik ?? 9)).slice(0, 3);

  const arcc = latest.find((r) => r.ticker === "ARCC");
  const navDefault = [...dividendSupport].sort((a, b) => (a.nav_chg_3y ?? 0) - (b.nav_chg_3y ?? 0))
    .slice(0, 3).map((r) => r.ticker).concat(["MAIN", "HTGC"]);
  const trendDefault = tickers.slice(0, 5);
  const coverageDefault = worstCash.map((r) => r.ticker).concat(tickers.slice(-2));

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CreditNav />
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-2xl font-bold text-white">PIK income &amp; dividend coverage</h1>
          <span className="px-2 py-1 rounded text-xs font-medium"
            style={{ background: "#1a1a28", color: "#a5b4fc", border: "1px solid #2d2d50" }}>
            trailing four quarters to {incomeMeta.latest_period}
          </span>
        </div>
        <p className="text-sm max-w-4xl" style={{ color: "#9ca3af" }}>
          PIK — payment in kind — is interest a borrower pays by adding it to the loan instead of paying
          cash. A BDC books it as income right away, so it counts toward net investment income (NII) and
          toward the dividend the BDC can say it &quot;earned&quot;, but the cash only arrives if and when
          the loan is repaid. This tab measures how much of each BDC&apos;s NII is PIK, and whether the
          dividend is covered by the income that <span className="text-white">did</span>{" "}arrive in cash.
          Figures are read off each 10-Q and 10-K: NII from the statement of operations, distributions
          declared from the statement of changes in net assets, and PIK from the cash-flow statement, where
          every BDC has to back it out to reconcile to operating cash.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="PIK share of NII — median BDC" value={`${(uLatest.pik_pct_nii_median ?? 0).toFixed(1)}%`}
          sub={u2019 ? `was ${(u2019.pik_pct_nii_median ?? 0).toFixed(1)}% in 2019${u3y ? ` · ${(u3y.pik_pct_nii_median ?? 0).toFixed(1)}% three years ago` : ""}` : undefined}
          color="#f59e0b" highlight />
        <StatCard label="PIK share of NII — all BDCs pooled" value={`${(uLatest.pik_pct_nii_agg ?? 0).toFixed(1)}%`}
          sub="dollar-weighted: total PIK ÷ total NII" color="#6366f1" />
        <StatCard label="Dividend not covered in cash" value={`${nUncovered} of ${latest.length}`}
          sub={`BDCs whose NII ex-PIK is below distributions · ${nReportedUncovered} on reported NII`} color="#ef4444" />
        <StatCard label="Most PIK-dependent" value={top ? `${top.ticker} ${(top.pik_pct_nii ?? 0).toFixed(0)}%` : "—"}
          sub={top ? `cash coverage ${(top.cov_ex_pik ?? 0).toFixed(2)}x vs ${(top.nii_cov ?? 0).toFixed(2)}x reported` : undefined}
          color="#ef4444" />
      </div>

      <section id="pik-share" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          How much of NII is PIK?{" "}
          <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· trailing four quarters, by BDC</span>
        </h2>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(Object.keys(HEAT) as HeatMetric[]).map((k) => (
            <button key={k} onClick={() => setMetric(k)}
              className="text-xs px-2.5 py-1 rounded border transition-all"
              style={{
                background: metric === k ? "rgba(99,102,241,0.15)" : "transparent",
                borderColor: metric === k ? "#6366f1" : "#2d2d45",
                color: metric === k ? "#a5b4fc" : "#9ca3af",
              }}>
              {HEAT[k].label}
            </button>
          ))}
        </div>
        <CreditHeatmap
          title={HEAT[metric].label}
          description={HEAT[metric].desc + " Rows sorted by the latest PIK share of NII."}
          periods={periods}
          tickers={tickers}
          cellMap={cellMap}
          thresholds={HEAT[metric].thresholds}
          csvFilename={`pik-income-${metric}`}
        />
        <div className="mt-4">
          <IncomeTrendChart
            rows={incomeTtm}
            universe={incomeUniverse}
            metric="pik_pct_nii"
            defaultTickers={trendDefault}
            title="PIK as % of NII over time"
            subtitle="The five most PIK-dependent BDCs today against the median BDC. Toggle any BDC on or off."
          />
        </div>
      </section>

      <section id="defaults" className="mb-12 scroll-mt-6">
        <OutcomeEvidenceNotice title="Default rates pending outcome validation">
          Disappearance from a filing and a low last reported mark do not establish a default or a realized loss.
          The former hard and shadow default estimates are withheld while event evidence and observation coverage
          are reviewed. <a className="text-indigo-300 underline" href="/non-accruals">Reported non-accruals</a> and
          <a className="text-indigo-300 underline" href="/vintage"> observed cohort bounds</a> remain available with
          their coverage limits.
        </OutcomeEvidenceNotice>
      </section>

      <section id="coverage" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Can the dividend be covered in cash?{" "}
          <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· reported vs cash coverage, and a PIK stress</span>
        </h2>
        <DividendCoverageTable rows={latest} />
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
          <IncomeTrendChart
            rows={incomeTtm}
            universe={incomeUniverse}
            metric="cov_ex_pik"
            defaultTickers={coverageDefault}
            title="Cash coverage over time (NII ex-PIK ÷ distributions)"
            subtitle="Below the red line the dividend needs PIK — income not yet received — to be covered."
          />
          <IncomeMixChart rows={incomeQuarterly} defaultTicker={worstCash[0]?.ticker ?? "ARCC"} />
        </div>
      </section>

      <section id="pik-ledger" className="mb-12 scroll-mt-6">
        <OutcomeEvidenceNotice title="PIK collection and loss allocation pending validation">
          PIK income is reported above. Allocations to collected, lost, or still outstanding are withheld:
          a loan leaving the schedule, even near par, does not establish cash proceeds or how much PIK was recovered.
          Separately reported PIK collections remain available where the issuer discloses them.
        </OutcomeEvidenceNotice>
      </section>

      <section id="dividend-support" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Dividend support{" "}
          <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· coverage, cushions and NAV trend</span>
        </h2>
        <DividendSupportTable rows={dividendSupport} />
        <div className="mt-4">
          <NavPerShareChart points={navPerShare} defaultTickers={navDefault} />
        </div>
        <p className="text-xs mt-3 max-w-4xl" style={{ color: "#6b6b88" }}>
          PIK collected in cash is shown only where a BDC reports it separately on its cash-flow statement
          {arcc && arcc.pik_collected_m != null ? ` (ARCC: $${arcc.pik_collected_m.toFixed(0)}m of $${arcc.pik_m.toFixed(0)}m over the last four quarters)` : ""};
          elsewhere it is folded into repayment proceeds. Spillover comes from each BDC&apos;s 10-K tax note (XBRL),
          so it is as of the last fiscal year end; TSLX and HTGC do not tag it. NAV per share is split-adjusted;
          the non-traded BDCs (ADS, ASIF, BCRED, OCIC) use their Class I NAV.
        </p>
      </section>

      <section id="method" className="mb-12 scroll-mt-6">
        <div className="rounded-xl border p-5 text-xs leading-relaxed" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#8b8ba8" }}>
          <div className="text-sm font-semibold text-white mb-2">How to read it — and what it does not say</div>
          <p className="mb-2">
            <span className="text-white">PIK income is not a realized outcome.</span>{" "}Booking PIK does not
            establish a loss or a later cash collection. Some filers disclose PIK collections separately
            {arcc && arcc.pik_collected_m != null
              ? ` (ARCC reported $${arcc.pik_collected_m.toFixed(0)}m collected against $${arcc.pik_m.toFixed(0)}m accrued over the last four quarters)`
              : ""}. These are period flows and need not relate to the same loans or accrual years.
            Cash coverage below 1.0x means NII excluding PIK is below declared distributions; it does not predict
            repayment, default, or a dividend cut. Estimated recapture from disappearances and refinancings is withheld.
          </p>
          <p className="mb-2">
            <span className="text-white">Accretion is shown but not in the headline.</span>{" "}Net accretion of
            discount unwinds fees the lender collected in cash when it funded the loan, and a steady
            portfolio keeps replacing them, so stripping it out as well (the &quot;ex-PIK &amp; accretion&quot;
            column) is the harsh lower bound, not the central case.
          </p>
          <p className="mb-2">
            <span className="text-white">Not every shortfall is a warning.</span>{" "}MAIN pays supplemental
            dividends out of realised gains rather than NII, and the non-traded BDCs (BCRED, ADS, ASIF, OCIC)
            often distribute more than NII by policy, so their reported coverage sits below 1.0x without
            implying a cut. Compare a BDC with its own history and with peers of the same type.
          </p>
          <p>
            <span className="text-white">Definitions and caveats.</span>{" "}NII is the reported figure after
            income and excise tax. Distributions are declared, including shares issued under dividend
            reinvestment. PIK includes PIK dividends on preferred and equity positions. A few filers print
            PIK differently and are tagged in the table: BBDC to FY2021 and OCSL from FY2018 print PIK
            net of cash collected (&quot;net&quot;, which understates gross PIK), and NMFC prints only a
            broader non-cash investment income line (&quot;broad&quot;). Values are as first reported in
            each quarter&apos;s own filing. Coverage runs from 2014, or a BDC&apos;s first filing, to{" "}
            {incomeMeta.latest_period}; {incomeMeta.n_bdcs} BDCs.
          </p>
        </div>
      </section>
    </div>
  );
}

function shiftYears(p: string, k: number): string {
  return `${Number(p.slice(0, 4)) + k}${p.slice(4)}`;
}
