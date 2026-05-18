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
import { validateNotificationRegistry } from "@/lib/notifications/notificationRegistry";
import { checkNotificationDedup } from "./notificationDedup.service";

// ─── Dev Validation ───────────────────────────────────────────────────────────

// Run registry validation in development
if (process.env.NODE_ENV === "development") {
  // Get all NotificationType enum values from Prisma
  const prismaTypes = Object.values(NotificationType);
  validateNotificationRegistry(prismaTypes);
}

// ─── Dev Validation ───────────────────────────────────────────────────────────

// Run registry validation in development
if (process.env.NODE_ENV === "development") {
  // Get all NotificationType enum values from Prisma
  const prismaTypes = Object.values(NotificationType);
  validateNotificationRegistry(prismaTypes);
}

export type NotificationStreamFilter = "user" | "business";

/**
 * Determine which notification surfaces (audiences) are accessible to a user.
 * This is the canonical source for "what notifications should this user see".
 */
export function getAccessibleSurfacesForUser(user: {
  id: string;
  role: string;
  business?: { id: string } | null;
}): Array<"USER" | "BUSINESS" | "ADMIN"> {
  const surfaces: Array<"USER" | "BUSINESS" | "ADMIN"> = ["USER"];
  
  if (user.business) {
    surfaces.push("BUSINESS");
  } else if (user.role === "BUSINESS_OWNER") {
    surfaces.push("BUSINESS");
  }

  if (user.role === "ADMIN") {
    surfaces.push("ADMIN");
  }
  
  return surfaces;
}

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

/**
 * Filter notifications by accessible surfaces (audiences).
 * This replaces stream-based filtering with audience-based filtering.
 */
function mergeAccessibleSurfacesFilter(
  base: Prisma.NotificationWhereInput,
  accessibleSurfaces: Array<"USER" | "BUSINESS" | "ADMIN">,
): Prisma.NotificationWhereInput {
  if (accessibleSurfaces.length === 0) {
    return { ...base, audience: { in: [] } };
  }
  return { ...base, audience: { in: accessibleSurfaces } };
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

/**
 * Send notification after successful email verification.
 * Uses SYSTEM type — account security event.
 */
export async function notifyEmailVerified(userId: string) {
  return createNotification({
    userId,
    type: "SYSTEM",
    audience: "USER",
    title: "Ваша почта подтверждена",
    body: "Теперь вы можете получать важные уведомления и восстанавливать доступ к аккаунту.",
    isPinned: false,
  });
}

// ── PLACE ─────────────────────────────────────────────────────────────────────

export async function notifyPlaceApproved(placeId: string, placeName: string, ownerId: string) {
  const dedup = await checkNotificationDedup(ownerId, "PLACE_APPROVED", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "PLACE_NEEDS_CHANGES", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "PLACE_REJECTED", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "PLACE_UPDATE_APPROVED", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "PLACE_UPDATE_NEEDS_REVISION", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "PLACE_UPDATE_REJECTED", "PLACE", placeId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "ACTIVITY_APPROVED", "ACTIVITY", activityId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "ACTIVITY_NEEDS_CHANGES", "ACTIVITY", activityId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "ACTIVITY_REJECTED", "ACTIVITY", activityId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "OFFER_APPROVED", "OFFER", offerId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "OFFER_NEEDS_CHANGES", "OFFER", offerId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "OFFER_REJECTED", "OFFER", offerId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "BUSINESS_VERIFIED", "BUSINESS", businessId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "BUSINESS_REJECTED", "BUSINESS", businessId);
  if (dedup.isDuplicate) return null;

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
  const dedup = await checkNotificationDedup(ownerId, "BUSINESS_NEEDS_INFO", "BUSINESS", businessId);
  if (dedup.isDuplicate) return null;

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
  /** Accessible surfaces (audiences) for the user */
  accessibleSurfaces?: Array<"USER" | "BUSINESS" | "ADMIN">;
};

const notificationListOrderBy = [
  { isPinned: "desc" as const },
  { createdAt: "desc" as const },
];

/**
 * Единая лента: сначала непросмотренные (seenAt IS NULL), затем просмотренные;
 * внутри группы — закрепы выше, далее createdAt desc.
 * Фильтрует по accessible surfaces вместо stream.
 */
export async function getUnifiedNotificationFeed(
  userId: string,
  limit: number,
  offset: number,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
): Promise<NotificationModel[]> {
  // If accessible surfaces are provided, use them; otherwise fall back to stream-based filtering
  let where: Prisma.NotificationWhereInput;
  
  if (options?.accessibleSurfaces && options.accessibleSurfaces.length > 0) {
    where = mergeAccessibleSurfacesFilter({ userId }, options.accessibleSurfaces);
  } else {
    where = mergeStreamFilter({ userId }, stream);
  }
  
  where = mergeHideWelcomeWhenTelegramConnected(where, options?.telegramConnected);
  
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
  let where: Prisma.NotificationWhereInput;
  
  if (options?.accessibleSurfaces && options.accessibleSurfaces.length > 0) {
    where = mergeAccessibleSurfacesFilter({ userId }, options.accessibleSurfaces);
  } else {
    where = mergeStreamFilter({ userId }, stream);
  }
  
  where = mergeHideWelcomeWhenTelegramConnected(where, options?.telegramConnected);
  
  return prisma.notification.count({ where });
}

/** Пометить все «новые» (seenAt IS NULL) как просмотренные — при открытии центра уведомлений. */
export async function markUnseenNotificationsAsSeen(
  userId: string,
  stream?: NotificationStreamFilter,
  options?: UserNotificationsQueryOptions,
) {
  const now = new Date();
  
  let where: Prisma.NotificationWhereInput;
  
  if (options?.accessibleSurfaces && options.accessibleSurfaces.length > 0) {
    where = mergeAccessibleSurfacesFilter({ userId, seenAt: null }, options.accessibleSurfaces);
  } else {
    where = mergeStreamFilter({ userId, seenAt: null }, stream);
  }
  
  where = mergeHideWelcomeWhenTelegramConnected(where, options?.telegramConnected);
  
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
  let where: Prisma.NotificationWhereInput;
  
  if (options?.accessibleSurfaces && options.accessibleSurfaces.length > 0) {
    where = mergeAccessibleSurfacesFilter({ userId, seenAt: null }, options.accessibleSurfaces);
  } else {
    where = mergeStreamFilter({ userId, seenAt: null }, stream);
  }
  
  where = mergeHideWelcomeWhenTelegramConnected(where, options?.telegramConnected);
  
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
  let where: Prisma.NotificationWhereInput;
  
  if (options?.accessibleSurfaces && options.accessibleSurfaces.length > 0) {
    where = mergeAccessibleSurfacesFilter({ userId, seenAt: { not: null } }, options.accessibleSurfaces);
  } else {
    where = mergeStreamFilter({ userId, seenAt: { not: null } }, stream);
  }
  
  where = mergeHideWelcomeWhenTelegramConnected(where, options?.telegramConnected);
  
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
  let where: Prisma.NotificationWhereInput;
  
  if (options?.accessibleSurfaces && options.accessibleSurfaces.length > 0) {
    where = mergeAccessibleSurfacesFilter({ userId, seenAt: null }, options.accessibleSurfaces);
  } else {
    where = mergeStreamFilter({ userId, seenAt: null }, stream);
  }
  
  where = mergeHideWelcomeWhenTelegramConnected(where, options?.telegramConnected);
  
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

// ── BOOKING ───────────────────────────────────────────────────────────────────

import {
  buildBookingNotificationBody,
  type BookingNotificationBodyInput,
} from "./booking/booking.formatters";
import { resolveBookingSourceType } from "./booking/booking.types";

export interface NotifyBookingCreatedParams {
  /** userId владельца бизнеса (получатель уведомления) */
  ownerUserId: string;
  bookingId: string;
  offerId?: string | null;
  offerTitle?: string | null;
  activityId?: string | null;
  activityTitle?: string | null;
  placeId?: string | null;
  placeTitle?: string | null;
  campShiftId?: string | null;
  campShiftTitle?: string | null;
  campShiftDateFrom?: string | null;
  campShiftDateTo?: string | null;
  customerName: string;
  childName?: string | null;
  childAge?: number | null;
}

/**
 * Уведомление бизнесу о новой заявке на запись.
 * Тело строится через buildBookingNotificationBody — без лагерь-специфичных assumptions.
 */
export async function notifyBookingCreated(params: NotifyBookingCreatedParams) {
  const sourceType = resolveBookingSourceType({
    campShiftId: params.campShiftId ?? null,
    offerId: params.offerId ?? null,
    activityId: params.activityId ?? null,
    placeId: params.placeId ?? null,
  });

  const bodyInput: BookingNotificationBodyInput = {
    sourceType,
    offerTitle: params.offerTitle ?? null,
    activityTitle: params.activityTitle ?? null,
    placeTitle: params.placeTitle ?? null,
    campShiftTitle: params.campShiftTitle ?? null,
    campShiftDateFrom: params.campShiftDateFrom ?? null,
    campShiftDateTo: params.campShiftDateTo ?? null,
    customerName: params.customerName,
    childName: params.childName ?? null,
    childAge: params.childAge ?? null,
  };

  const body = buildBookingNotificationBody(bodyInput);

  return createNotification({
    userId: params.ownerUserId,
    audience: "BUSINESS",
    type: "BOOKING_CREATED",
    title: "Новая заявка",
    body,
    entityType: "BOOKING",
    entityId: params.bookingId,
    ctaLabel: "Открыть заявки",
    ctaAction: "/business/bookings",
  });
}

// ── USER BOOKING LIFECYCLE ────────────────────────────────────────────────────

export interface NotifyUserBookingParams {
  /** userId владельца заявки (получатель уведомления) */
  userId: string;
  bookingId: string;
  /** Название активности/предложения/места (для тела уведомления) */
  publicationTitle?: string | null;
}

/**
 * Уведомление пользователю: бизнес подтвердил заявку.
 * Вызывается при переходе NEW → CONFIRMED.
 * Dedup: one per status change (no time window)
 */
export async function notifyUserBookingConfirmed(params: NotifyUserBookingParams) {
  // Check dedup
  const dedup = await checkNotificationDedup(
    params.userId,
    "BOOKING_CONFIRMED",
    "BOOKING",
    params.bookingId,
  );
  if (dedup.isDuplicate) {
    console.warn("[notification] BOOKING_CONFIRMED deduplicated:", params.bookingId);
    return null;
  }

  const title = params.publicationTitle ? `«${params.publicationTitle}»` : "Ваша заявка";
  return createNotification({
    userId: params.userId,
    audience: "USER",
    type: "BOOKING_CONFIRMED",
    title: "Заявка подтверждена",
    body: `${title} подтверждена. Ждём вас!`,
    entityType: "BOOKING",
    entityId: params.bookingId,
    ctaLabel: "Мои записи",
    ctaAction: "/me/bookings",
  });
}

/**
 * Уведомление пользователю: бизнес отклонил заявку.
 * Вызывается при переходе NEW|CONFIRMED → REJECTED.
 * Dedup: one per status change (no time window)
 */
export async function notifyUserBookingCancelled(params: NotifyUserBookingParams) {
  // Check dedup
  const dedup = await checkNotificationDedup(
    params.userId,
    "BOOKING_CANCELLED",
    "BOOKING",
    params.bookingId,
  );
  if (dedup.isDuplicate) {
    console.warn("[notification] BOOKING_CANCELLED deduplicated:", params.bookingId);
    return null;
  }

  const title = params.publicationTitle ? `«${params.publicationTitle}»` : "Ваша заявка";
  return createNotification({
    userId: params.userId,
    audience: "USER",
    type: "BOOKING_CANCELLED",
    title: "Заявка отклонена",
    body: `${title} была отклонена. Вы можете подать новую заявку.`,
    entityType: "BOOKING",
    entityId: params.bookingId,
    ctaLabel: "Мои записи",
    ctaAction: "/me/bookings",
  });
}

/**
 * Уведомление пользователю: заявка завершена.
 * Вызывается при переходе CONFIRMED → COMPLETED.
 * Dedup: one per status change (no time window)
 */
export async function notifyUserBookingCompleted(params: NotifyUserBookingParams) {
  // Check dedup
  const dedup = await checkNotificationDedup(
    params.userId,
    "BOOKING_COMPLETED",
    "BOOKING",
    params.bookingId,
  );
  if (dedup.isDuplicate) {
    console.warn("[notification] BOOKING_COMPLETED deduplicated:", params.bookingId);
    return null;
  }

  const title = params.publicationTitle ? `«${params.publicationTitle}»` : "Ваша заявка";
  return createNotification({
    userId: params.userId,
    audience: "USER",
    type: "BOOKING_COMPLETED",
    title: "Заявка завершена",
    body: `${title} завершена. Спасибо, что выбрали нас!`,
    entityType: "BOOKING",
    entityId: params.bookingId,
    ctaLabel: "Мои записи",
    ctaAction: "/me/bookings",
  });
}

/**
 * Уведомление пользователю: запрос отзыва после завершения.
 * Вызывается после BOOKING_COMPLETED, если feedback flow доступен.
 * Dedup: one per booking completion (no time window)
 *
 * TODO: Когда появится страница /me/bookings/:id с формой отзыва,
 * обновить ctaAction на `/me/bookings/${params.bookingId}`.
 */
export async function notifyUserBookingFeedbackRequest(params: NotifyUserBookingParams) {
  // Check dedup
  const dedup = await checkNotificationDedup(
    params.userId,
    "BOOKING_FEEDBACK_REQUEST",
    "BOOKING",
    params.bookingId,
  );
  if (dedup.isDuplicate) {
    console.warn("[notification] BOOKING_FEEDBACK_REQUEST deduplicated:", params.bookingId);
    return null;
  }

  const title = params.publicationTitle ? `«${params.publicationTitle}»` : "посещение";
  return createNotification({
    userId: params.userId,
    audience: "USER",
    type: "BOOKING_FEEDBACK_REQUEST",
    title: "Как прошло?",
    body: `Поделитесь впечатлениями о ${title}. Ваш отзыв поможет другим родителям.`,
    entityType: "BOOKING",
    entityId: params.bookingId,
    ctaLabel: "Оставить отзыв",
    ctaAction: "/me/bookings",
  });
}
