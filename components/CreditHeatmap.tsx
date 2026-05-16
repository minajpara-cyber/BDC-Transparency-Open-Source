// Server component: a wide BDC×quarter heatmap rendered as an HTML table.
// Cells are colored by metric magnitude using a green→yellow→red scale.

interface Cell {
  value: number | null;  // null = missing (no filing that quarter)
  reliable?: boolean;     // if false, cell is muted/striped
}

interface Props {
  title: string;
  description?: string;
  // ordered list of period_end strings forming the column axis
  periods: string[];
  // ordered list of tickers forming the row axis
  tickers: string[];
  // value lookup: cellMap.get(`${ticker}|${period_end}`)
  cellMap: Map<string, Cell>;
  // color thresholds: [green, yellow, red]
  thresholds: [number, number, number];
  unit?: string; // e.g., "%"
}

function cellColor(v: number | null, t: [number, number, number]): string {
  if (v === null || v === undefined) return "transparent";
  const [g, y, r] = t;
  // Linear interpolation between green/yellow/red anchor points
  // Below g: gradient white→green-tint
  // Between g..y: green→yellow
  // Between y..r: yellow→red
  // Above r: saturated red
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  let red = 0,
    green = 0,
    blue = 0,
    alpha = 0;
  if (v <= g) {
    const t01 = clamp(v / Math.max(g, 0.0001));
    // light gray → green-tint
    red = 30 + (34 - 30) * t01;
    green = 30 + (197 - 30) * t01;
    blue = 40 + (94 - 40) * t01;
    alpha = 0.1 + 0.25 * t01;
  } else if (v <= y) {
    const t01 = clamp((v - g) / (y - g));
    red = 34 + (234 - 34) * t01;
    green = 197 + (179 - 197) * t01;
    blue = 94 + (8 - 94) * t01;
    alpha = 0.35 + 0.15 * t01;
  } else if (v <= r) {
    const t01 = clamp((v - y) / (r - y));
    red = 234 + (239 - 234) * t01;
    green = 179 + (68 - 179) * t01;
    blue = 8 + (68 - 8) * t01;
    alpha = 0.5 + 0.2 * t01;
  } else {
    red = 239;
    green = 68;
    blue = 68;
    alpha = 0.85;
  }
  return `rgba(${Math.round(red)},${Math.round(green)},${Math.round(blue)},${alpha.toFixed(2)})`;
}

export default function CreditHeatmap({
  title,
  description,
  periods,
  tickers,
  cellMap,
  thresholds,
  unit = "%",
}: Props) {
  return (
    <div
      className="rounded-xl border overflow-hidden"
      style={{ background: "#111118", borderColor: "#1e1e2e" }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
        <h3 className="font-semibold text-white text-sm">{title}</h3>
        {description && (
          <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
            {description}
          </p>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              <th
                className="px-3 py-2 text-left font-semibold sticky left-0 z-10"
                style={{
                  color: "#8b8ba8",
                  background: "#0f0f16",
                  borderBottom: "1px solid #1e1e2e",
                  borderRight: "1px solid #1e1e2e",
                  minWidth: 70,
                }}
              >
                BDC
              </th>
              {periods.map((p) => (
                <th
                  key={p}
                  className="px-2 py-2 font-mono whitespace-nowrap"
                  style={{
                    color: "#8b8ba8",
                    borderBottom: "1px solid #1e1e2e",
                    minWidth: 60,
                  }}
                >
                  {p.slice(2, 7)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tickers.map((ticker, ri) => (
              <tr key={ticker}>
                <td
                  className="px-3 py-2 font-mono font-semibold sticky left-0 z-10"
                  style={{
                    color: "#a5b4fc",
                    background: ri % 2 === 0 ? "#111118" : "#0f0f16",
                    borderRight: "1px solid #1e1e2e",
                  }}
                >
                  {ticker}
                </td>
                {periods.map((p) => {
                  const cell = cellMap.get(`${ticker}|${p}`);
                  const v = cell?.value ?? null;
                  const reliable = cell?.reliable ?? true;
                  return (
                    <td
                      key={p}
                      className="px-2 py-1.5 text-center font-mono"
                      style={{
                        background: cellColor(v, thresholds),
                        color: v === null ? "#3b3b55" : reliable ? "#fafafa" : "#9ca3af",
                        fontStyle: reliable ? "normal" : "italic",
                        opacity: reliable ? 1 : 0.55,
                      }}
                      title={
                        v === null
                          ? "no filing"
                          : `${ticker} · ${p}: ${v.toFixed(2)}${unit}${reliable ? "" : "  (partial coverage)"}`
                      }
                    >
                      {v === null ? "—" : v.toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-3 text-xs flex items-center gap-4 flex-wrap" style={{ color: "#6b6b88", borderTop: "1px solid #1e1e2e" }}>
        <span>Scale ({unit}):</span>
        {[0, thresholds[0], thresholds[1], thresholds[2]].map((bound, i, a) => {
          const next = a[i + 1];
          if (next === undefined) {
            return (
              <span key={i} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-4 h-3 rounded-sm"
                  style={{ background: cellColor(bound + 1, thresholds), border: "1px solid #1e1e2e" }}
                />
                ≥ {bound}
              </span>
            );
          }
          return (
            <span key={i} className="flex items-center gap-1.5">
              <span
                className="inline-block w-4 h-3 rounded-sm"
                style={{ background: cellColor((bound + next) / 2, thresholds), border: "1px solid #1e1e2e" }}
              />
              {bound}–{next}
            </span>
          );
        })}
      </div>
    </div>
  );
}
