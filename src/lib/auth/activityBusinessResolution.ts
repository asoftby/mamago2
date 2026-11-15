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
 * Existing events retain their booking business. If a legacy event lacks one,
 * its author's own Business is the only safe automatic recipient.
 *
 * The editor may be a moderator or an employee, not the author. Never adopt
 * the editor's business, and never infer the recipient from the Organizer.
 */
export function resolveActivityBusinessIdForPatch(input: {
  existingBusinessId: string | null;
  authorBusinessId: string | null;
}): string | null {
  return input.existingBusinessId ?? input.authorBusinessId;
}
