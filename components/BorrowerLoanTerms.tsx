import Link from "next/link";
import type { BorrowerLoan, LoanEvent } from "@/data/borrower_loans";

/**
 * Loan terms on a borrower page: every position each current holder reports in
 * its latest schedule, one row per position (data/borrower_loans.ts, built by
 * scripts/59_export_borrower_loans.py). Undrawn commitments are listed for their
 * terms and never summed.
 */

// Fields scripts/59 writes from the 2026-11 rebuild on: a data file built before
// it lacks them, so each is optional here and read with a fallback.
type Event = Omit<LoanEvent, "kind"> & { kind: LoanEvent["kind"] | "replaced" };
export type Loan = Omit<BorrowerLoan, "first_q" | "events"> & {
  first_q: string | null;
  events: Event[];
  events_q?: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const qLabel = (pe: string) => `Q${Math.floor((Number(pe.slice(5, 7)) - 1) / 3) + 1} ${pe.slice(0, 4)}`;
/** "2025-06" -> "Jun 2025"; a bare year "2018" (an estimate) stays "2018". */
const monthLabel = (d: string | null) => {
  if (!d) return "—";
  const m = Number(d.slice(5, 7));
  return m >= 1 && m <= 12 ? `${MONTHS[m - 1]} ${d.slice(0, 4)}` : d.slice(0, 4);
};
/** 425 -> "4.25%", 412.5 -> "4.125%" (two decimals, three when the third is not zero). */
const pct = (bps: number) => {
  const v = bps / 100;
  const s3 = v.toFixed(3);
  return `${s3.endsWith("0") ? v.toFixed(2) : s3}%`;
};
const usd = (v: number | null) => {
  if (v === null) return "—";
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
/** The printed rate cells, or null when they hold no rate: NMFC's "— —" or GBDC's "N/A(6)" on undrawn lines. */
const filedText = (s: string | null) =>
  (s && /[A-Za-z0-9]/.test(s.replace(/\bN\/?A\b|\(\s*\w{1,3}\s*\)/gi, "")) ? s : null);

const ORIG_SRC: Record<string, string> = {
  filed: "BDC's filed date",
  "peer filing": "another BDC's filed date",
  "first seen": "first schedule showing it",
  "first seen elsewhere": "another BDC's first schedule showing it",
  estimate: "estimate",
};

/**
 * One change in words. `inBook`: the quarter the loan entered this BDC's book. A refinancing at the start
 * of a line that begins later than that is one of the loan's own changes, not the one that made it: 164
 * rows read "Refinanced into this loan · Q3 2024" under "in book since Q4 2021".
 */
function eventText(e: Event, inBook: string | null): string {
  const into = inBook === null || e.q <= inBook ? " into this loan" : "";
  switch (e.kind) {
    case "spread":
      return typeof e.from === "number" && typeof e.to === "number"
        ? `Spread ${pct(e.from)} → ${pct(e.to)}` : "Spread changed";
    case "maturity":
      return `Maturity ${monthLabel(e.from as string | null)} → ${monthLabel(e.to as string | null)}`;
    case "pik_on": return "PIK started";
    case "pik_off": return "PIK ended";
    case "na_on": return "Put on non-accrual";
    case "na_off": return "Back on accrual";
    case "refinanced": return `Refinanced${into}`;
    case "restructured": return `Restructured${into}`;
    case "replaced":
      return typeof e.from === "string" ? `Replaced an earlier loan due ${monthLabel(e.from)}` : "Replaced an earlier loan";
  }
}

const SHOWN_EVENTS = 3;

export default function BorrowerLoanTerms({ rows }: { rows: Loan[] }) {
  if (rows.length === 0) return null;
  const tickers = Array.from(new Set(rows.map((r) => r.ticker)));
  const asOf = Array.from(new Set(rows.map((r) => r.period_end))).sort();
  const headers: [string, string][] = [
    ["BDC", ""],
    ["Instrument", "The lien and instrument class, and the BDC's own label"],
    ["Rate", "The margin over the reference rate (cash and PIK combined) or the fixed coupon; hover for the rate cells as printed"],
    ["Maturity", "As filed"],
    ["Dated", "The date the vintage pages use for this loan and what it is: this BDC's filed acquisition date, another BDC's filed date for the same tranche, the first schedule showing the loan, or an estimate (year only). A filed or peer date more than a quarter after the loan entered this BDC's book shows as the year it entered the book, the year the vintage pages count it in. Not a closing date: a BDC files the date it bought in, and a facility can be older. Below it, the first quarter the loan shows in this BDC's schedules"],
    ["Par", "Principal; for an undrawn commitment, the commitment"],
    ["Fair value", ""],
    ["Mark", "Fair value ÷ par in cents of par, when that is a price; non-accrual flagged. At the twelve BDCs whose schedules net the undrawn discount into a facility's fair value, a loan with an undrawn commitment is priced on its whole commitment. No mark when, among other reasons, the par is the whole commitment of a partly drawn facility, a revolver or delayed draw would price 5¢ or more below the borrower's other loans (its par is not its drawn par), or the loan's undrawn commitment could not be tied to it"],
    ["Changes", "Changes on this loan, newest first: spread moves of 25 bps or more, maturity changes, PIK and non-accrual switches, a refinancing or restructuring (into this loan when that is where it entered the book), and where the BDC's line replaced an earlier loan"],
  ];

  return (
    <div className="rounded-xl border overflow-hidden mb-6" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
        <h2 className="font-semibold text-white">Loan terms by holder</h2>
        <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
          {rows.filter((r) => !r.unfunded).length} position{rows.filter((r) => !r.unfunded).length === 1 ? "" : "s"}
          {" "}at {tickers.length} holder{tickers.length === 1 ? "" : "s"}, from each BDC&apos;s latest schedule
          {" "}({asOf.length === 1 ? qLabel(asOf[0]) : `${qLabel(asOf[0])} – ${qLabel(asOf[asOf.length - 1])}`})
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: "#0f0f16", borderBottom: "1px solid #1e1e2e" }}>
            <tr>
              {headers.map(([h, tip]) => (
                <th key={h} title={tip || undefined}
                    className="px-3 py-3 text-xs font-semibold uppercase tracking-wider text-left whitespace-nowrap"
                    style={{ color: "#8b8ba8" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const firstOfHolder = i === 0 || rows[i - 1].ticker !== r.ticker;
              const band = tickers.indexOf(r.ticker) % 2 === 0 ? "#111118" : "#0f0f16";
              const events = [...r.events].reverse();
              const shown = events.slice(0, SHOWN_EVENTS);
              const hidden = events.slice(SHOWN_EVENTS);
              const markCents = r.mark !== null && !r.unfunded ? 100 * r.mark : null;
              const filed = filedText(r.rate_filed);
              // an undrawn commitment is no loan of the vintage pages: no book quarter, no history
              const inBook = r.unfunded ? null : r.first_q;
              const since = r.events_q ?? inBook;
              // a filed or peer date shown as a year: dated after the loan entered the book (scripts/59 dated_label)
              const lateYear = r.orig !== null && r.orig.length === 4 && r.orig_src !== null && r.orig_src !== "estimate";
              const datedTip = [
                r.acq_filed ? `Acquisition date as this BDC files it: ${r.acq_filed}` : "",
                lateYear ? "Dated after the loan entered this BDC's book, so shown as the year it entered the book" : "",
              ].filter(Boolean).join(". ");
              return (
                <tr key={`${r.ticker}-${i}`} className={firstOfHolder ? "border-t" : ""}
                    style={{ borderColor: "#1a1a28", background: band }}>
                  <td className="px-3 py-2.5 align-top">
                    {firstOfHolder && (
                      <Link href={`/bdcs/${r.ticker.toLowerCase()}`}
                            className="font-mono font-semibold text-white hover:text-indigo-400">
                        {r.ticker}
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top" style={{ minWidth: 150 }}>
                    <div className="text-white">{r.cls}</div>
                    {r.instrument && r.instrument.toLowerCase() !== r.cls.toLowerCase() && (
                      <div className="text-xs" style={{ color: "#8b8ba8" }}>{r.instrument}</div>
                    )}
                    {r.unfunded && (
                      <span className="inline-block mt-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border"
                            style={{ color: "#9ca3af", borderColor: "#2d2d45" }}
                            title="An undrawn commitment: listed for its terms, never counted in the totals">
                        undrawn
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap" title={filed ? `As filed: ${filed}` : undefined}>
                    <div style={{ color: "#d1d5db" }}>{r.rate ?? (filed ? <span style={{ color: "#9ca3af" }}>{filed}</span> : "—")}</div>
                    {r.pik === 1 && !(r.rate ?? "").includes("PIK") && (
                      <div className="text-xs font-semibold" style={{ color: "#f97316" }}>
                        PIK{r.pik_bps ? ` ${pct(r.pik_bps)}` : ""}
                      </div>
                    )}
                    {r.floor_bps !== null && r.floor_bps > 0 && (
                      <div className="text-xs" style={{ color: "#8b8ba8" }}>
                        {r.floor_all_in ? "minimum coupon" : "floor"} {pct(r.floor_bps)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap" style={{ color: "#d1d5db" }}>
                    {monthLabel(r.maturity)}
                  </td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap" title={datedTip || undefined}>
                    <div style={{ color: "#d1d5db" }}>{monthLabel(r.orig)}</div>
                    {r.orig_src && (
                      <div className="text-xs" style={{ color: r.orig_conf === "LOW" ? "#6b6b88" : "#8b8ba8" }}>
                        {ORIG_SRC[r.orig_src] ?? r.orig_src}
                      </div>
                    )}
                    {inBook && (
                      <div className="text-xs" style={{ color: "#6b6b88" }}
                           title={r.first_q_open ? "This BDC's first schedule on file: the loan may be older" : undefined}>
                        in book {r.first_q_open ? "since ≤ " : "since "}{qLabel(inBook)}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap" style={{ color: "#d1d5db" }}>
                    {r.par !== null && r.par > 0 ? usd(r.par) : "—"}
                  </td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap text-white">{r.unfunded ? "—" : usd(r.fv)}</td>
                  <td className="px-3 py-2.5 align-top whitespace-nowrap" style={{ color: "#d1d5db" }}>
                    {markCents !== null ? `${markCents.toFixed(1)}¢` : "—"}
                    {r.na === 1 && (
                      <div className="text-xs font-semibold" style={{ color: "#ef4444" }}>Non-accrual</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-top text-xs" style={{ minWidth: 210, color: "#d1d5db" }}>
                    {!since ? (
                      <span style={{ color: "#6b6b88" }}>—</span>
                    ) : shown.length === 0 ? (
                      <span style={{ color: "#6b6b88" }}>None since {qLabel(since)}</span>
                    ) : (
                      <>
                        {shown.map((e, k) => (
                          <div key={k}>
                            {eventText(e, inBook)}<span style={{ color: "#6b6b88" }}> · {qLabel(e.q)}</span>
                          </div>
                        ))}
                        {hidden.length > 0 && (
                          <div style={{ color: "#6b6b88" }}
                               title={hidden.map((e) => `${eventText(e, inBook)} · ${qLabel(e.q)}`).join("\n")}>
                            +{hidden.length}{" "}earlier
                          </div>
                        )}
                        {inBook && since > inBook && (
                          <div style={{ color: "#6b6b88" }}
                               title="This line of the schedule starts later than the loan: changes before it are not followed">
                            changes since {qLabel(since)}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-xs border-t" style={{ color: "#8b8ba8", borderColor: "#1e1e2e" }}>
        Terms as each BDC prints them in its latest schedule of investments, the index read by that BDC&apos;s own
        {" "}legend. Rate = the margin over the reference rate (cash and PIK combined) or the fixed coupon; hover a
        {" "}rate for the cells as printed. Dated = the date the vintage pages use for the loan and what it is: a filed
        {" "}acquisition date (this BDC&apos;s or another&apos;s), the first schedule showing the loan, or an estimate,
        {" "}shown as a year. A filed or peer date more than a quarter after the loan entered this BDC&apos;s book is
        {" "}shown as the year it entered the book. It is not a closing date: a BDC&apos;s filed date often moves to its
        {" "}latest amendment (hover), and a facility can be older than the loan a BDC bought. Below it, the quarter the
        {" "}loan entered this BDC&apos;s book (≤ when that is the BDC&apos;s first schedule on file). Changes follow the
        {" "}loan as the vintage pages identify it; where the BDC&apos;s line took over from an earlier loan (a
        {" "}refinancing into a new maturity or lien), the seam reads &quot;Replaced an earlier loan&quot; and the earlier
        {" "}loan&apos;s changes are not listed. Undrawn commitments are listed for their terms and left out of every total.
      </p>
    </div>
  );
}
