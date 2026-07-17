import type { ContentStatus, Role } from "@prisma/client";

import type { PlaceWizardMode } from "./types";

/**
 * Single source of truth for `PlaceWizard`'s `isEditable` flag, fed into
 * every step via `commonProps` — never re-derive this per step.
 *
 * `create` mode is always editable (the caller/access layer already
 * decided who may reach it). `edit` mode is editable for any non-PENDING
 * status (unchanged prior behavior), or for PENDING when the acting user
 * is ADMIN/MODERATOR — staff must be able to fix imported/submitted data
 * before approving it. BUSINESS_OWNER/USER stay read-only on a PENDING
 * Place: the authorization layer (`canManagePlaceAsync`) already lets an
 * owner reach this page to preview their own submission, but reaching the
 * page is not the same as being allowed to edit it while it's under
 * review — that would let them alter data mid-moderation.
 */
export function canEditPlaceInWizard(params: {
  mode: PlaceWizardMode;
  status: ContentStatus | null | undefined;
  userRole: Role | undefined;
}): boolean {
  const { mode, status, userRole } = params;

  if (mode === "create") return true;

  if (status !== "PENDING") return true;

  return userRole === "ADMIN" || userRole === "MODERATOR";
}
