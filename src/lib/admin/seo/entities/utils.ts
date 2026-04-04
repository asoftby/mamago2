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

/** Черновики и неопубликованное — в таблице как draft; иначе смотрим robots. */
export function indexationStatusForPublishedEntity(
  isPublished: boolean,
  robots: string | null
): SeoEntityListingRow["indexationStatus"] {
  if (!isPublished) return "draft";
  return indexationStatusFromRobots(robots);
}

export function isIndexableForPublishedEntity(
  isPublished: boolean,
  robots: string | null
): boolean {
  if (!isPublished) return false;
  return isIndexableFromRobots(robots);
}

