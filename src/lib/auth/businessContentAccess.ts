import type { Role } from "@prisma/client";

/**
 * Глобальные проверки роли платформы (legacy / transitional).
 * Доступ к конкретному бизнесу — через `@/server/permissions/business-permissions`
 * (BusinessMember + transitional owner).
 */

/** Кто может создавать/редактировать места, события и предложения в кабинете */
export function canCreateBusinessContent(role: Role): boolean {
  return (
    role === "BUSINESS_OWNER" ||
    role === "ADMIN" ||
    role === "MODERATOR"
  );
}

/** Владелец контента или сотрудник модерации */
export function canManageOwnedContent(
  user: { id: string; role: Role },
  ownerUserId: string
): boolean {
  if (user.id === ownerUserId) return true;
  if (user.role === "ADMIN" || user.role === "MODERATOR") return true;
  return false;
}

/** Админ / модератор публикует контент сразу, без очереди на модерацию */
export function canPublishContentDirectly(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}
