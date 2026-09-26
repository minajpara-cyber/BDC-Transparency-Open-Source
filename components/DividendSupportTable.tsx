"use client";

// Dividend support per BDC: the coverage ratios plus the things that decide
// whether a shortfall matters — spillover cushion, NAV per share trend, NAV
// total return against the payout, defaults, severe PIK — rolled into a
// transparent count of warning signs (lib/dividendPressure.ts). The shadow
// default sign counts only where that BDC's default-rate window is fully
// observed.
import { useMemo, useState } from "react";
import Link from "next/link";
import type { DividendSupportRow } from "@/data/dividend_support";
import type { DefaultWindowLike } from "@/lib/defaultRatePublication";
import { gateDividendSupport, SHADOW_DEFAULT_FLAG_PCT } from "@/lib/dividendPressure";
import CsvDownloadButton from "./CsvDownloadButton";

const PRESSURE: Record<string, { color: string; bg: string; label: string }> = {
  high: { color: "#fca5a5", bg: "rgba(239,68,68,0.22)", label: "High" },
  elevated: { color: "#fcd34d", bg: "rgba(245,158,11,0.18)", label: "Elevated" },
  low: { color: "#86efac", bg: "rgba(34,197,94,0.14)", label: "Low" },
};

const x2 = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}x`);
const p1 = (v: number | null, sign = false) =>
  v == null ? "—" : `${sign && v > 0 ? "+" : ""}${v.toFixed(1)}%`;

type Key = "ticker" | "gated_n_flags" | "nii_cov" | "cov_ex_pik" | "spillover_q" | "nav_chg_1y" | "nav_chg_3y"
  | "nav_tr_1y" | "shadow_default_observed";

export default function DividendSupportTable({ rows, defaultWindows }: {
  rows: DividendSupportRow[];
  defaultWindows: readonly DefaultWindowLike[];
}) {
  const [sortKey, setSortKey] = useState<Key>("gated_n_flags");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const gated = useMemo(() => rows.map((r) => gateDividendSupport(r, defaultWindows)), [rows, defaultWindows]);
  const sorted = useMemo(() => [...gated].sort((a, b) => {
    const av = a[sortKey] as number | string | null, bv = b[sortKey] as number | string | null;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [gated, sortKey, dir]);
  const nShadowCounted = gated.filter((r) => r.shadow_default_observed != null).length;
  const head: [Key, string][] = [
    ["ticker", "BDC"], ["gated_n_flags", "Pressure"], ["nii_cov", "Reported cov."], ["cov_ex_pik", "Cash cov."],
    ["spillover_q", "Spillover (qtrs)"], ["nav_chg_1y", "NAV/sh 1y"], ["nav_chg_3y", "NAV/sh 3y"],
    ["nav_tr_1y", "NAV total return 1y"], ["shadow_default_observed", "Shadow default"],
  ];
  const csvCols = ["ticker", "as_of", "pressure", "n_flags", "flags", "reported_coverage", "cash_coverage_ex_pik",
    "pik_pct_nii", "pik_collected_pct", "spillover_m", "spillover_fy", "spillover_quarters", "nav_ps",
    "nav_chg_1y_pct", "nav_chg_3y_pct", "dividend_yield_on_nav_pct", "nav_total_return_1y_pct",
    "shadow_default_pct", "hard_default_pct", "default_rate_note", "severe_share_of_pik_pct"];
  const csvRows = sorted.map((r) => [r.ticker, r.period_end, r.gated_pressure, r.gated_n_flags, r.gated_flags.join("; "),
    r.nii_cov, r.cov_ex_pik, r.pik_pct_nii, r.pik_collected_pct, r.spillover_m, r.spillover_fy, r.spillover_q,
    r.nav_ps, r.nav_chg_1y, r.nav_chg_3y, r.div_yield_nav, r.nav_tr_1y, r.shadow_default_observed,
    r.hard_default_observed, r.shadow_default_note, r.severe_pik_share]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b flex items-start justify-between gap-3 flex-wrap" style={{ borderColor: "#1e1e2e" }}>
        <div className="max-w-4xl">
          <h3 className="font-semibold text-white text-sm">Dividend support, latest quarter</h3>
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            A coverage shortfall matters more when there is no cushion behind it and NAV is shrinking. Each
            row counts the warning signs listed below the table; hover a pressure badge to see which ones
            apply.{" "}
            <span className="text-white">Spillover</span>{" "}is taxable income earned but not yet paid out, in
            quarters of the current dividend. <span className="text-white">NAV total return</span>{" "}is the
            change in NAV per share plus the year&apos;s distributions — when it is well below the dividend
            yield, part of the dividend came out of NAV.
          </p>
        </div>
        <CsvDownloadButton filename="dividend-support" columns={csvCols} rows={csvRows} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {head.map(([k, label], i) => (
                <th key={k} onClick={() => { if (k === sortKey) setDir(dir === "asc" ? "desc" : "asc"); else { setSortKey(k); setDir(k === "ticker" ? "asc" : "desc"); } }}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none ${i === 0 ? "text-left" : "text-right"}`}
                  style={{ color: sortKey === k ? "#a5b4fc" : "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>
                  {label} {sortKey === k ? (dir === "asc" ? "↑" : "↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => {
              const pr = PRESSURE[r.gated_pressure];
              return (
                <tr key={r.ticker} style={{ background: i % 2 === 0 ? "#111118" : "#0f0f16" }}>
                  <td className="px-3 py-2 font-mono font-semibold">
                    <Link href={`/bdcs/${r.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>{r.ticker}</Link>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-xs px-2 py-0.5 rounded font-semibold whitespace-nowrap"
                      style={{ background: pr.bg, color: pr.color }}
                      title={r.gated_flags.length ? r.gated_flags.join("\n") : "No warning signs"}>
                      {pr.label} · {r.gated_n_flags}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: (r.nii_cov ?? 9) < 0.95 ? "#fca5a5" : "#d1d5db" }}>{x2(r.nii_cov)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: (r.cov_ex_pik ?? 9) < 0.8 ? "#fca5a5" : "#d1d5db" }}>{x2(r.cov_ex_pik)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}
                    title={r.spillover_m != null ? `$${r.spillover_m.toFixed(1)}m at FY ${r.spillover_fy}` : "Not tagged in XBRL"}>
                    {r.spillover_q == null ? "—" : r.spillover_q.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: r.nav_chg_1y == null ? "#6b6b88" : r.nav_chg_1y < -5 ? "#fca5a5" : r.nav_chg_1y < 0 ? "#fcd34d" : "#86efac" }}>{p1(r.nav_chg_1y, true)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: r.nav_chg_3y == null ? "#6b6b88" : r.nav_chg_3y < -10 ? "#fca5a5" : r.nav_chg_3y < 0 ? "#fcd34d" : "#86efac" }}>{p1(r.nav_chg_3y, true)}</td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#d1d5db" }}
                    title={r.div_yield_nav != null ? `dividend yield on NAV ${r.div_yield_nav.toFixed(1)}%` : ""}>
                    {p1(r.nav_tr_1y, true)}
                    {r.div_yield_nav != null && (
                      <span className="text-[10px] ml-1" style={{ color: "#6b6b88" }}>vs {r.div_yield_nav.toFixed(1)}%</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums"
                    style={{ color: (r.shadow_default_observed ?? 0) > SHADOW_DEFAULT_FLAG_PCT ? "#fca5a5" : r.shadow_default_observed == null ? "#6b6b88" : "#9ca3af" }}
                    title={r.shadow_default_note || `Twelve months to ${r.period_end}; hard rate ${p1(r.hard_default_observed)}`}>
                    {p1(r.shadow_default_observed)}
                    {r.shadow_default_observed == null && <span className="text-[10px] ml-1">withheld</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t text-xs" style={{ borderColor: "#1e1e2e", color: "#6b6b88" }}>
        Warning signs (one point each): reported NII below 95% of the dividend · NII ex-PIK below 80% of it ·
        under-covered with less than a quarter of spillover · NAV per share down more than 5% in a year · shadow
        default rate above {SHADOW_DEFAULT_FLAG_PCT}% · PIK over 15% of NII with most of the PIK book severe. 0–1 = low,
        2–3 = elevated, 4+ = high. All but the shadow default sign are read straight off the filings. The shadow
        default sign uses the figure in the default-rate table above and counts only where that BDC&apos;s
        twelve-month window is fully observed ({nShadowCounted} of {gated.length}{" "}BDCs this quarter); elsewhere the
        column shows &quot;withheld&quot; and the sign is not counted. Hover a withheld cell for the reason.
      </div>
    </div>
  );
}
