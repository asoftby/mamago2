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
  body: string;
  ctaLabel: string | null;
  ctaAction: string | null;
  isPinned: boolean;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  /** null = новое (badge); после открытия центра выставляется на сервере */
  seenAt: string | null;
  createdAt: string;
  userId?: string;
  /** Контекст уведомления: USER, BUSINESS, ADMIN */
  audience?: string | null;
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
