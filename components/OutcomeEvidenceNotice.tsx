import type { ReactNode } from "react";

/** Outcome products remain withheld until their event evidence is validated. */
export default function OutcomeEvidenceNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div data-validation-status="withheld" className="rounded-xl border p-5 text-sm leading-relaxed"
      style={{ background: "#111118", borderColor: "#2d2d45", color: "#9ca3af" }}>
      <h2 className="font-semibold text-white mb-2">{title}</h2>
      <div>{children}</div>
    </div>
  );
}
