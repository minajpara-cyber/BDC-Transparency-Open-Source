// Canonical BDC ticker -> parent alternative-asset-manager grouping.
// `manager` is the short display label; `parent` is the public stock the
// platform's credit results roll into (null when the sponsor is private or the
// BDC is internally managed). Shared by the /watchlist by-manager view and
// (future) the manager read-through pages. Keep in sync with the MANAGER dict
// in bdc_inventory/scripts/51_export_early_warning.py.

export interface ManagerInfo {
  manager: string;
  parent: string | null;
}

export const MANAGER_MAP: Record<string, ManagerInfo> = {
  ARCC: { manager: "Ares", parent: "ARES" },
  ASIF: { manager: "Ares", parent: "ARES" },
  BXSL: { manager: "Blackstone", parent: "BX" },
  BCRED: { manager: "Blackstone", parent: "BX" },
  OBDC: { manager: "Blue Owl", parent: "OWL" },
  OTF: { manager: "Blue Owl", parent: "OWL" },
  OCIC: { manager: "Blue Owl", parent: "OWL" },
  MFIC: { manager: "Apollo", parent: "APO" },
  ADS: { manager: "Apollo", parent: "APO" },
  FSK: { manager: "FS/KKR", parent: "KKR" },
  CGBD: { manager: "Carlyle", parent: "CG" },
  TSLX: { manager: "Sixth Street", parent: null },
  OCSL: { manager: "Oaktree (Brookfield)", parent: "BN" },
  GBDC: { manager: "Golub", parent: null },
  BBDC: { manager: "Barings", parent: null },
  NMFC: { manager: "New Mountain", parent: null },
  CCAP: { manager: "Crescent", parent: null },
  HTGC: { manager: "Hercules", parent: "HTGC" },
  MAIN: { manager: "Main Street", parent: "MAIN" },
};

export function managerOf(ticker: string): string {
  return MANAGER_MAP[ticker]?.manager ?? ticker;
}

export function parentOf(ticker: string): string | null {
  return MANAGER_MAP[ticker]?.parent ?? null;
}
