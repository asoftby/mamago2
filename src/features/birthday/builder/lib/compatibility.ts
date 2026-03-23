import type { BirthdayOffer } from "../../types/birthday";
import type { OfferConflict, PlaceType } from "../types/builder";

/**
 * Resolve effective base type: from offer when base exists, or from placeType for HOME/OUTDOOR.
 */
function getEffectiveBaseType(base: BirthdayOffer | null, placeType: PlaceType | null): PlaceType | null {
  if (base) return getBaseType(base);
  if (placeType === "HOME" || placeType === "OUTDOOR") return placeType;
  return null;
}

/**
 * Check if an addon offer is compatible with the selected base or format (HOME/OUTDOOR).
 * Returns null if compatible, or a conflict object if incompatible.
 */
export function checkAddonCompatibility(
  addon: BirthdayOffer,
  base: BirthdayOffer | null,
  placeType: PlaceType | null
): OfferConflict | null {
  const effectiveBaseType = getEffectiveBaseType(base, placeType);
  const hasVenue = base !== null && base.category === "VENUE";

  const compat = addon.compatibility;
  if (!compat) return null; // No constraints = compatible

  // When no base and no format (place step not done), allow everything
  if (!effectiveBaseType) return null;

  // Check base type / format compatibility
  if (compat.compatibleBaseTypes && compat.compatibleBaseTypes.length > 0) {
    if (!compat.compatibleBaseTypes.includes(effectiveBaseType)) {
      return {
        offerId: addon.id,
        reason: "FORMAT_MISMATCH",
        message: `"${addon.title}" не подходит для выбранного формата праздника`,
      };
    }
  }

  // Check if addon requires a venue — conflict when HOME/OUTDOOR (no venue)
  if (compat.requiresSelectedVenue && !hasVenue) {
    return {
      offerId: addon.id,
      reason: "VENUE_MISMATCH",
      message: `"${addon.title}" требует выбора площадки`,
    };
  }

  // Venue-specific checks — only when we have a base
  if (base) {
    if (compat.compatibleVenueIds && compat.compatibleVenueIds.length > 0) {
      if (!compat.compatibleVenueIds.includes(base.id)) {
        return {
          offerId: addon.id,
          reason: "VENUE_MISMATCH",
          message: `"${addon.title}" не работает с выбранной площадкой`,
        };
      }
    }

    if (compat.incompatibleVenueIds && compat.incompatibleVenueIds.includes(base.id)) {
      return {
        offerId: addon.id,
        reason: "VENUE_MISMATCH",
        message: `"${addon.title}" несовместим с выбранной площадкой`,
      };
    }

    if (compat.isVenueExclusive && base.category === "VENUE" && addon.businessId !== base.businessId) {
      return {
        offerId: addon.id,
        reason: "EXCLUSIVE_TO_PREVIOUS_BASE",
        message: `"${addon.title}" доступен только в другой площадке`,
      };
    }
  }

  return null; // Compatible
}

/**
 * Revalidate all selected addons against the new base.
 * Returns array of conflicts.
 */
export function revalidateAddons(
  selectedAddonIds: string[],
  allOffers: BirthdayOffer[],
  newBase: BirthdayOffer | null,
  placeType: PlaceType | null
): OfferConflict[] {
  const conflicts: OfferConflict[] = [];

  for (const addonId of selectedAddonIds) {
    const addon = allOffers.find((o) => o.id === addonId);
    if (!addon) continue;

    const conflict = checkAddonCompatibility(addon, newBase, placeType);
    if (conflict) {
      conflicts.push(conflict);
    }
  }

  return conflicts;
}

/**
 * Get the base type from an offer (for compatibility checks).
 */
function getBaseType(offer: BirthdayOffer): PlaceType {
  if (offer.category === "PACKAGE") return "PACKAGE";
  if (offer.category === "VENUE") {
    // Check formatTags to determine venue type
    if (offer.formatTags?.includes("OUTDOOR")) return "OUTDOOR";
    if (offer.formatTags?.includes("HOME")) return "HOME";
    return "VENUE";
  }
  // Fallback
  return "VENUE";
}

/**
 * Check if an addon is venue-bound (tied to the selected venue).
 * Venue-bound = same business as venue OR explicitly compatible with this venue.
 */
export function isVenueBoundAddon(
  addon: BirthdayOffer,
  base: BirthdayOffer | null
): boolean {
  if (!base || base.layer !== "BASE") return false;

  // Same business = venue-bound (e.g. addon from venue's own offerings)
  if (addon.businessId && base.businessId && addon.businessId === base.businessId) {
    return true;
  }

  // Explicitly listed as compatible with this venue
  const compat = addon.compatibility;
  if (compat?.compatibleVenueIds?.includes(base.id)) {
    return true;
  }

  return false;
}

/**
 * Remove conflicted addons from selection.
 * Returns new selectedAddonIds array without conflicts.
 */
export function removeConflictedAddons(
  selectedAddonIds: string[],
  conflicts: OfferConflict[]
): string[] {
  const conflictIds = new Set(conflicts.map((c) => c.offerId));
  return selectedAddonIds.filter((id) => !conflictIds.has(id));
}
