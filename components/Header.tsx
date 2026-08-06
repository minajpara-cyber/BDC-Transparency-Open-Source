"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import SiteSearch from "@/components/SiteSearch";
import { siteMeta } from "@/data/site_meta";

type NavLeaf = { href: string; label: string };
type NavNode = NavLeaf & { children?: NavLeaf[] };

// 13 flat items → 6 groups, organized by the question being asked.
// URLs are unchanged — only the menu is grouped.
const navItems: NavNode[] = [
  { href: "/", label: "Overview" },
  { href: "/bdcs", label: "BDCs" },
  {
    href: "/credit",
    label: "Credit",
    children: [
      { href: "/credit", label: "Credit quality" },
      { href: "/vintage", label: "Vintage" },
      { href: "/maturity", label: "Maturity" },
      { href: "/non-accruals", label: "Non-accruals" },
    ],
  },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/valuation", label: "Price/NAV" },
  {
    href: "/borrowers",
    label: "Borrowers",
    children: [
      { href: "/borrowers", label: "Borrower universe" },
      { href: "/sponsors", label: "Sponsors" },
      { href: "/market", label: "Market trends" },
    ],
  },
  {
    href: "/methodology",
    label: "About",
    children: [
      { href: "/methodology", label: "Methodology" },
      { href: "/about", label: "About the project" },
    ],
  },
];

const flatItems: NavLeaf[] = navItems.flatMap((n) => (n.children ? n.children : [n]));

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href));
  const groupActive = (n: NavNode) =>
    n.children ? n.children.some((c) => isActive(c.href)) : isActive(n.href);

  return (
    <header className="sticky top-0 z-50 border-b" style={{ background: "rgba(10,10,15,0.96)", borderColor: "#1e1e2e", backdropFilter: "blur(12px)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "#1e1e40", border: "1px solid #6366f1" }}>
              <TrendingUp size={16} className="text-indigo-400" />
            </div>
            <div>
              <div className="font-bold text-sm leading-none text-white">BDC Transparency</div>
              <div className="text-xs leading-none mt-0.5" style={{ color: "#8b8ba8" }}>Private credit, from the filings</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const active = groupActive(item);
              const baseStyle = {
                color: active ? "#a5b4fc" : "#9ca3af",
                background: active ? "rgba(99,102,241,0.12)" : "transparent",
              };
              if (!item.children) {
                return (
                  <Link key={item.label} href={item.href}
                    className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                    style={baseStyle}>
                    {item.label}
                  </Link>
                );
              }
              return (
                <div key={item.label} className="relative group">
                  <Link href={item.href}
                    className="px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-0.5"
                    style={baseStyle}>
                    {item.label}
                    <ChevronDown size={12} className="opacity-60" />
                  </Link>
                  <div className="absolute left-0 top-full pt-1 hidden group-hover:block group-focus-within:block">
                    <div className="rounded-lg border shadow-xl py-1 min-w-44"
                      style={{ background: "#15151f", borderColor: "#2d2d50" }}>
                      {item.children.map((c) => (
                        <Link key={c.href} href={c.href}
                          className="block px-3.5 py-2 text-sm hover:bg-indigo-500/10"
                          style={{ color: isActive(c.href) ? "#a5b4fc" : "#c3c3d5" }}>
                          {c.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Right: search + freshness */}
          <div className="hidden md:flex items-center gap-3">
            <SiteSearch />
            <div className="flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: "#8b8ba8" }}
              title={`Latest quarter ends ${siteMeta.latest_period} · data regenerated ${siteMeta.generated_at} · ${siteMeta.n_filings} filings parsed`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
              {siteMeta.latest_quarter}
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md"
            style={{ color: "#9ca3af" }}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Nav — flat list of every page */}
        {mobileOpen && (
          <div className="md:hidden border-t py-2" style={{ borderColor: "#1e1e2e" }}>
            {flatItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium"
                style={{ color: isActive(item.href) ? "#a5b4fc" : "#9ca3af", background: isActive(item.href) ? "rgba(99,102,241,0.08)" : "transparent" }}
              >
                {item.label}
              </Link>
            ))}
            <div className="px-4 py-2 text-xs" style={{ color: "#6b7280" }}>
              Data through {siteMeta.latest_quarter} · refreshed {siteMeta.generated_at}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
