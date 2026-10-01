import { redirect } from "next/navigation";
import { portfolioCompanies } from "@/data/companies";
import { borrowers } from "@/data/borrowers_index";

// The 15 legacy /companies/<slug> pages showed hand-entered holders, marks and
// non-accrual statuses (data/companies.ts, typed in 2026-03) as if they came
// from the filings — Ivanti "on non-accrual at ARCC and FSK", which the latest
// 10-Qs contradict. Since 2026-10-01 every old link goes to the parsed
// borrower page for the same company (marks from scripts/marks.py, status from
// the filings), or to the borrower list when no BDC we parse holds it.

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return portfolioCompanies.map((c) => ({ slug: c.slug }));
}

/** The parsed borrower page for a legacy company slug, or null. */
function borrowerSlugFor(slug: string): string | null {
  const known = borrowers.map((b) => b.slug);
  if (known.includes(slug)) return slug;
  // "galway-insurance" -> "galway-insurance-holdings"; "hyland-software" -> "hyland"
  const longer = known.filter((s) => s.startsWith(`${slug}-`)).sort((a, b) => a.length - b.length);
  if (longer.length) return longer[0];
  const shorter = known.filter((s) => slug.startsWith(`${s}-`)).sort((a, b) => b.length - a.length);
  return shorter[0] ?? null;
}

export default async function LegacyCompanyRedirect({ params }: PageProps) {
  const { slug } = await params;
  const target = borrowerSlugFor(slug);
  redirect(target ? `/borrowers/${target}` : "/borrowers");
}
