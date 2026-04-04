import type { ContentStatus } from "@prisma/client";

/** Бейджи статусов ContentStatus — как на странице «Места». */
export const MODERATION_CONTENT_STATUS_CONFIG: Record<
  ContentStatus,
  { label: string; variant: "secondary" | "outline" | "default" | "destructive"; className: string }
> = {
  DRAFT: { label: "Черновик", variant: "secondary", className: "" },
  PENDING: {
    label: "На модерации",
    variant: "outline",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
  PENDING_UPDATE: {
    label: "Обновление на проверке",
    variant: "outline",
    className: "bg-amber-50 text-amber-900 border-amber-200",
  },
  PUBLISHED: { label: "Опубликовано", variant: "default", className: "" },
  NEEDS_REVISION: { label: "Требует правок", variant: "destructive", className: "" },
  REJECTED: { label: "Отклонено", variant: "destructive", className: "" },
  DELETED: { label: "Удалено", variant: "secondary", className: "text-muted-foreground" },
};
