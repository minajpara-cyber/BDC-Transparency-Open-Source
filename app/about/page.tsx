import Link from "next/link";
import { GitBranch, Database, FileText, BarChart3, Shield } from "lucide-react";
import { siteMeta } from "@/data/site_meta";
import { creditQuality } from "@/data/credit_quality";
import { industryNaPool, naPoolExclusionText } from "@/lib/naCoverage";
import { dataReleaseManifestPath, laggingIssuers, longTailReportingDate } from "@/lib/dataRelease";
import { checkDataRelease } from "@/lib/dataReleaseCheck";

export default function AboutPage() {
  const lagging = laggingIssuers();
  const naPool = industryNaPool(creditQuality);
  // The release file's checksums must still match the data this build ships;
  // otherwise its checks describe an earlier version of the data.
  const release = checkDataRelease();
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-3">About BDC Transparency</h1>
        <p className="text-base leading-relaxed" style={{ color: "#9ca3af" }}>
          BDC Transparency is an open-source project that tracks software private credit investments made
          by Business Development Companies (BDCs). We aggregate public data from SEC filings, quarterly
          reports, and industry sources to provide transparency into one of the fastest-growing and least
          transparent corners of private markets.
        </p>
      </div>

      {/* Mission */}
      <div className="rounded-xl border p-6 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-3">Mission</h2>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "#d1d5db" }}>
          Private credit has grown from a niche asset class to a $2 trillion market. Business Development
          Companies—the publicly regulated vehicles that make private loans—now manage over $450 billion in
          assets and have more than 29% exposure to software companies.
        </p>
        <p className="text-sm leading-relaxed mb-4" style={{ color: "#d1d5db" }}>
          Despite being regulated, much of the data in BDC portfolios is scattered across thousands of pages
          of SEC filings, inconsistently classified, and hard to aggregate. Industry misclassification is
          rampant—Bloomberg found over 250 software loans worth $9B+ categorized under other industries.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "#d1d5db" }}>
          Our goal is to aggregate, standardize, and publish this data freely—enabling investors, researchers,
          journalists, and regulators to understand the true concentration of risk in BDC software portfolios.
        </p>
      </div>

      {/* What We Track */}
      <div className="rounded-xl border p-6 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-4">What We Track</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              icon: <BarChart3 size={18} />,
              title: "BDC Portfolios",
              description: "Software exposure percentage, non-accrual rates, PIK rates, NAV, dividend yield, and credit quality metrics for 30+ BDCs.",
            },
            {
              icon: <Database size={18} />,
              title: "Portfolio Companies",
              description: "Individual software companies held across BDC portfolios, including loan type, spread, maturity, fair value, and pricing.",
            },
            {
              icon: <Shield size={18} />,
              title: "Credit Risk",
              description: "Non-accrual positions, PIK-paying companies, restructured credits, and overall distress indicators across the BDC universe.",
            },
            {
              icon: <FileText size={18} />,
              title: "Market Trends",
              description: "Historical trends in BDC AUM growth, software exposure trajectory, PIK rates, non-accrual rates, and fundraising activity.",
            },
          ].map((item) => (
            <div key={item.title} className="flex gap-3 p-4 rounded-lg" style={{ background: "#0f0f16", border: "1px solid #1e1e2e" }}>
              <div className="mt-0.5 flex-shrink-0" style={{ color: "#6366f1" }}>{item.icon}</div>
              <div>
                <div className="text-sm font-medium text-white mb-1">{item.title}</div>
                <div className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>{item.description}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Sources */}
      <div className="rounded-xl border p-6 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-4">Data Sources</h2>
        <div className="space-y-3">
          {[
            {
              source: "SEC EDGAR — Consolidated Schedule of Investments",
              description: "The primary data source. Every BDC files quarterly (10-Q) and annual (10-K) reports including a detailed Schedule of Investments listing every loan, its fair value, interest rate, and status.",
              url: "https://www.sec.gov/data-research/sec-markets-data/bdc-data-sets",
            },
            {
              source: "SEC BDC Data Sets",
              description: "The SEC publishes structured BDC data extracted from XBRL filings, including schedule of investments reports, financial data sets, and summary data.",
              url: "https://www.sec.gov/data-research/sec-markets-data/bdc-data-sets",
            },
            {
              source: "BDC Quarterly Reports & Press Releases",
              description: "Quarterly earnings releases and investor presentations from individual BDCs provide supplemental portfolio data, sector breakdowns, and management commentary.",
            },
            {
              source: "Industry Research",
              description: "Published analyses from S&P Global, Octus (formerly Reorg), BDC Credit Reporter, KBRA, Bloomberg, and PitchBook on BDC software exposure and private credit trends.",
            },
            {
              source: "Secondary Market Pricing",
              description: "Secondary market bid/offer data published by JPMorgan and other dealers provides real-time price discovery for illiquid private credit instruments.",
            },
          ].map((item) => (
            <div key={item.source} className="p-4 rounded-lg" style={{ background: "#0f0f16", border: "1px solid #1e1e2e" }}>
              <div className="flex items-start justify-between gap-2">
                <div className="text-sm font-medium text-white">{item.source}</div>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs flex-shrink-0" style={{ color: "#6366f1" }}>
                    Visit →
                  </a>
                )}
              </div>
              <div className="text-xs mt-1 leading-relaxed" style={{ color: "#9ca3af" }}>{item.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Data notes — what this release covers, in plain English */}
      <div id="data-notes" className="rounded-xl border p-6 mb-6 scroll-mt-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-4">Data notes</h2>
        <ul className="text-sm leading-relaxed space-y-2 pl-5 list-disc" style={{ color: "#d1d5db" }}>
          <li>
            Latest quarter: <span className="text-white">{siteMeta.latest_quarter}</span> (ending {siteMeta.latest_period}),
            from {siteMeta.n_filings} SEC filings across {siteMeta.n_bdcs} BDCs. Data updated {siteMeta.generated_at}.
          </li>
          <li>
            {lagging.length === 0
              ? `Every one of the ${siteMeta.n_bdcs} BDCs we parse has filed for that quarter.`
              : `Not yet filed for that quarter: ${lagging.map((l) => `${l.ticker} (latest ${l.period})`).join(", ")}. Their pages show their latest filing.`}
          </li>
          {longTailReportingDate && (
            <li>
              The smaller BDCs we add from the SEC&apos;s bulk data sets (used in industry mark comparisons and the
              borrower universe) run only through {longTailReportingDate}.
            </li>
          )}
          {naPool.latest && (
            <li>
              The pooled industry non-accrual rate for {naPool.latest}
              {naPool.industry?.na_covered_bdcs != null ? ` covers ${naPool.industry.na_covered_bdcs} BDCs` : ""};{" "}
              {naPoolExclusionText(naPool)}.
            </li>
          )}
          <li>
            &ldquo;—&rdquo; means a number is unknown; 0.00% means a confirmed zero. Figures labelled
            &ldquo;catalog estimate&rdquo; are hand-compiled for BDCs we don&apos;t parse, not read from filings.
          </li>
          {release.verified && release.checkedOn && (
            <li>
              Each release passes automated consistency checks before it is published (last run {release.checkedOn}).
              These checks are not an independent audit of every loan or event.
            </li>
          )}
          {!release.verified && release.checkedOn && (
            <li>
              Some data files were regenerated after the last automated release check ({release.checkedOn}) and
              have not been through it again yet, so this version is not covered by that check.
            </li>
          )}
        </ul>
        {release.verified && release.releaseId && (
          <p className="text-xs mt-4" style={{ color: "#6b6b88" }}>
            Release {release.releaseId}. For technical readers, the{" "}
            <a href={dataReleaseManifestPath} className="underline">release file</a> lists every data file&apos;s
            version and checksum.
          </p>
        )}
      </div>

      {/* BDC Basics */}
      <div className="rounded-xl border p-6 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-4">BDC Basics</h2>
        <div className="space-y-4">
          {[
            {
              q: "What is a Business Development Company (BDC)?",
              a: "A Business Development Company (BDC) is a type of closed-end investment company in the United States that invests in the debt and equity of small and mid-sized private companies. Created by Congress in 1980, BDCs provide individual investors with access to private credit. BDCs are regulated under the Investment Company Act of 1940 and must invest at least 70% of assets in eligible portfolio companies.",
            },
            {
              q: "What is private credit?",
              a: "Private credit refers to loans and other debt instruments that are originated and held by non-bank lenders, rather than traded in public markets. Unlike syndicated loans (which are sold to many investors), private credit is directly negotiated between lender and borrower. Private credit has grown dramatically since 2020, particularly in software, healthcare, and business services.",
            },
            {
              q: "What is a non-accrual loan?",
              a: "A non-accrual loan is one on which the BDC has stopped recognizing interest income because the borrower is struggling to make payments. Non-accrual designation is a significant credit event that typically indicates financial distress. BDCs disclose non-accrual loans in their Schedule of Investments.",
            },
            {
              q: "What is PIK (Payment-in-Kind)?",
              a: "PIK stands for Payment-in-Kind. A PIK loan allows the borrower to 'pay' interest by adding it to the principal balance rather than making cash payments. While not necessarily a sign of distress, high PIK rates can indicate that borrowers are cash-constrained. PIK interest accounted for ~12.8% of BDC loan portfolios as of Q3 2025.",
            },
            {
              q: "What is ARR-based lending?",
              a: "ARR-based lending (also called recurring revenue lending or ARR loans) is a form of private credit where loan sizing is based on Annual Recurring Revenue rather than EBITDA. This enabled lending to high-growth, low-profit SaaS companies. Many ARR-based loans were made at peak 2020-2022 valuations and are now facing AI disruption risk.",
            },
          ].map((item) => (
            <div key={item.q}>
              <div className="text-sm font-medium text-white mb-1">{item.q}</div>
              <div className="text-sm leading-relaxed" style={{ color: "#9ca3af" }}>{item.a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Methodology — vintage & modifications */}
      <div className="rounded-xl border p-6 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-4">Methodology — Vintage & Modifications</h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: "#d1d5db" }}>
          The <Link href="/vintage" className="text-indigo-400 hover:underline">vintage analysis</Link>{" "}
          and quarterly credit-modification metrics use distinct methodologies and covered populations.
          Quarterly flow rates use matched debt observations; holding cohorts show quarter-end
          non-accrual evidence and unresolved observation bounds. A quarter whose loan-by-loan status can&apos;t be
          decoded, or disagrees with the BDC&apos;s own disclosed rate for that date, uses that disclosed rate instead.
        </p>

        <h3 className="text-sm font-semibold text-white mt-4 mb-2">Dated holding cohorts</h3>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "#9ca3af" }}>
          Cohorts separate the holder&apos;s own disclosed acquisition date from the first observation
          in our filing history. Neither establishes original loan origination. Acquisition cohorts
          require first observation in the acquisition quarter; monitoring cohorts can contain seasoned
          loans. Ambiguous identities are excluded. For a selected follow-up horizon, fully seasoned
          holding groups retain the same initial-cost denominator at every age.
        </p>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "#9ca3af" }}>
          The lower bound counts initial cost of groups with any observed quarter-end non-accrual;
          the upper adds groups with unresolved past status. A positive position contributes the entire
          holding-group weight, not the actual non-accrual dollars. Baseline positives are included,
          gaps remain unresolved, and disappearance does not establish an outcome. These bounds do
          not estimate continuous-time defaults, realized losses or survival. Current acquisition
          composition is shown separately, with unknown dates and issuer reporting dates retained.
        </p>

        <h3 className="text-sm font-semibold text-white mt-4 mb-2">Quarterly loan modifications</h3>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "#9ca3af" }}>
          We infer modifications by comparing each loan&apos;s terms from one quarter to the next; they are
          not amendments the BDC has confirmed. The quarterly headline, the severity chart and the named-events
          table all use the same cash → PIK definition. The broader events table uses five signals, which can
          overlap:
        </p>
        <ul className="text-xs leading-relaxed mb-3 pl-5 list-disc" style={{ color: "#9ca3af" }}>
          <li><span className="text-white">Cash → PIK</span> — a loan that paid cash interest for two quarters in a row starts paying a meaningful part of its interest in kind (PIK). &ldquo;Meaningful&rdquo; is judged from the PIK share of the coupon or an all-PIK label; if the split isn&apos;t disclosed, a PIK rate of at least 1.5% counts, and if that is missing too the event is kept with severity &ldquo;unknown&rdquo;. It stays provisional until PIK shows up again the next quarter.</li>
          <li><span className="text-white">Maturity extension</span> — the maturity date moves out by at least six months. Some filings give maturity only to the month or year.</li>
          <li><span className="text-white">Stressed cut to the loan amount</span> — par falls by more than 15% while the loan was marked below 85¢ or on non-accrual, or the BDC newly holds equity in the borrower. This suggests a write-down but can&apos;t rule out a partial sale.</li>
          <li><span className="text-white">Spread cut</span> — the margin over the base rate falls by more than 0.5 percentage points. The cash coupon can move differently.</li>
          <li><span className="text-white">Lien downgrade</span> — the matched loan moves to a lower-ranking class (for example, first lien to second lien).</li>
        </ul>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "#9ca3af" }}>
          Rates are measured against the cost, in US dollars, of drawn loans whose PIK status we can see at
          both consecutive quarter-ends. Loans of unknown type, quarters with gaps and unfunded commitments are
          left out. A BDC with no events still counts (as zero), and events of unknown severity still count in
          the total. The industry line needs at least 10 BDCs and leaves out any BDC-quarter where 30% or more
          of the book flipped to PIK. Not every loan can be measured, so coverage is partial.
        </p>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "#9ca3af" }}>
          Each named event shows the before-and-after rows from the filings it compares; its reference
          identifies that comparison, not a legal loan agreement. A loan switching back from PIK to cash is
          not proof the borrower has recovered. The vintage page&apos;s non-accrual figures use a different,
          historical set of loans and should not be read as quarterly modification rates.
        </p>

        <h3 className="text-sm font-semibold text-white mt-4 mb-2">Sector classification &amp; borrower profiles</h3>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "#9ca3af" }}>
          Sectors come from the SOI&apos;s disclosed industry where available. BDCs that don&apos;t
          disclose one (Main Street, and Barings before its parser was fixed) are filled by a layered
          enrichment — the BDC&apos;s own prior-quarter label, then cross-BDC consensus on the same
          borrower, then curated metadata, then a conservative borrower-name keyword classifier, else
          &ldquo;Unclassified.&rdquo; A BDC whose disclosed industry is systematically unreliable can be
          distrusted and routed through the same fallback (Golub&apos;s column was mis-tagged and has
          since been fixed at the parser level).
        </p>
        <p className="text-xs leading-relaxed mb-3" style={{ color: "#9ca3af" }}>
          The largest ~180 borrowers also carry a model-curated profile (canonical sector, sub-sector,
          one-line business description), shown on the borrower pages and the{" "}
          <Link href="/companies" className="text-indigo-400 hover:underline">watchlist</Link>.
          <span className="text-white"> No revenue, EBITDA or sponsor figures are model-generated</span> —
          only checkable classification fields, with cryptic shell-entity names left blank rather than
          guessed. Sponsor attribution links borrowers to PE firms via the entity matcher plus a curated
          sponsor map.
        </p>

        <h3 className="text-sm font-semibold text-white mt-4 mb-2">Coverage caveats</h3>
        <ul className="text-xs leading-relaxed pl-5 list-disc" style={{ color: "#9ca3af" }}>
          <li>Acquisition cohorts exclude holdings first observed after their acquisition quarter. This limits late-entry bias but does not establish complete historical coverage; missing quarters and unknown flags remain visible in the bounds.</li>
          <li>Matching a loan across quarters can mistake a refinancing or a relabelled loan for an amendment, and the rules can&apos;t confirm legal terms or promise to catch every modification.</li>
          <li>Acquisition disclosures can refer to purchases or new securities, and changing or contradictory dates require review. First observed is a monitoring anchor only. No externally validated origination-accuracy rate is claimed.</li>
          <li>Cohort results depend on available issuer history, identified funded-debt coverage and the chosen follow-up horizon. Current composition and historical cohort denominators are different populations.</li>
        </ul>
      </div>

      {/* Open Source */}
      <div className="rounded-xl border p-6 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <div className="flex items-start gap-3">
          <GitBranch size={20} className="text-white mt-0.5" />
          <div>
            <h2 className="font-semibold text-white mb-2">Open Source</h2>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "#d1d5db" }}>
              BDC Transparency is open source under the MIT License. All code and data collection
              methodology is publicly available. Contributions are welcome—especially data updates,
              new BDC additions, and improved industry classification logic.
            </p>
            <a
              href="https://github.com/andylai119-prog/bdc-transparency-open-source"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}
            >
              <GitBranch size={14} />
              View on GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-xl border p-5" style={{ background: "#0f0f16", borderColor: "#1e1e2e" }}>
        <h2 className="text-sm font-semibold text-white mb-2">Disclaimer</h2>
        <p className="text-xs leading-relaxed" style={{ color: "#8b8ba8" }}>
          BDC Transparency is an informational resource only and does not constitute investment advice, a recommendation to buy or sell any security,
          or an offer to provide investment management or advisory services. All data is sourced from public filings and publicly available information.
          We make no representations as to the accuracy, completeness, or timeliness of any information on this site. Past credit performance does not
          predict future results. Investments in BDCs and private credit involve significant risks including illiquidity, leverage, and credit risk.
          Always consult a qualified financial professional before making investment decisions.
        </p>
      </div>
    </div>
  );
}
