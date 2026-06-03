"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SortableTable, { Column } from "@/components/SortableTable";
import { holdings, holdingsAsOf, type Holding } from "@/data/bdc_holdings";

const STRUCTURE_FILTERS = ["All", "1st Lien", "2nd Lien", "Unsecured/Sub", "Equity", "Structured/JV"];

function markCents(m: number | null) {
  if (m === null) return <span style={{ color: "#52526a" }}>—</span>;
  const c = Math.round(m * 100);
  const color = m < 0.8 ? "#ef4444" : m < 0.9 ? "#f59e0b" : m < 0.97 ? "#eab308" : "#9ca3af";
  return <span style={{ color }}>{c}¢</span>;
}

export default function BDCHoldingsTable({ ticker }: { ticker: string }) {
  const [q, setQ] = useState("");
  const [structure, setStructure] = useState("All");
  const [flag, setFlag] = useState<"all" | "na" | "pik">("all");

  const all = useMemo(() => holdings.filter((h) => h.ticker === ticker), [ticker]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((h) => {
      if (structure !== "All" && !h.structure.includes(structure)) return false;
      if (flag === "na" && !h.na) return false;
      if (flag === "pik" && !h.pik) return false;
      if (needle &&
          !h.name.toLowerCase().includes(needle) &&
          !(h.legal_name ?? "").toLowerCase().includes(needle) &&
          !(h.sector ?? "").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [all, q, structure, flag]);

  const shownFV = rows.reduce((s, h) => s + h.fv_m, 0);
  if (all.length === 0) return null;

  const columns: Column<Holding>[] = [
    {
      key: "name", label: "Borrower", sortable: true,
      render: (h) => (
        <div>
          <div className="flex items-center gap-1.5">
            {h.slug
              ? <Link href={`/borrowers/${h.slug}`} className="text-indigo-300 hover:text-indigo-200">{h.name}</Link>
              : <span className="text-white">{h.name}</span>}
            {h.na ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#ef444422", color: "#fca5a5", border: "1px solid #ef444455" }}>NA</span> : null}
            {h.pik ? <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: "#f59e0b22", color: "#fcd34d", border: "1px solid #f59e0b55" }}>PIK</span> : null}
          </div>
          <div className="text-xs" style={{ color: "#52526a" }}>
            {h.legal_name ? `${h.legal_name} · ` : ""}{h.n_tranches} tranche{h.n_tranches > 1 ? "s" : ""}
          </div>
        </div>
      ),
    },
    { key: "sector", label: "Sector", sortable: true, render: (h) => <span style={{ color: "#9ca3af" }}>{h.sector ?? "—"}</span> },
    { key: "structure", label: "Structure", sortable: true, render: (h) => <span className="text-xs" style={{ color: "#9ca3af" }}>{h.structure || "—"}</span> },
    { key: "fv_m", label: "Exposure", sortable: true, align: "right", render: (h) => <span className="text-white tabular-nums">${h.fv_m.toLocaleString(undefined, { maximumFractionDigits: 0 })}M</span> },
    { key: "pct_book", label: "% book", sortable: true, align: "right", render: (h) => <span className="tabular-nums" style={{ color: "#9ca3af" }}>{h.pct_book.toFixed(1)}%</span> },
    { key: "mark", label: "Blended mark", sortable: true, align: "right", render: (h) => <span className="tabular-nums">{markCents(h.mark)}</span> },
    { key: "maturity", label: "Nearest mat.", sortable: true, align: "right", render: (h) => <span className="text-xs tabular-nums" style={{ color: "#8b8ba8" }}>{h.maturity ?? "—"}</span> },
  ];

  const inputStyle = { background: "#0d0d14", border: "1px solid #2d2d50", borderRadius: 8, color: "#e5e7eb" };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Top exposures</h2>
          <p className="text-xs" style={{ color: "#8b8ba8" }}>
            {ticker}&apos;s largest credits from parsed SOI, aggregated by borrower across tranches · top {all.length} by total fair value · as of {holdingsAsOf}
          </p>
        </div>
        <div className="text-xs" style={{ color: "#8b8ba8" }}>
          <span className="text-white font-semibold">{rows.length}</span> shown · ${(shownFV / 1000).toFixed(2)}B
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search borrower or sector…"
          className="px-3 py-1.5 text-sm w-64" style={inputStyle}
        />
        <select value={structure} onChange={(e) => setStructure(e.target.value)} className="px-3 py-1.5 text-sm" style={inputStyle}>
          {STRUCTURE_FILTERS.map((a) => <option key={a} value={a}>{a === "All" ? "Any structure" : `Has ${a}`}</option>)}
        </select>
        {([["all", "All"], ["na", "Non-accrual"], ["pik", "PIK"]] as const).map(([v, lbl]) => (
          <button
            key={v} onClick={() => setFlag(v)}
            className="px-3 py-1.5 text-sm rounded-lg transition-colors"
            style={{
              background: flag === v ? "#6366f1" : "#0d0d14",
              border: `1px solid ${flag === v ? "#6366f1" : "#2d2d50"}`,
              color: flag === v ? "#fff" : "#9ca3af",
            }}
          >{lbl}</button>
        ))}
      </div>

      <SortableTable<Holding>
        data={rows}
        columns={columns}
        rowKey={(h) => `${h.name}|${h.structure}|${h.fv_m}`}
        initialSort={{ key: "fv_m", dir: "desc" }}
        stickyHeader
        dense
        emptyMessage="No borrowers match the filters."
      />
    </div>
  );
}
