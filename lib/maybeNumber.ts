// Read a money field that may or may not have been measured.
//
// The pipeline's exporters are being changed to write `null` where they used
// to write 0 for "we could not read this" — cost_m, fv_m and par_m in
// stressed_positions, non_accrual_events and early_warning. Until that export
// lands these fields are still typed `number`, and afterwards they are
// `number | null`, so everything here is written to accept both: the site has
// to compile against the data file as it is today AND as it will be the moment
// the pipeline next runs.
//
// The distinction the helpers preserve is the one the whole audit turns on. A
// value nobody measured is not a measurement of zero. It does not render as
// "$0.0", it does not colour a cell red, and it sorts to the bottom rather than
// pretending to be the smallest number in the table.

/** A money field from an export that may not have been able to read it. */
export type MaybeNumber = number | null | undefined;

/** The value when it was measured, otherwise null. */
export function measured(v: MaybeNumber): number | null {
  return typeof v === "number" ? v : null;
}

/**
 * The value for arithmetic, with an explicit stand-in when it is missing.
 * Callers must choose the stand-in deliberately: 0 is right for a sum (an
 * unread position contributes nothing to a total either way) and wrong for
 * anything a reader will compare, which is what `measured` is for.
 */
export function orElse(v: MaybeNumber, fallback: number): number {
  return typeof v === "number" ? v : fallback;
}

/**
 * A comparator that keeps unmeasured rows out of the way. Descending by
 * default, matching every table on the site that sorts by size; missing values
 * sort last in either direction rather than to whichever end means "smallest".
 */
export function byMeasured<T>(
  pick: (row: T) => MaybeNumber,
  dir: "desc" | "asc" = "desc",
): (a: T, b: T) => number {
  return (a, b) => {
    const x = measured(pick(a));
    const y = measured(pick(b));
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return dir === "desc" ? y - x : x - y;
  };
}

/** Fixed-decimal text, or an em dash when there is nothing to show. */
export function fmtMeasured(v: MaybeNumber, digits = 1, prefix = ""): string {
  return typeof v === "number" ? `${prefix}${v.toFixed(digits)}` : "—";
}

/** Sum of the values that were measured. Unmeasured rows are left out. */
export function sumMeasured<T>(rows: readonly T[], pick: (row: T) => MaybeNumber): number {
  let total = 0;
  for (const r of rows) {
    const v = measured(pick(r));
    if (v !== null) total += v;
  }
  return total;
}

/** How many rows in a set have no value for this field. */
export function countUnmeasured<T>(rows: readonly T[], pick: (row: T) => MaybeNumber): number {
  let n = 0;
  for (const r of rows) if (measured(pick(r)) === null) n += 1;
  return n;
}
