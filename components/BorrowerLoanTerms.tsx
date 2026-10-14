import Link from "next/link";
import type { BorrowerLoan, LoanEvent } from "@/data/borrower_loans";

/**
 * Loan terms on a borrower page: every position each current holder reports in
 * its latest schedule, one row per position (data/borrower_loans.ts, built by
 * scripts/59_export_borrower_loans.py). Undrawn commitments are listed for their
 * terms and never summed.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const qLabel = (pe: string) => `Q${Math.floor((Number(pe.slice(5, 7)) - 1) / 3) + 1} ${pe.slice(0, 4)}`;
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

const ORIG_SRC: Record<string, string> = {
  filed: "BDC's filed date",
  "peer filing": "another BDC's filed date",
  "first seen": "first schedule showing it",
  estimate: "estimate",
};

function eventText(e: LoanEvent): string {
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
    case "refinanced": return "Refinanced into this loan";
    case "restructured": return "Restructured into this loan";
  }
}

const SHOWN_EVENTS = 3;

export default function BorrowerLoanTerms({ rows }: { rows: BorrowerLoan[] }) {
  if (rows.length === 0) return null;
  const tickers = Array.from(new Set(rows.map((r) => r.ticker)));
  const asOf = Array.from(new Set(rows.map((r) => r.period_end))).sort();
  const headers: [string, string][] = [
    ["BDC", ""],
    ["Instrument", "The lien and instrument class, and the BDC's own label"],
    ["Rate", "The margin over the reference rate (cash and PIK combined, as filed) or the fixed coupon; hover for the rate cells as printed"],
    ["Maturity", "As filed"],
    ["Originated", "The date the vintage pages use for this loan and where it comes from, and the first quarter it shows in this BDC's schedules"],
    ["Par", "Principal; for an undrawn commitment, the commitment"],
    ["Fair value", ""],
    ["Mark", "Fair value ÷ par in cents of par, when that is a price; non-accrual flagged"],
    ["Changes", "Changes on this loan, newest first: spread moves of 25 bps or more, maturity changes, PIK and non-accrual switches, and a refinancing or restructuring that created it"],
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
                  <td className="px-3 py-2.5 align-top whitespace-nowrap" title={r.rate_filed ? `As filed: ${r.rate_filed}` : undefined}>
                    <div style={{ color: "#d1d5db" }}>{r.rate ?? (r.rate_filed ? <span style={{ color: "#9ca3af" }}>{r.rate_filed}</span> : "—")}</div>
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
                  <td className="px-3 py-2.5 align-top whitespace-nowrap"
                      title={r.acq_filed ? `Acquisition date as this BDC files it: ${r.acq_filed}` : undefined}>
                    <div style={{ color: "#d1d5db" }}>{monthLabel(r.orig)}</div>
                    {r.orig_src && (
                      <div className="text-xs" style={{ color: r.orig_conf === "LOW" ? "#6b6b88" : "#8b8ba8" }}>
                        {ORIG_SRC[r.orig_src] ?? r.orig_src}
                      </div>
                    )}
                    <div className="text-xs" style={{ color: "#6b6b88" }}
                         title={r.first_q_open ? "This BDC's first schedule on file: the loan may be older" : undefined}>
                      in book {r.first_q_open ? "since ≤ " : "since "}{qLabel(r.first_q)}
                    </div>
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
                    {shown.length === 0 ? (
                      <span style={{ color: "#6b6b88" }}>None since {qLabel(r.first_q)}</span>
                    ) : (
                      <>
                        {shown.map((e, k) => (
                          <div key={k}>
                            {eventText(e)}<span style={{ color: "#6b6b88" }}> · {qLabel(e.q)}</span>
                          </div>
                        ))}
                        {hidden.length > 0 && (
                          <div style={{ color: "#6b6b88" }}
                               title={hidden.map((e) => `${eventText(e)} · ${qLabel(e.q)}`).join("\n")}>
                            +{hidden.length} earlier
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
        Terms as each BDC prints them in its latest schedule of investments. Rate = the margin over the reference rate
        (cash and PIK combined, as filed) or the fixed coupon; hover a rate for the cells as printed. Originated = the
        date the vintage pages use, with its source, and the quarter the loan entered this BDC&apos;s book (≤ when that is the
        BDC&apos;s first schedule on file); a BDC&apos;s own filed acquisition date (hover) often moves to its latest
        amendment, so it can be later than the loan. Changes are on the same loan since it entered the BDC&apos;s book. Undrawn commitments are listed for their terms and left out of every total.
      </p>
    </div>
  );
}
