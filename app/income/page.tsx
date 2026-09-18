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
import PikLedgerTable from "@/components/PikLedgerTable";
import PikLedgerYearChart from "@/components/PikLedgerYearChart";
import PikStockChart from "@/components/PikStockChart";
import { pikLedger, pikLedgerByYear, pikLedgerQuarterly, pikLedgerMeta } from "@/data/pik_ledger";

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
  // PIK ledger: the BDCs with the most uncollected PIK relative to their book
  // open the stock chart; the seasoned-year sentence uses the year six years
  // before the latest one, old enough for most of its PIK to have resolved.
  const stockDefault = [...pikLedger]
    .sort((a, b) => (b.unresolved_pct_book ?? 0) - (a.unresolved_pct_book ?? 0))
    .slice(0, 4).map((r) => r.ticker);
  const arccLedger = pikLedger.find((r) => r.ticker === "ARCC");
  const ledgerYear = pikLedgerMeta.latest_period.slice(0, 4);
  const seasonedYear = String(Number(ledgerYear) - 6);
  const seasoned = pikLedgerByYear.find((r) => r.year === seasonedYear);
  const inBookPct = (pikLedgerMeta.pooled_in_book_performing_pct ?? 0) + (pikLedgerMeta.pooled_in_book_impaired_pct ?? 0);
  const windowYear = pikLedgerMeta.window_start.slice(0, 4);
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

      <section id="pik-ledger" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Where did the PIK go?{" "}
          <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· the PIK booked since {windowYear}, followed loan by loan</span>
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard label={`PIK booked since ${windowYear}`} value={`$${(pikLedgerMeta.pooled_accrued_bn ?? 0).toFixed(1)}bn`}
            sub={`${pikLedgerMeta.n_bdcs} BDCs, from the cash-flow statements`} color="#a5b4fc" highlight />
          <StatCard label="Collected on exits" value={`${(pikLedgerMeta.pooled_collected_pct ?? 0).toFixed(0)}%`}
            sub="repaid as principal when the loan left — a floor" color="#86efac" />
          <StatCard label="Still in the book" value={`${inBookPct.toFixed(0)}%`}
            sub={`${(pikLedgerMeta.pooled_in_book_impaired_pct ?? 0).toFixed(0)} points of it in impaired loans`} color="#fcd34d" />
          <StatCard label="Lost" value={`${(pikLedgerMeta.pooled_lost_pct ?? 0).toFixed(0)}%`}
            sub="unrecovered on exits below par" color="#fca5a5" />
        </div>
        <PikLedgerYearChart rows={pikLedgerByYear} latestYear={ledgerYear} />
        <div className="mt-4">
          <PikLedgerTable rows={pikLedger} />
        </div>
        <div className="mt-4">
          <PikStockChart points={pikLedgerQuarterly} defaultTickers={stockDefault} />
        </div>
        <div className="rounded-xl border p-5 mt-4 text-xs leading-relaxed" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#8b8ba8" }}>
          <div className="text-sm font-semibold text-white mb-2">How this is measured — and why it is a floor</div>
          <p className="mb-2">
            A BDC that books a third of its NII as PIK for years is only fine if that PIK keeps turning into cash later:
            the loan is repaid or refinanced and the capitalized PIK comes back as principal. The cash-flow statement gives
            the PIK booked each quarter; the schedule of investments gives every loan&apos;s PIK rate. Rate × principal
            reproduces the statement figure closely for most BDCs
            {arccLedger?.loan_coverage_of_statement != null ? ` (ARCC: ${(100 * arccLedger.loan_coverage_of_statement).toFixed(0)}% of it)` : ""},
            so each quarter&apos;s statement PIK is allocated to the loans it accrued on, and each loan is followed to its
            outcome.
          </p>
          <p className="mb-2">
            <span className="text-white">Collected is measured on exits only.</span>{" "}A loan that left the book with
            no successor position at a mark of 97¢ or better repaid its capitalized PIK as principal. PIK paid in cash
            while a loan stays on the book — partial paydowns, PIK toggles switching to cash — is invisible in the
            schedule, so the collected share is a floor
            {arccLedger?.reported_collected_last4q_m != null
              ? `: ARCC reports $${arccLedger.reported_collected_last4q_m.toFixed(0)}m of PIK collected over the last four quarters, of which $${arccLedger.collected_last4q_m.toFixed(0)}m shows up here as exits`
              : ""}.
            &quot;Refinanced&quot; loans left at par while the borrower kept a position at the same BDC: the PIK was rolled
            into the new loan, or repaid from its proceeds — the schedule cannot tell which, so it is kept separate.
          </p>
          <p>
            <span className="text-white">Reading the maturation curve.</span>{" "}
            {seasoned
              ? `Of the PIK booked in ${seasonedYear}, ${(seasoned.collected_pct ?? 0).toFixed(0)}% has been collected, ${(seasoned.lost_pct ?? 0).toFixed(0)}% lost and ${((seasoned.in_book_performing_pct ?? 0) + (seasoned.in_book_impaired_pct ?? 0)).toFixed(0)}% is still in the book six years later. `
              : ""}
            The newest PIK is almost all still in the book, which is expected; the question is whether the older years
            keep converting. PIK booked before {windowYear} is not tracked, so the uncollected stock is a floor in each
            BDC&apos;s early years. NMFC (†) prints only a broader non-cash income line, so its loan-level dollars are
            used unscaled; OCSL&apos;s statement PIK is net of cash collected, a floor.
          </p>
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
              : ""}. The &quot;Where did the PIK go?&quot; section above follows every PIK loan since {windowYear} to
            see how much actually came back. Cash coverage below 1.0x means
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
