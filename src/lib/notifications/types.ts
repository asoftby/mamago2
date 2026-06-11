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
  actionMode: "NONE" | "MODAL" | "PAGE" | "EXTERNAL_URL";
  actionUrl: string | null;
  modalTitle: string | null;
  modalBody: string | null;
  isPinned: boolean;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  archivedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  metadata?: Record<string, unknown> | null;
  /** null = еще ни разу не открывалось в центре уведомлений */
  seenAt: string | null;
  createdAt: string;
  userId?: string;
  /** Контекст уведомления: USER, BUSINESS, ADMIN */
  audience?: string | null;
  /** Action-required onboarding (VERIFY_EMAIL, CONNECT_TELEGRAM, …) */
  actionRequired?: boolean;
  /** Действие выполнено (email подтверждён, Telegram подключён, …) */
  actionResolved?: boolean;
  /** Можно ли архивировать (false для unresolved action-required) */
  canArchive?: boolean;
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
