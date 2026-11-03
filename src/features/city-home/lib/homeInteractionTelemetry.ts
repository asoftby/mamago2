import type { TrackUserEventInput } from "@/lib/analytics/types";
export const HOME_FAMILY_PLACEMENT = "HOME_FOR_FAMILY";
export function homeSelectionMode(choice: string | null) { return choice ? "CHILD" as const : "ALL_FAMILY" as const; }
/** IDs are used solely to detect a change and never enter the payload. */
export function homeChipSelectEvent(previous: string | null, next: string | null, citySlug: string): TrackUserEventInput | null {
  return previous === next ? null : { eventType: "FILTER_APPLY", vertical: "CITY", citySlug,
    meta: { source: "listing", section: "home", placement: HOME_FAMILY_PLACEMENT, action: "home_chip_select", selectionMode: homeSelectionMode(next) } };
}
export function homeCatalogEvent(choice: string | null, citySlug: string): TrackUserEventInput {
  return { eventType: "CTA_CLICK", vertical: "CITY", citySlug,
    meta: { source: "listing", section: "home", placement: HOME_FAMILY_PLACEMENT, targetAction: "catalog", selectionMode: homeSelectionMode(choice) } };
}
