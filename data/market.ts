export interface MarketDataPoint {
  date: string;
  value: number;
}

export interface SectorExposure {
  sector: string;
  percent: number;
  color: string;
}

export interface BDCSoftwareExposure {
  bdc: string;
  ticker: string;
  softwareExposure: number;
  type: string;
}

// Historical BDC market data
export const bdcAumHistory: MarketDataPoint[] = [
  { date: "2020-Q4", value: 110 },
  { date: "2021-Q4", value: 175 },
  { date: "2022-Q4", value: 255 },
  { date: "2023-Q4", value: 320 },
  { date: "2024-Q4", value: 395 },
  { date: "2025-Q3", value: 450 },
];

export const nonAccrualHistory: MarketDataPoint[] = [
  { date: "2022-Q4", value: 1.4 },
  { date: "2023-Q2", value: 1.6 },
  { date: "2023-Q4", value: 1.9 },
  { date: "2024-Q2", value: 2.1 },
  { date: "2024-Q4", value: 2.3 },
  { date: "2025-Q2", value: 2.0 },
  { date: "2025-Q3", value: 1.8 },
];

export const pikRateHistory: MarketDataPoint[] = [
  { date: "2022-Q4", value: 8.5 },
  { date: "2023-Q2", value: 10.2 },
  { date: "2023-Q4", value: 11.8 },
  { date: "2024-Q2", value: 13.0 },
  { date: "2024-Q4", value: 13.3 },
  { date: "2025-Q2", value: 13.1 },
  { date: "2025-Q3", value: 12.8 },
];

export const softwareExposureHistory: MarketDataPoint[] = [
  { date: "2022-Q4", value: 22.0 },
  { date: "2023-Q2", value: 24.5 },
  { date: "2023-Q4", value: 26.0 },
  { date: "2024-Q2", value: 27.8 },
  { date: "2024-Q4", value: 28.9 },
  { date: "2025-Q3", value: 29.0 },
];

export const bdcSalesHistory: MarketDataPoint[] = [
  { date: "2024-Q4", value: 5.5 },
  { date: "2025-Q1", value: 6.2 },
  { date: "2025-Q2", value: 5.8 },
  { date: "2025-Q3", value: 4.8 },
  { date: "2025-Q4", value: 4.1 },
  { date: "2026-Jan", value: 3.2 },
];

export const bdcSectorExposure: SectorExposure[] = [
  { sector: "Software / Technology", percent: 29.0, color: "#6366f1" },
  { sector: "Healthcare / Life Sciences", percent: 18.5, color: "#22c55e" },
  { sector: "Business Services", percent: 15.2, color: "#f59e0b" },
  { sector: "Consumer Products", percent: 8.8, color: "#ec4899" },
  { sector: "Industrials / Manufacturing", percent: 7.5, color: "#64748b" },
  { sector: "Financial Services", percent: 6.8, color: "#14b8a6" },
  { sector: "Energy", percent: 4.5, color: "#ef4444" },
  { sector: "Other / Diversified", percent: 9.7, color: "#8b5cf6" },
];

export const topBDCSoftwareExposure: BDCSoftwareExposure[] = [
  { bdc: "Blue Owl Technology Income Corp.", ticker: "OTIC", softwareExposure: 88.0, type: "Non-Traded" },
  { bdc: "Hercules Capital", ticker: "HTGC", softwareExposure: 45.0, type: "Traded" },
  { bdc: "Golub Capital Private Credit Fund", ticker: "GCRED", softwareExposure: 28.0, type: "Non-Traded" },
  { bdc: "Blackstone Private Credit Fund", ticker: "BCRED", softwareExposure: 26.0, type: "Non-Traded" },
  { bdc: "Blackstone Secured Lending", ticker: "BXSL", softwareExposure: 26.0, type: "Traded" },
  { bdc: "Golub Capital BDC", ticker: "GBDC", softwareExposure: 26.0, type: "Traded" },
  { bdc: "New Mountain Finance", ticker: "NMFC", softwareExposure: 24.0, type: "Traded" },
  { bdc: "Goldman Sachs BDC", ticker: "GSBD", softwareExposure: 20.0, type: "Traded" },
  { bdc: "Ares Capital Corporation", ticker: "ARCC", softwareExposure: 18.5, type: "Traded" },
  { bdc: "Bain Capital Specialty Finance", ticker: "BCSF", softwareExposure: 18.0, type: "Traded" },
];

export const recentAlerts = [
  {
    date: "2026-03-15",
    severity: "High" as const,
    title: "Blue Owl Technology Income (OTIC) Faces 17% Redemption Rate",
    description:
      "OTIC reported investor redemptions of approximately 17% of NAV in Q4 2025 as concerns about AI disruption to software BDC portfolios mount.",
    bdc: "OTIC",
  },
  {
    date: "2026-03-08",
    severity: "High" as const,
    title: "Golub Capital Cuts Dividend 15% Amid Software Exposure Concerns",
    description:
      "Golub Capital BDC (GBDC) reduced its quarterly dividend by 15%, citing increased credit concerns in its ~26% software portfolio allocation.",
    bdc: "GBDC",
  },
  {
    date: "2026-02-28",
    severity: "Medium" as const,
    title: "Non-Traded BDC Sales Decline 49% from March 2025 Peak",
    description:
      "January 2026 non-traded BDC sales fell to $3.2B, down nearly 49% from the March 2025 all-time high of $6.2B, as AI concerns ripple through private credit markets.",
    bdc: "Sector",
  },
  {
    date: "2026-02-15",
    severity: "Critical" as const,
    title: "Ivanti Software Loans Move to Non-Accrual Across Multiple BDCs",
    description:
      "ARCC, GSBD, FSK, and TCPC moved Ivanti Software loans to non-accrual status following continued customer churn and missed financial covenants. Loans marked at 66–82 cents on the dollar.",
    bdc: "Multiple",
  },
  {
    date: "2026-01-25",
    severity: "Medium" as const,
    title: "Apollo Cuts Software Exposure In Half to ~10%",
    description:
      "Apollo Global Management reduced software sector exposure in its credit portfolios from ~20% to ~10% during 2025—a notable de-risking signal from one of private credit's most sophisticated players.",
    bdc: "MFIC",
  },
  {
    date: "2026-01-10",
    severity: "Low" as const,
    title: "Medallia Loans Appear on JPMorgan Secondary List at 94/97",
    description:
      "Medallia (Thoma Bravo) loans appeared on JPMorgan's secondary private credit bid/offer list at significant discount (94/97), one of the most discounted names on the list.",
    bdc: "Multiple",
  },
  {
    date: "2025-12-20",
    severity: "Low" as const,
    title: "Finastra Refinances with $2.95B First-Lien / $500M Second-Lien",
    description:
      "Finastra (Vista Equity) refinanced its private credit debt with a $2.95B S+400 first-lien and $500M S+700 second-lien in the syndicated market. First-lien loans now marked at 93/94.5.",
    bdc: "Multiple",
  },
];

export type AlertSeverity = "Critical" | "High" | "Medium" | "Low";
