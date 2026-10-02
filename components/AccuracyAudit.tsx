import { accuracyAudit, type AccuracyField, type AccuracyRemaining } from "@/data/accuracy_audit";

// "How accurate is this data?" on /methodology. Every number comes from
// data/accuracy_audit.ts, which bdc_inventory/scripts/accuracy_goldens.py writes
// on each rebuild by re-checking the hand-audited golden set (280 positions read
// cell by cell against their filings) against the data the site publishes.


/** A share as a percent; never rounds a miss up to a full hundred or a hit down to zero. */
const pct = (v: number | null | undefined) => {
  if (v == null) return "—";
  if (v >= 100) return "100%";
  if (v <= 0) return "0%";
  if (v > 99.9) return "99.9%";
  if (v < 0.1) return "0.1%";
  return `${v.toFixed(1)}%`;
};
const share = (c: number | null | undefined, n: number | null | undefined) =>
  (c == null || !n ? null : (100 * c) / n);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
  "November", "December"];
const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};
const quarter = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${y} Q${Math.ceil(m / 3)}`;
};
const byField = Object.fromEntries(accuracyAudit.fields.map((f) => [f.field, f])) as Record<string, AccuracyField>;

/** The audit's headline in words: dollars vs labels, before and after. */
function headline(): string {
  const dollars = ["amortized_cost", "fair_value", "par", "maturity_date"].map((k) => byField[k]).filter(Boolean);
  const labels = ["instrument", "industry", "unfunded_commitment", "floor_pct", "pik", "non_accrual"]
    .map((k) => byField[k]).filter(Boolean);
  const before = (f: AccuracyField) => share(f.before_correct, f.before_checked);
  const after = (f: AccuracyField) => share(f.after_correct, f.after_checked);
  const lowest = [...dollars].sort((a, b) => (before(a) ?? 0) - (before(b) ?? 0))[0];
  const weak = labels.filter((f) => (before(f) ?? 100) < 95)
    .sort((a, b) => (before(a) ?? 0) - (before(b) ?? 0));
  const parts: string[] = [];
  if (lowest) parts.push(`The dollar amounts and dates were already right: on the audit date every one of them matched the filing on at least ${pct(before(lowest))} of sampled rows.`);
  if (weak.length) {
    parts.push(`The labels around them were not: ${weak.map((f) => `${f.short} ${pct(before(f))}`).join(", ")}.`);
    parts.push(`After the fixes they re-check at: ${weak.map((f) => `${f.short} ${pct(after(f))}`).join(", ")}.`);
  }
  return parts.join(" ");
}

function remainingLine(r: AccuracyRemaining): string {
  return `${r.ticker} ${quarter(r.period_end)}${r.company ? `, ${r.company}` : ""}: ${r.short} ${r.result}. ${r.reason}`;
}

export default function AccuracyAudit() {
  const a = accuracyAudit;
  const nowPct = a.values_checked ? (100 * a.values_correct) / a.values_checked : null;
  return (
    <div className="rounded-xl border p-5 text-sm space-y-4" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#d1d5db" }}>
      <p>
        {`On ${longDate(a.audited_on)} we took ${a.positions} positions — spread across all ${a.bdcs} BDCs and every filing format from ${a.sample_first_period.slice(0, 4)} to ${quarter(a.sample_last_period)}, in ${a.filings} different filings — and checked each one, cell by cell, against the 10-K or 10-Q it came from. Where the filing's value is unambiguous we kept it as a fixed answer key (the "golden set"). Every rebuild of the data re-checks those ${a.values_checked.toLocaleString("en-US")} filing values against what this site shows; the latest check, on ${longDate(a.checked_on)}, found ${a.values_correct.toLocaleString("en-US")} of them right (${pct(nowPct)}).`}
      </p>
      <p>{headline()}</p>

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: "#1e1e2e" }}>
        <table className="w-full text-xs">
          <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
            <tr>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>Field</th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>
                {`Before the fixes (${a.audited_on})`}
              </th>
              <th className="px-3 py-2 text-right font-semibold uppercase tracking-wider" style={{ color: "#8b8ba8" }}>
                {`Now (${a.checked_on})`}
              </th>
            </tr>
          </thead>
          <tbody>
            {a.fields.map((f) => (
              <tr key={f.field} style={{ borderBottom: "1px solid #1a1a28" }}>
                <td className="px-3 py-2 text-white">{f.label}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  {f.before_checked ? `${pct(share(f.before_correct, f.before_checked))} (${f.before_correct} of ${f.before_checked})` : "—"}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap text-white">
                  {`${pct(share(f.after_correct, f.after_checked))} (${f.after_correct} of ${f.after_checked})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>
        {`How to read it: a value counts as right only when it equals what the filing prints; a blank where the filing prints a value counts as wrong. Values a filing does not print (many schedules have no acquisition-date or floor column, older MAIN schedules print no industry) are left out, so each row has its own count. "Before" is the auditors' own count on the audit date; for a few fields they checked more readings than the answer key keeps (PIK rate and severity as well as the PIK type, the coupon as well as the spread), so the counts differ between the columns. "Now" re-checks the golden values, which leave out the readings the auditors marked ambiguous, against today's data — the same positions, looked up in the book this site publishes for each quarter.`}
        {a.before_recheck_note ? ` ${a.before_recheck_note}` : ""}
      </p>

      <div>
        <h3 className="text-white font-semibold mb-2">What remains imperfect</h3>
        <ul className="list-disc list-inside space-y-1.5">
          {a.remaining.length === 0 && <li>{"Every golden value matches the filing."}</li>}
          {a.remaining.map((r) => (
            <li key={`${r.id}-${r.field}`}>{remainingLine(r)}</li>
          ))}
          <li>
            {`A sample is a sample. ${a.positions} positions out of tens of thousands can miss a problem that did not happen to fall in it: a field that is right on every sampled row can still be wrong somewhere else. The audit is repeated against the same answer key on every rebuild, so a fix that breaks a checked value is caught, but new errors in rows outside the sample are not.`}
          </li>
          <li>
            {"Flags read from footnotes — non-accrual, PIK, undrawn commitment — are only as good as each filing's own legend. Where a quarter's loan-by-loan flags do not add up to the BDC's own non-accrual figure, the BDC's figure is shown and the loans' status is left unknown, never zero (see Caveats below)."}
          </li>
        </ul>
      </div>
    </div>
  );
}
