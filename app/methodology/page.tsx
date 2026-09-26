import Link from "next/link";
import { ArrowLeft, Database, FileText, GitBranch, AlertTriangle } from "lucide-react";
import { vintageGolden } from "@/data/vintage_golden";
import { creditQuality } from "@/data/credit_quality";
import { incomeTtm } from "@/data/income_coverage";
import { dividendSupportMeta } from "@/data/dividend_support";
import { FLOATING_CASH_LEG_NOTE, PIK_ORIGINS, PIK_ORIGIN_EXPLAIN, PIK_ORIGIN_LABEL, severePikTypePoint,
  severeTypeList } from "@/lib/pikOrigin";
import { joinList } from "@/lib/joinList";

// Latest industry split of severe PIK by type and the back-test behind the
// dividend-support PIK sign — all read from the exported data.
const SEVERE_ROW = creditQuality
  .filter((r) => r.ticker === "industry")
  .sort((a, b) => a.period_end.localeCompare(b.period_end))
  .pop();
const SEVERE_INDUSTRY = SEVERE_ROW ? severePikTypePoint(SEVERE_ROW) : undefined;
const SEVERE_TOTAL = SEVERE_ROW?.pct_pik_severe ?? 0;
// Switched debt cut into a new PIK loan at a restructuring, latest quarter (all BDCs).
const LATEST_INCOME_PERIOD = incomeTtm.reduce((m, r) => (r.period_end > m ? r.period_end : m), "");
const LATEST_INCOME = incomeTtm.filter((r) => r.period_end === LATEST_INCOME_PERIOD);
const RECUT_M = LATEST_INCOME.reduce((s, r) => s + (r.sev_switched_recut_m ?? 0), 0);
const SWITCHED_M = LATEST_INCOME.reduce((s, r) => s + (r.sev_switched_m ?? 0), 0);
const FLAG = dividendSupportMeta.switched_pik_flag_evidence;
const pc = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v.toFixed(d)}%`);
const signed = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`);
const bn = (m: number) => `$${(m / 1000).toFixed(1)}bn`;
const corr = (v: number) => `${v < 0 ? "−" : v > 0 ? "+" : ""}${Math.abs(v).toFixed(2)}`;

type ScanRow = { threshold: number; n: number; n_bdcs: number; gap_mean: number | null; gap_median: number | null };

/** How the line was picked, in words, from the scan in the export. */
function scanText(): string {
  if (!FLAG) return "";
  const scan = FLAG.scan as readonly ScanRow[];
  const lo = scan[0], hi = scan[scan.length - 1];
  const worse = scan.filter((x) => (x.gap_mean ?? 0) > 0);
  const used = scan.find((x) => x.threshold === Number(FLAG.threshold_pct_nii));
  const all = worse.length === scan.length
    ? `Every line from ${lo.threshold}% to ${hi.threshold}% (half-point steps, table below) left the BDCs above it worse off on average over the next year`
    : `${worse.length} of the ${scan.length} lines from ${lo.threshold}% to ${hi.threshold}% left the BDCs above it worse off on average`;
  const widen = (hi.gap_mean ?? 0) > (lo.gap_mean ?? 0)
    ? `, and the gap widens as the line rises (${(lo.gap_mean ?? 0).toFixed(1)} points of NAV at ${lo.threshold}%, ${(hi.gap_mean ?? 0).toFixed(1)} at ${hi.threshold}%) while resting on fewer BDCs (${lo.n} BDC-quarters at ${lo.n_bdcs} BDCs, then ${hi.n} at ${hi.n_bdcs})`
    : "";
  const pick = Number(FLAG.scan_lowest_clear) === Number(FLAG.threshold_pct_nii) && used
    ? ` ${FLAG.threshold_pct_nii}% is the lowest line at which the BDCs above it were at least ${FLAG.clear_gap_pp} point worse on both the average and the median: a sign should catch the pattern early, and higher lines lean on a handful of BDCs.`
    : ` ${FLAG.threshold_pct_nii}% is used; on the latest data the lowest line clearing ${FLAG.clear_gap_pp} point on both the average and the median is ${FLAG.scan_lowest_clear ?? "none"}${FLAG.scan_lowest_clear != null ? "%" : ""}.`;
  return `${all}${widen}.${pick} The line was chosen on these same data, so this is not an out-of-sample test.`;
}

/** The plain-PIK benchmark, in words: about as well / better / worse, from the export. */
function benchmarkText(): string {
  if (!FLAG) return "";
  const b = FLAG.benchmark;
  const best = b.best as ({ threshold: number; n: number; n_bdcs: number; fwd_nav_mean: number | null; rest_nav_mean: number | null; fwd_nav_median: number | null; rest_nav_median: number | null; gap_mean: number | null; fwd_hard_mean: number | null; rest_hard_mean: number | null } | null);
  const m = b.matched as (typeof best);
  const sp = FLAG.spearman;
  const own = FLAG.flagged.fwd_nav_mean != null && FLAG.rest.fwd_nav_mean != null
    ? FLAG.rest.fwd_nav_mean - FLAG.flagged.fwd_nav_mean : null;
  const theirs = best?.gap_mean ?? m?.gap_mean ?? null;
  const verdict = own == null || theirs == null ? "It cannot be compared on these data"
    : Math.abs(own - theirs) < 1 ? "On NAV, about as well — not better"
      : own > theirs ? "On NAV, it separates more" : "On NAV, the plain sign separates more";
  const parts: string[] = [`${verdict}.`];
  if (best) parts.push(`At its own best line among those flagging no more than a third of BDC-quarters, all PIK above ${best.threshold}% of NII (${best.n} BDC-quarters at ${best.n_bdcs} BDCs), NAV per share changed ${signed(best.fwd_nav_mean)} against ${signed(best.rest_nav_mean)} (medians ${signed(best.fwd_nav_median)} against ${signed(best.rest_nav_median)}).`);
  if (m) parts.push(`A plain line flagging the same ${pc(FLAG.pct_bdc_quarters_flagged, 0)} of BDC-quarters (${m.threshold.toFixed(0)}% of NII) gave ${signed(m.fwd_nav_mean)} against ${signed(m.rest_nav_mean)}.`);
  if (sp.switched_vs_fwd_nav != null && sp.all_pik_vs_fwd_nav != null)
    parts.push(`Ranked across all BDC-quarters, the correlation with the next year's NAV change is ${corr(sp.switched_vs_fwd_nav)} for switched-debt PIK and ${corr(sp.all_pik_vs_fwd_nav)} for all PIK.`);
  const hardOwn = FLAG.flagged.fwd_hard_mean != null && FLAG.rest.fwd_hard_mean != null ? FLAG.flagged.fwd_hard_mean - FLAG.rest.fwd_hard_mean : null;
  if (best && best.fwd_hard_mean != null && best.rest_hard_mean != null && hardOwn != null
    && sp.switched_vs_fwd_hard != null && sp.all_pik_vs_fwd_hard != null) {
    const hardBest = best.fwd_hard_mean - best.rest_hard_mean;
    parts.push(hardOwn - hardBest >= 0.5
      ? `Where it adds something is defaults: the BDCs above the switched line had a hard default rate of ${pc(FLAG.flagged.fwd_hard_mean)} against ${pc(FLAG.rest.fwd_hard_mean)}, while the PIK-heavy BDCs had ${pc(best.fwd_hard_mean)} against ${pc(best.rest_hard_mean)} (rank correlations with the hard default rate ${corr(sp.switched_vs_fwd_hard)} and ${corr(sp.all_pik_vs_fwd_hard)}).`
      : `On defaults it does no better: hard default rates of ${pc(FLAG.flagged.fwd_hard_mean)} against ${pc(FLAG.rest.fwd_hard_mean)} above and below the switched line, and ${pc(best.fwd_hard_mean)} against ${pc(best.rest_hard_mean)} for the PIK-heavy BDCs (rank correlations ${corr(sp.switched_vs_fwd_hard)} and ${corr(sp.all_pik_vs_fwd_hard)}).`);
  }
  parts.push("The switched sign is kept because it also says why: debt that moved from cash to PIK while the BDC held it.");
  return parts.join(" ");
}
const SCAN_TEXT = scanText();
const BENCHMARK_TEXT = benchmarkText();

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: "#8b8ba8" }}
      >
        <ArrowLeft size={14} />{" "}Back to home
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
          ["#severe-pik", "Severe PIK"],
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
          <Database size={18} />{" "}Data source
        </h2>
        <div className="rounded-xl border p-5 text-sm space-y-3" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#d1d5db" }}>
          <p>
            Every number on this site is derived from SEC EDGAR 10-K and 10-Q filings. We pull the
            full filing for each BDC in our universe (currently 19 in-house BDCs + ~160 SEC DERA
            long-tail BDCs) and parse the Schedule of Investments (SOI) table out of each one.
          </p>
          <p>
            <span className="text-white">In-house coverage:</span>{" "}ARCC, BXSL, FSK, MAIN, OBDC,
            MFIC, OCSL, GBDC, CCAP, HTGC, BBDC, NMFC, BCRED, ASIF, ADS, OCIC, OTF, CGBD, TSLX.
            These get the full per-position treatment — non-accrual flags, PIK structure, mark-at-par,
            asset composition, spread.
          </p>
          <p>
            <span className="text-white">Long-tail coverage:</span>{" "}SEC DERA bulk SOI extracts for
            an additional ~160 BDC-like funds. DERA covers mark-based metrics (below 95¢ / 90¢)
            but lacks per-position non-accrual and PIK tagging, so those metrics use in-house data
            only.
          </p>
        </div>
      </section>

      {/* 2. Parsing */}
      <section id="parsing" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <FileText size={18} />{" "}Parsing
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
            Parser code lives in the <code className="px-1 rounded" style={{ background: "#0f0f16", color: "#a5b4fc" }}>bdc_inventory/scripts</code>{" "}repo
            (not yet public — open-sourcing is on the roadmap).
          </p>
        </div>
      </section>

      {/* 3. Position tracking */}
      <section id="position-tracking" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <GitBranch size={18} />{" "}Position tracking
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
            <span className="text-white">Vintage assignment:</span>{" "}each loan gets a vintage date from
            the best evidence available — the BDC&apos;s own disclosed acquisition date, else the same
            tranche&apos;s date at a peer BDC, else a labelled estimate — and a HIGH / MED / LOW
            confidence tier (see <a href="#vintage" className="text-indigo-400 hover:underline">Vintage
            dating</a>). These are acquisition or first-seen dates, not proven origination dates. The
            /vintage page defaults to HIGH+MED dates only.
          </p>
          <p>
            <span className="text-white">Loan exits:</span>{" "}when a loan stops appearing in a BDC&apos;s
            schedule we tag it as exited. We can&apos;t tell <em>why</em>{" "}— refinancing, paydown, sale or
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
                ["Severe PIK, by type", "Severe PIK is PIK making up half or more of a position's coupon, or all of it. Each severe position is typed by why it pays in kind: preferred stock, equity and convertible notes (PIK by design); debt already paying PIK the first time it appears in our data; debt that switched from cash to PIK while held (the same loan, or a new PIK loan cut from it at a restructuring); or debt whose history is unclear. The four add up to severe PIK. See Severe PIK below."],
                ["Inferred cash → PIK modification rate", "Current USD cost of material-rule PIK events / eligible debt cost. A loan is eligible when it is funded, identified debt and its PIK status was read at both adjacent calendar quarter-ends; an event also needs two earlier cash-pay quarters. Only PIK status is needed: a missing spread, par or maturity does not remove a loan or an event from this rate (those inputs have their own denominators in the broad measure). Next-quarter persistence may be provisional. Zero-event issuers and unknown severity remain in totals. A BDC-quarter from an era whose PIK marks could not be read reliably shows no rate (a gap, not 0%). This does not confirm a disclosed amendment or rule out refinancing."],
                ["Weighted-avg spread (bps)", "Parsed from the SOI's reference-rate text (e.g. 'SOFR + 5.75%' → 575 bps). Cost-weighted across positions. Floating-rate loans give a clean read; fixed-rate notes fall through to coupon as a proxy."],
                ["Cumulative default exposure (vintage)", "Entry cost of loans ever flagged non-accrual OR that left the book in distress, as % of the vintage cohort's entry cost. Each age adds the new defaults at that age among the loans old enough to have reached it (leaving out loans whose non-accrual status is unknown then), so the cumulative rate never falls when fewer loans are old enough at a cohort's oldest ages. Directionally comparable to Raymond James's 'cumulative 1L default exposure' (our headline spans all instruments; the first-lien toggle gives the strictly comparable view: loans labelled first lien, one stop, unitranche or senior secured)."],
                ["Mark-based loss proxy (vintage)", "For distress exits: last reported fair value − last reported cost, as % of last cost. Filings don't disclose sale prices, so this is the final markdown, not realized loss-given-default. Shown only for vintages with at least 10 distress exits; a net markup shows as 0%, never as a negative loss."],
                ["% of cohort still on book", "Share of a vintage's entry cost still on a BDC's schedule at age T, chained age by age (at each age, the share of the old-enough loans on the book at the previous age that are still there). Cannot exceed 100% and never rises."],
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

      {/* 4a. Severe PIK — how much vs why */}
      <section id="severe-pik" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Severe PIK — how much is paid in kind, and why</h2>
        <div className="rounded-xl border p-5 text-sm space-y-3" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#d1d5db" }}>
          <p>
            A position&apos;s PIK <span className="text-white">severity</span>{" "}is the share of its coupon paid in
            kind: minimal under 20%, moderate 20% to under 50%, severe half or more, or all of it (a loan paying
            exactly half in kind counts as severe). It is read off each filing, but it only says how much. Whether
            severe PIK is a warning depends on why the coupon is paid in kind, so every severe position also gets
            one of four types:
          </p>
          <ul className="list-disc list-inside space-y-1.5">
            {PIK_ORIGINS.map((o) => (
              <li key={o}><span className="text-white">{PIK_ORIGIN_LABEL[o]}.</span>{" "}{PIK_ORIGIN_EXPLAIN[o]}</li>
            ))}
          </ul>
          {SEVERE_INDUSTRY && SEVERE_TOTAL > 0 && (
            <p>
              At {SEVERE_INDUSTRY.period_end.slice(0, 7)}{" "}severe PIK was {pc(SEVERE_TOTAL)}{" "}of the covered BDCs&apos;
              combined book at cost: {severeTypeList(SEVERE_INDUSTRY, SEVERE_TOTAL)}. Only the switched debt shows a
              borrower that moved from paying cash to paying half or more of its interest in kind while the BDC held
              the loan; many such loans still pay some cash.
            </p>
          )}
          <p>
            <span className="text-white">How the type is decided.</span>{" "}The instrument comes from the schedule&apos;s
            own description: preferred, equity or convertible wording, or — for filers that leave the instrument
            column blank — a suffix such as &quot;, Preferred Stock&quot; on the borrower&apos;s name (a name like
            &quot;… Preferred Holdings, Inc.&quot; is not an instrument). Ordinary unsecured notes stay debt. For
            debt, the loan&apos;s history decides. It is &quot;switched&quot; when the same loan paid cash for at least
            two quarters and then paid at least a fifth of its coupon in kind, still PIK at the next filing — or when
            it is a new PIK loan cut from the BDC&apos;s own cash-pay loans at a restructuring: the BDC held debt of
            the same borrower the quarter before, its cash-pay part shrank by at least half the new PIK loan&apos;s
            size, and its total lending to that borrower grew by no more than a quarter (a restructuring, not new
            money). A later re-cut of debt that had mostly switched stays switched.
            {RECUT_M > 0 && SWITCHED_M > 0
              ? ` At ${LATEST_INCOME_PERIOD.slice(0, 7)}, ${bn(RECUT_M)} of the ${bn(SWITCHED_M)} of severe switched debt was such a new PIK loan. Our loan history cannot always link a restructured loan to the one it replaced (FSK's split of a Kellermeyer Bergensons cash loan into a cash loan and a PIK loan is one case), so without this test these loans would read "first seen".`
              : ""}{" "}
            Debt is &quot;first seen&quot; when its first quarter in our data was already PIK and it was not cut from
            cash-pay debt the BDC held: a loan made with PIK terms, a loan restructured before our coverage of that
            BDC begins, or a refinancing that brought in more than a quarter of new money or sat under another
            borrower name. A loan that went PIK after a single cash quarter, or whose PIK crept up from a small
            share, is &quot;history unclear&quot; rather than guessed.
          </p>
          <p data-floating-cash-leg="">
            <span className="text-white">How a floating cash coupon is read.</span>{" "}{FLOATING_CASH_LEG_NOTE}{" "}
            The same applies to FSK, which prints the spread with the PIK part inside it, and to CCAP&apos;s spreads
            in basis points; where the filing also prints the loan&apos;s all-in rate, that rate less the PIK part is
            the cash coupon. Severity uses the cash coupon at each quarter end, so a loan&apos;s PIK share moves a
            little with SOFR.
          </p>
          <p>
            <span className="text-white">&quot;If severe PIK is lost&quot; on /income.</span>{" "}The base case takes the
            PIK of debt that switched from cash to PIK out of NII; the wider case also takes out severe PIK on debt
            already PIK when first seen. Neither removes PIK dividends on preferred stock or equity, PIK on
            convertible notes, or severe debt whose history is unclear. Each quarter&apos;s PIK from the cash-flow
            statement is shared out loan by loan by that quarter&apos;s PIK rate × principal, with loans on
            non-accrual at zero (they book no income), and the four quarters are added up — so a loan that switched
            late in the year is not charged for the whole year. This is the PIK ledger&apos;s allocation: an all-PIK
            floating loan quoted as a spread accrues at SOFR plus the spread, or at the all-in rate where the filing
            prints one. Severe loans carry far more PIK per dollar than lightly-PIK ones, so a split by cost would
            misstate them.
          </p>
          {FLAG && (
            <div data-switched-pik-flag={FLAG.threshold_pct_nii} className="space-y-3">
              <p>
                <span className="text-white">The PIK warning sign on dividend support.</span>{" "}One of the six signs
                is severe PIK on switched debt above {FLAG.threshold_pct_nii}% of NII over the last four quarters. It
                replaced &quot;PIK over 15% of NII with most of the PIK book severe&quot;, which counted preferred
                dividends and debt already PIK when first seen. The threshold is back-tested on{" "}
                {FLAG.n_bdc_quarters}{" "}BDC-quarters ({FLAG.n_bdcs}{" "}BDCs, {FLAG.from.slice(0, 7)}{" "}to{" "}
                {FLAG.to.slice(0, 7)}): the median BDC-quarter took {pc(FLAG.median_pct_nii)}{" "}of its NII from this
                source and {pc(FLAG.pct_bdc_quarters_flagged, 0)}{" "}were above {FLAG.threshold_pct_nii}%. Over the
                following twelve months those above it saw NAV per share change {signed(FLAG.flagged.fwd_nav_mean)}{" "}on
                average (median {signed(FLAG.flagged.fwd_nav_median)}) against {signed(FLAG.rest.fwd_nav_mean)}{" "}(median{" "}
                {signed(FLAG.rest.fwd_nav_median)}) for the rest, and a hard default rate of{" "}
                {pc(FLAG.flagged.fwd_hard_mean)}{" "}against {pc(FLAG.rest.fwd_hard_mean)}. The old sign did not separate
                the same quarters: {signed(FLAG.old_flagged.fwd_nav_mean)}{" "}against {signed(FLAG.old_rest.fwd_nav_mean)}{" "}
                NAV, and {pc(FLAG.old_flagged.fwd_hard_mean)}{" "}against {pc(FLAG.old_rest.fwd_hard_mean)}{" "}hard defaults.
              </p>
              <p>
                <span className="text-white">How the line was picked.</span>{" "}{SCAN_TEXT}
              </p>
              <div className="overflow-x-auto">
                <table className="text-xs" data-switched-pik-scan="">
                  <thead style={{ color: "#8b8ba8" }}>
                    <tr>
                      {["Line (% of NII)", "BDC-quarters above (BDCs)", "NAV/share next 12m: above vs rest (average)",
                        "… (median)", "Hard default rate: above vs rest"].map((h) => (
                        <th key={h} className="text-left font-semibold pr-4 pb-1">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FLAG.scan.map((x) => (
                      <tr key={x.threshold} style={{ color: Number(x.threshold) === Number(FLAG.threshold_pct_nii) ? "#fafafa" : "#d1d5db" }}>
                        <td className="pr-4 tabular-nums">{x.threshold}%{Number(x.threshold) === Number(FLAG.threshold_pct_nii) ? " (used)" : ""}</td>
                        <td className="pr-4 tabular-nums">{x.n} ({x.n_bdcs})</td>
                        <td className="pr-4 tabular-nums">{signed(x.fwd_nav_mean)} vs {signed(x.rest_nav_mean)}</td>
                        <td className="pr-4 tabular-nums">{signed(x.fwd_nav_median)} vs {signed(x.rest_nav_median)}</td>
                        <td className="pr-4 tabular-nums">{pc(x.fwd_hard_mean)} vs {pc(x.rest_hard_mean)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p data-switched-pik-benchmark="">
                <span className="text-white">Does it beat a plain &quot;lots of PIK&quot; sign?</span>{" "}{BENCHMARK_TEXT}
              </p>
              <p>
                Treat it as a pointer, not a proof: only {FLAG.flagged.n}{" "}BDC-quarters at {FLAG.flagged.n_bdcs}{" "}BDCs
                were above the line with a known outcome
                {FLAG.weakest_leave_one_out
                  ? `, and without ${FLAG.weakest_leave_one_out.without} the gap shrinks to ${signed(FLAG.weakest_leave_one_out.flagged.fwd_nav_mean)} against ${signed(FLAG.weakest_leave_one_out.rest.fwd_nav_mean)} on average (medians ${signed(FLAG.weakest_leave_one_out.flagged.fwd_nav_median)} against ${signed(FLAG.weakest_leave_one_out.rest.fwd_nav_median)})`
                  : ""}.
                It tells BDCs apart rather than timing one BDC, and the switch test looks one filing ahead to confirm
                that PIK persisted, so the back-test carries a quarter of hindsight at each switch.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 4b. Vintage dating */}
      <section id="vintage" className="mb-10 scroll-mt-6">
        <h2 className="text-lg font-semibold text-white mb-3">Vintage dating — how each loan gets its vintage year</h2>
        <div className="rounded-xl border p-5 text-sm space-y-3" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#d1d5db" }}>
          <p>
            The schedule&apos;s disclosed &ldquo;acquisition date&rdquo; is when the BDC acquired the{" "}
            <em>security</em>{" "}— a refinancing legally creates a new security, so the date can reset, and
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
            <span className="text-white">A loan can&apos;t be dated after we saw it.</span>{" "}If a candidate date is
            more than two quarters after the first filing that shows the loan (typically an amendment
            re-dating the loan, or a peer&apos;s date for a later facility), it is rejected and the next
            source is used. A BDC&apos;s own re-dated date replaced by the same tranche&apos;s peer date or a
            reliably covered first sighting counts as corrected (MED); anything else is an estimate (LOW). Each loan&apos;s tier comes from how stable its
            disclosure is across quarters and holders (HIGH ≤90 days of drift, MED ≤12 months); the
            default view uses HIGH+MED only. Refinancings that extend maturity are stitched to the
            original loan, and loans are keyed on the entity matcher&apos;s borrower id, so a renamed
            borrower stays one loan. When a filer starts printing a maturity it used to put only in the
            description (ARCC before 2022-09 &ldquo;… due 05/2029&rdquo;, OCSL before 2023), the description&apos;s
            date is used, so the loan is not split in two at the format change.
          </p>
          <p>
            <span className="text-white">Weights and pieces.</span>{" "}Each loan is weighted by its cost in the
            first quarter we saw it, summing every piece of the facility that quarter (for example a
            USD term loan, a GBP tranche and an add-on). Only a filing row read twice is dropped as a
            duplicate. Unfunded commitments are left out.
          </p>
          <p>
            <span className="text-white">Old enough to count.</span>{" "}At age T a cohort only counts loans
            whose vintage date is at least T before their BDC&apos;s latest filing, so every loan counted has
            had the full T years to default. Points with fewer than 20 such loans (30 for a single BDC),
            or with under a quarter of the cohort&apos;s cost old enough, are not published, and
            BDC-vs-industry comparisons use the oldest age every loan in the cohort has reached. Each age adds
            only the new events among the loans old enough to reach it (earlier ages keep the rate measured on
            the larger group), so a cumulative curve never dips just because fewer loans are old enough at its tail.
          </p>
          <p>
            <span className="text-white">Unknown non-accrual flags.</span>{" "}Where a BDC&apos;s non-accrual marks were
            not captured for a quarter, loans whose latest status is unknown are left out of that
            point rather than counted as performing; points where unknown history touches at least 5%
            of the counted cost are marked partial. The same applies to &ldquo;ever modified&rdquo;: a loan whose
            modification inputs could not be read in some quarter is left out from then on, never counted as
            unmodified, and &ldquo;ever below 80¢&rdquo; leaves out loans with no price mark (no par, such as equity).
          </p>
          <p>
            <span className="text-white">High-confidence figures.</span>{" "}A cohort gets a HIGH+MED-only figure only
            when those loans number at least 15 and carry at least a quarter of its counted cost; otherwise the
            all-dated figure is shown, untagged, and the BDC is not ranked on the HIGH+MED view. &ldquo;Mostly
            estimated&rdquo; means more than half of a cohort&apos;s entry cost is dated by an estimate rather than a
            disclosed date. MFIC joins the curves from 2022-03-31, the first quarter its schedule marks each
            non-accrual loan.
          </p>
          <p>
            <span className="text-white">Dating check:</span>{" "}
            {vintageGolden.overall.n > 0 ? (
              <>
                against a small reference set of {vintageGolden.n_reference_financings_matched}{" "}publicly documented
                financings ({vintageGolden.overall.n.toLocaleString()} matched loan-tranches; scored {vintageGolden.scored_on}),{" "}
                {vintageGolden.overall.pct_within_1y?.toFixed(0)}% of assigned vintage years are within ±1 year and the
                mean absolute error is {vintageGolden.overall.mae_years?.toFixed(2)}{" "}years
                {vintageGolden.by_bucket.borrowed?.mae_years != null && <> (peer same-tranche dates {vintageGolden.by_bucket.borrowed.mae_years.toFixed(2)}y on {vintageGolden.by_bucket.borrowed.n} tranches; own disclosed dates {vintageGolden.by_bucket.disclosed?.mae_years?.toFixed(2)}y on {vintageGolden.by_bucket.disclosed?.n})</>}.
                {vintageGolden.n_conflicting_loans_excluded > 0 && <> {vintageGolden.n_conflicting_loans_excluded} loans matched by reference rows that disagree on the year are left out.</>}{" "}
                {vintageGolden.caveat}{" "}It is a regression check, not a measure of accuracy across the whole book.
              </>
            ) : "not available for this release."}
          </p>
          <p>
            <span className="text-white">Disclosed dates only.</span>{" "}A second tab on /vintage keeps a stricter
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
          <AlertTriangle size={18} />{" "}Known caveats
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
              <span className="text-white">CCAP pre-XBRL.</span>{" "}
              CCAP&apos;s pre-XBRL parser extracted financial-statement summary rows instead of
              SOI positions, so those quarters are fully muted until XBRL kicks in. OCSL&apos;s older
              schedules (to 2022-12-31) print each loan&apos;s rate terms and maturity inside its
              description; those are now read from the description, so OCSL is no longer muted.
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
