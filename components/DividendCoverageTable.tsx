"use client";

// Latest trailing-four-quarter dividend coverage per BDC, from reported NII
// down to cash-only income, with a PIK stress slider: "suppose X% of the PIK
// income booked over the last year is never collected", and a severe-PIK
// stress by type: base case = the PIK on debt that switched from cash to PIK
// while held; wider case = also debt already PIK when first seen. Preferred,
// equity and convertible PIK (PIK by design) is in neither case, nor are loans
// that read severe only on a bare-spread cash leg (bdc_inventory/scripts/91).
import { useMemo, useState } from "react";
import Link from "next/link";
import type { IncomeTtmRow } from "@/data/income_coverage";
import { recaptureDisplay } from "@/lib/pikRecapture";
import { joinList } from "@/lib/joinList";
import CsvDownloadButton from "./CsvDownloadButton";

type Key =
  | "ticker" | "nii_m" | "dist_m" | "pik_pct_nii" | "nii_cov" | "cov_ex_pik" | "recapture_shown" | "cov_ex_net_pik_shown"
  | "cov_strict" | "pik_cushion_pct" | "switched_pik_pct_nii" | "cov_ex_switched" | "cov_ex_severe_debt" | "stressed";

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
    () => rows.map((r) => {
      const recap = recaptureDisplay(r);
      return {
        ...r,
        recap,
        recapture_shown: recap.recapturePct,
        cov_ex_net_pik_shown: recap.covExNetPik,
        stressed: r.dist_m > 0 ? (r.nii_m - (haircut / 100) * r.pik_m) / r.dist_m : null,
      };
    }),
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
  const reportedList = joinList(rows.filter((r) => r.recapture_src === "reported").map((r) => r.ticker).sort());
  const nBelowReported = enriched.filter((r) => (r.nii_cov ?? 9) < 1).length;

  const head: [Key, string, string][] = [
    ["ticker", "BDC", "left"],
    ["nii_m", "NII (TTM)", "right"],
    ["dist_m", "Distributions (TTM)", "right"],
    ["pik_pct_nii", "PIK % of NII", "right"],
    ["nii_cov", "Reported coverage", "right"],
    ["cov_ex_pik", "Cash coverage ex-PIK", "right"],
    ["recapture_shown", "PIK recaptured", "right"],
    ["cov_ex_net_pik_shown", "Cash cov. net of recapture", "right"],
    ["cov_strict", "Ex-PIK & accretion", "right"],
    ["pik_cushion_pct", "PIK cushion", "right"],
    ["switched_pik_pct_nii", "Switched-debt PIK % of NII", "right"],
    ["cov_ex_switched", "If switched-debt PIK lost", "right"],
    ["cov_ex_severe_debt", "Wider: + first-seen debt", "right"],
    ["stressed", `If ${haircut}% of PIK lost`, "right"],
  ];
  const onSort = (k: Key) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "ticker" ? "asc" : "asc"); }
  };

  const csvColumns = ["ticker", "ttm_to", "nii_m", "distributions_m", "pik_m", "accretion_m", "pik_pct_nii",
    "reported_coverage", "cash_coverage_ex_pik", "pik_recaptured_m", "recapture_basis", "recapture_pct_of_pik",
    "net_pik_pct_nii", "cash_coverage_net_of_recapture", "coverage_ex_pik_and_accretion", "pik_cushion_pct",
    "switched_debt_severe_pik_pct_nii", "coverage_if_switched_debt_severe_pik_lost",
    "coverage_if_switched_and_first_seen_debt_severe_pik_lost", "unclear_history_share_of_pik_income",
    `coverage_if_${haircut}pct_pik_lost`, "pik_basis"];
  const csvRows = sorted.map((r) => [r.ticker, r.period_end, r.nii_m, r.dist_m, r.pik_m, r.acc_m, r.pik_pct_nii,
    r.nii_cov, r.cov_ex_pik, r.recap.recapturePct == null ? null : r.pik_recaptured_m,
    r.recapture_src === "estimated" ? (r.recap.estimate ? "estimate" : "estimate not shown") : r.recapture_src,
    r.recap.recapturePct, r.recap.netPikPctNii, r.recap.covExNetPik,
    r.cov_strict, r.pik_cushion_pct,
    r.switched_pik_pct_nii, r.cov_ex_switched, r.cov_ex_severe_debt,
    r.unknown_share == null ? null : +(100 * r.unknown_share).toFixed(1),
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
              no dividend until the borrower repays. <span className="text-white">PIK recaptured</span>{" "}is the
              share of the year&apos;s PIK that came back as cash within the same year —{" "}
              {reportedList ? `reported by ${reportedList}; ` : ""}estimated for the rest from loans that left the
              book or were refinanced at par, marked &quot;est.&quot; (an estimate, not a reported figure). An
              estimate larger than the PIK booked is not shown.{" "}
              <span className="text-white">Cash coverage net of recapture</span>{" "}strips only the PIK that has
              not come back. The <span className="text-white">PIK cushion</span>{" "}is the share of the year&apos;s
              PIK that could prove uncollectible before reported NII stops covering the dividend (negative =
              already uncovered on reported NII).
            </p>
            <p className="text-xs mt-2" style={{ color: "#8b8ba8" }}>
              <span className="text-white">If severe PIK is lost</span>{" "}— severe PIK is half or more of a
              coupon paid in kind. The <span className="text-white">base case</span>{" "}takes out the year&apos;s PIK
              from debt that switched from cash to PIK while the BDC held it (the same loan, or a new PIK loan cut
              from it at a restructuring) — borrowers that moved from paying cash to paying half or more in kind.
              The <span className="text-white">wider case</span>{" "}also takes out severe PIK on debt that was already
              PIK when first seen in our data. Neither takes out PIK dividends on preferred stock, equity or
              convertible notes, where paying in kind is built into the instrument, nor severe debt whose history is
              unclear (hover the wider-case cell), nor loans that read severe only because the filing prints their
              cash coupon as a spread over SOFR (with SOFR added they pay under half in kind). Each quarter&apos;s
              PIK is shared out by that quarter&apos;s loan-level PIK rate × principal, with loans on non-accrual at
              zero — the PIK ledger&apos;s allocation, except that an all-PIK floating loan quoted as a spread
              accrues at SOFR plus the spread — and the four quarters are added up.
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
            {nBelow} of {enriched.length} BDCs below 1.0x (vs {nBelowReported}{" "}on reported NII)
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
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap" style={{ color: "#d1d5db" }}
                  title={r.recap.note || "not measurable yet"}>
                  {r.recapture_src === "net_basis" ? "net" : pct(r.recap.recapturePct, 0)}
                  {r.recap.estimate && <span className="text-[10px] ml-1" style={{ color: "#6b6b88" }}>est.</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ background: covColor(r.recap.covExNetPik), color: "#fafafa" }}
                  title={r.recap.note || undefined}>
                  {x2(r.recap.covExNetPik)}
                  {r.recap.estimate && <span className="text-[10px] ml-1 font-normal" style={{ color: "#9ca3af" }}>est.</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ background: covColor(r.cov_strict), color: "#9ca3af" }}>{x2(r.cov_strict)}</td>
                <td className="px-3 py-2 text-right tabular-nums"
                  style={{ color: (r.pik_cushion_pct ?? -1) < 0 ? "#ef4444" : (r.pik_cushion_pct ?? 0) < 25 ? "#f59e0b" : "#22c55e" }}>
                  {r.pik_cushion_pct == null ? "—" : r.pik_cushion_pct < 0 ? "uncovered" : r.pik_cushion_pct > 100 ? ">100%" : pct(r.pik_cushion_pct, 0)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}
                  title={r.switched_pik_m == null ? undefined : `$${r.switched_pik_m.toFixed(1)}m of the year's $${r.pik_m.toFixed(0)}m PIK`}>
                  {pct(r.switched_pik_pct_nii)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ background: covColor(r.cov_ex_switched), color: "#fafafa" }}>{x2(r.cov_ex_switched)}</td>
                <td className="px-3 py-2 text-right tabular-nums" style={{ background: covColor(r.cov_ex_severe_debt), color: "#e5e7eb" }}
                  title={r.unknown_share ? `Not in either case: ${(100 * r.unknown_share).toFixed(0)}% of the PIK income is severe debt whose history is unclear` : undefined}>
                  {x2(r.cov_ex_severe_debt)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ background: covColor(r.stressed), color: "#fafafa" }}>{x2(r.stressed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
