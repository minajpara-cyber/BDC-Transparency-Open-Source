"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { stressedPositions, StressedPosition } from "@/data/stressed_positions";

type FlagKey = "f_na" | "f_below_95" | "f_below_90" | "f_below_80" | "f_pik";

interface Props {
  open: boolean;
  onClose: () => void;
  ticker: string | null;
  period_end: string | null;
  flagKey: FlagKey;
  metricLabel: string;
}

const COLS: { key: keyof StressedPosition | "_calc_mark"; label: string; align?: "left" | "right" }[] = [
  { key: "company", label: "Borrower", align: "left" },
  { key: "investment_type", label: "Type", align: "left" },
  { key: "industry", label: "Industry", align: "left" },
  { key: "cost_m", label: "Cost ($M)", align: "right" },
  { key: "fv_m", label: "FV ($M)", align: "right" },
  { key: "mark_at_par", label: "Mark", align: "right" },
  { key: "coupon", label: "Coupon", align: "left" },
  { key: "maturity_date", label: "Maturity", align: "left" },
];

export default function LoanDetailsModal({
  open, onClose, ticker, period_end, flagKey, metricLabel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !ticker || !period_end) return null;

  const rows = stressedPositions
    .filter((p) => p.ticker === ticker && p.period_end === period_end && p[flagKey] === 1)
    .sort((a, b) => b.cost_m - a.cost_m);

  const fmtNum = (n: number | null | undefined, d = 1) =>
    n === null || n === undefined ? "—" : n.toFixed(d);
  const fmtMark = (m: number | null) =>
    m === null ? "—" : `${(m * 100).toFixed(1)}¢`;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl border"
        style={{
          background: "#111118",
          borderColor: "#1e1e2e",
          maxWidth: 1100,
          width: "100%",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="px-5 py-4 border-b flex items-center justify-between"
          style={{ borderColor: "#1e1e2e" }}
        >
          <div>
            <h3 className="font-semibold text-white text-sm">
              {ticker} · {period_end} — {metricLabel}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "#8b8ba8" }}>
              {rows.length === 0
                ? "No flagged positions in our top-30-by-cost extract for this cell."
                : `Top ${rows.length} flagged position${rows.length === 1 ? "" : "s"} by amortized cost. Click outside or press Esc to close.`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: "#8b8ba8" }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-auto" style={{ flex: 1 }}>
          <table className="w-full text-xs">
            <thead
              style={{
                background: "#0f0f16",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              <tr>
                {COLS.map((c) => (
                  <th
                    key={c.key as string}
                    className="px-3 py-2 font-semibold whitespace-nowrap"
                    style={{
                      color: "#8b8ba8",
                      textAlign: c.align ?? "left",
                      borderBottom: "1px solid #1e1e2e",
                    }}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.company}-${r.investment_type}-${i}`}
                  style={{
                    background: i % 2 === 0 ? "#111118" : "#0f0f16",
                    borderBottom: "1px solid #1a1a28",
                  }}
                >
                  <td className="px-3 py-2" style={{ color: "#d1d5db", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.company}
                  </td>
                  <td className="px-3 py-2" style={{ color: "#9ca3af" }}>
                    {r.investment_type ?? "—"}
                  </td>
                  <td className="px-3 py-2" style={{ color: "#9ca3af" }}>
                    {r.industry ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-right" style={{ color: "#fafafa" }}>
                    {fmtNum(r.cost_m)}
                  </td>
                  <td className="px-3 py-2 font-mono text-right" style={{ color: "#fafafa" }}>
                    {fmtNum(r.fv_m)}
                  </td>
                  <td
                    className="px-3 py-2 font-mono text-right"
                    style={{
                      color:
                        r.mark_at_par === null
                          ? "#6b6b88"
                          : r.mark_at_par < 0.8
                          ? "#fca5a5"
                          : r.mark_at_par < 0.9
                          ? "#fdba74"
                          : r.mark_at_par < 0.95
                          ? "#fde68a"
                          : "#86efac",
                    }}
                  >
                    {fmtMark(r.mark_at_par)}
                  </td>
                  <td className="px-3 py-2" style={{ color: "#9ca3af", whiteSpace: "nowrap" }}>
                    {r.coupon ?? "—"}
                  </td>
                  <td className="px-3 py-2 font-mono" style={{ color: "#9ca3af", whiteSpace: "nowrap" }}>
                    {r.maturity_date ?? "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={COLS.length} className="px-3 py-8 text-center" style={{ color: "#6b6b88" }}>
                    No flagged loans found in our position-level extract for this cell.
                    <br />
                    <span className="text-[10px]">
                      Either no positions were flagged (NA / below 95¢ / PIK) at this quarter,
                      or the cell pre-dates our position-level extract window.
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
