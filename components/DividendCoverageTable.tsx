"use client";

// Latest trailing-four-quarter dividend coverage per BDC, from reported NII
// down to cash-only income, with a PIK stress slider: "suppose X% of the PIK
// income booked over the last year is never collected".
import { useMemo, useState } from "react";
import Link from "next/link";
import type { IncomeTtmRow } from "@/data/income_coverage";
import CsvDownloadButton from "./CsvDownloadButton";

type Key =
  | "ticker" | "nii_m" | "dist_m" | "pik_pct_nii" | "nii_cov" | "cov_ex_pik" | "cov_strict"
  | "pik_cushion_pct" | "severe_share" | "cov_ex_severe" | "stressed";

function covColor(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "transparent";
  if (v >= 1.05) return "rgba(34,197,94,0.16)";
  if (v >= 0.95) return "rgba(234,179,8,0.14)";
  if (v >= 0.8) return "rgba(245,158,11,0.20)";
  return "rgba(239,68,68,0.24)";
}

const x2 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(2)}x`);
const pct = (v: number | null | undefined, d = 1) => (v == null || !Number.isFinite(v) ? "—" : `${v.toFixed(d)}%`);
const usd = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? "—" : v >= 1000 ? `$${(v / 1000).toFixed(2)}bn` : `$${v.toFixed(0)}m`;

export default function DividendCoverageTable({ rows }: { rows: IncomeTtmRow[] }) {
  const [haircut, setHaircut] = useState(25);
  const [sortKey, setSortKey] = useState<Key>("cov_ex_pik");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const enriched = useMemo(
    () => rows.map((r) => ({
      ...r,
      stressed: r.dist_m > 0 ? (r.nii_m - (haircut / 100) * r.pik_m) / r.dist_m : null,
    })),
    [rows, haircut],
  );
  const sorted = useMemo(() => {
    const s = [...enriched].sort((a, b) => {
      const av = a[sortKey as keyof typeof a];
      const bv = b[sortKey as keyof typeof b];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      if (av == null) return 1;
      if (bv == null) return -1;
      return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return s;
  }, [enriched, sortKey, sortDir]);

  const nBelow = enriched.filter((r) => (r.stressed ?? 9) < 1).length;
  const nBelowReported = enriched.filter((r) => (r.nii_cov ?? 9) < 1).length;

  const head: [Key, string, string][] = [
    ["ticker", "BDC", "left"],
    ["nii_m", "NII (TTM)", "right"],
    ["dist_m", "Distributions (TTM)", "right"],
    ["pik_pct_nii", "PIK % of NII", "right"],
    ["nii_cov", "Reported coverage", "right"],
    ["cov_ex_pik", "Cash coverage ex-PIK", "right"],
    ["cov_strict", "Ex-PIK & accretion", "right"],
    ["pik_cushion_pct", "PIK cushion", "right"],
    ["severe_share", "Severe share of PIK book", "right"],
    ["cov_ex_severe", "If severe PIK lost", "right"],
    ["stressed", `If ${haircut}% of PIK lost`, "right"],
  ];
  const onSort = (k: Key) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "ticker" ? "asc" : "asc"); }
  };

  const csvColumns = ["ticker", "ttm_to", "nii_m", "distributions_m", "pik_m", "accretion_m", "pik_pct_nii",
    "reported_coverage", "cash_coverage_ex_pik", "coverage_ex_pik_and_accretion", "pik_cushion_pct",
    "severe_share_of_pik_book", "coverage_if_severe_pik_lost", `coverage_if_${haircut}pct_pik_lost`, "pik_basis"];
  const csvRows = sorted.map((r) => [r.ticker, r.period_end, r.nii_m, r.dist_m, r.pik_m, r.acc_m, r.pik_pct_nii,
    r.nii_cov, r.cov_ex_pik, r.cov_strict, r.pik_cushion_pct,
    r.severe_share == null ? null : +(100 * r.severe_share).toFixed(1), r.cov_ex_severe,
    r.stressed == null ? null : +r.stressed.toFixed(3), r.basis]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="max-w-4xl">
            <h3 className="font-semibold text-white text-sm">Dividend coverage, last four quarters</h3>
            <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
              Reported coverage is NII ÷ distributions declared. <span className="text-white">Cash coverage</span>{" "}
              takes the PIK income out of NII first — PIK is interest paid by adding to the loan, so it funds
              no dividend until the borrower repays. The <span className="text-white">PIK cushion</span>{" "}is the
              share of the year&apos;s PIK that could prove uncollectible before reported NII stops covering the
              dividend (negative = already uncovered on reported NII).
            </p>
          </div>
          <CsvDownloadButton filename="dividend-coverage-ttm" columns={csvColumns} rows={csvRows} />
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <label className="text-xs" style={{ color: "#9ca3af" }} htmlFor="pik-haircut">
            Stress: assume <span className="text-white font-semibold">{haircut}%</span>{" "}of PIK income is never collected
          </label>
          <input id="pik-haircut" type="range" min={0} max={100} step={5} value={haircut}
            onChange={(e) => setHaircut(Number(e.target.value))} className="w-56" />
          <span className="text-xs" style={{ color: nBelow > nBelowReported ? "#f59e0b" : "#9ca3af" }}>
            {nBelow} of {enriched.length} BDCs below 1.0x (vs {nBelowReported} on reported NII)
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {head.map(([k, label, align]) => (
                <th key={k} onClick={() => onSort(k)}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none ${align === "left" ? "text-left" : "text-right"}`}
                  style={{ color: sortKey === k ? "#a5b4fc" : "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>
                  {label} {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                <td className="px-3 py-2 font-mono font-semibold">
                  <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>
                    {r.ticker}
                  </Link>
                  {r.basis !== "gross" && (
                    <span className="ml-1 text-[10px]" style={{ color: "#6b6b88" }}
                      title={r.basis === "net_of_collections"
                        ? "This filer prints PIK net of cash collected on PIK — understates gross PIK"
                        : "This filer prints only a broader 'non-cash investment income' line"}>
                      {r.basis === "net_of_collections" ? "net" : "broad"}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{usd(r.nii_m)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>{usd(r.dist_m)}</td>
                <td className="px-3 py-2 text-right tabular-nums"
                  style={{ color: (r.pik_pct_nii ?? 0) >= 30 ? "#ef4444" : (r.pik_pct_nii ?? 0) >= 15 ? "#f59e0b" : "#9ca3af" }}>
                  {pct(r.pik_pct_nii)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ background: covColor(r.nii_cov), color: "#e5e7eb" }}>{x2(r.nii_cov)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-white" style={{ background: covColor(r.cov_ex_pik) }}>{x2(r.cov_ex_pik)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ background: covColor(r.cov_strict), color: "#9ca3af" }}>{x2(r.cov_strict)}</td>
                <td className="px-3 py-2 text-right tabular-nums"
                  style={{ color: (r.pik_cushion_pct ?? -1) < 0 ? "#ef4444" : (r.pik_cushion_pct ?? 0) < 25 ? "#f59e0b" : "#22c55e" }}>
                  {r.pik_cushion_pct == null ? "—" : r.pik_cushion_pct < 0 ? "uncovered" : r.pik_cushion_pct > 100 ? ">100%" : pct(r.pik_cushion_pct, 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                  {r.severe_share == null ? "—" : `${(100 * r.severe_share).toFixed(0)}%`}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ background: covColor(r.cov_ex_severe), color: "#e5e7eb" }}>{x2(r.cov_ex_severe)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ background: covColor(r.stressed), color: "#fafafa" }}>{x2(r.stressed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
