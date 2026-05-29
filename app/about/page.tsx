import Link from "next/link";
import { GitBranch, Database, FileText, BarChart3, Shield } from "lucide-react";

export default function AboutPage() {
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
          and credit-modification metrics use distinct methodologies. Both are cost-weighted across our
          19 covered BDCs, with MFIC excluded from non-accrual metrics (its SOI doesn&apos;t flag NA
          per-position).
        </p>

        <h3 className="text-sm font-semibold text-white mt-4 mb-2">Cumulative default exposure (pct_ever_default)</h3>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "#9ca3af" }}>
          Cumulative share of vintage cost ever flagged non-accrual OR exited the portfolio in distress
          (loan exited at a mark below 0.85, or after ever being NA / below 80¢). This matches Raymond
          James&apos;s published &ldquo;cumulative 1L default exposure&rdquo; methodology. The prior
          pct_ever_na metric only counted on-book non-accruals, so it ran 4-10× LOWER than RJ — loans
          that defaulted then exited via write-off, distressed sale, or debt-for-equity were invisible.
        </p>

        <h3 className="text-sm font-semibold text-white mt-4 mb-2">Multi-signal modifications (pct_ever_modified, pct_any_mod_cost)</h3>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "#9ca3af" }}>
          Four signals comprise a &ldquo;modification event&rdquo; on a loan:
        </p>
        <ul className="text-xs leading-relaxed mb-3 pl-5 list-disc" style={{ color: "#9ca3af" }}>
          <li><span className="text-white">Cash → PIK flip</span> — loan was previously cash-pay, now has PIK component</li>
          <li><span className="text-white">Maturity extension</span> — maturity_date jumped &gt;180 days forward vs prior quarter</li>
          <li><span className="text-white">Par haircut</span> — par dropped &gt;15% AND at least one other BDC holder saw a drop the same quarter (cross-BDC corroboration — excludes one-BDC partial sales which aren&apos;t borrower modifications)</li>
          <li><span className="text-white">Spread/coupon cut</span> — cash_rate_bps dropped &gt;50bps vs prior quarter</li>
        </ul>
        <p className="text-xs leading-relaxed mb-2" style={{ color: "#9ca3af" }}>
          Pre-2026-05-18 the dashboard only tracked PIK flips, capturing roughly 10% of true modifications.
          The new multi-signal metric typically runs 3-5× higher and matches industry definitions of
          &ldquo;modified loan&rdquo;. 2022 and 2023 vintages show ever-modified rates of 16% by age 12q
          vs 2018&apos;s 2% — consistent with the rate-shock-driven restructuring wave.
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
          <li>Vintage rollup excludes loans whose holder BDC&apos;s parser coverage started <em>after</em> their vintage_year (eliminates BCRED / ADS / ASIF / BBDC survivor bias from older vintages)</li>
          <li>Modification cross-BDC corroboration only fires for loans held by 2+ BDCs (~6% of universe by count, ~40% by cost) — solo-held loans rely on the &gt;15% threshold alone</li>
          <li>BDC-disclosed acquisition_date is the latest amendment date in some filers (notably non-traded BDCs), not original origination. We correct this with MIN-across-observations, cross-BDC consensus favoring public filers, and a LIBOR→SOFR retag detector; the residual 2021-cohort inflation (~2.25× neighbors vs Raymond James&apos;s ~1.5×) is the floor achievable without external origination data</li>
          <li>Pre-2018 vintages are excluded; FSK/OBDC pre-2022 excluded due to parser limitations</li>
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
