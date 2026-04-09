import type { Role } from "@prisma/client";

/**
 * Доступ к редакторскому предпросмотру статей (`/preview/articles/[id]`).
 * При появлении роли EDITOR в схеме — добавить сюда.
 */
export function canAccessArticlePreview(role: Role | undefined): boolean {
  return role === "ADMIN" || role === "MODERATOR";
}
