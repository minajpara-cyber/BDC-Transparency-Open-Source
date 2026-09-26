"use client";

// Severe PIK by type, per BDC at its latest quarter. "Severe" (more than half
// of the coupon in kind, or all of it) says how much, not why; the four types
// (lib/pikOrigin.ts) say why, and always add up to the severe total. Data:
// data/income_coverage.ts (bdc_inventory/scripts/91 <- scripts/90).
import { useMemo, useState } from "react";
import Link from "next/link";
import type { IncomeTtmRow } from "@/data/income_coverage";
import { PIK_ORIGINS, PIK_ORIGIN_COLOR, PIK_ORIGIN_EXPLAIN, PIK_ORIGIN_LABEL, type PikOrigin, pikOriginPhrase } from "@/lib/pikOrigin";
import CsvDownloadButton from "./CsvDownloadButton";

type Row = Pick<IncomeTtmRow, "ticker" | "period_end" | "book_m" | "severe_m" | "severe_pct_book"
  | "sev_by_design_pct_book" | "sev_first_seen_pct_book" | "sev_switched_pct_book" | "sev_unknown_pct_book"
  | "sev_by_design_m" | "sev_first_seen_m" | "sev_switched_m" | "sev_unknown_m">;
type Key = "ticker" | "severe_pct_book" | `sev_${PikOrigin}_pct_book`;

const pctOf = (r: Row, o: PikOrigin) => r[`sev_${o}_pct_book`];
const usdOf = (r: Row, o: PikOrigin) => r[`sev_${o}_m`];
const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)}%`);
const usd = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : v >= 1000 ? `$${(v / 1000).toFixed(2)}bn` : `$${v.toFixed(0)}m`;

/** All-BDC total: dollars summed, then divided by the summed book. */
export function severeTypeTotal(rows: Row[]) {
  const ok = rows.filter((r) => r.book_m != null && r.book_m > 0 && r.severe_m != null);
  const book = ok.reduce((s, r) => s + (r.book_m ?? 0), 0);
  const severe = ok.reduce((s, r) => s + (r.severe_m ?? 0), 0);
  const parts = Object.fromEntries(PIK_ORIGINS.map((o) => [o, ok.reduce((s, r) => s + (usdOf(r, o) ?? 0), 0)])) as Record<PikOrigin, number>;
  return { n: ok.length, book, severe, parts };
}

export default function SeverePikTypeTable({ rows }: { rows: Row[] }) {
  const [sortKey, setSortKey] = useState<Key>("sev_switched_pct_book");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const usable = useMemo(() => rows.filter((r) => r.severe_pct_book != null), [rows]);
  const sorted = useMemo(() => [...usable].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [usable, sortKey, dir]);
  const total = severeTypeTotal(usable);
  const head: [Key, string][] = [
    ["ticker", "BDC"], ["severe_pct_book", "Severe PIK"],
    ...PIK_ORIGINS.map((o) => [`sev_${o}_pct_book`, PIK_ORIGIN_LABEL[o]] as [Key, string]),
  ];
  const csvCols = ["ticker", "as_of", "book_m", "severe_pik_m", "severe_pik_pct_book",
    ...PIK_ORIGINS.flatMap((o) => [`${o}_m`, `${o}_pct_book`])];
  const csvRows = sorted.map((r) => [r.ticker, r.period_end, r.book_m, r.severe_m, r.severe_pct_book,
    ...PIK_ORIGINS.flatMap((o) => [usdOf(r, o), pctOf(r, o)])]);

  const Bar = ({ r }: { r: Row }) => {
    const sev = r.severe_pct_book ?? 0;
    if (sev <= 0) return null;
    return (
      <div className="flex h-1.5 w-24 rounded overflow-hidden mt-1 ml-auto" style={{ background: "#1e1e2e" }}
        aria-hidden="true">
        {PIK_ORIGINS.map((o) => (
          <div key={o} style={{ width: `${(100 * (pctOf(r, o) ?? 0)) / sev}%`, background: PIK_ORIGIN_COLOR[o] }} />
        ))}
      </div>
    );
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b flex items-start justify-between gap-3 flex-wrap" style={{ borderColor: "#1e1e2e" }}>
        <div className="max-w-4xl">
          <h3 className="font-semibold text-white text-sm">What kind of severe PIK?</h3>
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            Severe PIK is PIK making up more than half of a position&apos;s coupon, or all of it — it says how
            much is paid in kind, not why. Each severe position is one of four types, shown as % of the BDC&apos;s
            whole book at cost (hover a cell for dollars); the four add up to the severe total.
            {total.book > 0 && ` Across ${total.n} BDCs, $${(total.severe / 1000).toFixed(1)}bn of severe PIK splits into `
              + PIK_ORIGINS.map((o) => `${pikOriginPhrase(o)} ${(100 * total.parts[o] / total.severe).toFixed(0)}%`).join(", ")
              + "."}
          </p>
          <ul className="text-xs mt-2 space-y-1" style={{ color: "#8b8ba8" }}>
            {PIK_ORIGINS.map((o) => (
              <li key={o}>
                <span className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle" style={{ background: PIK_ORIGIN_COLOR[o] }} />
                <span className="text-white">{PIK_ORIGIN_LABEL[o]}.</span>{" "}{PIK_ORIGIN_EXPLAIN[o]}
              </li>
            ))}
          </ul>
        </div>
        <CsvDownloadButton filename="severe-pik-by-type" columns={csvCols} rows={csvRows} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {head.map(([k, label], i) => (
                <th key={k} onClick={() => { if (k === sortKey) setDir(dir === "asc" ? "desc" : "asc"); else { setSortKey(k); setDir(k === "ticker" ? "asc" : "desc"); } }}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none ${i === 0 ? "text-left" : "text-right"}`}
                  style={{ color: sortKey === k ? "#a5b4fc" : "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>
                  {label} {sortKey === k ? (dir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#111118" : "#0f0f16" }} data-severe-type-row={r.ticker}>
                <td className="px-3 py-2 font-mono font-semibold">
                  <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>{r.ticker}</Link>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-white" title={`${usd(r.severe_m)} of a ${usd(r.book_m)} book, ${r.period_end}`}>
                  {pct(r.severe_pct_book)}
                  <Bar r={r} />
                </td>
                {PIK_ORIGINS.map((o) => (
                  <td key={o} className="px-3 py-2 text-right tabular-nums"
                    style={{ color: o === "switched" && (pctOf(r, o) ?? 0) >= 2 ? "#fca5a5" : "#d1d5db",
                      fontWeight: o === "switched" ? 600 : 400 }}
                    title={usd(usdOf(r, o))}>
                    {pct(pctOf(r, o))}
                  </td>
                ))}
              </tr>
            ))}
            {total.book > 0 && (
              <tr style={{ background: "#0f0f16", borderTop: "1px solid #1e1e2e" }}>
                <td className="px-3 py-2 text-xs font-semibold uppercase" style={{ color: "#8b8ba8" }}>All {total.n}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-white" title={`${usd(total.severe)} of ${usd(total.book)}`}>
                  {pct(100 * total.severe / total.book)}
                </td>
                {PIK_ORIGINS.map((o) => (
                  <td key={o} className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: "#d1d5db" }}
                    title={usd(total.parts[o])}>
                    {pct(100 * total.parts[o] / total.book)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
