"use client";

// Cross-holder non-accrual divergence: borrowers held by 2+ covered BDCs where
// at least one holder flags the loan non-accrual and at least one still accrues
// it. The forward-looking read: if peers have already written a credit to
// non-accrual and one holder hasn't, that holder is the likely next mover — and
// the dollars it still carries as accruing are the catch-up-writedown risk.
//
// Reads crossIssuerDisagreement (already exported on /non-accruals); all the
// direction/consensus/$-at-risk math is derived here. Borrowers are matched by
// normalized name, so this is a conservative subset of true shared exposure.
import { useMemo, useState } from "react";
import Link from "next/link";
import { crossIssuerDisagreement } from "@/data/non_accrual_events";
import { managerOf } from "@/lib/managerMap";

const cleanName = (s: string) => s.replace(/\s*\((?:\d+|[a-z])\)(?:\((?:\d+|[a-z])\))*\s*$/i, "").trim();
const fmtM = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(2)}B` : m >= 1 ? `$${m.toFixed(0)}M` : `$${m.toFixed(1)}M`);
// marks come from fv÷par on the underlying tranches; par is misparsed in a few
// BDCs (ARCC/GBDC), yielding impossible >110¢ marks. Hide those rather than show "200¢".
const markStr = (m: number | null) => (m != null && m > 0 && m <= 1.1 ? `${Math.round(m * 100)}¢` : null);

type SortKey = "fv_accruing" | "consensus" | "name";

export default function CrossHolderDivergence() {
  const [q, setQ] = useState("");
  const [majorityOnly, setMajorityOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("fv_accruing");

  const rows = useMemo(() => {
    return crossIssuerDisagreement
      .map((d) => {
        const na = d.holders.filter((h) => h.is_non_accrual);
        const accruing = d.holders.filter((h) => !h.is_non_accrual);
        const fvAccruing = accruing.reduce((s, h) => s + (h.fv_m || 0), 0);
        const consensus = d.n_holders_na / d.n_holders;
        return {
          key: d.company_norm,
          name: cleanName(d.display_name),
          n_holders: d.n_holders,
          n_na: d.n_holders_na,
          consensus,
          na,
          accruing,
          fvAccruing,
          // a holdout still accruing at a depressed mark is "quietly agreeing"
          minAccruingMark: accruing.reduce<number | null>(
            (m, h) => (h.mark_at_par != null && (m == null || h.mark_at_par < m) ? h.mark_at_par : m),
            null,
          ),
        };
      })
      .filter((r) => r.accruing.length > 0 && r.na.length > 0)
      .filter((r) => !majorityOnly || r.consensus >= 0.5)
      .filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name);
        if (sortKey === "consensus") return b.consensus - a.consensus || b.fvAccruing - a.fvAccruing;
        return b.fvAccruing - a.fvAccruing;
      });
  }, [q, majorityOnly, sortKey]);

  const totalAtRisk = rows.reduce((s, r) => s + r.fvAccruing, 0);
  const nMajority = rows.filter((r) => r.consensus >= 0.5).length;

  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-white mb-1">Cross-holder non-accrual divergence</h2>
      <p className="text-sm max-w-3xl mb-4" style={{ color: "#9ca3af" }}>
        Credits that at least one BDC has put on <span style={{ color: "#ef4444" }}>non-accrual</span> while at least one other
        holder <span className="text-white">still accrues</span> them. When peers have already stopped accruing a loan, the
        holdout is the likely next mover — and the dollars it still carries are the catch-up-writedown risk. A holdout marking the
        loan well below par is quietly agreeing; one still near par is genuinely disagreeing.
      </p>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search borrower…"
          className="px-3 py-1.5 rounded-lg text-sm outline-none"
          style={{ background: "#111118", border: "1px solid #2d2d50", color: "#e5e5f0", minWidth: 200 }}
        />
        <button
          onClick={() => setMajorityOnly((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: majorityOnly ? "#6366f1" : "transparent",
            color: majorityOnly ? "#fff" : "#9ca3af",
            border: "1px solid #2d2d50",
          }}
          title="Show only credits where at least half the holders have already flagged non-accrual"
        >
          Majority already non-accrual
        </button>
        <div className="flex rounded-lg overflow-hidden border text-xs" style={{ borderColor: "#2d2d50" }}>
          {([["fv_accruing", "$ at risk"], ["consensus", "Consensus"], ["name", "Name"]] as [SortKey, string][]).map(
            ([k, label]) => (
              <button key={k} onClick={() => setSortKey(k)} className="px-3 py-1.5 font-medium transition-colors"
                style={{ background: sortKey === k ? "#6366f1" : "transparent", color: sortKey === k ? "#fff" : "#9ca3af" }}>
                {label}
              </button>
            ),
          )}
        </div>
        <span className="text-xs ml-auto" style={{ color: "#6b6b88" }}>
          {rows.length} contested · {fmtM(totalAtRisk)} still accruing{nMajority ? ` · ${nMajority} where majority flagged` : ""}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm text-center" style={{ background: "#111118", borderColor: "#1e1e2e", color: "#8b8ba8" }}>
          No cross-holder disagreements match — every shared borrower is flagged consistently across its holders.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
          <table className="w-full text-sm">
            <thead style={{ background: "#0f0f16" }}>
              <tr style={{ color: "#8b8ba8" }} className="text-xs uppercase tracking-wider">
                <th className="text-left font-semibold px-4 py-2.5">Borrower</th>
                <th className="text-center font-semibold px-3 py-2.5">Consensus</th>
                <th className="text-left font-semibold px-3 py-2.5">On non-accrual at</th>
                <th className="text-left font-semibold px-3 py-2.5">Still accruing at</th>
                <th className="text-right font-semibold px-4 py-2.5">$ still accruing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.key} style={{ borderTop: "1px solid #1a1a28", background: i % 2 ? "#0f0f16" : undefined }}>
                  <td className="px-4 py-3 align-top">
                    <div className="font-medium text-white leading-tight">{r.name}</div>
                  </td>
                  <td className="px-3 py-3 align-top text-center">
                    <div className="font-semibold tabular-nums" style={{ color: r.consensus >= 0.5 ? "#ef4444" : "#eab308" }}>
                      {r.n_na}/{r.n_holders}
                    </div>
                    <div className="text-xs" style={{ color: "#6b6b88" }}>NA</div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {r.na.map((h) => (
                        <Link key={h.ticker} href={`/bdcs/${h.ticker.toLowerCase()}`}
                          className="px-1.5 py-0.5 rounded text-xs font-mono font-medium"
                          style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.4)" }}
                          title={`${managerOf(h.ticker)} · ${fmtM(h.fv_m)}${markStr(h.mark_at_par) ? ` · mark ${markStr(h.mark_at_par)}` : ""}`}>
                          {h.ticker}{markStr(h.mark_at_par) ? ` ${markStr(h.mark_at_par)}` : ""}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {r.accruing.map((h) => {
                        const low = h.mark_at_par != null && h.mark_at_par < 0.85;
                        return (
                          <Link key={h.ticker} href={`/bdcs/${h.ticker.toLowerCase()}`}
                            className="px-1.5 py-0.5 rounded text-xs font-mono font-medium"
                            style={{
                              background: low ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.12)",
                              color: low ? "#fcd34d" : "#a5b4fc",
                              border: `1px solid ${low ? "rgba(245,158,11,0.45)" : "#2d2d50"}`,
                            }}
                            title={`${managerOf(h.ticker)} · ${fmtM(h.fv_m)} still accruing${markStr(h.mark_at_par) ? ` · marked ${markStr(h.mark_at_par)}${low ? " (already marking it down)" : ""}` : ""}`}>
                            {h.ticker} {fmtM(h.fv_m)}{markStr(h.mark_at_par) ? ` · ${markStr(h.mark_at_par)}` : ""}
                          </Link>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-right tabular-nums font-semibold text-white">
                    {fmtM(r.fvAccruing)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
        Borrowers matched by normalized name across covered BDCs (a conservative subset — different legal-entity names for the
        same credit may not link). Marks are fair value ÷ par on the debt tranches; an <span style={{ color: "#fcd34d" }}>amber</span>{" "}holdout
        is already carrying the loan below 85¢ while still accruing. MFIC is excluded (its SOI doesn&apos;t flag non-accrual per position).
      </p>
    </section>
  );
}
