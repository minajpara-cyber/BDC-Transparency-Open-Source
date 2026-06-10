"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SortableTable, { Column } from "@/components/SortableTable";
import { holdings, holdingsAsOf, type Holding } from "@/data/bdc_holdings";

// Canonical capital-structure buckets, senior -> junior. A borrower aggregated
// across tranches can carry several (e.g. "1st Lien · Equity"), so the holding's
// `structure` string is a " · "-joined list of these tokens, and `slices` carries
// each bucket's own fair value / mark / maturity.
const STRUCTURE_TOKENS = ["1st Lien", "2nd Lien", "Unsecured/Sub", "Structured/JV", "Equity", "Other"];

// Split a compound structure string ("1st Lien · Equity") into its tokens.
const splitStructure = (s: string) =>
  s.split("·").map((t) => t.trim()).filter(Boolean);

// One table row, whether a consolidated borrower or a single structure slice of one.
interface DisplayRow {
  name: string;
  legal_name: string | null;
  sector: string | null;
  slug: string | null;
  structure: string;
  n_tranches: number;
  fv_m: number;
  pct_book: number;
  mark: number | null;
  maturity: string | null;
  na: number;
  pik: number;
  isSlice: boolean;
}

function markCents(m: number | null) {
  if (m === null) return <span style={{ color: "#52526a" }}>—</span>;
  const c = Math.round(m * 100);
  const color = m < 0.8 ? "#ef4444" : m < 0.9 ? "#f59e0b" : m < 0.97 ? "#eab308" : "#9ca3af";
  return <span style={{ color }}>{c}¢</span>;
}

export default function BDCHoldingsTable({ ticker }: { ticker: string }) {
  const [q, setQ] = useState("");
  // Multi-select set of structure tokens. Empty = no structure filter (show all,
  // consolidated by borrower). Non-empty = break borrowers into the selected slices.
  const [structures, setStructures] = useState<Set<string>>(new Set());
  const [flag, setFlag] = useState<"all" | "na" | "pik">("all");

  const all = useMemo(() => holdings.filter((h) => h.ticker === ticker), [ticker]);
  const sliceMode = structures.size > 0;

  // How many of THIS BDC's borrowers hold each structure token. Drives the
  // per-chip counts and disables empty buckets.
  const structureCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const h of all)
      for (const t of splitStructure(h.structure)) c[t] = (c[t] ?? 0) + 1;
    return c;
  }, [all]);

  const rows = useMemo<DisplayRow[]>(() => {
    const needle = q.trim().toLowerCase();
    const textOk = (h: Holding) =>
      !needle ||
      h.name.toLowerCase().includes(needle) ||
      (h.legal_name ?? "").toLowerCase().includes(needle) ||
      (h.sector ?? "").toLowerCase().includes(needle);

    const out: DisplayRow[] = [];
    for (const h of all) {
      if (!textOk(h)) continue;
      if (!sliceMode) {
        // Consolidated borrower row.
        if (flag === "na" && !h.na) continue;
        if (flag === "pik" && !h.pik) continue;
        out.push({
          name: h.name, legal_name: h.legal_name, sector: h.sector, slug: h.slug,
          structure: h.structure, n_tranches: h.n_tranches, fv_m: h.fv_m, pct_book: h.pct_book,
          mark: h.mark, maturity: h.maturity, na: h.na, pik: h.pik, isSlice: false,
        });
      } else {
        // One row per selected structure slice of this borrower.
        for (const s of h.slices) {
          if (!structures.has(s.structure)) continue;
          if (flag === "na" && !s.na) continue;
          if (flag === "pik" && !s.pik) continue;
          out.push({
            name: h.name, legal_name: h.legal_name, sector: h.sector, slug: h.slug,
            structure: s.structure, n_tranches: s.n_tranches, fv_m: s.fv_m, pct_book: s.pct_book,
            mark: s.mark, maturity: s.maturity, na: s.na, pik: s.pik, isSlice: true,
          });
        }
      }
    }
    return out;
  }, [all, q, structures, sliceMode, flag]);

  const shownFV = rows.reduce((s, h) => s + h.fv_m, 0);
  if (all.length === 0) return null;

  const toggleStructure = (t: string) =>
    setStructures((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

  const columns: Column<DisplayRow>[] = [
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
            {h.legal_name ? `${h.legal_name} · ` : ""}{h.n_tranches} tranche{h.n_tranches > 1 ? "s" : ""}{h.isSlice ? " in slice" : ""}
          </div>
        </div>
      ),
    },
    { key: "sector", label: "Sector", sortable: true, render: (h) => <span style={{ color: "#9ca3af" }}>{h.sector ?? "—"}</span> },
    { key: "structure", label: "Structure", sortable: true, render: (h) => <span className="text-xs" style={{ color: h.isSlice ? "#a5b4fc" : "#9ca3af" }}>{h.structure || "—"}</span> },
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
          <span className="text-white font-semibold">{rows.length}</span> {sliceMode ? "slice" : "borrower"}{rows.length === 1 ? "" : "s"} shown · ${(shownFV / 1000).toFixed(2)}B
        </div>
      </div>

      {/* Structure type — multi-select. Pick one or several buckets to combine. */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-xs uppercase tracking-wider mr-0.5" style={{ color: "#6b6b88" }}>Structure</span>
        {STRUCTURE_TOKENS.map((t) => {
          const active = structures.has(t);
          const count = structureCounts[t] ?? 0;
          const disabled = count === 0;
          return (
            <button
              key={t}
              onClick={() => !disabled && toggleStructure(t)}
              disabled={disabled}
              className="px-2.5 py-1.5 text-xs rounded-lg transition-colors"
              style={{
                background: active ? "#6366f1" : "#0d0d14",
                border: `1px solid ${active ? "#6366f1" : "#2d2d50"}`,
                color: active ? "#fff" : disabled ? "#52526a" : "#9ca3af",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.45 : 1,
              }}
              title={disabled ? `No ${t} positions in ${ticker}'s top exposures` : `${count} borrower${count === 1 ? "" : "s"} with ${t}`}
            >
              {t} <span style={{ opacity: 0.65 }}>{count}</span>
            </button>
          );
        })}
        {structures.size > 0 && (
          <button
            onClick={() => setStructures(new Set())}
            className="px-2.5 py-1.5 text-xs rounded-lg transition-colors"
            style={{ background: "#0d0d14", border: "1px solid #2d2d50", color: "#8b8ba8" }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Search + flag filters — combine freely with the structure picks above. */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search borrower or sector…"
          className="px-3 py-1.5 text-sm w-64" style={inputStyle}
        />
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

      {/* In slice mode, make clear each row is one position class, not the borrower total. */}
      {sliceMode && (
        <p className="text-xs mb-3" style={{ color: "#8b8ba8" }}>
          Each row is one capital-structure slice of a borrower — its own fair value, % of book, mark
          and maturity, <span className="text-white">not the borrower&apos;s blended total</span>.
          Equity and structured/JV slices have no mark or maturity (no par), so those show &ldquo;—&rdquo;.
        </p>
      )}

      <SortableTable<DisplayRow>
        data={rows}
        columns={columns}
        rowKey={(h) => `${h.name}|${h.structure}|${h.fv_m}`}
        initialSort={{ key: "fv_m", dir: "desc" }}
        stickyHeader
        dense
        emptyMessage="No positions match the filters."
      />
    </div>
  );
}
