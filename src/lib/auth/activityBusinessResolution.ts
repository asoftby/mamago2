/**
 * Resolve the business scope for a newly-created activity.
 *
 * A business-owned Place is authoritative. For legacy/unowned Places we keep
 * an explicitly requested business, otherwise fall back to the user's active
 * partner business. This prevents EXISTING_PLACE selections with
 * ownerBusinessId=null from losing the author's business scope.
 */
export function resolveActivityBusinessIdForCreate(input: {
  placeOwnerBusinessId: string | null | undefined;
  requestedBusinessId: string | null | undefined;
  userBusinessId: string | null | undefined;
}): string | null {
  return (
    input.placeOwnerBusinessId ??
    input.requestedBusinessId ??
    input.userBusinessId ??
    null
  );
}

/**
 * Business scope of an existing activity being saved.
 *
 * An event that has no business (e.g. seeded or created by platform staff
 * without one) cannot receive bookings. The person saving it supplies their
 * own partner business; an existing business is never replaced by this fallback.
 */
export function resolveActivityBusinessIdForPatch(input: {
  nextBusinessId: string | null | undefined;
  existingBusinessId: string | null | undefined;
  userBusinessId: string | null | undefined;
}): string | null {
  return (
    (input.nextBusinessId !== undefined ? input.nextBusinessId : input.existingBusinessId) ??
    input.userBusinessId ??
    null
  );
}
