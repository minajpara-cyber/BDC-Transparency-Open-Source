"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type Hit = { label: string; sub: string; href: string };

// Data files are loaded on first focus (dynamic import) so the search index
// never weighs down the initial bundle of every page.
let INDEX: Hit[] | null = null;
async function loadIndex(): Promise<Hit[]> {
  if (INDEX) return INDEX;
  const [{ borrowers }, { sponsors }, { bdcs }] = await Promise.all([
    import("@/data/borrowers_index"),
    import("@/data/sponsors_index"),
    import("@/data/bdcs"),
  ]);
  const idx: Hit[] = [];
  for (const b of bdcs) {
    idx.push({ label: `${b.ticker} — ${b.name}`, sub: "BDC", href: `/bdcs/${b.slug}` });
  }
  for (const s of sponsors) {
    idx.push({ label: s.sponsor, sub: "Sponsor", href: `/sponsors/${s.sponsor_slug}` });
  }
  for (const b of borrowers) {
    idx.push({
      label: b.name,
      sub: `Borrower · ${b.n_holders} holder${b.n_holders > 1 ? "s" : ""}`,
      href: `/borrowers#${b.slug}`,
    });
  }
  INDEX = idx;
  return idx;
}

export default function SiteSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (q.trim().length < 2) { setHits([]); return; }
    loadIndex().then((idx) => {
      if (cancelled) return;
      const needle = q.trim().toLowerCase();
      const starts: Hit[] = [];
      const contains: Hit[] = [];
      for (const h of idx) {
        const l = h.label.toLowerCase();
        if (l.startsWith(needle)) starts.push(h);
        else if (l.includes(needle)) contains.push(h);
        if (starts.length >= 8) break;
      }
      setHits([...starts, ...contains].slice(0, 8));
    });
    return () => { cancelled = true; };
  }, [q]);

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border"
        style={{ borderColor: "#2d2d50", background: "#12121c" }}>
        <Search size={13} style={{ color: "#6b7280" }} />
        <input
          value={q}
          onFocus={() => { setOpen(true); loadIndex(); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits.length) {
              router.push(hits[0].href); setOpen(false); setQ("");
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Borrower, sponsor, BDC…"
          className="bg-transparent outline-none text-sm w-40 lg:w-48 text-gray-200 placeholder:text-gray-600"
        />
      </div>
      {open && hits.length > 0 && (
        <div className="absolute right-0 mt-1.5 w-80 rounded-lg border shadow-xl z-50 overflow-hidden"
          style={{ background: "#15151f", borderColor: "#2d2d50" }}>
          {hits.map((h, i) => (
            <button
              key={i}
              onClick={() => { router.push(h.href); setOpen(false); setQ(""); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-500/10 flex items-center justify-between gap-2"
            >
              <span className="text-gray-200 truncate">{h.label}</span>
              <span className="text-xs whitespace-nowrap" style={{ color: "#6b7280" }}>{h.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
