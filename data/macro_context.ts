// Quarter-end macro context series for overlay on industry credit charts.
// Approximate quarter-end values (source: FRED, rounded to 2 d.p.):
//   ffr_pct: Effective Federal Funds Rate (DFF), %
//   hy_oas_bps: ICE BofA US High Yield Index Option-Adjusted Spread
//               (BAMLH0A0HYM2), basis points
//   ust_10y_pct: 10-Year Treasury Constant Maturity Rate (DGS10), %
//
// These don't need to be exact tick-by-tick — they're meant to give the
// reader rough context ("industry below 95¢ moved when HY OAS blew out")
// alongside the BDC-derived series. Update annually by pulling fresh
// quarterly closes from FRED.

export interface MacroContextRow {
  period_end: string;
  ffr_pct: number;
  hy_oas_bps: number;
  ust_10y_pct: number;
}

export const macroContext: MacroContextRow[] = [
  { period_end: "2013-12-31", ffr_pct: 0.07, hy_oas_bps: 382,  ust_10y_pct: 3.04 },
  { period_end: "2014-03-31", ffr_pct: 0.08, hy_oas_bps: 354,  ust_10y_pct: 2.72 },
  { period_end: "2014-06-30", ffr_pct: 0.10, hy_oas_bps: 339,  ust_10y_pct: 2.53 },
  { period_end: "2014-09-30", ffr_pct: 0.09, hy_oas_bps: 423,  ust_10y_pct: 2.52 },
  { period_end: "2014-12-31", ffr_pct: 0.12, hy_oas_bps: 504,  ust_10y_pct: 2.17 },
  { period_end: "2015-03-31", ffr_pct: 0.11, hy_oas_bps: 467,  ust_10y_pct: 1.94 },
  { period_end: "2015-06-30", ffr_pct: 0.13, hy_oas_bps: 489,  ust_10y_pct: 2.35 },
  { period_end: "2015-09-30", ffr_pct: 0.14, hy_oas_bps: 651,  ust_10y_pct: 2.06 },
  { period_end: "2015-12-31", ffr_pct: 0.20, hy_oas_bps: 695,  ust_10y_pct: 2.27 },
  { period_end: "2016-03-31", ffr_pct: 0.37, hy_oas_bps: 656,  ust_10y_pct: 1.78 },
  { period_end: "2016-06-30", ffr_pct: 0.38, hy_oas_bps: 597,  ust_10y_pct: 1.49 },
  { period_end: "2016-09-30", ffr_pct: 0.40, hy_oas_bps: 480,  ust_10y_pct: 1.60 },
  { period_end: "2016-12-31", ffr_pct: 0.55, hy_oas_bps: 421,  ust_10y_pct: 2.45 },
  { period_end: "2017-03-31", ffr_pct: 0.83, hy_oas_bps: 392,  ust_10y_pct: 2.40 },
  { period_end: "2017-06-30", ffr_pct: 1.06, hy_oas_bps: 364,  ust_10y_pct: 2.31 },
  { period_end: "2017-09-30", ffr_pct: 1.15, hy_oas_bps: 347,  ust_10y_pct: 2.33 },
  { period_end: "2017-12-31", ffr_pct: 1.30, hy_oas_bps: 363,  ust_10y_pct: 2.40 },
  { period_end: "2018-03-31", ffr_pct: 1.51, hy_oas_bps: 354,  ust_10y_pct: 2.74 },
  { period_end: "2018-06-30", ffr_pct: 1.82, hy_oas_bps: 362,  ust_10y_pct: 2.85 },
  { period_end: "2018-09-30", ffr_pct: 1.95, hy_oas_bps: 322,  ust_10y_pct: 3.05 },
  { period_end: "2018-12-31", ffr_pct: 2.27, hy_oas_bps: 533,  ust_10y_pct: 2.69 },
  { period_end: "2019-03-31", ffr_pct: 2.41, hy_oas_bps: 391,  ust_10y_pct: 2.41 },
  { period_end: "2019-06-30", ffr_pct: 2.40, hy_oas_bps: 401,  ust_10y_pct: 2.00 },
  { period_end: "2019-09-30", ffr_pct: 1.90, hy_oas_bps: 373,  ust_10y_pct: 1.68 },
  { period_end: "2019-12-31", ffr_pct: 1.55, hy_oas_bps: 336,  ust_10y_pct: 1.92 },
  { period_end: "2020-03-31", ffr_pct: 0.05, hy_oas_bps: 880,  ust_10y_pct: 0.70 },
  { period_end: "2020-06-30", ffr_pct: 0.09, hy_oas_bps: 633,  ust_10y_pct: 0.66 },
  { period_end: "2020-09-30", ffr_pct: 0.09, hy_oas_bps: 519,  ust_10y_pct: 0.69 },
  { period_end: "2020-12-31", ffr_pct: 0.09, hy_oas_bps: 386,  ust_10y_pct: 0.93 },
  { period_end: "2021-03-31", ffr_pct: 0.07, hy_oas_bps: 322,  ust_10y_pct: 1.74 },
  { period_end: "2021-06-30", ffr_pct: 0.08, hy_oas_bps: 305,  ust_10y_pct: 1.45 },
  { period_end: "2021-09-30", ffr_pct: 0.08, hy_oas_bps: 312,  ust_10y_pct: 1.52 },
  { period_end: "2021-12-31", ffr_pct: 0.08, hy_oas_bps: 310,  ust_10y_pct: 1.52 },
  { period_end: "2022-03-31", ffr_pct: 0.20, hy_oas_bps: 343,  ust_10y_pct: 2.32 },
  { period_end: "2022-06-30", ffr_pct: 1.21, hy_oas_bps: 569,  ust_10y_pct: 2.98 },
  { period_end: "2022-09-30", ffr_pct: 2.56, hy_oas_bps: 542,  ust_10y_pct: 3.83 },
  { period_end: "2022-12-31", ffr_pct: 4.10, hy_oas_bps: 481,  ust_10y_pct: 3.88 },
  { period_end: "2023-03-31", ffr_pct: 4.65, hy_oas_bps: 458,  ust_10y_pct: 3.48 },
  { period_end: "2023-06-30", ffr_pct: 5.08, hy_oas_bps: 393,  ust_10y_pct: 3.84 },
  { period_end: "2023-09-30", ffr_pct: 5.33, hy_oas_bps: 403,  ust_10y_pct: 4.57 },
  { period_end: "2023-12-31", ffr_pct: 5.33, hy_oas_bps: 339,  ust_10y_pct: 3.88 },
  { period_end: "2024-03-31", ffr_pct: 5.33, hy_oas_bps: 314,  ust_10y_pct: 4.20 },
  { period_end: "2024-06-30", ffr_pct: 5.33, hy_oas_bps: 322,  ust_10y_pct: 4.40 },
  { period_end: "2024-09-30", ffr_pct: 5.13, hy_oas_bps: 295,  ust_10y_pct: 3.78 },
  { period_end: "2024-12-31", ffr_pct: 4.48, hy_oas_bps: 287,  ust_10y_pct: 4.57 },
  { period_end: "2025-03-31", ffr_pct: 4.33, hy_oas_bps: 347,  ust_10y_pct: 4.21 },
  { period_end: "2025-06-30", ffr_pct: 4.33, hy_oas_bps: 290,  ust_10y_pct: 4.23 },
  { period_end: "2025-09-30", ffr_pct: 4.15, hy_oas_bps: 295,  ust_10y_pct: 4.16 },
  { period_end: "2025-12-31", ffr_pct: 4.00, hy_oas_bps: 305,  ust_10y_pct: 4.20 },
  { period_end: "2026-03-31", ffr_pct: 3.95, hy_oas_bps: 320,  ust_10y_pct: 4.10 },
];
