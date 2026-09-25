"use client";

import Link from "next/link";
import { bdcsHistory } from "@/data/bdcs_history";
import { naFcMeta, naForecast, type NaForecastRow } from "@/data/na_forecast";
import { latestNonAccrualSnapshots } from "@/lib/latestNonAccruals";
import CsvDownloadButton from "./CsvDownloadButton";

const snapshotsByTicker = new Map(
  latestNonAccrualSnapshots(bdcsHistory).map((row) => [row.ticker, row]),
);
const rows = [...naForecast].sort((a, b) => a.ticker.localeCompare(b.ticker));
const coverageFloor =
  naFcMeta.formation.observability.publication_min_feature_coverage_pct;

function projectionIsPublished(row: NaForecastRow): boolean {
  return row.form_observation_status === "complete" ||
    row.form_observation_status === "imputed_with_indicators";
}

function snapshotBasisLabel(status: string | undefined, basis: string | undefined): string | null {
  if (status === "disclosed_aggregate") {
    return basis === "issuer_reported_investments_excluding_cash"
      ? "Issuer disclosure · excludes cash"
      : "Issuer aggregate disclosure";
  }
  if (status === "withheld_reconciliation") return "Reconciliation pending";
  return null;
}

function projectionStatusLabel(row: NaForecastRow): string {
  if (row.form_observation_status === "complete") return "Published · complete inputs";
  if (row.form_observation_status === "imputed_with_indicators") {
    return "Published · partial inputs";
  }
  if (row.form_observation_status === "withheld_feature_coverage") {
    return `Below ${coverageFloor.toFixed(2)}% floor`;
  }
  return "Unavailable";
}

export default function NaForecastTable() {
  const publishedCount = rows.filter(projectionIsPublished).length;
  const withheldCount = rows.filter(
    (row) => row.form_observation_status === "withheld_feature_coverage",
  ).length;
  const unavailableCount = rows.length - publishedCount - withheldCount;

  const csvColumns = [
    "ticker",
    "reporting_date",
    "na_at_cost_pct",
    "current_na_publication_status",
    "current_na_basis",
    "current_na_publication_reason",
    "base_quarter",
    "expected_new_na_4q_pct",
    "band_lo_pct",
    "band_hi_pct",
    "form_feature_coverage_pct",
    "form_observation_status",
    "projection_publication",
  ];
  const csvRows = rows.map((row) => {
    const snapshot = snapshotsByTicker.get(row.ticker);
    const published = projectionIsPublished(row);
    return [
      row.ticker,
      snapshot?.period_end ?? row.period_end,
      snapshot?.na_pct_at_cost ?? null,
      snapshot?.na_publication_status ?? "unknown",
      snapshot?.na_basis ?? "unknown",
      snapshot?.na_publication_reason ?? "",
      row.period_end,
      published ? row.form_4q : null,
      published ? row.form_lo : null,
      published ? row.form_hi : null,
      row.form_feature_coverage_pct,
      row.form_observation_status,
      projectionStatusLabel(row),
    ];
  });

  return (
    <div
      id="gated-na-projections"
      className="rounded-xl border overflow-hidden scroll-mt-6"
      style={{ background: "#111118", borderColor: "#1e1e2e" }}
    >
      <div className="px-4 py-3 border-b" style={{ borderColor: "#1e1e2e" }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Current non-accruals and gated four-quarter formation
            </h2>
            <p className="text-xs mt-1 max-w-4xl" style={{ color: "#8b8ba8" }}>
              Current non-accruals preserve each issuer&apos;s latest accepted disclosure or parsed
              position measure. Four-quarter formation estimates publish only when cost-weighted
              observed coverage reaches at least {coverageFloor.toFixed(2)}% across six nullable
              feature families. Rows below that floor remain visible with their estimates withheld.
            </p>
            <p className="text-xs mt-2" style={{ color: "#6b6b88" }}>
              {publishedCount} published · {withheldCount} below coverage floor · {unavailableCount} unavailable.
              Missing feature values use explicit indicators; future non-accrual outcomes are never imputed.
            </p>
          </div>
          <CsvDownloadButton filename="na-gated-four-quarter-formation" columns={csvColumns} rows={csvRows} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          <thead style={{ background: "#0f0f16" }}>
            <tr>
              {[
                "BDC",
                "Reporting date",
                "Current NA at cost",
                "Expected new NA · next 4Q",
                "80% range",
                "Feature coverage",
                "Publication status",
              ].map((c, i) => (
                <th key={c} className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                  style={{ color: "#8b8ba8", borderBottom: "1px solid #1e1e2e" }}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const snapshot = snapshotsByTicker.get(row.ticker);
              const published = projectionIsPublished(row);
              const basisLabel = snapshotBasisLabel(
                snapshot?.na_publication_status,
                snapshot?.na_basis,
              );
              const publicationLabel = projectionStatusLabel(row);
              return (
                <tr
                  key={row.ticker}
                  data-forecast-status={row.form_observation_status}
                  data-projection-published={published ? "true" : "false"}
                  style={{ background: i % 2 === 0 ? "#111118" : "#0f0f16" }}
                >
                  <td className="px-3 py-2 font-mono font-semibold">
                    <Link href={`/bdcs/${row.ticker.toLowerCase()}`} className="hover:underline" style={{ color: "#a5b4fc" }}>
                      {row.ticker}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                    {snapshot?.period_end ?? row.period_end}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                    <div>{snapshot?.na_pct_at_cost == null ? "Unknown" : `${snapshot.na_pct_at_cost.toFixed(2)}%`}</div>
                    {basisLabel && (
                      <div className="text-[10px] mt-0.5 whitespace-nowrap" style={{ color: "#6b6b88" }}>
                        {basisLabel}
                      </div>
                    )}
                  </td>
                  <td
                    className="px-3 py-2 text-right tabular-nums font-semibold"
                    style={{ color: published ? "#fafafa" : "#8b8ba8" }}
                  >
                    {published && row.form_4q != null
                      ? `${row.form_4q.toFixed(2)}%`
                      : row.form_observation_status === "withheld_feature_coverage"
                        ? "Withheld"
                        : "Unavailable"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs" style={{ color: "#8b8ba8" }}>
                    {published && row.form_lo != null && row.form_hi != null
                      ? `${row.form_lo.toFixed(2)}–${row.form_hi.toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: "#9ca3af" }}>
                    {row.form_feature_coverage_pct == null
                      ? "Unavailable"
                      : `${row.form_feature_coverage_pct.toFixed(2)}%`}
                  </td>
                  <td className="px-3 py-2 text-right text-xs whitespace-nowrap">
                    <span
                      className="inline-block rounded px-2 py-1"
                      style={{
                        background: published
                          ? "rgba(34,197,94,0.10)"
                          : row.form_observation_status === "withheld_feature_coverage"
                            ? "rgba(245,158,11,0.10)"
                            : "rgba(107,114,128,0.12)",
                        color: published
                          ? "#86efac"
                          : row.form_observation_status === "withheld_feature_coverage"
                            ? "#fbbf24"
                            : "#9ca3af",
                      }}
                    >
                      {publicationLabel}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t text-xs" style={{ borderColor: "#1e1e2e", color: "#6b6b88" }}>
        <span className="text-white">Provisional model.</span> Validation covers {naFcMeta.formation.n} mature
        BDC-quarters. The coverage gate measures whether current inputs are observed; it is not predictive
        certification. The projection is expected new non-accrual formation as a share of currently performing
        amortized cost, with an empirical 80% error band. It is a portfolio estimate, not a borrower-level
        default probability or an estimate of realized loss.
      </div>
    </div>
  );
}
