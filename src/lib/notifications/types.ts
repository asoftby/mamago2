/**
 * Единая UI-модель уведомлений: один поток на userId, разделение USER / BUSINESS только в интерфейсе.
 * Соответствует данным из API `/api/notifications` (поле `type` — Prisma `NotificationType`).
 */

export type NotificationStream = "USER" | "BUSINESS";

export type NotificationCategory =
  | "PLAN"
  | "IDEA"
  | "REMINDER"
  | "REQUEST"
  | "MODERATION";

/** Строка из GET /api/notifications */
export type NotificationApiRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
  userId?: string;
};

/**
 * Представление для списков и карточек (опционально, для явной типизации UI).
 */
export type NotificationViewModel = {
  id: string;
  userId: string;
  type: NotificationStream;
  category: NotificationCategory;
  title: string;
  description?: string;
  isRead: boolean;
  createdAt: Date;
};
