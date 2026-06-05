"use client";

// Maturity wall: a bar per calendar-year bucket showing the dollars of debt
// coming due. Near-term buckets (this year + next) are warm-colored so the
// "wall" the BDC has to refinance soon reads at a glance. Used on /maturity
// (aggregate, all covered BDCs) and on each /bdcs/[slug] (single BDC).
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Cell,
} from "recharts";

export interface MaturityDatum {
  bucket: string;
  cost_m: number;
  fv_m: number;
  n_loans: number;
}

interface Props {
  data: MaturityDatum[];
  /** which dollar measure to plot */
  metric?: "cost_m" | "fv_m";
  /** the as-of calendar year — buckets at/just after this are the "near-term wall" */
  asOfYear?: number;
  height?: number;
}

// near-term (asOf & asOf+1) = amber/orange; the rest grade cool by distance.
function barColor(bucket: string, asOfYear: number): string {
  if (bucket === "<=2025") return "#6b7280"; // grey — already due / overdue
  if (bucket === "2033+") return "#3b82f6";
  const y = parseInt(bucket, 10);
  if (Number.isNaN(y)) return "#6366f1";
  const d = y - asOfYear;
  if (d <= 0) return "#ef4444"; // due this year
  if (d === 1) return "#f59e0b"; // next year
  if (d === 2) return "#eab308";
  if (d <= 4) return "#6366f1";
  return "#3b82f6";
}

function fmtDollarsM(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}B`;
  return `$${v.toFixed(0)}M`;
}

export default function MaturityWallChart({
  data,
  metric = "cost_m",
  asOfYear = 2026,
  height = 300,
}: Props) {
  return (
    <div style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 10, right: 16, left: 4, bottom: 6 }}>
          <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fill: "#8b8ba8", fontSize: 11 }}
            tickFormatter={(b: string) => (b === "<=2025" ? "≤25" : b === "2033+" ? "’33+" : `’${b.slice(2)}`)}
          />
          <YAxis
            tick={{ fill: "#8b8ba8", fontSize: 11 }}
            tickFormatter={(v: number) => fmtDollarsM(v)}
            width={52}
          />
          <Tooltip
            cursor={{ fill: "rgba(99,102,241,0.08)" }}
            contentStyle={{ background: "#0f0f16", border: "1px solid #1e1e2e", borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: "#d1d5db" }}
            labelFormatter={((b: string) => (b === "<=2025" ? "Due ≤ 2025" : b === "2033+" ? "2033 and later" : `Matures ${b}`)) as unknown as (label: unknown) => string}
            formatter={(value: unknown, _n: unknown, item: unknown) => {
              const v = Number(value);
              const n = (item as { payload?: MaturityDatum })?.payload?.n_loans ?? 0;
              return [`${fmtDollarsM(v)} · ${n} loan${n === 1 ? "" : "s"}`, metric === "fv_m" ? "Fair value" : "Amortized cost"];
            }}
          />
          <Bar dataKey={metric} radius={[3, 3, 0, 0]} maxBarSize={64}>
            {data.map((d) => (
              <Cell key={d.bucket} fill={barColor(d.bucket, asOfYear)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
