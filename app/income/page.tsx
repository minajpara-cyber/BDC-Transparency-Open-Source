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
import CreditNav from "@/components/CreditNav";
import StatCard from "@/components/StatCard";
import CreditHeatmap from "@/components/CreditHeatmap";
import IncomeTrendChart from "@/components/IncomeTrendChart";
import DividendCoverageTable from "@/components/DividendCoverageTable";
import IncomeMixChart from "@/components/IncomeMixChart";
import { incomeTtm, incomeQuarterly, incomeUniverse, incomeMeta } from "@/data/income_coverage";
import DefaultRateChart from "@/components/DefaultRateChart";
import DefaultRateTable from "@/components/DefaultRateTable";
import DividendSupportTable from "@/components/DividendSupportTable";
import NavPerShareChart from "@/components/NavPerShareChart";
import { defaultRates, defaultRateUniverse } from "@/data/default_rate";
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
  const drLatest = useMemo(() => {
    const m = new Map<string, (typeof defaultRates)[number]>();
    for (const r of defaultRates) {
      const cur = m.get(r.ticker);
      if (!cur || r.period_end > cur.period_end) m.set(r.ticker, r);
    }
    return [...m.values()];
  }, []);
  const drU = defaultRateUniverse[defaultRateUniverse.length - 1];
  const drU1y = defaultRateUniverse.find((u) => u.period_end === shiftYears(drU.period_end, -1));
  const drPoolN = defaultRateUniverse.filter((u) => u.period_end >= "2019-12-31").map((u) => u.n_bdcs);
  const drPool = { min: Math.min(...drPoolN), last: drU.n_bdcs };
  const navDefault = [...dividendSupport].sort((a, b) => (a.nav_chg_3y ?? 0) - (b.nav_chg_3y ?? 0))
    .slice(0, 3).map((r) => r.ticker).concat(["MAIN", "HTGC"]);
  const trendDefault = tickers.slice(0, 5);
  const coverageDefault = worstCash.map((r) => r.ticker).concat(tickers.slice(-2));

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CreditNav />
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-2xl font-bold text-white">PIK income, defaults &amp; dividend coverage</h1>
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
        <h2 className="text-lg font-semibold text-white mb-3">
          Default rate{" "}
          <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· including the defaults that do not look like defaults</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard label="Shadow default rate — last 12 months" value={`${drU.default_rate.toFixed(1)}%`}
            sub={drU1y ? `${drU1y.default_rate.toFixed(1)}% a year earlier · all BDCs pooled, by $` : "all BDCs pooled, by $"}
            color="#f97316" highlight />
          <StatCard label="Hard default rate" value={`${drU.hard_rate.toFixed(1)}%`}
            sub="new non-accruals + distressed exits only" color="#ef4444" />
          <StatCard label="Shadow rate by borrower count" value={`${drU.count_rate.toFixed(1)}%`}
            sub={`hard rate by count ${drU.count_rate_hard.toFixed(1)}%`} color="#fde68a" />
          <StatCard label="Non-accrual stock today" value={`${drU.na_stock_pct.toFixed(1)}%`}
            sub="point in time, % of cost — not a rate" color="#6b7280" />
        </div>
        <DefaultRateChart data={defaultRateUniverse} />
        <div className="mt-4">
          <DefaultRateTable rows={drLatest} />
        </div>
        <div className="rounded-xl border p-5 mt-4 text-xs leading-relaxed" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#8b8ba8" }}>
          <div className="text-sm font-semibold text-white mb-2">Why published default rates disagree</div>
          <p className="mb-2">
            The same loan book can honestly produce a &quot;default rate&quot; anywhere from{" "}
            {Math.min(drU.na_stock_pct, drU.hard_rate, drU.count_rate_hard).toFixed(1)}% to{" "}
            {Math.max(drU.default_rate, drU.count_rate).toFixed(1)}%, depending on five choices. <span className="text-white">Stock or flow:</span>{" "}the share of the book
            on non-accrual today ({drU.na_stock_pct.toFixed(1)}%) is not a default rate; the share of performing
            loans that defaulted over a year is. <span className="text-white">What counts:</span>{" "}hard defaults
            ({drU.hard_rate.toFixed(1)}%) versus a &quot;shadow&quot; rate that adds lenders&apos; workarounds —
            switching a struggling borrower to PIK, extending its maturity at a distressed mark, cutting principal,
            swapping debt for equity ({drU.default_rate.toFixed(1)}%). <span className="text-white">Dollars or
            borrowers:</span>{" "}a count-based rate ({drU.count_rate.toFixed(1)}%) weights a $5m loan like a $500m
            one. <span className="text-white">Whose book:</span>{" "}BDCs, private credit funds and broadly syndicated
            loans have different borrowers. <span className="text-white">Timing:</span>{" "}lenders place loans on
            non-accrual at different points in a borrower&apos;s decline.
          </p>
          <p>
            <span className="text-white">How this one is built.</span> Every borrower that was performing twelve months
            earlier is followed through the year at the same BDC; it counts once, under its first event. A PIK
            amendment counts only when PIK becomes at least a fifth of the coupon after at least two cash-pay quarters,
            and a modification only when it touches at least a quarter of the borrower&apos;s debt at that BDC. MFIC
            reports non-accruals only in aggregate, so its rate is partial. The chart starts at the end of 2019; the
            pool holds as few as {drPool.min} BDCs in the early years and {drPool.last} today, so early points rest
            on fewer books. The 2020 peak is the COVID wave of PIK amendments.
          </p>
        </div>
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

      <section id="dividend-support" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Dividend support{" "}
          <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· cushions, NAV trend and warning signs</span>
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
            <span className="text-white">PIK is not lost income.</span>{" "}Most PIK is eventually paid when the
            loan is refinanced or repaid, and a few filers show those collections separately
            {arcc && arcc.pik_collected_m != null
              ? ` (ARCC collected $${arcc.pik_collected_m.toFixed(0)}m of PIK in cash against $${arcc.pik_m.toFixed(0)}m accrued over the last four quarters)`
              : ""}. Cash coverage below 1.0x means
            the dividend currently relies on income that will arrive later — or not at all if the borrower
            fails. That is the risk this tab sizes; the stress slider and the severe-PIK column put numbers
            on it. Severe PIK is PIK making up more than half a loan&apos;s coupon, or all of it — the
            borrowers least likely to be paying for choice.
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
