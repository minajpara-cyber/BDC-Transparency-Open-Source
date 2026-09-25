// Server-only (reads files at build time): does public/data-release.json still
// describe the data files this build ships? The release step writes one
// SHA-256 per data file after its checks pass. Data regenerated afterwards
// (without re-running that step) no longer matches, and the site must not
// claim those checks or point readers to the stale checksums.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export interface ReleaseCheck {
  /** Every data file listed in the release file matches its checksum. */
  verified: boolean;
  releaseId?: string;
  /** YYYY-MM-DD the release checks ran. */
  checkedOn?: string;
  /** Listed files whose current contents differ from the release checksum. */
  changedFiles: string[];
}

export function checkDataRelease(root: string = process.cwd()): ReleaseCheck {
  try {
    const manifest = JSON.parse(readFileSync(path.join(root, "public/data-release.json"), "utf8")) as {
      release_id?: string; checked_at?: string; data_sha256?: Record<string, string>;
    };
    const listed = Object.entries(manifest.data_sha256 ?? {});
    const changedFiles = listed
      .filter(([file, sha]) => {
        try {
          return createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex") !== sha;
        } catch {
          return true;
        }
      })
      .map(([file]) => file);
    return {
      verified: listed.length > 0 && changedFiles.length === 0,
      releaseId: manifest.release_id,
      checkedOn: manifest.checked_at?.slice(0, 10),
      changedFiles,
    };
  } catch {
    return { verified: false, changedFiles: [] };
  }
}
