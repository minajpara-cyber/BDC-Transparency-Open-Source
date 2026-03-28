"use client";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import AlertBadge from "@/components/AlertBadge";
import {
  bdcAumHistory,
  nonAccrualHistory,
  pikRateHistory,
  softwareExposureHistory,
  bdcSalesHistory,
  bdcSectorExposure,
  topBDCSoftwareExposure,
} from "@/data/market";
import { marketStats } from "@/data/bdcs";
import { portfolioCompanies } from "@/data/companies";

const CHART_COLORS = {
  primary: "#6366f1",
  secondary: "#22c55e",
  warning: "#eab308",
  danger: "#ef4444",
  muted: "#475569",
};

const tooltipStyle = {
  background: "#111118",
  border: "1px solid #2d2d45",
  borderRadius: "8px",
  color: "#d1d5db",
  fontSize: "12px",
};

export default function MarketPage() {
  const aiRiskBreakdown = [
    { name: "Critical", count: portfolioCompanies.filter(c => c.aiRisk === "Critical").length, color: "#ef4444" },
    { name: "High", count: portfolioCompanies.filter(c => c.aiRisk === "High").length, color: "#f97316" },
    { name: "Medium", count: portfolioCompanies.filter(c => c.aiRisk === "Medium").length, color: "#eab308" },
    { name: "Low", count: portfolioCompanies.filter(c => c.aiRisk === "Low").length, color: "#22c55e" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-white mb-2">Market Trends & Analytics</h1>
        <p className="text-sm" style={{ color: "#8b8ba8" }}>
          BDC market data, software exposure trends, credit quality metrics, and AI disruption risk analysis.
          Data as of Q3 2025.
        </p>
      </div>

      {/* Key Market Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Total BDC AUM", value: "$450B", sub: "4x growth since 2020", color: "#6366f1" },
          { label: "Software Exposure", value: "29.0%", sub: "↑ from 22% in 2022", color: "#f97316" },
          { label: "Avg PIK Rate", value: "12.8%", sub: "↓ from 13.5% peak", color: "#eab308" },
          { label: "Non-Accrual Rate", value: "1.8%", sub: "↓ from 2.3% peak", color: "#22c55e" },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
            <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>{m.label}</div>
            <div className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</div>
            <div className="text-xs mt-1" style={{ color: "#6b6b88" }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* BDC AUM Growth */}
        <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white mb-1">BDC Market AUM Growth</h2>
          <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>Total BDC AUM ($B) — 4x growth since 2020</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={bdcAumHistory}>
              <defs>
                <linearGradient id="aumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="date" tick={{ fill: "#8b8ba8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b8ba8", fontSize: 11 }} tickFormatter={(v) => `$${v}B`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v}B`, "AUM"]} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#aumGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Software Exposure Trend */}
        <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white mb-1">Software Exposure Trend</h2>
          <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>BDC-weighted average software portfolio % over time</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={softwareExposureHistory}>
              <defs>
                <linearGradient id="swGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="date" tick={{ fill: "#8b8ba8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b8ba8", fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[18, 32]} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Software Exposure"]} />
              <Area type="monotone" dataKey="value" stroke="#f97316" fill="url(#swGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Non-Accrual Rate */}
        <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white mb-1">Non-Accrual Rate History</h2>
          <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>Weighted average BDC non-accrual rate (%)</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={nonAccrualHistory}>
              <defs>
                <linearGradient id="naGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="date" tick={{ fill: "#8b8ba8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b8ba8", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "Non-Accrual Rate"]} />
              <Area type="monotone" dataKey="value" stroke="#ef4444" fill="url(#naGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* PIK Rate History */}
        <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white mb-1">PIK Rate History</h2>
          <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>Payment-in-kind as % of total BDC loan portfolio</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={pikRateHistory}>
              <defs>
                <linearGradient id="pikGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="date" tick={{ fill: "#8b8ba8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b8ba8", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, "PIK Rate"]} />
              <Area type="monotone" dataKey="value" stroke="#eab308" fill="url(#pikGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Non-Traded BDC Sales */}
        <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white mb-1">Non-Traded BDC Sales Decline</h2>
          <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>Monthly non-traded BDC fundraising ($B) — down 49% from March 2025 peak</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bdcSalesHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="date" tick={{ fill: "#8b8ba8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#8b8ba8", fontSize: 11 }} tickFormatter={(v) => `$${v}B`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`$${v}B`, "Monthly Sales"]} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {bdcSalesHistory.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.value >= 5 ? "#22c55e" : entry.value >= 4 ? "#eab308" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sector Exposure Pie */}
        <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <h2 className="font-semibold text-white mb-1">BDC Sector Allocation</h2>
          <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>Weighted average across all tracked BDCs</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={bdcSectorExposure}
                dataKey="percent"
                nameKey="sector"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
              >
                {bdcSectorExposure.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}%`, ""]} />
              <Legend
                formatter={(value) => <span style={{ color: "#d1d5db", fontSize: "11px" }}>{value}</span>}
                iconSize={8}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Software Exposure by BDC */}
      <div className="rounded-xl border p-5 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-1">Software Exposure by BDC</h2>
        <p className="text-xs mb-4" style={{ color: "#8b8ba8" }}>Top 10 BDCs ranked by software portfolio exposure (%)</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={topBDCSoftwareExposure} layout="vertical" margin={{ left: 180 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis type="number" tick={{ fill: "#8b8ba8", fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
            <YAxis
              type="category"
              dataKey="ticker"
              tick={{ fill: "#a5b4fc", fontSize: 12, fontWeight: 600 }}
              width={170}
              tickFormatter={(ticker) => {
                const bdc = topBDCSoftwareExposure.find(b => b.ticker === ticker);
                return bdc ? `${ticker} – ${bdc.bdc.split(" ").slice(0, 2).join(" ")}` : ticker;
              }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v, name, props) => [`${v}%`, props.payload.bdc]}
            />
            <Bar dataKey="softwareExposure" radius={[0, 4, 4, 0]}>
              {topBDCSoftwareExposure.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.softwareExposure >= 50 ? "#ef4444" : entry.softwareExposure >= 25 ? "#f97316" : "#6366f1"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* AI Risk */}
      <div className="rounded-xl border p-5 mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-4">AI Disruption Risk Overview</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "#9ca3af" }}>
              Enterprise SaaS has been the single largest sector in private credit for years. These were supposed to be safe loans—sticky recurring revenue,
              high margins, predictable cash flows. Now, every one of those assumptions is being stress-tested by AI simultaneously.
            </p>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "#9ca3af" }}>
              Software companies comprise ~29% of BDC portfolios, and UBS estimates 25–35% of private credit portfolios face heightened threats from AI.
              Apollo cut its software exposure from ~20% to ~10% during 2025, signaling de-risking by sophisticated players.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "AI-at-risk", value: "25–35%", sub: "of private credit portfolios", color: "#ef4444" },
                { label: "Software loans at risk", value: "$25B+", sub: "trading below 80¢ (leveraged loan mkt)", color: "#f97316" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border p-3" style={{ background: "#0f0f16", borderColor: "#2d2d45" }}>
                  <div className="text-xs mb-1" style={{ color: "#8b8ba8" }}>{s.label}</div>
                  <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs" style={{ color: "#6b6b88" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8b8ba8" }}>
              Tracked Portfolio — AI Risk Distribution
            </div>
            <div className="space-y-3">
              {aiRiskBreakdown.map((r) => (
                <div key={r.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: r.color }}>{r.name} Risk</span>
                    <span style={{ color: "#d1d5db" }}>{r.count} companies</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "#1a1a28" }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(r.count / portfolioCompanies.length) * 100}%`, background: r.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg" style={{ background: "#0f0f16", border: "1px solid #1e1e2e" }}>
              <div className="text-xs font-semibold mb-2 text-white">Key AI Risk Factors</div>
              <ul className="space-y-1">
                {[
                  "Customer service / CRM — Direct AI substitution (Zendesk, Medallia)",
                  "Document management — AI extracts and automates workflows",
                  "FP&A / Planning — AI-native tools emerging (Anaplan)",
                  "IT monitoring — AI-driven AIOps commoditizing ITOM",
                  "Tax compliance — Highly rules-based, low near-term AI risk",
                  "GovTech — Regulated, sticky contracts, low AI risk",
                ].map((item) => (
                  <li key={item} className="text-xs flex items-start gap-1.5" style={{ color: "#9ca3af" }}>
                    <span className="mt-0.5" style={{ color: "#6366f1" }}>›</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Market Context */}
      <div className="rounded-xl border p-5" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white mb-4">Credit Market Context</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: "BDC Debt Maturity Wall",
              content: "23 out of 32 rated BDCs have unsecured debt maturing in 2026, totaling $12.7B — a 73% increase over 2025. Refinancing at higher spreads could pressure distributions.",
              severity: "High" as const,
            },
            {
              title: "Redemption Pressure",
              content: "OTIC: 17% redemptions Q4 2025. BCRED: 4.5% Q3 2025. ASIF: 5.6%. Non-traded BDC monthly sales fell to $3.2B in Jan 2026, down 49% from March 2025 peak.",
              severity: "High" as const,
            },
            {
              title: "Loan Valuation Stability",
              content: "Despite software sector concerns, average price across BDC software holdings was 97.8¢ as of Q3 2025, with fewer than 10% of loans maturing before 2028. Near-term defaults remain limited.",
              severity: "Low" as const,
            },
            {
              title: "Apollo's De-Risking Signal",
              content: "Apollo Global Management reduced software exposure in its credit portfolios from ~20% to ~10% during 2025—a notable signal from one of private credit's most sophisticated players.",
              severity: "Medium" as const,
            },
            {
              title: "Secondary Market Activity",
              content: "JPMorgan circulated a list of 38 private credit investments for secondary trading in March 2025. Most priced near par, but Medallia (94/97) and Conga showed more distress.",
              severity: "Medium" as const,
            },
            {
              title: "Golub Dividend Cut",
              content: "Golub Capital BDC (GBDC), with ~26% software exposure, cut its dividend 15% in early 2026, with analysts forecasting another 10–20% reduction. Canary in the coal mine?",
              severity: "High" as const,
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border p-4" style={{ background: "#0f0f16", borderColor: "#2d2d45" }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertBadge severity={item.severity} label />
              </div>
              <div className="text-sm font-medium text-white mb-2">{item.title}</div>
              <div className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>{item.content}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
