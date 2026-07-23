import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Reads the immutable snapshot TSV's `content_authorship` section once and
 * returns, for a given set of WordPress `places` post IDs, their
 * `post_status` (publish / draft / unpublished / ...). Read-only file
 * access, no query, no SSH — matches the loader convention in
 * `planning/user-ownership/snapshotEvidence.ts`.
 */
export function loadPlaceSourceStatuses(snapshotRoot: string, placePostIds: readonly string[]): ReadonlyMap<string, string> {
  const path = join(snapshotRoot, "raw/users-source-capture.tsv");
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");
  const sectionStart = lines.findIndex(line => line.trim() === "SECTION content_authorship");
  if (sectionStart === -1) throw new Error("content_authorship section not found in source snapshot TSV.");
  const header = lines[sectionStart + 1].split("\t");
  const idIndex = header.indexOf("ID");
  const typeIndex = header.indexOf("post_type");
  const statusIndex = header.indexOf("post_status");
  if (idIndex === -1 || typeIndex === -1 || statusIndex === -1) throw new Error("content_authorship section is missing expected columns.");

  const wanted = new Set(placePostIds);
  const statusById = new Map<string, string>();
  for (let i = sectionStart + 2; i < lines.length; i++) {
    const line = lines[i];
    if (!line || line.trim() === "") continue;
    if (line.startsWith("SECTION ") || line.trim() === "snapshot_section") break;
    const cols = line.split("\t");
    if (cols[typeIndex] !== "places") continue;
    const id = cols[idIndex];
    if (wanted.has(id)) statusById.set(id, cols[statusIndex]);
  }
  return statusById;
}
