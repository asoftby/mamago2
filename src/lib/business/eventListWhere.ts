import { ActivityType, ContentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

/**
 * Статусы «всё кроме мягко удалённого».
 * Нельзя использовать `status: { not: DELETED }`: пока в PostgreSQL нет значения enum DELETED,
 * Prisma падает с «Value 'DELETED' not found in enum 'ContentStatus'».
 */
export function activityStatusesExcludingDeleted(): ContentStatus[] {
  return Object.values(ContentStatus).filter((s) => s !== ContentStatus.DELETED);
}

/** Скрывает события с мягким удалением. */
export function excludeDeletedEvents(): Prisma.ActivityWhereInput {
  return {
    status: { in: activityStatusesExcludingDeleted() },
  };
}

/**
 * Исключает «пустые» legacy-черновики (типичный автосейв до фикса мастера):
 * DRAFT, дефолтное название, без обложки и без возраста.
 */
export function excludeGhostEventDrafts(): Prisma.ActivityWhereInput {
  return {
    NOT: {
      AND: [
        { status: ContentStatus.DRAFT },
        { type: ActivityType.EVENT },
        { title: "Новое событие" },
        { coverImageId: null },
        { ageTags: { isEmpty: true } },
      ],
    },
  };
}
