"use client";

// Predicted loss content by quartile, across the whole BDC universe, over time.
// Quartiles are cut WITHIN each quarter, so a line answers "what did the best /
// worst quarter of the universe look like then" — not "what happened to a fixed
// set of BDCs". Membership changes as BDCs move between buckets; that is the
// point, since the interesting question is how the DISTRIBUTION has shifted.
import { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis,
  Tooltip, Legend, Line, ReferenceLine, ReferenceArea,
} from "recharts";
import { naQuartileSeries } from "@/data/na_forecast";
import CsvDownloadButton from "./CsvDownloadButton";

const Q_META = [
  { q: 1, label: "Q1 — lowest predicted", color: "#22c55e" },
  { q: 2, label: "Q2", color: "#eab308" },
  { q: 3, label: "Q3", color: "#f97316" },
  { q: 4, label: "Q4 — highest predicted", color: "#ef4444" },
];

export default function NaQuartileTrend() {
  const [showActual, setShowActual] = useState(false);

  const { data, firstUnrealised, latest, first } = useMemo(() => {
    const byPeriod = new Map<string, Record<string, number | string | null>>();
    for (const r of naQuartileSeries) {
      const row = byPeriod.get(r.period_end) ?? { period_end: r.period_end };
      row[`q${r.q}`] = r.pred;
      row[`a${r.q}`] = r.actual;
      byPeriod.set(r.period_end, row);
    }
    const data = Array.from(byPeriod.values()).sort((a, b) =>
      String(a.period_end).localeCompare(String(b.period_end)));
    // Where outcomes stop being known — the last four quarters are forecast-only.
    const firstUnrealised = data.find((d) => d.a4 === null || d.a4 === undefined)?.period_end as
      | string | undefined;
    return {
      data,
      firstUnrealised,
      latest: data[data.length - 1],
      first: data[0],
    };
  }, []);

  const spread = (row: Record<string, number | string | null> | undefined) =>
    row && typeof row.q4 === "number" && typeof row.q1 === "number" && row.q1 > 0
      ? (row.q4 / row.q1).toFixed(1) : null;

  const csvColumns = ["period_end", "quartile", "predicted_formation_pct", "realised_formation_pct", "n_bdcs"];
  const csvRows = naQuartileSeries.map((r) => [
    r.period_end, `Q${r.q}`, r.pred.toFixed(2), r.actual == null ? "" : r.actual.toFixed(2), r.n,
  ]);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Predicted loss content by quartile, over time
            </h2>
            <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>
              Every quarter, all covered BDCs are sorted by predicted new non-accrual formation over
              the following year and split into quartiles; each line is the average for that bucket.
              Universe-wide, not per BDC — and quartiles are re-cut{" "}
              <span className="text-white">within each quarter</span>, so a line tracks the shape of
              the distribution rather than a fixed group of names.
            </p>
          </div>
          <CsvDownloadButton filename="na-quartile-trend" columns={csvColumns} rows={csvRows} />
        </div>
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <button
            onClick={() => setShowActual(!showActual)}
            className="text-xs px-2.5 py-1 rounded border transition-all"
            style={{
              background: showActual ? "rgba(99,102,241,0.15)" : "transparent",
              borderColor: showActual ? "#6366f1" : "#2d2d45",
              color: showActual ? "#a5b4fc" : "#9ca3af",
            }}
          >
            {showActual ? "Hide" : "Show"} what actually happened
          </button>
          {spread(first) && spread(latest) && (
            <span className="text-xs" style={{ color: "#8b8ba8" }}>
              Q4 / Q1 spread:{" "}
              <span className="text-white">{spread(first)}×</span> in {String(first.period_end).slice(0, 7)}
              {" → "}
              <span className="text-white">{spread(latest)}×</span> in {String(latest.period_end).slice(0, 7)}
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
                  dot={false}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
          Predictions are <span className="text-white">walk-forward</span> — each quarter&apos;s figure
          uses only data available at the time, so this is what the model would have said then, not a
          fit to known outcomes. The shaded band on the right is where the four-quarter outcome has
          not elapsed yet; toggle{" "}
          <span className="text-white">what actually happened</span> to overlay realised formation for
          the quarters that have resolved. Two things worth reading off it: every quartile has drifted
          up since 2022, and the <span className="text-white">gap has been closing</span> lately —
          the best quartile is deteriorating faster than the worst, which is stress broadening across
          the universe rather than concentrating in the usual names.
        </p>
      </div>
    </div>
  );
}
