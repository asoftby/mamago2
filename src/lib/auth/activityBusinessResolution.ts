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
