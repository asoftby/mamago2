import type { OfferStatus, Role } from "@prisma/client";
import { canPublishContentDirectly } from "@/lib/auth/businessContentAccess";

export const OFFER_PUBLISHED_REQUIRES_MODERATION_CODE =
  "OFFER_PUBLISHED_REQUIRES_MODERATION";

/**
 * PUBLISHED-оффер нельзя править напрямую: модели OfferRevision нет,
 * прямая запись в живую строку минует модерацию (content leak).
 * ADMIN/MODERATOR (canPublishContentDirectly) правят живую строку сразу —
 * та же семантика, что у гейта «кто может слать status: PUBLISHED».
 */
export function shouldBlockPublishedOfferEdit(params: {
  role: Role;
  currentStatus: OfferStatus;
}): boolean {
  return (
    params.currentStatus === "PUBLISHED" &&
    !canPublishContentDirectly(params.role)
  );
}
