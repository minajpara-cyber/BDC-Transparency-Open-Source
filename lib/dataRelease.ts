import { siteMeta } from "@/data/site_meta";

// Older seeded snapshots have no checked release stamp. Do not invent one.
const metadata = siteMeta as typeof siteMeta & {
  release_id?: string;
  dataset_periods?: { long_tail?: { max?: string | null } };
};

export const dataReleaseId = metadata.release_id;
export const longTailReportingDate = metadata.dataset_periods?.long_tail?.max;
