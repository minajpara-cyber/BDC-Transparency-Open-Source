// "PIK net of recapture": PIK income less the PIK that came back as cash in
// the same four quarters (data/income_coverage.ts, scripts/91). How the
// recapture is known decides how the value is shown:
//   reported   — the BDC discloses PIK collected in cash (e.g. ARCC, ASIF):
//                shown as is.
//   net_basis  — the BDC prints PIK already net of collections: shown as is.
//   estimated  — PIK on loans that left the book or were refinanced at par in
//                the same four quarters: shown, but marked "estimate". An
//                estimate larger than the PIK booked in those quarters is not
//                credible and is not shown, and neither is one whose loan data
//                misses a quarter of the window (a gap is unknown, not $0).

export interface RecaptureFields {
  pik_m: number | null;
  pik_recaptured_m?: number | null;
  pik_recaptured_est_m?: number | null;
  recapture_src?: string | null;
  recapture_pct?: number | null;
  net_pik_pct_nii?: number | null;
  cov_ex_net_pik?: number | null;
  /** Optional explicit flag from newer exports; true marks the recapture as an estimate. */
  estimate?: boolean | null;
  /** Why an estimate is not shown (scripts/91). */
  recapture_suppressed?: string | null;
}

export interface RecaptureDisplay {
  /** null when there is nothing credible to show. */
  netPikPctNii: number | null;
  covExNetPik: number | null;
  recapturePct: number | null;
  estimate: boolean;
  /** Plain-English note for tooltips; "" when nothing needs saying. */
  note: string;
}

const EMPTY: RecaptureDisplay = { netPikPctNii: null, covExNetPik: null, recapturePct: null, estimate: false, note: "" };

export function recaptureDisplay(r: RecaptureFields): RecaptureDisplay {
  const src = r.estimate === true && r.recapture_src !== "net_basis" ? "estimated" : (r.recapture_src ?? null);
  if (src === "reported") {
    return { netPikPctNii: r.net_pik_pct_nii ?? null, covExNetPik: r.cov_ex_net_pik ?? null,
      recapturePct: r.recapture_pct ?? null, estimate: false, note: "PIK collected in cash as reported by the BDC" };
  }
  if (src === "net_basis") {
    return { netPikPctNii: r.net_pik_pct_nii ?? null, covExNetPik: r.cov_ex_net_pik ?? null,
      recapturePct: null, estimate: false, note: "this BDC prints PIK already net of cash collected" };
  }
  if (src === "estimated") {
    if (r.recapture_suppressed === "ledger_quarter_missing") {
      return { ...EMPTY, note: "loan data is missing for part of this four-quarter window, so no estimate is shown" };
    }
    const recaptured = r.pik_recaptured_m ?? r.pik_recaptured_est_m ?? null;
    const net = r.net_pik_pct_nii ?? null;
    if (recaptured == null || r.pik_m == null || net == null) return { ...EMPTY, note: "no recapture estimate for this quarter" };
    if (recaptured > r.pik_m || net < 0) {
      return { ...EMPTY, note: `estimated recapture ($${recaptured.toFixed(0)}m) is more than the PIK booked ($${r.pik_m.toFixed(0)}m), so no estimate is shown` };
    }
    return { netPikPctNii: net, covExNetPik: r.cov_ex_net_pik ?? null, recapturePct: r.recapture_pct ?? null,
      estimate: true, note: "estimated from loans that left the book or were refinanced at par" };
  }
  return { ...EMPTY, note: "no recapture measure for this quarter" };
}
