"use client";
// Credit > PIK & dividends. How much of each BDC's reported earnings arrives as
// PIK (interest paid by growing the loan rather than in cash), whether the
// dividend is covered by the income that actually arrived in cash, how often
// borrowers default, and where the PIK booked over the years ended up.
//
// Data: data/income_coverage.ts (bdc_inventory/scripts/91). NII and total
// investment income come off each filing's statement of operations,
// distributions off its statement of changes in net assets, and PIK / accretion
// off its CASH-FLOW statement — the non-cash adjustments every BDC must print to
// reconcile net increase in net assets to operating cash. Default rates come
// from data/default_rate.ts (scripts/92), the PIK ledger from
// data/pik_ledger.ts (scripts/94) and dividend support from
// data/dividend_support.ts (scripts/93).
import { useMemo, useState } from "react";
import CreditNav from "@/components/CreditNav";
import StatCard from "@/components/StatCard";
import CreditHeatmap from "@/components/CreditHeatmap";
import IncomeTrendChart from "@/components/IncomeTrendChart";
import DividendCoverageTable from "@/components/DividendCoverageTable";
import SeverePikTypeTable from "@/components/SeverePikTypeTable";
import IncomeMixChart from "@/components/IncomeMixChart";
import { incomeTtm, incomeQuarterly, incomeUniverse, incomeMeta, type IncomeTtmRow } from "@/data/income_coverage";
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
import { isFullyObserved, latestWindowByTicker, withheldReason } from "@/lib/defaultRatePublication";
import { recaptureDisplay } from "@/lib/pikRecapture";
import { joinList } from "@/lib/joinList";

type HeatMetric = "pik_pct_nii" | "net_pik_pct_nii" | "pik_pct_tii" | "noncash_pct_nii" | "gap";

// Which BDCs disclose PIK collected in cash, which print PIK already net of
// collections, and when the estimated recapture starts — all read off the data
// so the text follows the next export.
const LATEST_INCOME = (() => {
  const m = new Map<string, IncomeTtmRow>();
  for (const r of incomeTtm) {
    const cur = m.get(r.ticker);
    if (!cur || r.period_end > cur.period_end) m.set(r.ticker, r);
  }
  return [...m.values()];
})();
const REPORTED_RECAPTURE = LATEST_INCOME.filter((r) => r.recapture_src === "reported").map((r) => r.ticker).sort();
const NET_BASIS_RECAPTURE = LATEST_INCOME.filter((r) => r.recapture_src === "net_basis").map((r) => r.ticker).sort();
const ESTIMATE_START = incomeTtm.filter((r) => r.recapture_src === "estimated")
  .map((r) => r.period_end).sort()[0] ?? null;
const NET_TREND_FROM = incomeUniverse.filter((u) => u.net_pik_pct_nii_median != null)
  .map((u) => u.period_end).sort()[0] ?? ESTIMATE_START ?? undefined;

const HEAT: Record<HeatMetric, { label: string; desc: string; thresholds: [number, number, number] }> = {
  pik_pct_nii: {
    label: "PIK % of NII",
    desc: "PIK income as a share of net investment income, trailing four quarters. Colored 10% → 25% → 40%+.",
    thresholds: [10, 25, 40],
  },
  net_pik_pct_nii: {
    label: "PIK net of recapture, % of NII",
    desc: "PIK income less the PIK that came back as cash within the same four quarters, as a share of NII. "
      + (REPORTED_RECAPTURE.length ? `${joinList(REPORTED_RECAPTURE)} report their PIK collections (plain cells)` : "No BDC reports its PIK collections")
      + (NET_BASIS_RECAPTURE.length ? `; ${joinList(NET_BASIS_RECAPTURE)} print${NET_BASIS_RECAPTURE.length === 1 ? "s" : ""} PIK already net of collections (plain cells)` : "")
      + ". For the rest the recapture is an estimate from loans that left the book or were refinanced at par (hatched cells"
      + (ESTIMATE_START ? `, from ${ESTIMATE_START.slice(0, 7)}` : "")
      + "). An estimate larger than the PIK booked is not shown. Colored 5% → 12% → 20%+.",
    thresholds: [5, 12, 20],
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

const isRecaptureEstimate = (r: IncomeTtmRow) => recaptureDisplay(r).estimate;

export default function IncomePage() {
  const [metric, setMetric] = useState<HeatMetric>("pik_pct_nii");

  const latest = LATEST_INCOME;

  const periods = useMemo(
    () => Array.from(new Set(incomeTtm.map((r) => r.period_end))).filter((p) => p >= "2015-12-31").sort(),
    [],
  );
  const tickers = useMemo(
    () => [...latest].sort((a, b) => (b.pik_pct_nii ?? -1) - (a.pik_pct_nii ?? -1)).map((r) => r.ticker),
    [latest],
  );
  const cellMap = useMemo(() => {
    const m = new Map<string, { value: number | null; reliable?: boolean; estimate?: boolean; note?: string }>();
    for (const r of incomeTtm) {
      if (metric === "net_pik_pct_nii") {
        const d = recaptureDisplay(r);
        m.set(`${r.ticker}|${r.period_end}`, { value: d.netPikPctNii, estimate: d.estimate, note: d.note || undefined });
        continue;
      }
      const v = metric === "gap"
        ? (r.cov_ex_pik == null ? null : 100 * (1 - r.cov_ex_pik))
        : r[metric];
      m.set(`${r.ticker}|${r.period_end}`, { value: v ?? null });
    }
    return m;
  }, [metric]);
  // Net-of-recapture trend: estimates that fail the sanity check are dropped.
  const netTrendRows = useMemo(
    () => incomeTtm.map((r) => ({ ...r, net_pik_pct_nii: recaptureDisplay(r).netPikPctNii })),
    [],
  );

  // headline stats
  const uLatest = incomeUniverse[incomeUniverse.length - 1];
  const u3y = incomeUniverse.find((u) => u.period_end === shiftYears(uLatest.period_end, -3));
  const u2019 = incomeUniverse.find((u) => u.period_end === "2019-12-31");
  const top = [...latest].sort((a, b) => (b.pik_pct_nii ?? 0) - (a.pik_pct_nii ?? 0))[0];
  const nUncovered = latest.filter((r) => (r.cov_ex_pik ?? 9) < 1).length;
  const nReportedUncovered = latest.filter((r) => (r.nii_cov ?? 9) < 1).length;
  const worstCash = [...latest].sort((a, b) => (a.cov_ex_pik ?? 9) - (b.cov_ex_pik ?? 9)).slice(0, 3);
  const arcc = latest.find((r) => r.ticker === "ARCC");

  // Default rates: each BDC's latest window; only fully observed ones carry numbers.
  const drLatest = useMemo(() => latestWindowByTicker(defaultRates), []);
  const drWithheld = drLatest.filter((r) => !isFullyObserved(r)).sort((a, b) => a.ticker.localeCompare(b.ticker));
  const drUniverse = useMemo(
    () => [...defaultRateUniverse].sort((a, b) => a.period_end.localeCompare(b.period_end)), [],
  );
  const drU = drUniverse[drUniverse.length - 1];
  const drU1y = drU ? drUniverse.find((u) => u.period_end === shiftYears(drU.period_end, -1)) : undefined;
  const drFirst = drUniverse[0];
  const drPoolSizes = drUniverse.map((u) => u.n_bdcs);
  const drPoolMin = drPoolSizes.length ? Math.min(...drPoolSizes) : null;
  const drAll = drU ? [drU.na_stock_pct, drU.hard_rate, drU.count_rate_hard, drU.default_rate, drU.count_rate] : [];

  // PIK ledger: the BDCs with the most uncollected PIK relative to their book
  // open the stock chart; the seasoned-year sentence uses the year six years
  // before the latest one, old enough for most of its PIK to have resolved.
  const stockDefault = [...pikLedger]
    .sort((a, b) => (b.unresolved_pct_book ?? 0) - (a.unresolved_pct_book ?? 0))
    .slice(0, 4).map((r) => r.ticker);
  const ledgerYear = pikLedgerMeta.latest_period.slice(0, 4);
  const seasonedYear = String(Number(ledgerYear) - 6);
  const seasoned = pikLedgerByYear.find((r) => r.year === seasonedYear);
  const inBookPct = (pikLedgerMeta.pooled_in_book_performing_pct ?? 0) + (pikLedgerMeta.pooled_in_book_impaired_pct ?? 0)
    + (pikLedgerMeta.pooled_in_book_unknown_pct ?? 0);
  const windowYear = pikLedgerMeta.window_start.slice(0, 4);
  const scaledQuarters = pikLedgerMeta.statement_scaling_eligible_quarters ?? null;
  const totalQuarters = scaledQuarters == null ? null
    : scaledQuarters + (pikLedgerMeta.statement_scaling_ineligible_quarters ?? 0);
  const collectionChecks = pikLedger
    .filter((r) => r.reported_collected_last4q_m != null && r.reported_collected_last4q_m > 0)
    .map((r) => `${r.ticker} $${r.collected_last4q_m.toFixed(0)}m estimated against $${(r.reported_collected_last4q_m ?? 0).toFixed(0)}m reported`);

  const navDefault = [...dividendSupport].sort((a, b) => (a.nav_chg_3y ?? 0) - (b.nav_chg_3y ?? 0))
    .slice(0, 3).map((r) => r.ticker).concat(["MAIN", "HTGC"]);
  const trendDefault = tickers.slice(0, 5);
  const coverageDefault = worstCash.map((r) => r.ticker).concat(tickers.slice(-2));
  const netMode = metric === "net_pik_pct_nii";

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
            key={netMode ? "net" : "gross"}
            rows={netMode ? netTrendRows : incomeTtm}
            universe={incomeUniverse}
            metric={netMode ? "net_pik_pct_nii" : "pik_pct_nii"}
            from={netMode ? NET_TREND_FROM : undefined}
            isEstimate={netMode ? isRecaptureEstimate : undefined}
            medianLabel={netMode ? "Universe median (mostly estimates)" : undefined}
            defaultTickers={trendDefault}
            title={netMode ? "PIK net of recapture as % of NII over time" : "PIK as % of NII over time"}
            subtitle={netMode
              ? `PIK income less the PIK that came back as cash in the same four quarters.${REPORTED_RECAPTURE.length ? ` ${joinList(REPORTED_RECAPTURE)} report their collections;` : ""} the rest are estimates (the tooltip says "estimate"). The five most PIK-dependent BDCs today against the median BDC.`
              : "The five most PIK-dependent BDCs today against the median BDC. Toggle any BDC on or off."}
          />
        </div>
      </section>

      <section id="defaults" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Default rate{" "}
          <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· including the defaults that do not look like defaults</span>
        </h2>
        {drU ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatCard label="Shadow default rate — last 12 months" value={`${drU.default_rate.toFixed(1)}%`}
              sub={`${drU1y ? `${drU1y.default_rate.toFixed(1)}% a year earlier · ` : ""}${drU.n_bdcs} BDCs pooled, by $ · adds term changes (inferred)`}
              color="#f97316" highlight />
            <StatCard label="Hard default rate" value={`${drU.hard_rate.toFixed(1)}%`}
              sub={`new non-accruals ${drU.rate_non_accrual.toFixed(1)}% + distressed exits ${drU.rate_distressed_exit.toFixed(1)}% (inferred from exit mark)`}
              color="#ef4444" />
            <StatCard label="Shadow rate by borrower count" value={`${drU.count_rate.toFixed(1)}%`}
              sub={`hard rate by count ${drU.count_rate_hard.toFixed(1)}%`} color="#fde68a" />
            <StatCard label="Non-accrual stock, debt only" value={`${drU.na_stock_pct.toFixed(1)}%`}
              sub="point in time, % of debt cost — not a rate" color="#6b7280" />
          </div>
        ) : null}
        <DefaultRateChart data={drUniverse} />
        <div className="mt-4">
          <DefaultRateTable rows={drLatest} history={defaultRates} />
        </div>
        <div className="rounded-xl border p-5 mt-4 text-xs leading-relaxed" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#8b8ba8" }}>
          <div className="text-sm font-semibold text-white mb-2">Why published default rates disagree</div>
          {drU && (
            <p className="mb-2">
              The same loan book can honestly produce a &quot;default rate&quot; anywhere from{" "}
              {Math.min(...drAll).toFixed(1)}% to {Math.max(...drAll).toFixed(1)}%, depending on five
              choices. <span className="text-white">Stock or flow:</span>{" "}the share of the book on non-accrual
              today ({drU.na_stock_pct.toFixed(1)}%) is not a default rate; the share of performing loans that
              defaulted over a year is. <span className="text-white">What counts:</span>{" "}hard defaults
              ({drU.hard_rate.toFixed(1)}%) versus a &quot;shadow&quot; rate that adds lenders&apos; workarounds —
              switching a struggling borrower to PIK, extending its maturity at a distressed mark, cutting
              principal, swapping debt for equity ({drU.default_rate.toFixed(1)}%). <span className="text-white">Dollars
              or borrowers:</span>{" "}a count-based rate ({drU.count_rate.toFixed(1)}%) weights a $5m loan like a
              $500m one. <span className="text-white">Whose book:</span>{" "}BDCs, private credit funds and broadly
              syndicated loans have different borrowers. <span className="text-white">Timing:</span>{" "}lenders place
              loans on non-accrual at different points in a borrower&apos;s decline.
            </p>
          )}
          <p className="mb-2">
            <span className="text-white">How this one is built.</span>{" "}Every borrower that was performing twelve
            months earlier is followed through the year at the same BDC; it counts once, under its first event.
            New non-accruals are observed in the filings. The other legs are inferred, not disclosed:{" "}
            <span className="text-white">distressed exits</span>{" "}are inferred from the exit mark (the loan left
            the book below 85¢, or after a mark below 80¢, without going non-accrual, or a marked-down loan was
            swapped for new equity or much smaller or junior debt — a low last mark is not proof of a loss, and some
            of these may be sales at a discount; a piece repaid or refinanced while the borrower keeps its debt at the
            BDC is not counted; CLO and other structured-finance notes are left out altogether), and{" "}
            <span className="text-white">restructurings and PIK amendments</span>{" "}are inferred from changes in
            the loan&apos;s terms between filings. A PIK amendment counts only when PIK becomes at least a fifth of
            the coupon after at least two cash-pay quarters, and a modification only when it touches at least a
            quarter of the borrower&apos;s debt at that BDC.
          </p>
          <p>
            <span className="text-white">Which BDCs are in it.</span>{" "}A BDC&apos;s twelve months count only when
            every loan&apos;s non-accrual status is known at the start and in every quarter of the year — an unknown
            status is never treated as &quot;performing&quot;.
            {drU ? ` The latest pooled figure covers ${drU.n_bdcs} of ${drLatest.length} BDCs.` : ""}
            {drWithheld.length > 0
              ? ` Withheld: ${drWithheld.map((r) => `${r.ticker} (${withheldReason(r.window_observation_status)})`).join("; ")}.`
              : ""}
            {drFirst
              ? ` The pooled line starts with the twelve months to ${drFirst.period_end}, the first quarter with enough fully observed BDCs to pool. The pool holds as few as ${drPoolMin} BDCs in the early points and ${drU?.n_bdcs ?? drFirst.n_bdcs} in the latest, so early points rest on fewer books.`
              : " No quarter yet has enough fully observed BDCs to pool."}
          </p>
        </div>
      </section>

      <section id="severe-pik" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Severe PIK, by type{" "}
          <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· why the coupon is paid in kind, latest quarter</span>
        </h2>
        <SeverePikTypeTable rows={latest} />
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-3">
          <StatCard label={`PIK booked since ${windowYear}`} value={`$${(pikLedgerMeta.pooled_accrued_bn ?? 0).toFixed(1)}bn`}
            sub={`${pikLedgerMeta.n_bdcs} BDCs · allocated loan by loan from disclosed PIK rates`} color="#a5b4fc" highlight />
          <StatCard label="Collected — estimate" value={`${(pikLedgerMeta.pooled_collected_pct ?? 0).toFixed(0)}%`}
            sub="loans repaid at 97¢ or better, or refinanced at par" color="#86efac" />
          <StatCard label="Still in the book — observed" value={`${inBookPct.toFixed(0)}%`}
            sub={`${(pikLedgerMeta.pooled_in_book_impaired_pct ?? 0).toFixed(0)} points of it in impaired loans`
              + ((pikLedgerMeta.pooled_in_book_unknown_pct ?? 0) >= 0.5
                ? ` · ${(pikLedgerMeta.pooled_in_book_unknown_pct ?? 0).toFixed(0)} in loans whose PIK status is unknown` : "")}
            color="#fcd34d" />
          <StatCard label="Lost — estimated from last mark" value={`${(pikLedgerMeta.pooled_lost_pct ?? 0).toFixed(0)}%`}
            sub="exits below par, valued at the last reported mark" color="#fca5a5" />
        </div>
        <p className="text-xs mb-4 max-w-5xl" style={{ color: "#6b6b88" }}>
          Coverage: PIK status is shown in the filings for{" "}
          {(pikLedgerMeta.latest_pik_observation_coverage_pct ?? 0).toFixed(1)}% of the book&apos;s cost in the
          latest quarter and {(pikLedgerMeta.window_pik_observation_coverage_pct ?? 0).toFixed(1)}% over the whole
          window; cost with unknown PIK status is left out of the dollars.
          {scaledQuarters != null && totalQuarters
            ? ` Each loan's PIK is its disclosed PIK rate × principal; it is scaled to the cash-flow statement's PIK in ${scaledQuarters} of ${totalQuarters} BDC-quarters (those where at least ${pikLedgerMeta.statement_scaling_min_coverage_pct ?? 97}% of the book's cost has a known PIK status and rate), which cover ${pikLedgerMeta.pooled_statement_scaled_pct_of_accrued ?? "—"}% of the PIK dollars.`
            : ""}
          {pikLedgerMeta.tieout_median_coverage != null
            ? ` Across BDCs the loan-level figure reproduces a median ${(100 * pikLedgerMeta.tieout_median_coverage).toFixed(0)}% of the statement PIK.`
            : ""}
        </p>
        <PikLedgerYearChart rows={pikLedgerByYear} latestYear={ledgerYear} />
        <div className="mt-4">
          <PikLedgerTable rows={pikLedger} />
        </div>
        <div className="mt-4">
          <PikStockChart points={pikLedgerQuarterly} defaultTickers={stockDefault} />
        </div>
        <div className="rounded-xl border p-5 mt-4 text-xs leading-relaxed" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#8b8ba8" }}>
          <div className="text-sm font-semibold text-white mb-2">How this is measured — what is observed and what is estimated</div>
          <p className="mb-2">
            A BDC that books a third of its NII as PIK for years is only fine if that PIK keeps turning into cash
            later: the loan is repaid or refinanced and the capitalized PIK comes back as principal. The cash-flow
            statement gives the PIK booked each quarter; the schedule of investments gives every loan&apos;s PIK
            rate. Each loan&apos;s PIK is followed to what happened to it.{" "}
            <span className="text-white">Still in the book</span>{" "}is observed: the loan is in the latest
            schedule, still paying PIK, back on cash-pay, or impaired (non-accrual, marked under 80¢, or
            restructured).
          </p>
          <p className="mb-2">
            <span className="text-white">Collected is an estimate.</span>{" "}A loan that left the book at a mark
            of 97¢ or better, or was refinanced at par at the same BDC, is taken to have repaid its capitalized PIK
            as principal. PIK paid in cash while a loan stays on the book — partial paydowns, PIK toggles switching
            to cash — is not visible in the schedule, and an exit near par is not proof of cash received, so the
            estimate can be too low or too high.
            {collectionChecks.length > 0
              ? ` Where a BDC reports its PIK collections the two can be compared for the last four quarters: ${collectionChecks.join("; ")}.`
              : ""}{" "}
            <span className="text-white">Lost is estimated from the last mark:</span>{" "}the part of a below-par
            exit that the last reported fair value says was not recovered — not a sale price.
          </p>
          <p>
            <span className="text-white">Reading the maturation curve.</span>{" "}
            {seasoned
              ? `Of the PIK booked in ${seasonedYear}, an estimated ${(seasoned.collected_pct ?? 0).toFixed(0)}% has been collected and ${(seasoned.lost_pct ?? 0).toFixed(0)}% lost, and ${((seasoned.in_book_performing_pct ?? 0) + (seasoned.in_book_impaired_pct ?? 0) + (seasoned.in_book_unknown_pct ?? 0)).toFixed(0)}% is still in the book six years later. `
              : ""}
            The newest PIK is almost all still in the book, which is expected; the question is whether the older
            years keep converting. PIK booked before {windowYear}{" "}is not tracked, so the uncollected stock is a
            floor in each BDC&apos;s early years. NMFC (†) prints only a broader non-cash income line, so its
            loan-level dollars are used as they are; OCSL&apos;s statement PIK is net of cash collected.
          </p>
        </div>
      </section>

      <section id="dividend-support" className="mb-12 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">
          Dividend support{" "}
          <span className="text-xs font-normal" style={{ color: "#8b8ba8" }}>· cushions, NAV trend and warning signs</span>
        </h2>
        <DividendSupportTable rows={dividendSupport} defaultWindows={defaultRates} />
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
            <span className="text-white">PIK is income not yet received in cash.</span>{" "}Booking PIK is not a
            loss: most PIK is paid when the loan is refinanced or repaid, but some never is. A few filers show
            their collections separately
            {arcc && arcc.pik_collected_m != null
              ? ` (ARCC reported $${arcc.pik_collected_m.toFixed(0)}m collected against $${arcc.pik_m.toFixed(0)}m accrued over the last four quarters)`
              : ""}; these are flows for the period and need not relate to the same loans or years. The
            &quot;Where did the PIK go?&quot; section above follows every PIK loan since {windowYear}{" "}to estimate how
            much came back. Cash coverage below 1.0x means NII excluding PIK is below declared distributions: the
            dividend relies on income that will arrive later — or not at all if the borrower fails. It does not by
            itself predict a dividend cut. The stress slider and the severe-PIK stress put numbers on that risk.
            Severe PIK is PIK making up half or more of a position&apos;s coupon, or all of it; the stress takes
            out only severe PIK on debt — first the debt that switched from cash to PIK while held, then also
            debt already PIK when first seen — and never PIK dividends on preferred stock or equity.
          </p>
          <p className="mb-2">
            <span className="text-white">PIK net of recapture.</span>{" "}A mature book recycles PIK: loans with
            capitalized PIK get repaid or refinanced and the PIK comes back as cash. The &quot;net of
            recapture&quot; measures take the same four quarters&apos; collections out first —{" "}
            {REPORTED_RECAPTURE.length ? `the reported figure for ${joinList(REPORTED_RECAPTURE)}; ` : ""}
            {NET_BASIS_RECAPTURE.length ? `nothing extra for ${joinList(NET_BASIS_RECAPTURE)}, which already print${NET_BASIS_RECAPTURE.length === 1 ? "s" : ""} PIK net; ` : ""}
            and for the rest an estimate from the PIK on loans that left the book or were refinanced at par in
            those quarters. Estimates are hatched in the heat map and marked &quot;est.&quot; in the table; an
            estimate larger than the PIK booked is not shown.
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
            {incomeMeta.latest_period}; {incomeMeta.n_bdcs}{" "}BDCs.
          </p>
        </div>
      </section>
    </div>
  );
}

function shiftYears(p: string, k: number): string {
  return `${Number(p.slice(0, 4)) + k}${p.slice(4)}`;
}
