import Link from "next/link";
import { ArrowLeft, Database, FileText, GitBranch, AlertTriangle } from "lucide-react";

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: "#8b8ba8" }}
      >
        <ArrowLeft size={14} /> Back to home
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Methodology</h1>
        <p className="text-sm leading-relaxed" style={{ color: "#9ca3af" }}>
          How the data on this site is collected, processed, and surfaced. Read this before relying
          on the numbers for investment decisions — the pipeline is open-source and we&apos;ve flagged
          its limitations.
        </p>
      </div>

      {/* TOC */}
      <div className="rounded-xl border mb-8 p-3 flex items-center gap-2 flex-wrap text-xs" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <span style={{ color: "#8b8ba8" }}>Sections:</span>
        {[
          ["#data-source", "Source"],
          ["#parsing", "Parsing"],
          ["#position-tracking", "Position tracking"],
          ["#metrics", "Metrics"],
          ["#vintage", "Holding cohorts"],
          ["#caveats", "Caveats"],
          ["#glossary", "Glossary"],
        ].map(([href, label]) => (
          <a
            key={href}
            href={href}
            className="px-2 py-1 rounded border hover:text-white transition-colors"
            style={{ color: "#d1d5db", background: "rgba(99,102,241,0.06)", borderColor: "#2d2d50" }}
          >
            {label}
          </a>
        ))}
      </div>

      {/* 1. Data source */}
      <section id="data-source" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Database size={18} /> Data source
        </h2>
        <div className="rounded-xl border p-5 text-sm space-y-3" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#d1d5db" }}>
          <p>
            Every number on this site is derived from SEC EDGAR 10-K and 10-Q filings. We pull the
            full filing for each BDC in our universe (currently 19 in-house BDCs + ~160 SEC DERA
            long-tail BDCs) and parse the Schedule of Investments (SOI) table out of each one.
          </p>
          <p>
            <span className="text-white">In-house coverage:</span> ARCC, BXSL, FSK, MAIN, OBDC,
            MFIC, OCSL, GBDC, CCAP, HTGC, BBDC, NMFC, BCRED, ASIF, ADS, OCIC, OTF, CGBD, TSLX.
            These get the full per-position treatment — non-accrual flags, PIK structure, mark-at-par,
            asset composition, spread.
          </p>
          <p>
            <span className="text-white">Long-tail coverage:</span> SEC DERA bulk SOI extracts for
            an additional ~160 BDC-like funds. DERA covers mark-based metrics (below 95¢ / 90¢)
            but lacks per-position non-accrual and PIK tagging, so those metrics use in-house data
            only.
          </p>
        </div>
      </section>

      {/* 2. Parsing */}
      <section id="parsing" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <FileText size={18} /> Parsing
        </h2>
        <div className="rounded-xl border p-5 text-sm space-y-3" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#d1d5db" }}>
          <p>
            SOI tables aren&apos;t consistent across BDCs — every issuer rolls their own layout,
            column ordering, footnote conventions, and unit conventions (millions vs thousands vs
            raw $). We maintain a per-BDC parser that:
          </p>
          <ol className="list-decimal list-inside space-y-1.5 pl-2">
            <li>Locates the SOI table within the filing&apos;s exhibit HTML.</li>
            <li>Identifies the banner row (&quot;in thousands&quot;, &quot;in millions&quot;) and applies the right unit multiplier.</li>
            <li>Maps columns to canonical fields: <em>par_amount, amortized_cost, fair_value, coupon_rate, ref_rate_spread, maturity_date, acquisition_date</em>.</li>
            <li>Decodes per-position footnotes for non-accrual and PIK flags.</li>
            <li>Selects one approved filing schedule per issuer and reporting period, retaining rejected alternatives for diagnosis.</li>
            <li>Links observed borrower/instrument positions using identity and terms. Quarterly modification flows require adjacent calendar observations.</li>
          </ol>
          <p className="text-xs" style={{ color: "#9ca3af" }}>
            Parser code lives in the <code className="px-1 rounded" style={{ background: "#0f0f16", color: "#a5b4fc" }}>bdc_inventory/scripts</code> repo
            (not yet public — open-sourcing is on the roadmap).
          </p>
        </div>
      </section>

      {/* 3. Position tracking */}
      <section id="position-tracking" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <GitBranch size={18} /> Position tracking
        </h2>
        <div className="rounded-xl border p-5 text-sm space-y-3" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#d1d5db" }}>
          <p>
            We link positions using borrower identity, instrument class and observed terms, including
            maturity, size, contractual spread and PIK status. These inferred links can preserve a
            chain across label or maturity changes, but they are not permanent legal facility IDs.
            Amendments, refinancing and splits can remain ambiguous. Named quarterly modification
            events retain both source-row locations so the comparison can be reviewed.
          </p>
          <p>
            <span className="text-white">Holding cohorts:</span> the vintage view uses conservative
            groups within one holder, with ambiguous identity excluded. It separates this holder&apos;s
            disclosed acquisition date from the first date observed in the selected filing history.
            Neither is evidence of original loan origination. Historical modification links do not
            automatically establish a continuous legal facility for cohort analysis.
          </p>
          <p>
            <span className="text-white">Missing observations:</span> disappearance does not establish
            repayment, refinancing, sale, write-off or cure. The cohort view retains unresolved past
            quarter-end status rather than assigning an outcome or estimating realized loss from
            the last valuation.
          </p>
        </div>
      </section>

      {/* 4. Metrics */}
      <section id="metrics" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Metrics</h2>
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Metric</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>What it measures</th>
              </tr>
            </thead>
            <tbody className="text-xs" style={{ color: "#d1d5db" }}>
              {[
                ["% non-accrual", "NA-flagged positive amortized cost / all positive-cost positions in the approved schedule, when position-flag coverage is complete. This denominator is not debt-only. MFIC uses its separately disclosed issuer rate; that aggregate-only rate and incomplete flag coverage are excluded from the USD cost-weighted industry ratio. FSK rates are withheld until its non-accrual numerator can be matched to funded exposure after commitment adjustments. Missing coverage is unknown, not zero."],
                ["% below 95¢ / 90¢ / 80¢ of par", "Cost of debt positions where fair value / par is below the threshold, divided by debt cost. Equity positions are excluded (par is meaningless for equity)."],
                ["% PIK", "Positive cost of positions flagged as paying any portion of interest in kind / all positive-cost positions in the approved schedule. This stock measure differs from the debt-only quarterly modification flow."],
                ["Inferred cash → PIK modification rate", "Current USD cost of material-rule PIK events / eligible debt cost. Eligibility requires funded, identified debt with observed PIK flags in adjacent calendar quarters; events require two prior cash quarters. Next-quarter persistence may be provisional. Zero-event issuers and unknown severity remain in totals. This does not confirm a disclosed amendment or rule out refinancing."],
                ["Weighted-avg spread (bps)", "Parsed from the SOI's reference-rate text (e.g. 'SOFR + 5.75%' → 575 bps). Cost-weighted across positions. Floating-rate loans give a clean read; fixed-rate notes fall through to coupon as a proxy."],
                ["Holding-cohort NA bounds", "Fixed initial-cost share of holding groups with any observed quarter-end non-accrual (lower), plus groups with unresolved past status (upper). Baseline positives are included. These are not default rates or statistical confidence intervals."],
                ["Cohort valuation snapshot", "Observed current cost with fair value below 90% of cost / current cost with an observed cost-based mark. Missing snapshots remain unknown. Exposure can grow or shrink and is not a survival probability."],
                ["PIK cascade", "Historical cash → PIK event outcomes four quarters later: observed return to cash, still PIK at various mark levels, or absent from parsed data. This separate historical cohort is not the quarterly flow population; disappearance does not establish repayment or cure."],
                ["Cross-BDC mark dispersion", "For borrowers held by ≥3 BDCs, the spread between max and min mark across holders in the same quarter."],
              ].map(([metric, desc]) => (
                <tr key={metric} style={{ borderBottom: "1px solid #1a1a28" }}>
                  <td className="px-4 py-3 font-semibold text-white whitespace-nowrap align-top">{metric}</td>
                  <td className="px-4 py-3 leading-relaxed">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-3 leading-relaxed" style={{ color: "#9ca3af" }}>
          Quarterly modifications use the shared definition <code>inferred_debt_modifications_v2</code>.
          The narrow PIK rate and severity totals reconcile to named PIK events. The broad ledger
          also includes maturity extensions of at least six indexed months, stressed par reductions
          greater than 15%, contractual-spread cuts greater than 50bps and lien downgrades. Event
          types can overlap. Industry rollups require at least 10 eligible issuers and exclude
          issuer quarters with material PIK event cost of 30% or more. The data retains provisional
          persistence and unknown severity; none of these rules establishes a disclosed amendment.
        </p>
      </section>

      {/* 4b. Holding cohorts */}
      <section id="vintage" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Dated holding cohorts: evidence, eligibility and uncertainty</h2>
        <div className="rounded-xl border p-5 text-sm space-y-3" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#d1d5db" }}>
          <p>
            A holding group belongs to one BDC. We use identified funded debt from the selected
            filing schedules, retain source observations and exclude ambiguous identity from the
            cohort curves. Industry pools holder exposures; it does not count unique global loans.
            The data does not certify a legal facility chain through amendments or refinancing.
          </p>
          <p>
            <span className="text-white">Two separate date bases.</span> Holder-acquisition cohorts
            require the holder&apos;s own disclosed acquisition date and first observation in that
            same calendar quarter. Holdings first observed later are excluded from this view because
            earlier experience is unobserved. Monitoring cohorts begin at first observation; they
            can contain seasoned loans and reveal no earlier history. Neither basis is documented
            original origination. We do not borrow another holder&apos;s date or infer origination
            by subtracting a tenor from maturity.
          </p>
          <p>
            <span className="text-white">Fixed horizon, fixed denominator.</span> Choose 4, 8, 12 or
            20 quarters and either all identified funded debt or first lien. Only groups old enough
            to reach that horizon by their issuer&apos;s reporting cutoff enter the curve. Each group
            receives its first observed positive cost as a fixed weight, never a future maximum.
            The same group count and denominator apply from age zero through the horizon. Changing
            the horizon changes the eligible population. Unseasoned exclusions are shown separately.
          </p>
          <p>
            <span className="text-white">Quarter-end non-accrual bounds.</span> The lower bound is
            initial cost of groups with any observed positive NA flag through that age, divided by
            the fixed denominator. One positive position makes the group positive and contributes
            its entire initial group weight; this is not the actual dollars on non-accrual. The
            upper bound additionally includes groups with unresolved past quarter-end status. Missing
            or unknown flags, gaps and disappearance preserve uncertainty even after a later clear
            observation. A later positive observation resolves that group as ever observed NA.
          </p>
          <p>
            Baseline NA is included, so this is not new-default incidence. The bounds cover observed
            quarter-end status, not events that begin and end between reports; they are not confidence
            intervals, continuous-time default estimates or survival curves. No default or realized
            loss is assigned from disappearance. Current-cost and valuation snapshots use only
            contemporaneous observations and stay unknown when no snapshot exists.
          </p>
          <p>
            <span className="text-white">Current composition and coverage.</span> The separate
            acquisition mix uses each issuer&apos;s latest approved positive funded-debt snapshot,
            including unknown or conflicting dates in its denominator. Missing-cost groups are counted separately, and percentage weights use known positive cost only. Acquisition can reflect a
            secondary purchase or a new security. Issuer dates and pooled date ranges are shown.
            Identity-ambiguity cost overlaps dated and unknown cost; those categories must not be
            added together. No external dating-accuracy percentage is asserted for these cohorts.
          </p>
        </div>
      </section>

      {/* 5. Caveats */}
      <section id="caveats" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <AlertTriangle size={18} /> Known caveats
        </h2>
        <div className="rounded-xl border p-5 text-sm space-y-3" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#d1d5db" }}>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <span className="text-white">Per-metric coverage caveats.</span>{" "}
              Pre-XBRL filings (broadly pre-2022) sometimes capture mark-based fields cleanly even
              when non-accrual / PIK footnotes don&apos;t decode. We flag caveats per metric family
              (mark / NA / PIK) rather than per BDC-quarter, so reliable data surfaces while
              broken streams stay muted.
            </li>
            <li>
              <span className="text-white">FSK NA, Q4 2019 – Q3 2021.</span>{" "}
              During the FSKR-merger era, the parser misreads merger-adjustment footnotes as
              non-accrual flags. Mark-based metrics from the same filings are reliable.
            </li>
            <li>
              <span className="text-white">CCAP / OCSL pre-XBRL.</span>{" "}
              CCAP&apos;s pre-XBRL parser extracted financial-statement summary rows instead of
              SOI positions. OCSL is missing par data across many pre-XBRL quarters. Both fully
              muted until XBRL kicks in.
            </li>
            <li>
              <span className="text-white">MFIC non-accrual disclosure.</span>{" "}
              The issuer NA rate comes from a separate filing disclosure; per-position NA identity
              is unavailable. It is excluded from the industry cost-weighted denominator until
              a matching disclosure scope is established. PIK observations are tracked separately.
            </li>
            <li>
              <span className="text-white">FSK denominator scope.</span>{" "}
              Portfolio totals include disclosed unfunded-commitment adjustments. PIK stock percentages
              retain the gross-position basis and must not be applied to net portfolio totals. FSK
              non-accrual percentages are withheld until the funded numerator is reconciled.
            </li>
            <li>
              <span className="text-white">DERA long-tail cleanup.</span>{" "}
              The SEC DERA bulk SOI data has XBRL rollup duplicates (one loan appearing at 2–3
              hierarchy levels) and per-filing unit-scaling bugs (some BDCs report at 1000× values
              in specific quarters). We dedup by leaf identifier and drop quarters with avg
              position cost &gt; $300M.
            </li>
            <li>
              <span className="text-white">Position-level drilldown is last 60 quarters only.</span>{" "}
              The stressed-loans modal exports the top-30 flagged positions per (BDC, quarter)
              for the most recent 60 quarter-ends. Older heatmap cells exist but don&apos;t have
              loan-level detail yet.
            </li>
            <li>
              <span className="text-white">Exit outcomes are unresolved.</span>{" "}
              The final reported valuation is not a sale price. The holding-cohort view does not
              estimate realized losses or assign defaults from disappearance.
            </li>
          </ul>
        </div>
      </section>

      {/* 6. Glossary */}
      <section id="glossary" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Glossary</h2>
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <dl className="divide-y" style={{ borderColor: "#1a1a28" }}>
            {[
              ["1L / First Lien", "Senior-secured term loan with first-priority claim on the borrower's collateral. Lowest risk in a typical sponsor-finance capital stack."],
              ["2L / Second Lien", "Term loan subordinated to the first-lien debt. Higher coupon, higher loss-given-default."],
              ["Amortized cost", "Original loan cost adjusted for OID accretion / discount amortization since acquisition. The 'book value' the BDC carries the loan at, before fair-value marks."],
              ["BDC", "Business Development Company. A publicly regulated investment vehicle that makes loans to private middle-market companies. Most are externally managed by a private credit GP."],
              ["Coupon / spread", "The interest rate on a loan, usually quoted as a reference rate (SOFR / LIBOR) plus a spread (e.g. 'SOFR + 5.75%'). Floor / ceiling cap the floating rate."],
              ["Quarter-end NA bounds", "Initial-cost-weighted share of holding groups ever observed on non-accrual, bounded above by also including unresolved past status. Includes baseline positives; not a default rate."],
              ["Distress exit", "A loan that exited the book with last mark below 85¢ of par, or that was ever non-accrual / sub-80¢ during its life."],
              ["Fair value (FV)", "The BDC's quarterly estimate of what the loan would sell for in an orderly transaction. Reported per position in the SOI."],
              ["Unresolved cohort status", "Missing or unknown quarter-end evidence that remains uncertain after a later clear observation. Disappearance is not an established outcome."],
              ["Mark", "Fair value as a percent of par (e.g. mark of 0.85 = 85¢ on the dollar). Below 100 = the BDC has marked the loan below face value."],
              ["Non-accrual", "Status applied when the BDC no longer expects full collection of interest. Position-level flag in the SOI footnotes."],
              ["OID (original issue discount)", "Discount at which a loan was issued vs. face value. Accretes back to par over the loan's life."],
              ["Par (face)", "The face value of the loan — what the borrower owes at maturity. Usually equals amortized cost ± small OID accretion."],
              ["PIK", "Payment-in-kind interest. Instead of paying cash, the borrower issues more debt to the lender. 'Cash → PIK' usually signals borrower distress."],
              ["SOI", "Schedule of Investments — the detailed position-by-position table in a BDC's 10-K / 10-Q filing."],
              ["Holding cohort year", "Year of the selected anchor: holder-disclosed acquisition or first observation. The two bases are shown separately and neither establishes original origination."],
              ["XBRL", "Tagged-data format the SEC requires for financial filings (broadly since 2022). Pre-XBRL filings are HTML-only and harder to parse reliably."],
            ].map(([term, def]) => (
              <div key={term} className="px-5 py-3">
                <dt className="font-semibold text-white text-sm">{term}</dt>
                <dd className="text-xs mt-1 leading-relaxed" style={{ color: "#9ca3af" }}>{def}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="text-xs mt-8" style={{ color: "#6b6b88" }}>
        Suggestions or corrections? Open an issue at{" "}
        <Link href="https://github.com/minajpara-cyber/BDC-Transparency-Open-Source" className="hover:text-white underline" style={{ color: "#a5b4fc" }}>
          github.com/minajpara-cyber/BDC-Transparency-Open-Source
        </Link>.
      </div>
    </div>
  );
}
