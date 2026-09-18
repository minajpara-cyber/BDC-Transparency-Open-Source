// Recover a position's par from the text of its own description.
//
// ARCC writes the par and the maturity inside the position description rather
// than in their own columns — "First lien senior secured loan ($70.1 par due
// 9/2018)" — and the pipeline leaves par_m at 0 for those rows. In
// stressed_positions that is 479 debt rows, every one of ARCC's zero-par debt
// rows, and the number is sitting in the string the row already carries. The
// same rows are the reason ARCC's mark coverage reads far below the other
// BDCs', which in turn is why ARCC's vintage cohorts are denominated
// differently from everyone else's.
//
// This reads the value at render time. It never writes to data/, so the next
// pipeline run stays the only thing that sets par and cannot collide with it.
//
// Currency is the reason this is narrower than it looks. TSLX's zero-par rows
// read "First-lien loan (AUD 46,092 par, due 12/2022)" — the par is there, but
// in Australian dollars and in thousands, so the pipeline is right to refuse
// it, and so are we. Only a plain dollar amount is taken.

/** Matches "$70.1 par" but not "AUD 46,092 par" or "EUR 12,000 par". */
const USD_PAR = /(?:^|[^A-Za-z])\$\s*([\d,]+(?:\.\d+)?)\s*par\b/i;

/**
 * Par in $M read out of a position description, or null when the description
 * carries none or carries one in a currency we cannot convert.
 */
export function parFromDescription(description: string | null | undefined): number | null {
  if (!description) return null;
  const m = USD_PAR.exec(description);
  if (!m) return null;
  const v = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/**
 * A position's par in $M: the exported value when it parsed, otherwise the one
 * printed in its description, otherwise null. Never returns 0 for "unknown".
 */
export function effectivePar(
  par_m: number | null | undefined,
  description: string | null | undefined,
): number | null {
  if (typeof par_m === "number" && par_m > 0) return par_m;
  return parFromDescription(description);
}

/** FV / par as a fraction, using a recovered par when the exported one is 0. */
export function effectiveMark(
  mark_at_par: number | null | undefined,
  fv_m: number | null | undefined,
  par_m: number | null | undefined,
  description: string | null | undefined,
): number | null {
  if (typeof mark_at_par === "number") return mark_at_par;
  const par = effectivePar(par_m, description);
  if (par === null || typeof fv_m !== "number") return null;
  const mark = fv_m / par;
  // A mark far above par means the two numbers are not in the same units — a
  // share count read as a par, or a figure in thousands. 41 of the 490
  // recoverable rows look like that. A very low mark is not rejected: on a
  // stressed position that is the finding.
  return mark > 1.5 ? null : mark;
}
