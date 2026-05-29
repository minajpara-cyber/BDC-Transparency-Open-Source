// Real sector / software exposure derived from our parsed SOI data, replacing
// the hand-entered constants in data/market.ts. Sources:
//   - data/bdc_sector_exposure.ts  (per-BDC latest-quarter sector mix; powers
//     real software-exposure-by-BDC)
//   - data/sector_credit.ts        (industry-wide sector cost; powers the
//     sector-allocation breakdown + the headline software %)
// Both come from the industry-enrichment pipeline (scripts/36 + scripts/50),
// so MAIN/BBDC (which don't disclose industry) and GBDC (whose tags were
// fixed) are handled correctly rather than reading 0% software.

import { bdcSectorExposure as bdcSectorRows } from "@/data/bdc_sector_exposure";
import { sectorCredit } from "@/data/sector_credit";

// Non-traded perpetual / interval BDCs in our coverage (everything else is a
// listed/traded BDC). Used only to tag the software-exposure rows.
const NON_TRADED = new Set(["BCRED", "ASIF", "ADS", "OCIC", "OTF", "OTIC", "GCRED", "HLEND"]);

const BDC_NAME: Record<string, string> = {
  ARCC: "Ares Capital", BXSL: "Blackstone Secured Lending", OBDC: "Blue Owl Capital",
  FSK: "FS KKR Capital", GBDC: "Golub Capital BDC", TSLX: "Sixth Street Specialty",
  CGBD: "Carlyle Secured Lending", OCSL: "Oaktree Specialty Lending", MFIC: "MidCap Financial",
  MAIN: "Main Street Capital", HTGC: "Hercules Capital", CCAP: "Crescent Capital",
  BBDC: "Barings BDC", NMFC: "New Mountain Finance", BCRED: "Blackstone Private Credit",
  ASIF: "Ares Strategic Income", ADS: "Blackstone Pvt Credit (ADS)", OCIC: "Blue Owl Credit Income",
  OTF: "Blue Owl Technology Finance",
};

const SECTOR_COLORS: Record<string, string> = {
  "Software & IT": "#6366f1", "Healthcare": "#22c55e", "Professional Services": "#f59e0b",
  "Industrial": "#64748b", "Consumer / Retail": "#ec4899", "Insurance": "#0ea5e9",
  "Financial Services": "#14b8a6", "Utilities & Energy": "#ef4444",
  "Media & Entertainment": "#a855f7", "Real Estate": "#f97316",
  "Materials & Chemicals": "#84cc16", "Education": "#eab308",
  "Other": "#8b5cf6", "Unclassified": "#4b5563",
};

export interface BdcSoftwareRow {
  ticker: string;
  bdc: string;
  softwareExposure: number; // % of attributed book in Software & IT
  type: "Traded" | "Non-Traded";
}

/** Real software-exposure % by BDC (latest quarter), descending. */
export function bdcSoftwareExposureActual(): BdcSoftwareRow[] {
  return bdcSectorRows
    .filter((r) => r.sector === "Software & IT")
    .map((r) => ({
      ticker: r.ticker,
      bdc: BDC_NAME[r.ticker] ?? r.ticker,
      softwareExposure: Math.round(r.share_of_bdc * 1000) / 10,
      type: NON_TRADED.has(r.ticker) ? ("Non-Traded" as const) : ("Traded" as const),
    }))
    .sort((a, b) => b.softwareExposure - a.softwareExposure);
}

export interface SectorAllocRow {
  sector: string;
  percent: number;
  color: string;
  cost_b: number;
}

/** Industry-wide sector allocation (latest reliable quarter), by cost. */
export function industrySectorAllocationActual(): SectorAllocRow[] {
  const total = sectorCredit.reduce((s, r) => s + r.total_cost_b, 0);
  if (!total) return [];
  return sectorCredit
    .map((r) => ({
      sector: r.sector,
      percent: Math.round((1000 * r.total_cost_b) / total) / 10,
      color: SECTOR_COLORS[r.sector] ?? "#8b5cf6",
      cost_b: r.total_cost_b,
    }))
    .sort((a, b) => b.percent - a.percent);
}

/** Headline industry software exposure % (Software & IT share of total cost). */
export function industrySoftwarePct(): number {
  const total = sectorCredit.reduce((s, r) => s + r.total_cost_b, 0);
  const sw = sectorCredit.find((r) => r.sector === "Software & IT");
  return total && sw ? Math.round((1000 * sw.total_cost_b) / total) / 10 : 0;
}

/** The as-of quarter for the sector data. */
export function sectorAsOf(): string {
  return sectorCredit[0]?.period_end ?? "";
}
