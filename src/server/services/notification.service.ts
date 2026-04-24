/**
 * Notification Service
 *
 * Single entry point for all in-app notifications + delivery dispatch.
 * Server-only — do not import in client components.
 *
 * Flow:
 *   createNotification(params) → saves Notification → dispatchDelivery(notification, user)
 *
 * All notify*() helpers are thin wrappers that resolve the owner userId
 * and call createNotification(). Route handlers should call these helpers,
 * not createNotification() directly.
 */

import prisma from "@/lib/prisma";
import { Prisma, type Notification as NotificationModel } from "@prisma/client";
import { NotificationType } from "@prisma/client";
import {
  NOTIFICATION_TYPES_BUSINESS,
  NOTIFICATION_TYPES_USER,
} from "@/lib/notifications/streamFilters";
import {
  WELCOME_NOTIFICATION_BODY,
  WELCOME_NOTIFICATION_TITLE,
} from "@/lib/notifications/welcomeNotification";
import { resolveNotificationAudience } from "@/lib/notifications/audience";
import { dispatchDelivery } from "./notificationDelivery.service";

export type NotificationStreamFilter = "user" | "business";

function mergeStreamFilter(
  base: Prisma.NotificationWhereInput,
  stream?: NotificationStreamFilter,
): Prisma.NotificationWhereInput {
  if (stream === "user") return { ...base, type: { in: NOTIFICATION_TYPES_USER } };
  if (stream === "business") return { ...base, type: { in: NOTIFICATION_TYPES_BUSINESS } };
  return base;
}

/**
 * Hide WELCOME notification from the feed when Telegram is already connected.
 * The DB record is preserved — only the feed query excludes it.
 * WELCOME is a legacy onboarding type; it is not part of the active USER settings model.
 */
function mergeHideWelcomeWhenTelegramConnected(
  base: Prisma.NotificationWhereInput,
  telegramConnected?: boolean,
): Prisma.NotificationWhereInput {
  if (telegramConnected !== true) return base;
  return {
    AND: [base, { NOT: { type: "WELCOME" } }],
  };
}

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  audience?: "USER" | "BUSINESS" | "ADMIN";
  title: string;
  body: string;
  ctaLabel?: string | null;
  ctaAction?: string | null;
  isPinned?: boolean;
  entityType?: string;
  entityId?: string;
}

/**
 * Core: create in-app notification record + dispatch delivery channels.
 * Never throws on delivery failure — delivery errors are recorded in NotificationDelivery.
 */
export async function createNotification(params: CreateNotificationParams) {
  const notification = await prisma.notification.create({
    data: {
      userId: params.userId,
      audience: params.audience ?? resolveNotificationAudience(params.type),
      type: params.type,
      title: params.title,
      body: params.body,
      ctaLabel: params.ctaLabel ?? null,
      ctaAction: params.ctaAction ?? null,
      isPinned: params.isPinned ?? false,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
    },
  });

  // Dispatch delivery async — fire and forget, never blocks the caller
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, email: true, role: true },
  });
  if (user) {
    dispatchDelivery(notification, user).catch((e) =>
      console.error("[notification] dispatchDelivery failed:", e),
    );
  }

  return notification;
}

/**
 * Send a one-time welcome notification after registration.
 * Uses the legacy WELCOME type — this is an onboarding record, not a settings category.
 * Deduplication: only one WELCOME per user is ever created.
 */
export async function notifyWelcomeNewUser(userId: string) {
  const existing = await prisma.notification.findFirst({
    where: { userId, type: "WELCOME" },
    select: { id: true },
  });
  if (existing) return null;

  return createNotification({
    userId,
    type: "WELCOME",
    title: WELCOME_NOTIFICATION_TITLE,
    body: WELCOME_NOTIFICATION_BODY,
    isPinned: true,
  });
}

// ── PLACE ─────────────────────────────────────────────────────────────────────

export async function notifyPlaceApproved(placeId: string, placeName: string, ownerId: string) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_APPROVED",
    title: "Место опубликовано",
    body: `Ваше место «${placeName}» успешно прошло модерацию и теперь доступно пользователям mamaGo.`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceNeedsChanges(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_NEEDS_CHANGES",
    title: "Требуются правки",
    body: `Ваше место «${placeName}» требует доработки. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceRejected(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_REJECTED",
    title: "Место отклонено",
    body: `Ваше место «${placeName}» было отклонено. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceUpdateApproved(placeId: string, placeName: string, ownerId: string) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_APPROVED",
    title: "Изменения опубликованы",
    body: `Изменения для места «${placeName}» успешно прошли модерацию и опубликованы.`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceUpdateNeedsRevision(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_NEEDS_REVISION",
    title: "Требуются правки",
    body: `Изменения для места «${placeName}» требуют правок. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

export async function notifyPlaceUpdateRejected(
  placeId: string,
  placeName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "PLACE_UPDATE_REJECTED",
    title: "Изменения отклонены",
    body: `Изменения для места «${placeName}» были отклонены. ${moderatorComment}`,
    entityType: "PLACE",
    entityId: placeId,
  });
}

// ── ACTIVITY ──────────────────────────────────────────────────────────────────

export async function notifyActivityApproved(activityId: string, activityName: string, ownerId: string) {
  return createNotification({
    userId: ownerId,
    type: "ACTIVITY_APPROVED",
    title: "Событие опубликовано",
    body: `Ваше событие «${activityName}» успешно прошло модерацию и теперь доступно пользователям mamaGo.`,
    entityType: "ACTIVITY",
    entityId: activityId,
  });
}

export async function notifyActivityNeedsChanges(
  activityId: string,
  activityName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "ACTIVITY_NEEDS_CHANGES",
    title: "Требуются правки",
    body: `Ваше событие «${activityName}» требует доработки. ${moderatorComment}`,
    entityType: "ACTIVITY",
    entityId: activityId,
  });
}

export async function notifyActivityRejected(
  activityId: string,
  activityName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "ACTIVITY_REJECTED",
    title: "Событие отклонено",
    body: `Ваше событие «${activityName}» было отклонено. ${moderatorComment}`,
    entityType: "ACTIVITY",
    entityId: activityId,
  });
}

// ── OFFER ─────────────────────────────────────────────────────────────────────

export async function notifyOfferApproved(offerId: string, offerName: string, ownerId: string) {
  return createNotification({
    userId: ownerId,
    type: "OFFER_APPROVED",
    title: "Предложение опубликовано",
    body: `Ваше предложение «${offerName}» успешно прошло модерацию и теперь доступно пользователям mamaGo.`,
    entityType: "OFFER",
    entityId: offerId,
  });
}

export async function notifyOfferNeedsChanges(
  offerId: string,
  offerName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "OFFER_NEEDS_CHANGES",
    title: "Требуются правки",
    body: `Ваше предложение «${offerName}» требует доработки. ${moderatorComment}`,
    entityType: "OFFER",
    entityId: offerId,
  });
}

export async function notifyOfferRejected(
  offerId: string,
  offerName: string,
  ownerId: string,
  moderatorComment: string,
) {
  return createNotification({
    userId: ownerId,
    type: "OFFER_REJECTED",
    title: "Предложение отклонено",
    body: `Ваше предложение «${offerName}» было отклонено. ${moderatorComment}`,
    entityType: "OFFER",
    entityId: offerId,
  });
}

// ── BUSINESS VERIFICATION ─────────────────────────────────────────────────────

export async function notifyBusinessVerified(businessId: string, businessName: string, ownerId: string) {
  return createNotification({
    userId: ownerId,
    type: "BUSINESS_VERIFIED",
    title: "Верификация пройдена",
    body: `Ваш бизнес «${businessName}» успешно верифицирован. Теперь вы можете публиковать места и события.`,
    entityType: "BUSINESS",
    entityId: businessId,
  });
}

export async function notifyBusinessRejected(
  businessId: string,
  businessName: string,
  ownerId: string,
  note: string,
) {
  return createNotification({
    userId: ownerId,
    type: "BUSINESS_REJECTED",
    title: "Верификация отклонена",
    body: `Верификация бизнеса «${businessName}» отклонена. ${note}`,
    entityType: "BUSINESS",
    entityId: businessId,
  });
}

export async function notifyBusinessNeedsInfo(
  businessId: string,
  businessName: string,
  ownerId: string,
  note: string,
) {
  return createNotification({
    userId: ownerId,
    type: "BUSINESS_NEEDS_INFO",
    title: "Требуется дополнительная информация",
    body: `Для верификации бизнеса «${businessName}» требуется дополнительная информация. ${note}`,
    entityType: "BUSINESS",
    entityId: businessId,
  });
}

// ── READ / QUERY ──────────────────────────────────────────────────────────────

export type UserNotificationsQueryOptions = {
  /** Если true — не отдаём WELCOME в списке (история в БД сохраняется). */
  telegramConnected?: boolean;
};

const notificationListOrderBy = [
  { isPinned: "desc" as const },
  { createdAt: "desc" as const },
];

/**
 * Единая лента: сначала непросмотренные (seenAt IS NULL), затем просмотренные;
 * внутри группы — закрепы выше, далее createdAt desc.
 */
export async function getUnifiedNotificationFeed(
  userId: string,
  limit: number,
  offset: number,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
): Promise<NotificationModel[]> {
  const where = mergeHideWelcomeWhenTelegramConnected(
    mergeStreamFilter({ userId }, stream),
    options?.telegramConnected,
  );
  return prisma.notification.findMany({
    where,
    orderBy: [
      { seenAt: { sort: "asc", nulls: "first" } },
      { isPinned: "desc" },
      { createdAt: "desc" },
    ],
    take: limit,
    skip: offset,
  });
}

export async function countUnifiedNotifications(
  userId: string,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
): Promise<number> {
  const where = mergeHideWelcomeWhenTelegramConnected(
    mergeStreamFilter({ userId }, stream),
    options?.telegramConnected,
  );
  return prisma.notification.count({ where });
}

/** Пометить все «новые» (seenAt IS NULL) как просмотренные — при открытии центра уведомлений. */
export async function markUnseenNotificationsAsSeen(
  userId: string,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
) {
  const now = new Date();
  const where = mergeHideWelcomeWhenTelegramConnected(
    mergeStreamFilter({ userId, seenAt: null }, stream),
    options?.telegramConnected,
  );
  return prisma.notification.updateMany({
    where,
    data: { seenAt: now, isRead: true, readAt: now },
  });
}

export async function getUnreadNotifications(
  userId: string,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
  take?: number,
) {
  const where = mergeHideWelcomeWhenTelegramConnected(
    mergeStreamFilter({ userId, seenAt: null }, stream),
    options?.telegramConnected,
  );
  return prisma.notification.findMany({
    where,
    orderBy: notificationListOrderBy,
    ...(take != null ? { take } : {}),
  });
}

export async function getReadNotifications(
  userId: string,
  limit = 80,
  offset = 0,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
) {
  const where = mergeHideWelcomeWhenTelegramConnected(
    mergeStreamFilter({ userId, seenAt: { not: null } }, stream),
    options?.telegramConnected,
  );
  return prisma.notification.findMany({
    where,
    orderBy: notificationListOrderBy,
    take: limit,
    skip: offset,
  });
}

/** @deprecated Используйте getUnifiedNotificationFeed */
export async function getUserNotifications(
  userId: string,
  limit = 50,
  offset = 0,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
) {
  return getUnifiedNotificationFeed(userId, limit, offset, stream, options);
}

export async function markNotificationAsRead(notificationId: string, userId: string) {
  const now = new Date();
  return prisma.notification.update({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: now, seenAt: now },
  });
}

export async function markAllNotificationsAsRead(userId: string) {
  const now = new Date();
  return prisma.notification.updateMany({
    where: { userId, seenAt: null },
    data: { isRead: true, readAt: now, seenAt: now },
  });
}

export async function getUnreadCount(
  userId: string,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
): Promise<number> {
  const where = mergeHideWelcomeWhenTelegramConnected(
    mergeStreamFilter({ userId, seenAt: null }, stream),
    options?.telegramConnected,
  );
  return prisma.notification.count({ where });
}

export async function getLatestActivePlanReminderNotification(
  userId: string,
  now = new Date(),
) {
  const activeSince = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  return prisma.notification.findFirst({
    where: {
      userId,
      scenario: "PLAN_EVENT_2H_BEFORE",
      audience: "USER",
      entityType: "PLAN_ITEM",
      createdAt: { gte: activeSince },
    },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      body: true,
      ctaLabel: true,
      ctaAction: true,
      createdAt: true,
      isRead: true,
      scenario: true,
      entityType: true,
      entityId: true,
    },
  });
}

/** После подключения Telegram — скрыть WELCOME из UI и снять непрочитанность. */
export async function markWelcomeNotificationsRead(userId: string) {
  const now = new Date();
  return prisma.notification.updateMany({
    where: {
      userId,
      type: "WELCOME",
      OR: [{ seenAt: null }, { isRead: false }],
    },
    data: { isRead: true, readAt: now, seenAt: now },
  });
}

/** Проверить, просмотрено ли welcome (для Telegram banner). */
export async function getWelcomeIsRead(userId: string): Promise<boolean> {
  const welcome = await prisma.notification.findFirst({
    where: { userId, type: "WELCOME" },
    select: { seenAt: true, isRead: true },
  });
  if (!welcome) return true;
  return welcome.seenAt != null || welcome.isRead;
}

export async function deleteOldNotifications(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  return prisma.notification.deleteMany({
    where: { seenAt: { not: null, lt: cutoffDate } },
  });
}

export async function notifyAdminModerationItemCreated(params: {
  userId: string;
  itemTitle: string;
  itemId?: string;
}) {
  return createNotification({
    userId: params.userId,
    audience: "ADMIN",
    type: "ADMIN_MODERATION_ITEM_CREATED",
    title: "Новый объект на модерации",
    body: params.itemTitle,
    entityType: "MODERATION_ITEM",
    entityId: params.itemId ?? undefined,
  });
}

export async function notifyUserPlanReminder(params: {
  userId: string;
  title: string;
  body: string;
  entityId?: string | null;
}) {
  return createNotification({
    userId: params.userId,
    audience: "USER",
    type: "REMINDER",
    title: params.title,
    body: params.body,
    entityType: "PLAN_ITEM",
    entityId: params.entityId ?? undefined,
  });
}
