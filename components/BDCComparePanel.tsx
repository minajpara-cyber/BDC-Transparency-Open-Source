"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
} from "recharts";

// Distinct colors for up to 6 overlaid BDCs. The industry benchmark sits
// outside this palette — it gets a neutral white so it reads as the baseline
// rather than as one more peer.
const SERIES_COLORS = [
  "#a5b4fc", "#fda4af", "#86efac", "#fde68a", "#67e8f9", "#d8b4fe",
];
const INDUSTRY_KEY = "industry";
const INDUSTRY_COLOR = "#e5e7eb";

// Color encodes WHO, dash pattern encodes WHAT. Patterns are assigned by
// position in the current selection, so a single-metric view is always solid.
const METRIC_DASHES = ["", "6 3", "2 3", "9 3 2 3", "1 4", "12 4"];

// A BDC x metric grid gets unreadable fast. Every extra line costs more than
// it adds past roughly a dozen, so the toggles hard-stop there.
const MAX_SERIES = 12;

export type CompareMetric =
  | "pct_non_accrual"
  | "pct_below_95"
  | "pct_below_90"
  | "pct_pik_total"
  | "pct_wl_elevated_plus"
  | "pct_wl_high";

type MetricFamily = "mark" | "na" | "pik" | "watchlist";

// Canonical order — drives both the toggle row and dash assignment.
const METRIC_ORDER: CompareMetric[] = [
  "pct_non_accrual",
  "pct_below_95",
  "pct_below_90",
  "pct_pik_total",
  "pct_wl_elevated_plus",
  "pct_wl_high",
];

const METRIC_META: Record<
  CompareMetric,
  { label: string; short: string; family: MetricFamily; group: "credit" | "watchlist" }
> = {
  pct_non_accrual: {
    label: "% non-accrual (at cost)", short: "Non-accrual",
    family: "na", group: "credit",
  },
  pct_below_95: {
    label: "% debt cost below 95¢ of par", short: "Below 95¢",
    family: "mark", group: "credit",
  },
  pct_below_90: {
    label: "% debt cost below 90¢ of par", short: "Below 90¢",
    family: "mark", group: "credit",
  },
  pct_pik_total: {
    label: "% PIK (at cost)", short: "PIK",
    family: "pik", group: "credit",
  },
  pct_wl_elevated_plus: {
    label: "% book on watchlist — Elevated or worse", short: "Watchlist: Elevated+",
    family: "watchlist", group: "watchlist",
  },
  pct_wl_high: {
    label: "% book on watchlist — High severity", short: "Watchlist: High",
    family: "watchlist", group: "watchlist",
  },
};

export interface CompareRow {
  ticker: string;
  period_end: string;
  pct_non_accrual: number;
  pct_below_95: number;
  pct_below_90: number;
  pct_pik_total: number;
  /** Watchlist tiers as a share of book fair value. Null where the BDC has no
   *  watchlist history for the quarter (pre-coverage or no book figure). */
  pct_wl_high: number | null;
  pct_wl_elevated_plus: number | null;
  /** Per-metric-family reliability — true means this row should appear when
   *  the user has selected a metric in that family. */
  rel_na: boolean;
  rel_mark: boolean;
  rel_pik: boolean;
  rel_watchlist: boolean;
}

interface Props {
  rows: CompareRow[];
  /** Tickers eligible for selection (ordered). May include the industry key. */
  tickers: string[];
  /** Initial selection. */
  initialSelection?: string[];
}

export default function BDCComparePanel({
  rows,
  tickers,
  initialSelection,
}: Props) {
  const [metrics, setMetrics] = useState<Set<CompareMetric>>(
    new Set<CompareMetric>(["pct_below_95"]),
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelection ?? ["ARCC", "BXSL", "FSK", "OBDC"]),
  );

  const bdcTickers = useMemo(
    () => tickers.filter((t) => t !== INDUSTRY_KEY),
    [tickers],
  );
  const hasIndustry = tickers.includes(INDUSTRY_KEY);

  // Selection order drives color assignment; industry is kept out of the
  // rotation so peers keep their color when the benchmark is toggled.
  const selectedBdcs = useMemo(
    () => bdcTickers.filter((t) => selected.has(t)),
    [bdcTickers, selected],
  );
  const industryOn = selected.has(INDUSTRY_KEY);
  const selectedMetrics = useMemo(
    () => METRIC_ORDER.filter((m) => metrics.has(m)),
    [metrics],
  );

  const colorOf = (ticker: string) =>
    ticker === INDUSTRY_KEY
      ? INDUSTRY_COLOR
      : SERIES_COLORS[selectedBdcs.indexOf(ticker) % SERIES_COLORS.length];

  const seriesTickers = useMemo(
    () => (industryOn ? [...selectedBdcs, INDUSTRY_KEY] : selectedBdcs),
    [selectedBdcs, industryOn],
  );
  const seriesCount = seriesTickers.length * selectedMetrics.length;

  // Merged dataset: one row per period_end, one column per (ticker, metric).
  const chartData = useMemo(() => {
    const byPeriod = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      if (!seriesTickers.includes(r.ticker)) continue;
      for (const m of selectedMetrics) {
        const relKey = ("rel_" + METRIC_META[m].family) as keyof CompareRow;
        if (!r[relKey]) continue;
        const v = r[m];
        if (v === null || v === undefined) continue;
        const slot = byPeriod.get(r.period_end) ?? { period_end: r.period_end };
        slot[`${r.ticker}|${m}`] = v as number;
        byPeriod.set(r.period_end, slot);
      }
    }
    return Array.from(byPeriod.values()).sort((a, b) =>
      String(a.period_end).localeCompare(String(b.period_end)),
    );
  }, [rows, seriesTickers, selectedMetrics]);

  // A toggle is blocked when switching it on would blow past MAX_SERIES, or
  // when it is the last one of its kind (an empty chart helps nobody).
  const wouldExceed = (nTickers: number, nMetrics: number) =>
    nTickers * nMetrics > MAX_SERIES;

  const toggleTicker = (t: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(t)) {
        if (next.size === 1) return prev;
        next.delete(t);
      } else {
        if (
          wouldExceed(seriesTickers.length + 1, selectedMetrics.length) ||
          (t !== INDUSTRY_KEY && selectedBdcs.length >= SERIES_COLORS.length)
        ) {
          return prev;
        }
        next.add(t);
      }
      return next;
    });
  };

  const toggleMetric = (m: CompareMetric) => {
    setMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(m)) {
        if (next.size === 1) return prev;
        next.delete(m);
      } else {
        if (wouldExceed(seriesTickers.length, selectedMetrics.length + 1)) return prev;
        next.add(m);
      }
      return next;
    });
  };

  const tickerBlocked = (t: string) =>
    !selected.has(t) &&
    (wouldExceed(seriesTickers.length + 1, selectedMetrics.length) ||
      (t !== INDUSTRY_KEY && selectedBdcs.length >= SERIES_COLORS.length));

  const metricBlocked = (m: CompareMetric) =>
    !metrics.has(m) && wouldExceed(seriesTickers.length, selectedMetrics.length + 1);

  const yLabel =
    selectedMetrics.length === 1
      ? METRIC_META[selectedMetrics[0]].label
      : "% of book";

  const metricButton = (m: CompareMetric) => {
    const isOn = metrics.has(m);
    const blocked = metricBlocked(m);
    const dashIdx = selectedMetrics.indexOf(m);
    return (
      <button
        key={m}
        onClick={() => toggleMetric(m)}
        disabled={blocked}
        title={blocked ? `Max ${MAX_SERIES} lines — deselect a BDC or metric first` : METRIC_META[m].label}
        className="text-xs px-2 py-1 rounded border transition-colors inline-flex items-center gap-1.5"
        style={{
          background: isOn ? "rgba(99,102,241,0.12)" : "transparent",
          borderColor: isOn ? "#6366f1" : "#2d2d50",
          color: isOn ? "#fafafa" : "#8b8ba8",
          opacity: blocked ? 0.4 : 1,
          cursor: blocked ? "not-allowed" : "pointer",
        }}
      >
        {isOn && dashIdx >= 0 && (
          <svg width="18" height="6" aria-hidden="true">
            <line
              x1="0" y1="3" x2="18" y2="3"
              stroke="#fafafa" strokeWidth="2"
              strokeDasharray={METRIC_DASHES[dashIdx % METRIC_DASHES.length] || undefined}
            />
          </svg>
        )}
        {METRIC_META[m].short}
      </button>
    );
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "#111118", borderColor: "#1e1e2e" }}>
      <div className="px-5 py-4 border-b" style={{ borderColor: "#1e1e2e" }}>
        <h3 className="font-semibold text-white text-sm">Compare BDCs</h3>
        <p className="text-xs mt-1" style={{ color: "#8b8ba8" }}>
          Overlay quarterly history for any mix of BDCs and metrics — color identifies the
          BDC, line style the metric, up to {MAX_SERIES} lines. Add <span className="text-white">Industry</span> as
          a benchmark. Caveat-flagged (BDC, metric) combos and sub-30-position stub quarters
          are excluded automatically.
        </p>
      </div>

      {/* Controls */}
      <div className="px-5 py-4 border-b space-y-3" style={{ borderColor: "#1e1e2e" }}>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8b8ba8" }}>
            Credit metrics:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {METRIC_ORDER.filter((m) => METRIC_META[m].group === "credit").map(metricButton)}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8b8ba8" }}>
            Watchlist severity{" "}
            <span className="normal-case font-normal" style={{ color: "#6b6b88" }}>
              · share of book FV in pre-non-accrual stress tiers
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {METRIC_ORDER.filter((m) => METRIC_META[m].group === "watchlist").map(metricButton)}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8b8ba8" }}>
            BDCs ({selectedBdcs.length} / {SERIES_COLORS.length}) ·{" "}
            <span style={{ color: seriesCount > MAX_SERIES - 1 ? "#f59e0b" : "#6b6b88" }}>
              {seriesCount} / {MAX_SERIES} lines
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 items-center">
            {bdcTickers.map((t) => {
              const isOn = selected.has(t);
              const blocked = tickerBlocked(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTicker(t)}
                  className="text-xs font-mono px-2 py-1 rounded border transition-colors"
                  style={{
                    background: isOn ? "rgba(99,102,241,0.12)" : "transparent",
                    borderColor: isOn ? colorOf(t) : "#2d2d50",
                    color: isOn ? "#fafafa" : "#8b8ba8",
                    opacity: blocked ? 0.4 : 1,
                    cursor: blocked ? "not-allowed" : "pointer",
                  }}
                  disabled={blocked}
                  title={blocked ? `Max ${SERIES_COLORS.length} BDCs / ${MAX_SERIES} lines` : ""}
                >
                  {t}
                </button>
              );
            })}
            {hasIndustry && (
              <>
                <span className="mx-1" style={{ color: "#2d2d50" }}>|</span>
                <button
                  onClick={() => toggleTicker(INDUSTRY_KEY)}
                  className="text-xs px-2 py-1 rounded border transition-colors"
                  style={{
                    background: industryOn ? "rgba(229,231,235,0.14)" : "transparent",
                    borderColor: industryOn ? INDUSTRY_COLOR : "#2d2d50",
                    color: industryOn ? "#fafafa" : "#8b8ba8",
                    opacity: tickerBlocked(INDUSTRY_KEY) ? 0.4 : 1,
                    cursor: tickerBlocked(INDUSTRY_KEY) ? "not-allowed" : "pointer",
                  }}
                  disabled={tickerBlocked(INDUSTRY_KEY)}
                  title="Position-weighted average across reporting BDCs"
                >
                  Industry
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div style={{ width: "100%", height: 360 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid stroke="#1e1e2e" strokeDasharray="3 3" />
              <XAxis
                dataKey="period_end"
                tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(0, 7)}
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "#8b8ba8", fontSize: 11 }}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                label={{
                  value: yLabel,
                  angle: -90,
                  position: "insideLeft",
                  fill: "#8b8ba8",
                  fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "#0f0f16",
                  border: "1px solid #1e1e2e",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "#d1d5db" }}
                itemSorter={(item) => -(Number(item.value) || 0)}
                formatter={(v, name) => {
                  if (v === undefined || v === null) return ["—", String(name)];
                  return [`${Number(v).toFixed(2)}%`, String(name)];
                }}
              />
              {seriesTickers.map((t) =>
                selectedMetrics.map((m, mi) => (
                  <Line
                    key={`${t}|${m}`}
                    type="monotone"
                    dataKey={`${t}|${m}`}
                    name={`${t === INDUSTRY_KEY ? "Industry" : t} · ${METRIC_META[m].short}`}
                    stroke={colorOf(t)}
                    strokeWidth={t === INDUSTRY_KEY ? 2.5 : 2}
                    strokeDasharray={METRIC_DASHES[mi % METRIC_DASHES.length] || undefined}
                    dot={false}
                    activeDot={{ r: 3 }}
                    connectNulls
                  />
                )),
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Two-axis key: color = BDC, dash = metric. Beats an N x M legend. */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 pt-3 border-t" style={{ borderColor: "#1e1e2e" }}>
          <div className="flex flex-wrap items-center gap-3">
            {seriesTickers.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "#d1d5db" }}>
                <span
                  className="inline-block rounded"
                  style={{ width: 14, height: 3, background: colorOf(t) }}
                />
                <span className={t === INDUSTRY_KEY ? "" : "font-mono"}>
                  {t === INDUSTRY_KEY ? "Industry" : t}
                </span>
              </span>
            ))}
          </div>
          {selectedMetrics.length > 1 && (
            <div className="flex flex-wrap items-center gap-3">
              {selectedMetrics.map((m, mi) => (
                <span key={m} className="inline-flex items-center gap-1.5 text-xs" style={{ color: "#8b8ba8" }}>
                  <svg width="20" height="6" aria-hidden="true">
                    <line
                      x1="0" y1="3" x2="20" y2="3"
                      stroke="#8b8ba8" strokeWidth="2"
                      strokeDasharray={METRIC_DASHES[mi % METRIC_DASHES.length] || undefined}
                    />
                  </svg>
                  {METRIC_META[m].short}
                </span>
              ))}
            </div>
          )}
        </div>

        {selectedMetrics.some((m) => METRIC_META[m].group === "watchlist") && (
          <p className="text-xs mt-3" style={{ color: "#6b6b88" }}>
            Watchlist tiers score positions that are <span className="text-white">not yet on non-accrual</span> for
            pre-default stress (mark level and trajectory, cash→PIK flips, par cuts). Shown as a share of
            book fair value, and cumulative — &quot;Elevated or worse&quot; includes High, so a loan
            deteriorating between tiers never reads as an improvement.
          </p>
        )}
      </div>
    </div>
  );
}
