import Link from "next/link";
import { TrendingUp, GitBranch } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t mt-16" style={{ borderColor: "#1e1e2e", background: "#0a0a0f" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#1e1e40", border: "1px solid #6366f1" }}>
                <TrendingUp size={14} className="text-indigo-400" />
              </div>
              <span className="font-bold text-white">BDC Transparency</span>
            </div>
            <p className="text-sm mb-4" style={{ color: "#8b8ba8" }}>
              Tracking software private credit across Business Development Companies. An open-source project
              aggregating public data from SEC filings, BDC disclosures, and industry sources.
            </p>
            <p className="text-xs" style={{ color: "#6b6b88" }}>
              Data sourced from SEC EDGAR, BDC Schedule of Investments, and public filings.
              Not investment advice. All data is for informational purposes only.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Navigate</h4>
            <ul className="space-y-2">
              {[
                { href: "/", label: "Market Overview" },
                { href: "/bdcs", label: "BDC List" },
                { href: "/companies", label: "Portfolio Companies" },
                { href: "/market", label: "Market Trends" },
                { href: "/non-accruals", label: "Non-Accruals" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm hover:text-white transition-colors" style={{ color: "#8b8ba8" }}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Resources</h4>
            <ul className="space-y-2">
              {[
                { href: "https://www.sec.gov/data-research/sec-markets-data/bdc-data-sets", label: "SEC BDC Data Sets" },
                { href: "https://efts.sec.gov/LATEST/search-index?q=%22schedule+of+investments%22&dateRange=custom&startdt=2025-01-01&forms=N-2", label: "SEC EDGAR Filings" },
                { href: "/about", label: "About This Project" },
              ].map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target={item.href.startsWith("http") ? "_blank" : undefined}
                    rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="text-sm hover:text-white transition-colors"
                    style={{ color: "#8b8ba8" }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <a
                href="https://github.com/andylai119-prog/bdc-transparency-open-source"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm transition-colors"
                style={{ color: "#8b8ba8" }}
              >
                <GitBranch size={14} />
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        <div className="border-t mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2" style={{ borderColor: "#1e1e2e" }}>
          <p className="text-xs" style={{ color: "#6b6b88" }}>
            © 2025 BDC Transparency. Open source under MIT License.
          </p>
          <p className="text-xs" style={{ color: "#6b6b88" }}>
            Data as of Q3 2025 · Not investment advice
          </p>
        </div>
      </div>
    </footer>
  );
}
