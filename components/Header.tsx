"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/bdcs", label: "BDCs" },
  { href: "/companies", label: "Portfolio Companies" },
  { href: "/borrowers", label: "Borrowers" },
  { href: "/market", label: "Market Trends" },
  { href: "/non-accruals", label: "Non-Accruals" },
  { href: "/credit-lens", label: "Credit Lens" },
  { href: "/about", label: "About" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b" style={{ background: "rgba(10,10,15,0.96)", borderColor: "#1e1e2e", backdropFilter: "blur(12px)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: "#1e1e40", border: "1px solid #6366f1" }}>
              <TrendingUp size={16} className="text-indigo-400" />
            </div>
            <div>
              <div className="font-bold text-sm leading-none text-white">BDC Transparency</div>
              <div className="text-xs leading-none mt-0.5" style={{ color: "#8b8ba8" }}>Software Private Credit</div>
            </div>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    color: active ? "#a5b4fc" : "#9ca3af",
                    background: active ? "rgba(99,102,241,0.12)" : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right badges */}
          <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs" style={{ color: "#8b8ba8" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
              Live as of Q3 2025
            </div>
            <span className="px-2 py-1 rounded text-xs font-medium" style={{ background: "#1a1a28", color: "#a5b4fc", border: "1px solid #2d2d50" }}>
              Open Source
            </span>
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

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden border-t py-2" style={{ borderColor: "#1e1e2e" }}>
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-2.5 text-sm font-medium"
                  style={{ color: active ? "#a5b4fc" : "#9ca3af", background: active ? "rgba(99,102,241,0.08)" : "transparent" }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
