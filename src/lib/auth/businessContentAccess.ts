import type { Role } from "@prisma/client";

/**
 * Platform editorial capability only.
 * Partner/resource authorization must use BusinessMember-backed permissions from
 * `@/server/permissions/business-permissions`.
 */

/** Админ / модератор публикует контент сразу, без очереди на модерацию. */
export function canPublishContentDirectly(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}
