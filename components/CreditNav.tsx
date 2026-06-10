"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/credit", label: "Credit quality" },
  { href: "/vintage", label: "Vintage" },
  { href: "/maturity", label: "Maturity" },
  { href: "/non-accruals", label: "Non-accruals" },
];

/** Tab strip shared by the four credit-section pages so they read as one hub. */
export default function CreditNav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 mb-5 border-b pb-0" style={{ borderColor: "#1e1e2e" }}>
      <span className="text-xs uppercase tracking-wide mr-2 pb-2" style={{ color: "#6b7280" }}>
        Credit
      </span>
      {tabs.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className="px-3 py-1.5 text-sm font-medium -mb-px border-b-2 transition-colors"
            style={{
              color: active ? "#a5b4fc" : "#9ca3af",
              borderColor: active ? "#6366f1" : "transparent",
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
