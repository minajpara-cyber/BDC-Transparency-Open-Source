"use client";

import { useState } from "react";
import Link from "next/link";
import CreditNav from "@/components/CreditNav";
import VintageChart from "@/components/VintageChart";
import VintageExposureTable from "@/components/VintageExposureTable";
import { vintageCohorts, vintagePoints, vintageCoverage } from "@/data/vintage_analysis";

const pct = (value: number | null | undefined) => value == null ? "Unknown" : `${value.toFixed(2)}%`;
const money = (value: number | null | undefined) => value == null ? "Unknown" : `$${value.toFixed(3)}B`;
const dates = (min: string | null | undefined, max: string | null | undefined) => !min || !max ? "No snapshot" : min === max ? min : `${min} – ${max}`;
const panel = { background: "#111118", borderColor: "#1e1e2e" };

export default function VintagePage() {
  const [basis, setBasis] = useState<"holder_acquisition" | "first_observed">("holder_acquisition");
  const [horizon, setHorizon] = useState(4);
  const [scope, setScope] = useState<"all" | "first_lien">("all");
  const [ticker, setTicker] = useState("industry");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const tickers = Array.from(new Set([...vintageCohorts.map((r) => r.ticker), ...vintageCoverage.map((r) => r.ticker)])).filter((t) => t !== "industry").sort();
  const selected = vintageCohorts.filter((r) => r.ticker === ticker && r.basis === basis && r.horizon_quarters === horizon && r.debt_scope === scope).sort((a, b) => a.cohort_year - b.cohort_year);
  const cohorts = selected.filter((r) => r.n_holdings > 0 && r.entry_cost_b > 0);
  const ids = new Set(cohorts.map((r) => r.cohort_id));
  const points = vintagePoints.filter((r) => ids.has(r.cohort_id));
  const series = cohorts.map((c) => ({ cohort_year: c.cohort_year, n_issuers: c.n_issuers, issuers: c.issuers, n_holdings: c.n_holdings, entry_cost_b: c.entry_cost_b, points: points.filter((r) => r.cohort_id === c.cohort_id).map((r) => ({ age_quarters: r.age_quarters, lower: r.na_lower_pct, upper: r.na_upper_pct })) }));
  const detail = cohorts.find((r) => r.cohort_year === selectedYear) ?? cohorts[cohorts.length - 1];
  const detailPoints = detail ? points.filter((r) => r.cohort_id === detail.cohort_id).sort((a, b) => a.age_quarters - b.age_quarters) : [];
  const coverage = vintageCoverage.find((r) => r.ticker === ticker);
  const n = cohorts.reduce((sum, r) => sum + r.n_holdings, 0);
  const cost = cohorts.reduce((sum, r) => sum + r.entry_cost_b, 0);
  const unseasoned = selected.reduce((sum, r) => sum + r.n_unseasoned, 0);
  const unseasonedCost = selected.reduce((sum, r) => sum + r.unseasoned_cost_b, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <CreditNav />
      <h1 className="text-2xl font-bold text-white mb-3">Dated holding cohorts</h1>
      <p className="text-sm text-gray-400 max-w-5xl">Track quarter-end non-accrual observations for groups of debt holdings at one BDC. Choose the holder&apos;s disclosed acquisition date or the start of our observation window. Neither establishes a loan&apos;s original origination date. Pooled holders can include the same borrower or facility more than once. Acquisition curves cover only the subset with qualifying date evidence and observed entry; they do not represent all BDC originations.</p>
      <div className="rounded-xl border p-4 mt-4 text-sm text-gray-300" style={panel}>
        <strong className="text-white">How to read the bounds.</strong> The solid line is the share of initial holding-group cost with any observed quarter-end non-accrual through that age. The dashed line also includes groups with unresolved quarter-end status. An earlier gap stays unresolved after a later clear observation. Baseline non-accrual is included. These are bounds on observed quarter-end status, not default rates, continuous-time event estimates, confidence intervals or survival probabilities.
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
        {" "}The denominator is fixed at every displayed age for the selected horizon. Holdings too young to reach that horizon are excluded from the entire curve. Changing the horizon changes the eligible population. Cohort years with no eligible groups are absent; the too-young count covers listed cohort years only.
      </p>
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        {[["Eligible holding groups", n.toLocaleString()], ["Fixed initial cost", money(cost)], ["Too young within listed cohort years", `${unseasoned.toLocaleString()} groups · ${money(unseasonedCost)}`]].map(([label, value]) => (
          <div className="rounded-xl border p-4" style={panel} key={label}><div className="text-xs text-gray-400">{label}</div><div className="text-lg text-white font-semibold mt-1">{value}</div></div>
        ))}
      </div>
      <section className="rounded-xl border p-5" style={panel}>
        <h2 className="font-semibold text-white">Any quarter-end non-accrual: observation bounds</h2>
        <p className="text-xs text-gray-400 mt-2 mb-4">Each year is a separate cohort. A group with any positive flag contributes its entire initial cost to the lower bound; this is not the actual amount of debt on non-accrual. The upper bound adds initial cost with missing, unknown or unobserved past status. Disappearance is unresolved evidence, not a repayment, default or cure.</p>
        <VintageChart series={series} />
      </section>
      <section className="rounded-xl border overflow-hidden mt-6" style={panel}>
        <div className="p-5"><h2 className="font-semibold text-white">Cohort denominators and {horizon / 4}-year bounds</h2><p className="text-xs text-gray-400 mt-2">The entry-cost denominator and group count stay fixed from baseline through the selected horizon. Reporting cutoff ranges show how far the available issuer histories extend.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-xs text-left">
          <thead className="text-gray-400"><tr>{["Cohort year", "Contributing holders", "Eligible groups", "Initial cost", "Observed NA lower", "Including unresolved upper", "Unresolved cost", "Reporting cutoffs"].map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{cohorts.map((c) => { const p = points.find((r) => r.cohort_id === c.cohort_id && r.age_quarters === horizon); return (
            <tr className="border-t border-gray-800 text-gray-300" key={c.cohort_id}><td className="p-3 font-semibold text-white">{c.cohort_year}</td><td className="p-3" title={c.issuers.join(", ")}>{c.n_issuers}</td><td className="p-3">{c.n_holdings.toLocaleString()}</td><td className="p-3">{money(c.entry_cost_b)}</td><td className="p-3">{pct(p?.na_lower_pct)}</td><td className="p-3">{pct(p?.na_upper_pct)}</td><td className="p-3">{money(p?.na_unresolved_cost_b)}</td><td className="p-3 whitespace-nowrap">{dates(c.as_of_min, c.as_of_max)}</td></tr>
          ); })}</tbody>
        </table></div>
        {!cohorts.length && <p className="p-5 text-gray-400 text-sm">No eligible cohorts for these filters. Current composition may still be available below.</p>}
      </section>
      {detail && <section className="rounded-xl border overflow-hidden mt-6" style={panel}>
        <div className="p-5"><div className="flex items-center gap-3"><h2 className="font-semibold text-white">Age-level evidence</h2><label className="text-xs text-gray-400">Cohort <select className="p-1 ml-2 rounded bg-gray-900 text-gray-200 border border-gray-700" value={detail.cohort_year} onChange={(e) => setSelectedYear(Number(e.target.value))}>{cohorts.map((c) => <option key={c.cohort_id} value={c.cohort_year}>{c.cohort_year}</option>)}</select></label></div>
          <p className="text-xs text-gray-400 mt-2">Fixed denominator: {detail.n_holdings.toLocaleString()} groups / {money(detail.entry_cost_b)} from {detail.n_issuers} holder{detail.n_issuers === 1 ? "" : "s"} ({detail.issuers.join(", ")}). Snapshot measures use only holdings observed at that age, so their population and dates can change. Unknown snapshots stay unknown even when past non-accrual evidence remains known.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-xs text-left">
          <thead className="text-gray-400"><tr>{["Age (quarters)", "Observed groups", "Observed initial cost", "NA lower", "NA upper", "Unresolved initial cost", "Snapshot cost", "Mark-covered cost", "Cost marked <90%", "Snapshot dates"].map((h) => <th key={h} className="p-3 whitespace-nowrap">{h}</th>)}</tr></thead>
          <tbody>{detailPoints.map((p) => <tr className="border-t border-gray-800 text-gray-300" key={p.age_quarters}>
            <td className="p-3">{p.age_quarters === 0 ? "0 (baseline)" : p.age_quarters}</td><td className="p-3">{p.n_observed.toLocaleString()}</td><td className="p-3">{money(p.observed_entry_cost_b)}</td><td className="p-3">{pct(p.na_lower_pct)}</td><td className="p-3">{pct(p.na_upper_pct)}</td><td className="p-3">{money(p.na_unresolved_cost_b)}</td><td className="p-3">{money(p.current_cost_b)}</td><td className="p-3">{money(p.mark_coverage_cost_b)}</td><td className="p-3">{pct(p.below_cost90_pct)}</td><td className="p-3 whitespace-nowrap">{dates(p.period_end_min, p.period_end_max)}</td>
          </tr>)}</tbody>
        </table></div><p className="text-xs text-gray-500 p-4">Mark measure: current cost with fair value below 90% of cost / current cost with an observed cost-based mark. This is a valuation snapshot, not a par recovery estimate.</p>
      </section>}
      {coverage && <section className="rounded-xl border p-5 mt-6" style={panel}>
        <h2 className="font-semibold text-white">Current date, identity and cost coverage</h2>
        <p className="text-xs text-gray-400 mt-2">{ticker === "industry" ? "Pooled holder" : ticker} reporting dates: {dates(coverage.period_end_min, coverage.period_end_max)}. These figures describe the current known positive funded-debt book, regardless of the horizon or scope controls above. They are separate from the historical cohort denominator.</p>
        {!coverage.cost_complete && <p className="text-xs text-amber-300 mt-3">Cost coverage is incomplete: {coverage.n_missing_cost_holdings.toLocaleString()} holding groups have missing cost. Cost shares reflect known positive amounts only.</p>}
        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 text-sm">
          {[["Known funded-debt cost", money(coverage.latest_funded_cost_b)], ["Holder-acquisition dated", money(coverage.acquisition_dated_cost_b)], ["Unknown/conflicting date", money(coverage.unknown_date_cost_b)], ["First seen in acquisition quarter", money(coverage.acquisition_inception_cost_b)], ["Observed after acquisition quarter", money(coverage.acquisition_late_entry_cost_b)], ["Ambiguous identity (overlapping)", money(coverage.ambiguous_identity_cost_b)]].map(([label, value]) => <div key={label}><dt className="text-xs text-gray-400">{label}</dt><dd className="text-white mt-1">{value}</dd></div>)}
        </dl>
        <p className="text-xs text-gray-500 mt-4">{coverage.n_positions.toLocaleString()} current positions; {coverage.n_holdings.toLocaleString()} holding groups; {coverage.n_ambiguous_holdings.toLocaleString()} ambiguous groups; {coverage.n_date_conflicts.toLocaleString()} date conflicts. Dated and unknown cost partition the selected book. Ambiguous identity overlaps those categories and must not be added to them; ambiguous groups are excluded from cohort curves.</p>
      </section>}
      <VintageExposureTable />
      <p className="text-xs text-gray-400 mt-6">The acquisition and monitoring views do not infer original origination, bridge refinancings, assign defaults from exits or estimate realized losses. Missing histories limit what can be established. <Link href="/methodology#vintage" className="text-indigo-400 hover:underline">Read the cohort methodology</Link>.</p>
    </div>
  );
}
