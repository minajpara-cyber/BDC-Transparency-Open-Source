import Link from "next/link";
import { ArrowLeft, Database, FileText, GitBranch, AlertTriangle } from "lucide-react";
import { vintageGolden } from "@/data/vintage_golden";

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
          ["#vintage", "Vintage dating"],
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
            <span className="text-white">Vintage assignment:</span> each loan gets a vintage date from
            the best evidence available — the BDC&apos;s own disclosed acquisition date, else the same
            tranche&apos;s date at a peer BDC, else a labelled estimate — and a HIGH / MED / LOW
            confidence tier (see <a href="#vintage" className="text-indigo-400 hover:underline">Vintage
            dating</a>). These are acquisition or first-seen dates, not proven origination dates. The
            /vintage page defaults to HIGH+MED dates only.
          </p>
          <p>
            <span className="text-white">Loan exits:</span> when a loan stops appearing in a BDC&apos;s
            schedule we tag it as exited. We can&apos;t tell <em>why</em> — refinancing, paydown, sale or
            write-off — but we flag <em>distress exits</em>: a last mark below 85¢, or any non-accrual or
            sub-80¢ mark before the loan left. Those count toward cumulative default on /vintage, and
            the last mark before exit gives the mark-based loss proxy (not realized loss).
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
                ["% non-accrual", "Amortized cost of positions flagged non-accrual ÷ amortized cost of all positions in the filing's schedule (debt and equity alike), when every position's flag can be read. Cash, money-market funds and unfunded commitments are left out of both sides. Where a BDC reports only a total, its reported rate is shown; where the filing states that nothing was on non-accrual on that date, 0.00% is shown with the quoted sentence as its source. A quarter whose flags are incomplete or on hold shows as unknown, never as zero. The industry line on /credit is dollar-weighted across the BDCs with a usable rate that quarter; it shows how many BDCs each point pools and which were left out of the latest one, and plots quarters with at least 5."],
                ["% below 95¢ / 90¢ / 80¢ of par", "Cost of debt positions where fair value / par is below the threshold, divided by debt cost. Equity positions are excluded (par is meaningless for equity)."],
                ["% PIK", "Cost of positions known to pay any PIK ÷ cost of all positions in the schedule. Preferred stock paying its dividend in kind counts as PIK. Where some positions' PIK status is unknown, an upper figure counts them all as PIK. One number (the known share) is shown unless the two differ by more than 1pp, in which case the range is shown; otherwise the range is in the hover text. A figure is called 'bounded' only when the two differ by at least 0.1pp, and a quarter-on-quarter change is shown when both quarters differ by under 0.25pp. Coverage is the share of cost whose PIK status is known. This is a stock measure, unlike the quarterly cash → PIK flow below."],
                ["Inferred cash → PIK modification rate", "Current USD cost of material-rule PIK events / eligible debt cost. Rate eligibility requires funded, identified debt with all comparison inputs observed in adjacent calendar quarters; events require two prior cash quarters. A supported positive event remains in the named ledger when an unrelated comparison input is missing, but is labeled incomplete and excluded from the rate. Next-quarter persistence may be provisional. Zero-event issuers and unknown severity remain in totals. This does not confirm a disclosed amendment or rule out refinancing."],
                ["Weighted-avg spread (bps)", "Parsed from the SOI's reference-rate text (e.g. 'SOFR + 5.75%' → 575 bps). Cost-weighted across positions. Floating-rate loans give a clean read; fixed-rate notes fall through to coupon as a proxy."],
                ["Cumulative default exposure (vintage)", "Entry cost of loans ever flagged non-accrual OR that left the book in distress, as % of the vintage cohort's entry cost — counting at each age only loans old enough to have reached it, and leaving out loans whose non-accrual status is unknown at that age. Directionally comparable to Raymond James's 'cumulative 1L default exposure' (our headline spans all instruments; the first-lien toggle gives the strictly comparable view)."],
                ["Mark-based loss proxy (vintage)", "For distress exits: last reported fair value − last reported cost, as % of last cost. Filings don't disclose sale prices, so this is the final markdown, not realized loss-given-default."],
                ["% of cohort still on book", "Share of a vintage's entry cost (loans old enough to reach age T) whose loan still appears on a BDC's schedule at age T or later. Cannot exceed 100%."],
                ["Disclosed-dates-only NA bounds", "The stricter cross-check tab on /vintage: fixed initial-cost share of holding groups (dated only by the holder's own acquisition date or first observation) with any observed quarter-end non-accrual (lower), plus groups with unresolved past status, including every exit (upper). Not default rates."],
                ["PIK cascade", "For every loan tranche that switched from cash interest to PIK, where it was a year later: back to cash-pay, still PIK (split by mark: 90¢ or more, 80–90¢, under 80¢, or mark unknown), or gone from the book while the BDC was still filing. 'Left the book' does not say whether the loan was repaid, refinanced, sold or written off. Follow-ups that have not happened yet are 'not yet seasoned', and a switch whose later filing is missing or unreadable is 'status unknown' rather than any outcome, so each year adds to 100%."],
                ["Default rate (hard / shadow)", "Of the debt that was performing twelve months earlier, the share whose borrower defaulted during the year, counted once at its first event. Hard = new non-accrual (observed) or a distressed exit (inferred from the exit mark: left below 85¢, or after a mark below 80¢, without going non-accrual). Shadow adds restructurings and PIK amendments inferred from term changes. Published only for BDC windows where every loan's non-accrual status is known at the start and in every quarter; others are listed as withheld with the reason."],
                ["Where did the PIK go (PIK ledger)", "The PIK booked since the window start, allocated to loans by their disclosed PIK rates and followed to today; the loan-level dollars are scaled to the cash-flow statement's PIK in quarters where at least 97% of the book's cost has a known PIK status and rate. Still in the book (performing, relabelled to another equity line at the same borrower, impaired, or PIK status unknown) is observed. Collected (loans that left at 97¢ or better or were refinanced at par) is an estimate, compared with the BDCs that report their PIK collections. Lost is estimated from the last mark before exit, not from sale proceeds."],
                ["Forward queue (implied non-accrual formation)", "Each loan not yet on non-accrual is scored on warning signals (mark below 90¢, mark drop, cash → PIK switch, modification, junior ranking, another holder already on non-accrual); a signal gets points in proportion to how much more often loans carrying it went non-accrual, and none if too few loans carried it to measure. The score was fitted on older data and tested on later quarters it had not seen; each score bucket's hit rate there (share going non-accrual within two quarters) is applied to the BDC's scored book. Loans whose status is unknown at the start or at either later quarter are left out of the test rather than counted as performing, and so are loans whose borrower was already on non-accrual at the same BDC; a signal that cannot be checked counts as absent, so a BDC's figure is a lower bound where its signal coverage is below 100%."],
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
          Quarterly modifications use the shared definition <code>inferred_debt_modifications_v3</code>.
          Each signal is counted only over loans where its own inputs could be read: a missing
          spread or par no longer removes a cash → PIK change from the PIK rate, a fixed-rate loan
          cannot have a spread cut, and a loan&apos;s first quarter has nothing to compare with. A rate
          covering under half of a BDC&apos;s funded debt is labelled low coverage.
          The narrow PIK rate and severity totals reconcile to named PIK events. The broad ledger
          also includes maturity extensions of at least six indexed months, stressed par reductions
          greater than 15%, contractual-spread cuts greater than 50bps and lien downgrades. Event
          types can overlap. Industry rollups require at least 10 eligible issuers and exclude
          issuer quarters with material PIK event cost of 30% or more. The data retains provisional
          persistence and unknown severity; none of these rules establishes a disclosed amendment.
        </p>
      </section>

      {/* 4b. Vintage dating */}
      <section id="vintage" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Vintage dating — how each loan gets its vintage year</h2>
        <div className="rounded-xl border p-5 text-sm space-y-3" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#d1d5db" }}>
          <p>
            The schedule&apos;s disclosed &ldquo;acquisition date&rdquo; is when the BDC acquired the{" "}
            <em>security</em> — a refinancing legally creates a new security, so the date can reset, and
            several BDCs print it only for some positions or not at all. So a loan&apos;s vintage is an
            acquisition or first-seen date, not a proven origination date. It comes from a waterfall, in
            order of trust:
          </p>
          <ol className="list-decimal list-inside space-y-1.5">
            <li><span className="text-white">Own disclosed date</span> — the earliest date this BDC ever printed for the loan (two-digit years such as BBDC&apos;s &ldquo;04/22&rdquo; read as April 2022), overridden when peers holding the <em>same tranche</em> (same lien, maturity within ±2 years) agree on a meaningfully earlier date.</li>
            <li><span className="text-white">Peer date, same tranche</span> — another BDC&apos;s disclosed date for the same facility.</li>
            <li><span className="text-white">Estimates (graded LOW)</span> — a long-tail fund&apos;s date for the same borrower name, a sibling facility&apos;s date, the borrower&apos;s first appearance in SEC bulk data, maturity minus a typical tenor (first lien ≈ 6y, calibrated on stable disclosed loans), or the first quarter we saw the loan when the quarter before was reliably parsed.</li>
          </ol>
          <p>
            <span className="text-white">A loan can&apos;t be dated after we saw it.</span> If a candidate date is
            more than two quarters after the first filing that shows the loan (typically an amendment
            re-dating the loan, or a peer&apos;s date for a later facility), it is rejected and the next
            source is used. A BDC&apos;s own re-dated date replaced by the same tranche&apos;s peer date or a
            reliably covered first sighting counts as corrected (MED); anything else is an estimate (LOW). Each loan&apos;s tier comes from how stable its
            disclosure is across quarters and holders (HIGH ≤90 days of drift, MED ≤12 months); the
            default view uses HIGH+MED only. Refinancings that extend maturity are stitched to the
            original loan, and loans are keyed on the entity matcher&apos;s borrower id, so a renamed
            borrower stays one loan.
          </p>
          <p>
            <span className="text-white">Weights and pieces.</span> Each loan is weighted by its cost in the
            first quarter we saw it, summing every piece of the facility that quarter (for example a
            USD term loan, a GBP tranche and an add-on). Only a filing row read twice is dropped as a
            duplicate. Unfunded commitments are left out.
          </p>
          <p>
            <span className="text-white">Old enough to count.</span> At age T a cohort only counts loans
            whose vintage date is at least T before their BDC&apos;s latest filing, so every loan counted has
            had the full T years to default. Points with fewer than 20 such loans (30 for a single BDC),
            or with under a quarter of the cohort&apos;s cost old enough, are not published, and
            BDC-vs-industry comparisons use the oldest age every loan in the cohort has reached. Because the
            counted set shrinks at the oldest ages, a curve can dip at its tail without any cure.
          </p>
          <p>
            <span className="text-white">Unknown non-accrual flags.</span> Where a BDC&apos;s non-accrual marks were
            not captured for a quarter, loans whose latest status is unknown are left out of that
            point rather than counted as performing; points where unknown history touches at least 5%
            of the counted cost are marked partial.
          </p>
          <p>
            <span className="text-white">Dating check:</span>{" "}
            {vintageGolden.overall.n > 0 ? (
              <>
                against a small reference set of {vintageGolden.n_reference_financings_matched} publicly documented
                financings ({vintageGolden.overall.n.toLocaleString()} matched loan-tranches; scored {vintageGolden.scored_on}),{" "}
                {vintageGolden.overall.pct_within_1y?.toFixed(0)}% of assigned vintage years are within ±1 year and the
                mean absolute error is {vintageGolden.overall.mae_years?.toFixed(2)} years
                {vintageGolden.by_bucket.borrowed?.mae_years != null && <> (peer same-tranche dates {vintageGolden.by_bucket.borrowed.mae_years.toFixed(2)}y on {vintageGolden.by_bucket.borrowed.n} tranches; own disclosed dates {vintageGolden.by_bucket.disclosed?.mae_years?.toFixed(2)}y on {vintageGolden.by_bucket.disclosed?.n})</>}.
                {vintageGolden.n_conflicting_loans_excluded > 0 && <> {vintageGolden.n_conflicting_loans_excluded} loans matched by reference rows that disagree on the year are left out.</>}{" "}
                {vintageGolden.caveat} It is a regression check, not a measure of accuracy across the whole book.
              </>
            ) : "not available for this release."}
          </p>
          <p>
            <span className="text-white">Disclosed dates only.</span> A second tab on /vintage keeps a stricter
            view: holdings dated only by the BDC&apos;s own disclosed acquisition date (or the first quarter
            we saw them), no peer dates, no estimates, fixed follow-up horizons, and lower/upper bounds on
            observed non-accrual in which every exit stays unresolved. BDCs that never disclose
            acquisition dates drop out of it, and its bands are wide; it is a cross-check, not the headline.
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
              <span className="text-white">FSK non-accrual before mid-2022.</span>{" "}
              FSK&apos;s filings before 2022-06-30 don&apos;t mark which positions are unfunded commitments,
              so its non-accrual rate for those quarters is approximate and shown muted, and none of those
              quarters joins the industry line (letting some in and not others bent the line whenever FSK left
              or re-entered). Where the parsed rate is far from the fair-value rate FSK itself disclosed, the
              disclosed figure is shown instead. Mark-based metrics from the same filings are reliable.
            </li>
            <li>
              <span className="text-white">CCAP / OCSL pre-XBRL.</span>{" "}
              CCAP&apos;s pre-XBRL parser extracted financial-statement summary rows instead of
              SOI positions. OCSL is missing par data across many pre-XBRL quarters. Both fully
              muted until XBRL kicks in.
            </li>
            <li>
              <span className="text-white">Cross-check against each BDC&apos;s own figure.</span>{" "}
              A quarter&apos;s loan-by-loan non-accrual flags are held to the BDC&apos;s own non-accrual
              percentage for that date (a dated sentence, or a performing/non-accrual table). If nothing is
              flagged and the filing doesn&apos;t say nothing was on non-accrual, or the flags are more than
              1pp (or two-fold) away from the BDC&apos;s figure on the same basis, the flags are set aside: the
              BDC&apos;s own figure is shown for that quarter and loan-level measures treat its loans as unknown.
              MFIC marks each non-accrual loan in its schedule, and its decoded rate matches its disclosed rate
              in every quarter we hold a full book (for example 4.61% at cost against 4.6% at 2026-06-30).
            </li>
            <li>
              <span className="text-white">FSK denominator scope.</span>{" "}
              Portfolio totals include disclosed unfunded-commitment adjustments. PIK stock percentages
              retain the gross-position basis and must not be applied to net portfolio totals. From
              2022-06-30 FSK&apos;s non-accrual rate leaves unfunded commitments out of both sides; at fair
              value it matches the rate FSK discloses within 0.1pp in every quarter (for example 3.76% against
              3.8% at 2026-06-30). The cost-basis rate shown by default is higher because FSK&apos;s
              non-accrual loans are marked well below cost.
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
              <span className="text-white">Exit outcomes are proxies.</span>{" "}
              A loan leaving the schedule does not say why. Where the site shows an exit-based figure —
              distress exits and the realized-loss proxy on /sponsors, the distressed-exit leg of the
              default rate and of the vintage cumulative-default curves, the vintage loss proxy,
              &quot;collected&quot; and &quot;lost&quot; in the PIK ledger — it is inferred from the last
              reported mark, not from sale proceeds, and labelled as such. The disclosed-dates-only
              vintage tab does not assign exit outcomes.
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
              ["Cumulative default", "Share of a vintage's cost that has ever been flagged non-accrual or left the book in distress, counting only loans old enough to reach that age. Cures don't reduce it."],
              ["Distress exit", "A loan that exited the book with last mark below 85¢ of par, or that was ever non-accrual / sub-80¢ during its life."],
              ["Fair value (FV)", "The BDC's quarterly estimate of what the loan would sell for in an orderly transaction. Reported per position in the SOI."],
              ["Mark-based loss proxy", "Last reported fair value minus last reported cost for loans that left the book in distress, as % of cost. A markdown, not a realized loss."],
              ["Mark", "Fair value as a percent of par (e.g. mark of 0.85 = 85¢ on the dollar). Below 100 = the BDC has marked the loan below face value."],
              ["Non-accrual", "Status applied when the BDC no longer expects full collection of interest. Position-level flag in the SOI footnotes."],
              ["OID (original issue discount)", "Discount at which a loan was issued vs. face value. Accretes back to par over the loan's life."],
              ["Par (face)", "The face value of the loan — what the borrower owes at maturity. Usually equals amortized cost ± small OID accretion."],
              ["PIK", "Payment-in-kind interest. Instead of paying cash, the borrower issues more debt to the lender. 'Cash → PIK' usually signals borrower distress."],
              ["SOI", "Schedule of Investments — the detailed position-by-position table in a BDC's 10-K / 10-Q filing."],
              ["Vintage", "Year a loan came onto a BDC's book as best we can document it: the BDC's own disclosed acquisition date, else the same tranche's date at a peer BDC, else a labelled estimate. An acquisition or first-seen date, not a proven origination date."],
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
