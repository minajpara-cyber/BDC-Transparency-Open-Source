import { redirect } from "next/navigation";

// "Portfolio Companies" merged into the Borrower universe (2026-06-10 site
// cleanup): two pages described the same universe — the legacy curated
// software list and the parsed 1,900-borrower index. /borrowers is the
// canonical page now; old links keep working via this redirect.
export default function CompaniesRedirect() {
  redirect("/borrowers");
}
