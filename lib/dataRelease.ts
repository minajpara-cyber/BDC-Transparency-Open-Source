import { siteMeta } from "@/data/site_meta";

// Older seeded snapshots have no checked release stamp. Do not invent one.
const metadata = siteMeta as typeof siteMeta & {
  release_id?: string;
  checked_at?: string;
  issuer_latest_periods?: Record<string, string>;
  dataset_periods?: { long_tail?: { max?: string | null } };
};

export const dataReleaseId = metadata.release_id;
export const longTailReportingDate = metadata.dataset_periods?.long_tail?.max;
/** Date (YYYY-MM-DD) the release's automated checks last ran, if stamped. */
export const dataCheckedOn = metadata.checked_at ? metadata.checked_at.slice(0, 10) : undefined;
/** Raw release manifest (file versions and hashes) for technical readers. */
export const dataReleaseManifestPath = "/data-release.json";

/** BDCs whose latest filed quarter is older than the site's latest quarter. */
export function laggingIssuers(): { ticker: string; period: string }[] {
  const periods = metadata.issuer_latest_periods ?? {};
  return Object.entries(periods)
    .filter(([, period]) => period < siteMeta.latest_period)
    .map(([ticker, period]) => ({ ticker, period }))
    .sort((a, b) => a.period.localeCompare(b.period) || a.ticker.localeCompare(b.ticker));
}
