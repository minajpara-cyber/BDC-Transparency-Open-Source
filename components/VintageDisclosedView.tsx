"use client";

// "Disclosed dates only" tab on /vintage — Codex's strict holding-cohort view,
// kept as a secondary view and a cross-check on the main curves. Only a BDC's
// own disclosed acquisition date (or the first quarter we saw the holding) is
// used; nothing is estimated. Results are lower/upper bounds on observed
// quarter-end non-accrual, not default rates.
import { useState } from "react";
import Link from "next/link";
import VintageBoundsChart from "@/components/VintageBoundsChart";
import CsvDownloadButton from "@/components/CsvDownloadButton";
import { disclosedCohorts, disclosedPoints, disclosedCoverage, disclosedExposure } from "@/data/vintage_disclosed";

const pct = (value: number | null | undefined) => value == null ? "Unknown" : `${value.toFixed(2)}%`;
const money = (value: number | null | undefined) => value == null ? "Unknown" : `$${value.toFixed(3)}B`;
const dates = (min: string | null | undefined, max: string | null | undefined) => !min || !max ? "No snapshot" : min === max ? min : `${min} – ${max}`;
const panel = { background: "#111118", borderColor: "#1e1e2e" };

function DisclosedExposureTable() {
  const years = Array.from(new Set(disclosedExposure.flatMap((r) => r.vintage_year == null ? [] : [r.vintage_year]))).sort((a, b) => a - b);
  const tickers = Array.from(new Set(disclosedExposure.map((r) => r.ticker))).sort((a, b) => a === "industry" ? 1 : b === "industry" ? -1 : a.localeCompare(b));
  const grouped = tickers.map((ticker) => {
    const rows = disclosedExposure.filter((r) => r.ticker === ticker);
    const cells = new Map<number | null, number | null>();
    for (const r of rows) cells.set(r.vintage_year, r.pct_cost == null || cells.get(r.vintage_year) === null ? null : (cells.get(r.vintage_year) ?? 0) + r.pct_cost);
    const starts = rows.map((r) => r.period_end_min).filter((d): d is string => Boolean(d)).sort();
    const ends = rows.map((r) => r.period_end_max).filter((d): d is string => Boolean(d)).sort();
    const min = starts[0];
    const max = ends[ends.length - 1];
    return { ticker, cells, coverage: disclosedCoverage.find((r) => r.ticker === ticker), cost: rows.reduce((sum, r) => sum + r.cost_b, 0), date: min && max ? min === max ? min : `${min} – ${max}` : "Unknown" };
  });
  const columns = [...years, null];
  return (
    <section className="rounded-xl border overflow-hidden mt-8" style={panel}>
      <div className="p-5 flex items-start justify-between gap-4">
        <div><h2 className="font-semibold text-white">Latest book by disclosed acquisition year</h2>
          <p className="text-xs text-gray-400 mt-2 max-w-4xl">Share of known positive funded-debt cost by each holder&apos;s own disclosed acquisition year. Unknown or conflicting dates stay in the Unknown column (BDCs that never disclose acquisition dates are 100% Unknown here; the main view dates them from peers or labelled estimates). Acquisition year is not documented original loan origination.</p></div>
        <CsvDownloadButton filename="disclosed-acquisition-mix" columns={["ticker", "period_end", ...years.map(String), "unknown_date_pct", "selected_debt_cost_b"]}
          rows={grouped.map((r) => [r.ticker, r.date, ...columns.map((y) => r.cells.has(y) ? r.cells.get(y) : r.cost > 0 ? 0 : null), r.cost])} />
      </div>
      <div className="overflow-x-auto"><table className="w-full text-xs text-right">
        <thead className="text-gray-400"><tr><th className="p-3 text-left">Holder</th><th className="p-3 text-left">As of</th>{columns.map((year) => <th className="p-3" key={year ?? "unknown"}>{year ?? "Unknown"}</th>)}<th className="p-3 whitespace-nowrap">Cost ($B)</th></tr></thead>
        <tbody>{grouped.map((r) => <tr key={r.ticker} className="border-t border-gray-800 text-gray-300">
          <td className="p-3 text-left font-semibold text-indigo-300">{r.ticker === "industry" ? "Pooled holders" : <Link href={`/bdcs/${r.ticker.toLowerCase()}`}>{r.ticker}</Link>}</td><td className="p-3 text-left whitespace-nowrap">{r.date}{r.coverage && !r.coverage.cost_complete && <div className="text-amber-300 mt-1">{r.coverage.n_missing_cost_holdings} groups missing cost</div>}</td>
          {columns.map((year) => { const v = r.cells.has(year) ? r.cells.get(year) : r.cost > 0 ? 0 : null; return <td key={year ?? "unknown"} className="p-3 tabular-nums" style={{ background: v != null && v > 0 ? `rgba(99,102,241,${0.06 + Math.min(v / 100, 1) * 0.6})` : undefined }}>{v == null ? "Unknown" : `${v.toFixed(1)}%`}</td>; })}
          <td className="p-3 tabular-nums">{r.cost.toFixed(2)}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  );
}

export default function VintageDisclosedView() {
  const [basis, setBasis] = useState<"holder_acquisition" | "first_observed">("holder_acquisition");
  const [horizon, setHorizon] = useState(4);
  const [scope, setScope] = useState<"all" | "first_lien">("all");
  const [ticker, setTicker] = useState("industry");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const tickers = Array.from(new Set([...disclosedCohorts.map((r) => r.ticker), ...disclosedCoverage.map((r) => r.ticker)])).filter((t) => t !== "industry").sort();
  const selected = disclosedCohorts.filter((r) => r.ticker === ticker && r.basis === basis && r.horizon_quarters === horizon && r.debt_scope === scope).sort((a, b) => a.cohort_year - b.cohort_year);
  const cohorts = selected.filter((r) => r.n_holdings > 0 && r.entry_cost_b > 0);
  const ids = new Set(cohorts.map((r) => r.cohort_id));
  const points = disclosedPoints.filter((r) => ids.has(r.cohort_id));
  const series = cohorts.map((c) => ({ cohort_year: c.cohort_year, n_issuers: c.n_issuers, issuers: c.issuers, n_holdings: c.n_holdings, entry_cost_b: c.entry_cost_b, points: points.filter((r) => r.cohort_id === c.cohort_id).map((r) => ({ age_quarters: r.age_quarters, lower: r.na_lower_pct, upper: r.na_upper_pct })) }));
  const detail = cohorts.find((r) => r.cohort_year === selectedYear) ?? cohorts[cohorts.length - 1];
  const detailPoints = detail ? points.filter((r) => r.cohort_id === detail.cohort_id).sort((a, b) => a.age_quarters - b.age_quarters) : [];
  const coverage = disclosedCoverage.find((r) => r.ticker === ticker);
  const n = cohorts.reduce((sum, r) => sum + r.n_holdings, 0);
  const cost = cohorts.reduce((sum, r) => sum + r.entry_cost_b, 0);
  const unseasoned = selected.reduce((sum, r) => sum + r.n_unseasoned, 0);
  const unseasonedCost = selected.reduce((sum, r) => sum + r.unseasoned_cost_b, 0);

  return (
    <div>
      <p className="text-sm text-gray-400 max-w-5xl">A stricter cross-check on the main curves. Each BDC&apos;s holdings are dated only by that BDC&apos;s own disclosed acquisition date, or by the start of our observation window; nothing is borrowed from peers or estimated, so BDCs that never disclose acquisition dates drop out of the acquisition view. Neither date establishes a loan&apos;s original origination.</p>
      <div className="rounded-xl border p-4 mt-4 text-sm text-gray-300" style={panel}>
        <strong className="text-white">How to read the bounds.</strong>{" "}The solid line is the share of initial holding-group cost with any observed quarter-end non-accrual through that age. The dashed line also includes groups with unresolved quarter-end status, including every loan that left the book (a repayment is not proof of no default). Bands are therefore wide. These are bounds on observed quarter-end status, not default rates, confidence intervals or survival probabilities.
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <label className="text-xs text-gray-400">Cohort date basis
          <select className="block w-full mt-1 p-2 rounded bg-gray-900 text-gray-200 border border-gray-700" value={basis} onChange={(e) => setBasis(e.target.value as typeof basis)}>
            <option value="holder_acquisition">Holder acquisition</option><option value="first_observed">First observed (monitoring)</option>
          </select>
        </label>
        <label className="text-xs text-gray-400">Required follow-up horizon
          <select className="block w-full mt-1 p-2 rounded bg-gray-900 text-gray-200 border border-gray-700" value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
            {[4, 8, 12, 20].map((q) => <option key={q} value={q}>{q / 4} year{q === 4 ? "" : "s"} ({q} quarters)</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-400">Debt scope
          <select className="block w-full mt-1 p-2 rounded bg-gray-900 text-gray-200 border border-gray-700" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
            <option value="all">All identified funded debt</option><option value="first_lien">First lien</option>
          </select>
        </label>
        <label className="text-xs text-gray-400">Holder
          <select className="block w-full mt-1 p-2 rounded bg-gray-900 text-gray-200 border border-gray-700" value={ticker} onChange={(e) => setTicker(e.target.value)}>
            <option value="industry">Pooled holders</option>{tickers.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-gray-400 mb-5">
        {basis === "holder_acquisition" ? "Acquisition cohorts require this holder’s own disclosed acquisition date and first observation in the same calendar quarter. Late-entry holdings are excluded because their earlier history is unobserved." : "Monitoring cohorts begin when a holding group first appears in the selected filing history. They can include seasoned loans; events before that point are outside this observation window."}
        {" "}The denominator is fixed at every displayed age for the selected horizon. Holdings too young to reach that horizon are excluded from the entire curve.
      </p>
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[["Eligible holding groups", n.toLocaleString()], ["Fixed initial cost", money(cost)], ["Too young within listed cohort years", `${unseasoned.toLocaleString()} groups · ${money(unseasonedCost)}`]].map(([label, value]) => (
          <div className="rounded-xl border p-4" style={panel} key={label}><div className="text-xs text-gray-400">{label}</div><div className="text-lg text-white font-semibold mt-1">{value}</div></div>
        ))}
      </div>
      <section className="rounded-xl border p-5" style={panel}>
        <h2 className="font-semibold text-white">Any quarter-end non-accrual: observation bounds</h2>
        <p className="text-xs text-gray-400 mt-2 mb-4">Each year is a separate cohort. A group with any positive flag contributes its entire initial cost to the lower bound; this is not the actual amount of debt on non-accrual. The upper bound adds initial cost with missing, unknown or unobserved past status.</p>
        <VintageBoundsChart series={series} />
      </section>
      <section className="rounded-xl border overflow-hidden mt-6" style={panel}>
        <div className="p-5"><h2 className="font-semibold text-white">Cohort denominators and {horizon / 4}-year bounds</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-xs text-left">
          <thead className="text-gray-400"><tr>{["Cohort year", "Contributing holders", "Eligible groups", "Initial cost", "Observed NA lower", "Including unresolved upper", "Unresolved cost", "Reporting cutoffs"].map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{cohorts.map((c) => { const p = points.find((r) => r.cohort_id === c.cohort_id && r.age_quarters === horizon); return (
            <tr className="border-t border-gray-800 text-gray-300" key={c.cohort_id}><td className="p-3 font-semibold text-white">{c.cohort_year}</td><td className="p-3" title={c.issuers.join(", ")}>{c.n_issuers}</td><td className="p-3">{c.n_holdings.toLocaleString()}</td><td className="p-3">{money(c.entry_cost_b)}</td><td className="p-3">{pct(p?.na_lower_pct)}</td><td className="p-3">{pct(p?.na_upper_pct)}</td><td className="p-3">{money(p?.na_unresolved_cost_b)}</td><td className="p-3 whitespace-nowrap">{dates(c.as_of_min, c.as_of_max)}</td></tr>
          ); })}</tbody>
        </table></div>
        {!cohorts.length && <p className="p-5 text-gray-400 text-sm">No eligible cohorts for these filters.</p>}
      </section>
      {detail && <section className="rounded-xl border overflow-hidden mt-6" style={panel}>
        <div className="p-5"><div className="flex items-center gap-3"><h2 className="font-semibold text-white">Age-level evidence</h2><label className="text-xs text-gray-400">Cohort <select className="p-1 ml-2 rounded bg-gray-900 text-gray-200 border border-gray-700" value={detail.cohort_year} onChange={(e) => setSelectedYear(Number(e.target.value))}>{cohorts.map((c) => <option key={c.cohort_id} value={c.cohort_year}>{c.cohort_year}</option>)}</select></label></div>
          <p className="text-xs text-gray-400 mt-2">Fixed denominator: {detail.n_holdings.toLocaleString()} groups / {money(detail.entry_cost_b)} from {detail.n_issuers} holder{detail.n_issuers === 1 ? "" : "s"} ({detail.issuers.join(", ")}). Snapshot measures use only holdings observed at that age.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-xs text-left">
          <thead className="text-gray-400"><tr>{["Age (quarters)", "Observed groups", "Observed initial cost", "NA lower", "NA upper", "Unresolved initial cost", "Snapshot cost", "Mark-covered cost", "Cost marked <90%", "Snapshot dates"].map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{detailPoints.map((p) => <tr className="border-t border-gray-800 text-gray-300" key={p.age_quarters}>
            <td className="p-3">{p.age_quarters === 0 ? "0 (baseline)" : p.age_quarters}</td><td className="p-3">{p.n_observed.toLocaleString()}</td><td className="p-3">{money(p.observed_entry_cost_b)}</td><td className="p-3">{pct(p.na_lower_pct)}</td><td className="p-3">{pct(p.na_upper_pct)}</td><td className="p-3">{money(p.na_unresolved_cost_b)}</td><td className="p-3">{money(p.current_cost_b)}</td><td className="p-3">{money(p.mark_coverage_cost_b)}</td><td className="p-3">{pct(p.below_cost90_pct)}</td><td className="p-3 whitespace-nowrap">{dates(p.period_end_min, p.period_end_max)}</td>
          </tr>)}</tbody>
        </table></div>
      </section>}
      {coverage && <section className="rounded-xl border p-5 mt-6" style={panel}>
        <h2 className="font-semibold text-white">Current date, identity and cost coverage (disclosed dates only)</h2>
        <p className="text-xs text-gray-400 mt-2">{ticker === "industry" ? "Pooled holder" : ticker} reporting dates: {dates(coverage.period_end_min, coverage.period_end_max)}. These figures describe the current known positive funded-debt book.</p>
        {!coverage.cost_complete && <p className="text-xs text-amber-300 mt-3">Cost coverage is incomplete: {coverage.n_missing_cost_holdings.toLocaleString()} holding groups have missing cost.</p>}
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 text-sm">
          {[["Known funded-debt cost", money(coverage.latest_funded_cost_b)], ["Holder-acquisition dated", money(coverage.acquisition_dated_cost_b)], ["Unknown/conflicting date", money(coverage.unknown_date_cost_b)], ["First seen in acquisition quarter", money(coverage.acquisition_inception_cost_b)], ["Observed after acquisition quarter", money(coverage.acquisition_late_entry_cost_b)], ["Ambiguous identity (overlapping)", money(coverage.ambiguous_identity_cost_b)]].map(([label, value]) => <div key={label}><dt className="text-xs text-gray-400">{label}</dt><dd className="text-white mt-1">{value}</dd></div>)}
        </dl>
        <p className="text-xs text-gray-500 mt-4">{coverage.n_positions.toLocaleString()} current positions; {coverage.n_holdings.toLocaleString()} holding groups; {coverage.n_ambiguous_holdings.toLocaleString()} ambiguous groups; {coverage.n_date_conflicts.toLocaleString()} date conflicts. Ambiguous identity overlaps the dated and unknown categories; ambiguous groups are excluded from these cohort curves.</p>
      </section>}
      <DisclosedExposureTable />
      <p className="text-xs text-gray-400 mt-6">This view does not infer origination, bridge refinancings, assign defaults from exits or estimate losses. <Link href="/methodology#vintage" className="text-indigo-400 hover:underline">Vintage methodology</Link>.</p>
    </div>
  );
}
