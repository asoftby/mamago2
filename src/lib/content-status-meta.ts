import type { ContentStatus } from "@prisma/client";

export interface ContentStatusMeta {
  label: string;
  badgeTone: "muted" | "warning" | "success" | "danger";
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  badgeClassName?: string;
  actionLabel?: string;
}

export const CONTENT_STATUS_META: Record<ContentStatus, ContentStatusMeta> = {
  DRAFT: {
    label: "Черновик",
    badgeTone: "muted",
    badgeVariant: "secondary",
    actionLabel: "Продолжить",
  },
  PENDING: {
    label: "На модерации",
    badgeTone: "warning",
    badgeVariant: "outline",
    badgeClassName: "bg-gray-100 text-gray-700 border-gray-200",
    actionLabel: "На модерации",
  },
  PENDING_UPDATE: {
    label: "На проверке",
    badgeTone: "warning",
    badgeVariant: "outline",
    badgeClassName: "bg-amber-50 text-amber-900 border-amber-200",
    actionLabel: "На проверке",
  },
  PUBLISHED: {
    label: "Опубликовано",
    badgeTone: "success",
    badgeVariant: "default",
    badgeClassName: "bg-green-100 text-green-800 border-green-200",
    actionLabel: "Редактировать",
  },
  NEEDS_REVISION: {
    label: "Требует правок",
    badgeTone: "warning",
    badgeVariant: "destructive",
    badgeClassName: "bg-orange-100 text-orange-800 border-orange-200",
    actionLabel: "Исправить",
  },
  REJECTED: {
    label: "Отклонено",
    badgeTone: "danger",
    badgeVariant: "destructive",
    badgeClassName: "bg-red-100 text-red-800 border-red-200",
    actionLabel: "Исправить",
  },
  DELETED: {
    label: "Удалено",
    badgeTone: "muted",
    badgeVariant: "secondary",
    badgeClassName: "text-muted-foreground",
    actionLabel: "—",
  },
  SCHEDULED: {
    label: "Запланировано",
    badgeTone: "warning",
    badgeVariant: "outline",
    badgeClassName: "bg-blue-50 text-blue-900 border-blue-200",
    actionLabel: "Редактировать",
  },
  ARCHIVED: {
    label: "Архив",
    badgeTone: "muted",
    badgeVariant: "secondary",
    badgeClassName: "text-muted-foreground",
    actionLabel: "Восстановить",
  },
};
