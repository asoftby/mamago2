import { ActivityType, ContentStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export type BusinessEventListView = "active" | "archived";

const ACTIVE_EVENT_STATUSES: ContentStatus[] = [
  ContentStatus.DRAFT,
  ContentStatus.PENDING,
  ContentStatus.PUBLISHED,
  ContentStatus.NEEDS_REVISION,
  ContentStatus.REJECTED,
  ContentStatus.PENDING_UPDATE,
  ContentStatus.SCHEDULED,
];

export function normalizeBusinessEventListView(
  value: string | string[] | null | undefined,
): BusinessEventListView {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "archived" || raw === "archive" ? "archived" : "active";
}

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

export function businessEventListViewWhere(
  view: BusinessEventListView,
): Prisma.ActivityWhereInput {
  if (view === "archived") {
    return { status: ContentStatus.ARCHIVED };
  }

  return { status: { in: ACTIVE_EVENT_STATUSES } };
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
