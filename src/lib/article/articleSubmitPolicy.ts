import type { Role } from "@prisma/client";
import { canPublishContentDirectly } from "@/lib/auth/businessContentAccess";

/**
 * Что делает «Опубликовать / Отправить на модерацию» для статьи (в т.ч. Breaking News).
 * Решение принимает сервер по роли актёра: ADMIN и MODERATOR публикуют сразу,
 * остальные уходят в очередь. Клиентская подпись кнопки — только подсказка.
 */
export function resolveArticleSubmitAction(role: Role | undefined): "publish" | "submit" {
  return canPublishContentDirectly(role) ? "publish" : "submit";
}
