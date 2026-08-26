import prisma from "@/lib/prisma";
import type { Role } from "@prisma/client";

/**
 * Every context that is allowed to request an owner override at all. Kept as
 * an exhaustive literal union (not a free-form string) so a typo or garbage
 * client value can never accidentally match — it must fail closed to null.
 */
export type UploadContext = "ADMIN_ARTICLE";

export class UploadOwnerOverrideError extends Error {
  code: "FORBIDDEN" | "OWNER_NOT_FOUND";

  constructor(code: "FORBIDDEN" | "OWNER_NOT_FOUND", message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Resolves the effective `MediaAsset.uploadedById` for an upload request.
 *
 * The override capability is intentionally narrow: it exists only for the
 * admin article editor uploading directly into the article's authorUserId's
 * library, not as a general "any ADMIN/MODERATOR can attribute any upload to
 * anyone" capability. Two independent gates must both pass before the target
 * user is even looked up:
 *   1. `uploadContext` must be exactly "ADMIN_ARTICLE" — plain `/api/upload`
 *      callers (business wizard, avatar, etc.) never send this, so they
 *      always keep `uploadedById = requesterId` no matter what.
 *   2. the requester's role must be ADMIN or MODERATOR.
 * Neither gate is silently downgraded — every rejected override throws, so a
 * caller that thinks it set an owner never gets a silently wrong one. The
 * override target must be a real user; a dangling id fails closed here
 * rather than surfacing as a raw FK-constraint error from the MediaAsset
 * insert.
 */
export async function resolveUploadOwnerUserId(params: {
  requesterId: string;
  requesterRole: Role;
  requestedOwnerUserId: string | null;
  uploadContext: UploadContext | null;
}): Promise<string> {
  const { requesterId, requesterRole, requestedOwnerUserId, uploadContext } = params;

  if (!requestedOwnerUserId || requestedOwnerUserId === requesterId) {
    return requesterId;
  }

  if (uploadContext !== "ADMIN_ARTICLE") {
    throw new UploadOwnerOverrideError(
      "FORBIDDEN",
      "Owner override is only allowed for the ADMIN_ARTICLE upload context",
    );
  }

  if (requesterRole !== "ADMIN" && requesterRole !== "MODERATOR") {
    throw new UploadOwnerOverrideError(
      "FORBIDDEN",
      "Only ADMIN/MODERATOR can upload into another user's media library",
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: requestedOwnerUserId },
    select: { id: true },
  });
  if (!targetUser) {
    throw new UploadOwnerOverrideError("OWNER_NOT_FOUND", "Target media library owner does not exist");
  }

  return targetUser.id;
}
