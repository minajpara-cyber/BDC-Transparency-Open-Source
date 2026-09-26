"use client";

// Predicted new non-accruals by quartile, across the whole BDC universe, over
// time. Quartiles are cut WITHIN each quarter, so a line answers "what did the
// best / worst quarter of the universe look like then" — not "what happened to a
// fixed set of BDCs". Membership changes as BDCs move between buckets; the point
// is how the DISTRIBUTION has shifted.
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Line, ReferenceLine, ReferenceArea,
} from "recharts";
import { naQuartileSeries } from "@/data/na_forecast";
import CsvDownloadButton from "./CsvDownloadButton";

/** Fewer quarters than this is not a trend yet. */
export const MIN_TREND_QUARTERS = 4;

const Q_META = [
  { q: 1, label: "Q1 — lowest predicted", color: "#22c55e" },
  { q: 2, label: "Q2", color: "#eab308" },
  { q: 3, label: "Q3", color: "#f97316" },
  { q: 4, label: "Q4 — highest predicted", color: "#ef4444" },
];

type TrendRow = Record<string, number | string | null>;

const avgPred = (row: TrendRow | undefined) => {
  if (!row) return null;
  const values = Q_META.map((m) => row[`q${m.q}`]).filter((v): v is number => typeof v === "number");
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null;
};

const spread = (row: TrendRow | undefined) =>
  row && typeof row.q4 === "number" && typeof row.q1 === "number" && row.q1 > 0
    ? row.q4 / row.q1 : null;

export default function NaQuartileTrend() {
  const [showActual, setShowActual] = useState(false);

  const { data, firstUnrealised, lastRealised, nRealised, latest, first } = useMemo(() => {
    const byPeriod = new Map<string, TrendRow>();
    for (const r of naQuartileSeries) {
      const row = byPeriod.get(r.period_end) ?? { period_end: r.period_end };
      row[`q${r.q}`] = r.pred;
      row[`a${r.q}`] = r.actual;
      byPeriod.set(r.period_end, row);
    }
    const data = Array.from(byPeriod.values()).sort((a, b) =>
      String(a.period_end).localeCompare(String(b.period_end)));
    const hasActual = (d: TrendRow) => Q_META.some((m) => typeof d[`a${m.q}`] === "number");
    const realisedIdx = data.map(hasActual).lastIndexOf(true);
    return {
      data,
      // Outcomes are known up to the last quarter with any realised value;
      // everything after it is forecast-only.
      lastRealised: realisedIdx >= 0 ? String(data[realisedIdx].period_end) : undefined,
      firstUnrealised: realisedIdx + 1 < data.length ? String(data[realisedIdx + 1].period_end) : undefined,
      nRealised: data.filter(hasActual).length,
      latest: data[data.length - 1],
      first: data[0],
    };
  }, []);

  if (data.length < MIN_TREND_QUARTERS) {
    return (
      <div className="rounded-xl border px-4 py-3" style={{ background: "#111118", borderColor: "#1e1e2e" }}
        data-trend-status="too-short">
        <h2 className="text-lg font-semibold text-white">Predicted new non-accruals by quartile, over time</h2>
        <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>
          Forecast history is too short to chart yet: {data.length === 0 ? "no quarters" : `${data.length} quarter${data.length === 1 ? "" : "s"}`}{" "}
          so far, and a trend needs at least {MIN_TREND_QUARTERS}. The chart will appear here as more
          back-tested quarters are added.
        </p>
      </div>
    );
  }

  const csvColumns = ["period_end", "quartile", "predicted_formation_pct", "realised_formation_pct", "n_bdcs"];
  const csvRows = naQuartileSeries.map((r) => [
    r.period_end, `Q${r.q}`, r.pred.toFixed(2), r.actual == null ? "" : r.actual.toFixed(2), r.n,
  ]);
  const firstAvg = avgPred(first);
  const latestAvg = avgPred(latest);
  const firstSpread = spread(first);
  const latestSpread = spread(latest);
  const label = (row: TrendRow | undefined) => String(row?.period_end ?? "").slice(0, 7);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}
      data-trend-status="shown">
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Predicted new non-accruals by quartile, over time
            </h2>
            <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>
              Each quarter, the BDCs with a projection are sorted by expected new non-accruals over the
              following year and split into four equal groups; each line is one group&apos;s average.
              This is universe-wide, not per BDC, and the groups are re-cut{" "}
              <span className="text-white">every quarter</span>, so a line tracks the shape of the
              distribution rather than a fixed set of names.
            </p>
          </div>
          <CsvDownloadButton filename="na-quartile-trend" columns={csvColumns} rows={csvRows} />
        </div>
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {nRealised > 0 && (
            <button
              onClick={() => setShowActual(!showActual)}
              className="text-xs px-2.5 py-1 rounded border transition-all"
              style={{
                background: showActual ? "rgba(99,102,241,0.15)" : "transparent",
                borderColor: showActual ? "#6366f1" : "#2d2d45",
                color: showActual ? "#a5b4fc" : "#9ca3af",
              }}
            >
              {showActual ? "Hide" : "Show"}{" "}what actually happened
            </button>
          )}
          {firstSpread != null && latestSpread != null && (
            <span className="text-xs" style={{ color: "#8b8ba8" }}>
              Highest ÷ lowest group:{" "}
              <span className="text-white">{firstSpread.toFixed(1)}×</span> in {label(first)}
              {" → "}
              <span className="text-white">{latestSpread.toFixed(1)}×</span> in {label(latest)}
            </span>
          )}
        </div>
      </div>

      <div className="p-4">
        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
              {firstUnrealised && (
                <ReferenceArea
                  x1={firstUnrealised}
                  x2={String(latest?.period_end ?? firstUnrealised)}
                  fill="#6366f1" fillOpacity={0.05}
                />
              )}
              {firstUnrealised && (
                <ReferenceLine
                  x={firstUnrealised}
                  stroke="#6366f1" strokeDasharray="4 4"
                  label={{ value: "outcome not yet known", position: "insideTopRight",
                           fill: "#6b6b88", fontSize: 10 }}
                />
              )}
              <XAxis
                dataKey="period_end"
                tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(0, 7)}
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                label={{ value: "Expected new NA over next 4Q (% of cost)", angle: -90,
                         position: "insideLeft", fill: "#8b8ba8", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{ background: "#0f0f16", border: "1px solid #1e1e2e",
                                borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#d1d5db" }}
                formatter={(v, name) =>
                  v == null ? ["—", String(name)] : [`${Number(v).toFixed(2)}%`, String(name)]}
              />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8b8ba8" }} />
              {Q_META.map((m) => (
                <Line
                  key={m.q}
                  type="monotone"
                  dataKey={`q${m.q}`}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  connectNulls
                />
              ))}
              {showActual && Q_META.map((m) => (
                <Line
                  key={`a${m.q}`}
                  type="monotone"
                  dataKey={`a${m.q}`}
                  name={`Q${m.q} actual`}
                  stroke={m.color}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={{ r: 2 }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
          Each quarter&apos;s figures use only information available at the time — the model is re-fitted
          on loans whose outcomes were already known — so this is what it would have said then, not a
          fit to what later happened.{" "}
          {nRealised > 0
            ? `Outcomes are known for ${nRealised} of the ${data.length} quarters shown (through ${String(lastRealised).slice(0, 7)}); the shaded area is where the four-quarter outcome has not arrived yet. Where only some BDCs in a group have a known outcome, that group's actual is left blank.`
            : `None of the ${data.length} quarters shown has a known four-quarter outcome yet.`}
          {firstAvg != null && latestAvg != null &&
            ` Across all four groups, the average projection moved from ${firstAvg.toFixed(2)}% in ${label(first)} to ${latestAvg.toFixed(2)}% in ${label(latest)}.`}
          {firstSpread != null && latestSpread != null &&
            (latestSpread < firstSpread
              ? " The gap between the highest and lowest groups has narrowed: expected stress is spreading more evenly across BDCs."
              : latestSpread > firstSpread
                ? " The gap between the highest and lowest groups has widened: the riskiest BDCs are pulling away from the rest."
                : "")}
        </p>
      </div>
    </div>
  );
}
