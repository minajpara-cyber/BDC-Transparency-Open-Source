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
            <li>Joins to a previous-quarter snapshot via <em>(ticker, company, investment_type, maturity_date)</em> so the same loan tranche tracks across quarters.</li>
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
            We assign each loan a stable <code className="px-1 rounded" style={{ background: "#0f0f16", color: "#a5b4fc" }}>loan_id</code> built from
            (BDC ticker, borrower name, investment_type, maturity_date). This lets us follow the
            same tranche across quarters even when BDCs amend the borrower name slightly or change
            the column ordering.
          </p>
          <p>
            <span className="text-white">Vintage assignment:</span> when the SOI discloses an
            acquisition_date, we use it. Otherwise we fall back to the first quarter we observed
            the loan. Disclosed acquisition_date is sometimes overwritten with the date of the
            latest amendment — we run a stability check across quarters and across BDC holders to
            flag this, then bucket loans into HIGH / MED / LOW confidence tiers. The headline
            vintage curves on /vintage default to HIGH+MED only.
          </p>
          <p>
            <span className="text-white">Loan exits:</span> when a loan stops appearing in a BDC&apos;s
            SOI, we tag it as exited. We can&apos;t directly tell <em>why</em> it exited — refi,
            paydown, distressed sale, write-off — but we flag <em>distress exits</em> as those
            with a last mark below 85¢ or any non-accrual / sub-80¢ event in the loan&apos;s history.
            That powers the LGD-by-vintage table on /vintage.
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
                ["% non-accrual", "Amortized cost of loans flagged non-accrual / total amortized cost. Numerator and denominator both count debt positions only; equity and JV stakes excluded."],
                ["% below 95¢ / 90¢ / 80¢ of par", "Cost of debt positions where fair value / par is below the threshold, divided by debt cost. Equity positions are excluded (par is meaningless for equity)."],
                ["% PIK", "Cost of loans currently paying any portion of interest in-kind / total debt cost."],
                ["Cash → PIK modification rate", "Cost of loans that flipped from cash-pay to PIK this quarter / eligible-loan cost. Strict payment-structure changes only — excludes refis, paydowns, maturity extensions."],
                ["Weighted-avg spread (bps)", "Parsed from the SOI's reference-rate text (e.g. 'SOFR + 5.75%' → 575 bps). Cost-weighted across positions. Floating-rate loans give a clean read; fixed-rate notes fall through to coupon as a proxy."],
                ["Cumulative default exposure (vintage)", "Cost of loans ever flagged non-accrual OR exited in distress, as % of cohort entry cost. Matches Raymond James's published 'cumulative 1L default exposure' methodology."],
                ["Loss-given-default (LGD)", "Realized loss on distress exits as % of distress-exit cost. Realized loss uses last-observed FV − cost as proxy; not audited."],
                ["Cohort survival", "% of vintage's entry cost still on a BDC's balance sheet at age T. Falls as loans refi, pay down, or exit."],
                ["PIK cascade", "For every cash → PIK flip, outcome 4 quarters later: cured, still PIK at various mark levels, or exited."],
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
              <span className="text-white">MFIC non-accrual / PIK.</span>{" "}
              MFIC&apos;s SOI doesn&apos;t carry per-position NA or PIK footnotes. Mark-based
              metrics for MFIC are reliable; NA and PIK columns are muted.
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
              <span className="text-white">Realized loss is a proxy.</span>{" "}
              We use last-observed FV − cost as a proxy for the realized loss on each exit. Actual
              proceeds (sale price) aren&apos;t disclosed in the SOI, so the LGD numbers are
              directional, not audited.
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
              ["Cumulative default", "Share of a vintage's cost that has ever been flagged as a default event (non-accrual or distress exit). Monotonically non-decreasing — cures don't reduce it."],
              ["Distress exit", "A loan that exited the book with last mark below 85¢ of par, or that was ever non-accrual / sub-80¢ during its life."],
              ["Fair value (FV)", "The BDC's quarterly estimate of what the loan would sell for in an orderly transaction. Reported per position in the SOI."],
              ["LGD (loss-given-default)", "Realized loss as % of cost on loans that exit in distress. Lower is better — high recovery on bad loans."],
              ["Mark", "Fair value as a percent of par (e.g. mark of 0.85 = 85¢ on the dollar). Below 100 = the BDC has marked the loan below face value."],
              ["Non-accrual", "Status applied when the BDC no longer expects full collection of interest. Position-level flag in the SOI footnotes."],
              ["OID (original issue discount)", "Discount at which a loan was issued vs. face value. Accretes back to par over the loan's life."],
              ["Par (face)", "The face value of the loan — what the borrower owes at maturity. Usually equals amortized cost ± small OID accretion."],
              ["PIK", "Payment-in-kind interest. Instead of paying cash, the borrower issues more debt to the lender. 'Cash → PIK' usually signals borrower distress."],
              ["SOI", "Schedule of Investments — the detailed position-by-position table in a BDC's 10-K / 10-Q filing."],
              ["Vintage", "Year a loan first appeared on a BDC's book — either the disclosed acquisition_date or the first observation in our parsed data."],
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
