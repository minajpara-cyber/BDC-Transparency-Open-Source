"use client";

import type { PnavEvaluation, PnavExample } from "@/data/pnav";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-15" -> "Sep 15, 2026" (no Date(): avoids time-zone drift). */
export function fmtDay(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, dd] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${dd}, ${y}`;
}

const x2 = (v: number) => `${v.toFixed(2)}x`;
const usd = (v: number) => `$${v.toFixed(2)}`;
const pct = (v: number | null | undefined, dp = 2) => (v == null ? "—" : `${v.toFixed(dp)}%`);

function ExampleCard({ ex }: { ex: PnavExample }) {
  const repMove = ex.pbRepEx - ex.pbRepPrev;
  const adjMove = ex.pbAdjEx - ex.pbAdjPrev;
  const rows: [string, string, string][] = [
    ["Closing price", usd(ex.pxPrev), usd(ex.pxEx)],
    [`Last reported NAV (as of ${fmtDay(ex.navDate)})`, usd(ex.navReported), usd(ex.navReported)],
    ["P/NAV on the reported NAV", x2(ex.pbRepPrev), x2(ex.pbRepEx)],
    ["NAV rolled forward to that day", usd(ex.estPrev), usd(ex.estEx)],
    ["P/NAV on the rolled-forward NAV", x2(ex.pbAdjPrev), x2(ex.pbAdjEx)],
  ];
  return (
    <div className="rounded-lg border p-4" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
        <span className="font-mono font-semibold" style={{ color: "#a5b4fc" }}>{ex.ticker}</span>
        <span className="text-xs" style={{ color: "#8b8ba8" }}>
          pays {ex.freq} · ${ex.amount.toFixed(ex.amount < 0.1 ? 3 : 2)}{" "}dividend went ex on {fmtDay(ex.exDate)}
        </span>
      </div>
      <table className="text-xs w-full mt-2" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ color: "#8b8ba8" }}>
            <th className="text-left font-medium py-1"></th>
            <th className="text-right font-medium py-1 pl-2 whitespace-nowrap">{fmtDay(ex.prevDate)}</th>
            <th className="text-right font-medium py-1 pl-2 whitespace-nowrap">{fmtDay(ex.exDate)} (ex-date)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b], i) => (
            <tr key={label} style={{ borderTop: "1px solid #1e1e2e", color: i === 2 || i === 4 ? "#e5e7eb" : "#9ca3af" }}>
              <td className="py-1 pr-2">{label}</td>
              <td className="py-1 pl-2 text-right tabular-nums">{a}</td>
              <td className="py-1 pl-2 text-right tabular-nums">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs mt-3 leading-relaxed" style={{ color: "#9ca3af" }}>
        By {fmtDay(ex.prevDate)}, {ex.daysPrev}{" "}days past the quarter end its last report covered
        ({fmtDay(ex.navDate)}), {ex.ticker}{" "}had earned about {usd(ex.accruedPrev)}{" "}a share of net investment income
        (at the latest reported pace of {usd(ex.niiQ)}{" "}a quarter)
        {ex.paidPrev > 0 ? ` and already paid out ${usd(ex.paidPrev)} in earlier dividends` : ""}.
        {" "}On the ex-date the price {ex.pxEx <= ex.pxPrev ? "fell" : "rose"}{" "}by
        {" "}${Math.abs(ex.pxPrev - ex.pxEx).toFixed(2)}{" "}{ex.pxEx <= ex.pxPrev ? "against" : "despite"}{" "}a
        {" "}${ex.amount.toFixed(ex.amount < 0.1 ? 3 : 2)}{" "}dividend. On the reported NAV,
        P/NAV moved {repMove >= 0 ? "+" : ""}{repMove.toFixed(3)}; on the rolled-forward NAV it
        moved {adjMove >= 0 ? "+" : ""}{adjMove.toFixed(3)}.
      </p>
    </div>
  );
}

export default function PnavDividendExplainer({
  examples, evaluation,
}: { examples: PnavExample[]; evaluation: PnavEvaluation }) {
  const now = Object.fromEntries(evaluation.nowcast.map((r) => [r.method, r]));
  const step = (m: string, c: string) => evaluation.steps.find((s) => s.method === m && s.category === c);
  const A = now["A"], B = now["B"], C = now["C"];
  const exA = step("A", "ex"), exC = step("C", "ex"), ordA = step("A", "ordinary");
  const dc = evaluation.dividendCheck;
  const nHandovers = C?.n ?? 0;

  return (
    <section className="mb-8 rounded-xl border p-5" style={{ background: "#0d0d14", borderColor: "#1e1e2e" }}>
      <h2 className="text-lg font-semibold text-white mb-1">Why P/NAV jumps around dividends, and how we correct it</h2>
      <div className="text-sm max-w-4xl space-y-2" style={{ color: "#9ca3af" }}>
        <p>
          A BDC reports NAV once a quarter, as of the quarter end, and the market uses that figure
          for up to four and a half months. In the meantime two things happen that the stale NAV
          doesn&apos;t show. The BDC keeps earning interest, so its true NAV creeps up day by day.
          And when a dividend goes ex, the price drops by roughly the dividend — the cash is leaving
          the company — while the reported NAV stays put. Divide one by the other and P/NAV falls
          at every ex-date (once a quarter for quarterly payers, every month for monthly payers,
          plus any specials) and then jumps when the next NAV is published.
        </p>
        <p>
          So every P/NAV on this page divides by the <span className="text-white">NAV rolled forward</span>:
          the last reported NAV, plus net investment income earned since the quarter end (at the
          latest quarterly rate the BDC has reported, spread evenly over the days), minus every
          dividend that has gone ex since. Only information public on each day is used. Simply
          subtracting dividends is not enough — it removes the payout but not the income that
          funds it, and over-corrects. What no method can see in advance is the quarter&apos;s
          gains and losses on the loans themselves; those still arrive with the next report.
        </p>
      </div>

      {examples.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {examples.map((ex) => <ExampleCard key={ex.ticker} ex={ex} />)}
        </div>
      )}

      {A && B && C && (
        <div className="mt-5">
          <h3 className="text-base font-semibold text-white mb-1">Does it work? Tested on history</h3>
          <p className="text-sm max-w-4xl mb-3" style={{ color: "#9ca3af" }}>
            {nHandovers}{" "}quarterly NAV reports from {evaluation.nBdcs}{" "}listed BDCs, quarters ending
            {" "}{fmtDay(evaluation.firstQuarter)}{" "}to {fmtDay(evaluation.lastQuarter)}. For each, on the
            day before the new NAV came out, we estimated it three ways from what was public that day
            and compared with what was reported.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border overflow-x-auto" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <table className="text-xs w-full" style={{ borderCollapse: "collapse" }}>
                <thead style={{ background: "#0f0f16" }}>
                  <tr style={{ color: "#8b8ba8" }}>
                    <th className="text-left font-semibold px-2.5 py-2">Estimate of the next NAV</th>
                    <th className="text-right font-semibold px-2.5 py-2">Typical miss</th>
                    <th className="text-right font-semibold px-2.5 py-2">Average miss</th>
                    <th className="text-right font-semibold px-2.5 py-2">Within 1%</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { r: A, label: "Last reported NAV, unchanged" },
                    { r: B, label: "Reported NAV minus dividends only" },
                    { r: C, label: "Rolled forward (income in, dividends out)" },
                  ].map(({ r, label }) => (
                    <tr key={r.method} style={{ borderTop: "1px solid #1e1e2e",
                      color: r.method === evaluation.method ? "#e5e7eb" : "#9ca3af" }}>
                      <td className="px-2.5 py-1.5">{label}{r.method === evaluation.method ? " — used on this page" : ""}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{pct(r.medianAbsPct)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{pct(r.meanAbsPct)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{pct(r.within1Pct, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border overflow-x-auto" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
              <table className="text-xs w-full" style={{ borderCollapse: "collapse" }}>
                <thead style={{ background: "#0f0f16" }}>
                  <tr style={{ color: "#8b8ba8" }}>
                    <th className="text-left font-semibold px-2.5 py-2">Average one-day P/NAV move</th>
                    <th className="text-right font-semibold px-2.5 py-2">Ex-dividend days</th>
                    <th className="text-right font-semibold px-2.5 py-2">NAV-report days</th>
                    <th className="text-right font-semibold px-2.5 py-2">Other days</th>
                  </tr>
                </thead>
                <tbody>
                  {["A", "B", "C"].map((m) => (
                    <tr key={m} style={{ borderTop: "1px solid #1e1e2e",
                      color: m === evaluation.method ? "#e5e7eb" : "#9ca3af" }}>
                      <td className="px-2.5 py-1.5">
                        {m === "A" ? "On reported NAV" : m === "B" ? "On NAV minus dividends" : "On rolled-forward NAV"}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{pct(step(m, "ex")?.meanAbsPct)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{pct(step(m, "filing")?.meanAbsPct)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{pct(step(m, "ordinary")?.meanAbsPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-sm max-w-4xl mt-3 space-y-2" style={{ color: "#9ca3af" }}>
            <p>
              <span className="text-white">At the quarter end, the rolled-forward NAV and the plain reported
              NAV are about equally close</span>{" "}to the next report (typical miss {pct(C.medianAbsPct)}{" "}vs
              {" "}{pct(A.medianAbsPct)}). That is expected: over a whole quarter the income earned and the
              dividend paid roughly cancel, and what&apos;s left is the gains and losses on the loans, which
              nothing here can forecast. On average the NAVs came in {pct(Math.abs(A.biasPct ?? 0))}{" "}
              {(A.biasPct ?? 0) > 0 ? "below" : "above"}{" "}where either estimate put them — markdowns
              across the sector over this period. Taking off dividends without adding income misses by
              {" "}{pct(B.medianAbsPct)}.
            </p>
            {exA && exC && ordA && (
              <p>
                <span className="text-white">The difference is inside the quarter.</span>{" "}On reported NAV,
                P/NAV moves {pct(exA.meanAbsPct)}{" "}on an ex-dividend day — {exA.vsOrdinary?.toFixed(1)}x an
                ordinary day&apos;s {pct(ordA.meanAbsPct)}{" "}— and nearly all of that is the dividend. On the
                rolled-forward NAV the ex-day move is {pct(exC.meanAbsPct)}. What remains is mostly real: for a BDC
                trading below NAV the price drops by the whole dividend, which is a bigger slice of a discounted
                price than of NAV, so its discount genuinely widens a little. NAV-report days move a lot under
                every method, because that is when the quarter&apos;s gains and losses — and earnings — land.
              </p>
            )}
            {dc && (
              <p className="text-xs" style={{ color: "#6b6b88" }}>
                Dividend amounts come from Yahoo Finance&apos;s ex-date history (regular, supplemental and
                special). For the {dc.bdcs}{" "}BDCs whose filings we parse they were checked against the
                distributions each filing reports: {dc.ok}{" "}of {dc.quarters}{" "}quarters agree, {dc.timing}{" "}
                differ only in which side of a quarter end a dividend falls, {dc.inconclusive}{" "}can&apos;t be
                checked (a merger moved the share count mid-quarter) and {dc.mismatch}{" "}look like gaps in the
                dividend feed{dc.mismatches.length ? ` (${dc.mismatches.join(", ")})` : ""}.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
