import type { SeoEntityListingRow } from "./types";

export function indexationStatusFromRobots(
  robots: string | null
): SeoEntityListingRow["indexationStatus"] {
  const r = (robots ?? "").toLowerCase();
  if (r.includes("noindex")) return "noindex";
  return "indexed";
}

export function isIndexableFromRobots(robots: string | null): boolean {
  return !(robots ?? "").toLowerCase().includes("noindex");
}

